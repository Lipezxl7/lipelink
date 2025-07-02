require('dotenv').config();
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const translate = require('@iamtraction/google-translate');


const logger = P({ level: 'silent' });
const authFolder = 'auth';

const cache = {
  cep: new Map(),
  ip: new Map()
};

function getMessageText(msg) {
  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    ''
  );
}

async function consultarCEP(cep) {
  cep = cep.replace(/\D/g, '');
  if (cep.length !== 8) throw new Error('CEP deve ter 8 dígitos');

  if (cache.cep.has(cep)) return cache.cep.get(cep) + '\n( dados em cache)';

  const { data } = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
  if (data.erro) throw new Error('CEP não encontrado');

  const resultado =
    `📦 *Resultado para ${data.cep}*\n\n` +
    `📍 Logradouro: ${data.logradouro || '-'}\n` +
    `🏘️ Bairro: ${data.bairro || '-'}\n` +
    `🏙️ Cidade: ${data.localidade}/${data.uf}\n` +
    `🔢 Código IBGE: ${data.ibge || '-'}`;

  cache.cep.set(cep, resultado);
  return resultado;
}

async function consultarIP(ip) {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) throw new Error('ta errado esse ip tenta denovo');

  if (cache.ip.has(ip)) return cache.ip.get(ip) + '\n(🔄 dados em cache)';

  const { data } = await axios.get(
    `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,zip,lat,lon,isp,org,as,query`
  );
  if (data.status !== 'success') throw new Error(data.message || 'ip não encontrado');

  const resultado =
    `🌐 *Informações do IP ${data.query}*\n\n` +
    `🛡️ Status: ${data.status}\n` +
    `🗺️ País: ${data.country}\n` +
    `🏙️ Cidade: ${data.city} (${data.regionName})\n` +
    `📮 CEP: ${data.zip || 'N/D'}\n` +
    `📡 Provedor: ${data.isp}\n` +
    `🏢 Organização: ${data.org}\n` +
    `📍 Localização: ${data.lat}, ${data.lon}\n` +
    `🔢 AS: ${data.as}`;

  cache.ip.set(ip, resultado);
  return resultado;
}

async function handleCommands(sock, from, msg, text) {
  const command = text.toLowerCase().trim();

  if (command === '!menu') {
    const menu = `*Menu do LipeLink ✅*\n\n` +
  `🟢 !on - Verifica se o bot está online\n` +
  `📦 !cep - Consulta CEP\n` +
  `🌐 !ip - Consulta informações de IP\n` +
  `💳 !bin - Verifica dados do cartão\n` +
  `🖼️ !fig - Cria figurinha de imagem ou vídeo\n` +
  `📝 !pdf - Transforma imagem em PDF\n` +
  `🌍 !tdr br [texto] - Traduz para Português\n` +
  `🌍 !tdr en [texto] - Traduz para Inglês\n` +
  `❓ !menu - Mostra este menu`;
    return sock.sendMessage(from, { text: menu });
  }

  if (command === '!on') {
    return sock.sendMessage(from, { text: '✅ To on lendario!' });
  }

  if (command === '!fig') {
    if (msg.message.imageMessage || msg.message.videoMessage) {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() });

      if (msg.message.imageMessage) {
        const resized = await sharp(buffer)
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();
        return sock.sendMessage(from, { sticker: resized });
      }

      return sock.sendMessage(from, { sticker: buffer });
    }

    return sock.sendMessage(from, { text: 'e a imagem?? /fig [imagem ou video]' });
  }

  if (command === '!pdf') {
    if (!msg.message.imageMessage) return sock.sendMessage(from, { text: 'cade a imagem??.' });

    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() });
      const pdfDoc = await PDFDocument.create();
      const image = await pdfDoc.embedJpg(buffer).catch(() => pdfDoc.embedPng(buffer));
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      const pdfBytes = await pdfDoc.save();

      return sock.sendMessage(from, {
        document: Buffer.from(pdfBytes),
        mimetype: 'application/pdf',
        fileName: 'imagem_convertida.pdf'
      });
    } catch (err) {
      console.error('Erro PDF:', err);
      return sock.sendMessage(from, { text: 'deu erro manda denovo.' });
    }
  }

  if (command.startsWith('!bin ')) {
    const bin = command.slice(5).replace(/\D/g, '').slice(0, 6);
    if (bin.length !== 6) return sock.sendMessage(from, { text: 'Envie um bin com 6 numeros. Exemplo: !bin 411111' });

    try {
      const { data } = await axios.get(`https://lookup.binlist.net/${bin}`);
      const resposta = `🏦 *Informações do BIN ${bin}*\n\n` +
        `💳 Bandeira: ${data.scheme?.toUpperCase() || 'Desconhecida'}\n` +
        `🏦 Banco: ${data.bank?.name || 'Não disponível'}\n` +
        `🌍 País: ${data.country?.name || 'Desconhecido'}\n` +
        `💼 Tipo: ${data.type?.toUpperCase() || 'Desconhecido'}`;
      return sock.sendMessage(from, { text: resposta });
    } catch {
      return sock.sendMessage(from, { text: 'Erro ao consultar a bin' });
    }
  }

  if (command.startsWith('!cep ')) {
    const cep = command.slice(5).trim();
    try {
      await sock.sendMessage(from, { text: '🔍 Consultando CEP...' });
      const resultado = await consultarCEP(cep);
      return sock.sendMessage(from, { text: resultado });
    } catch (err) {
      return sock.sendMessage(from, { text: `Erro: ${err.message}\nExemplo: !cep 10101010` });
    }
  }

  if (command.startsWith('!ip ')) {
    const ip = command.slice(4).trim();
    try {
      await sock.sendMessage(from, { text: '🔍 Consultando IP...' });
      const resultado = await consultarIP(ip);
      return sock.sendMessage(from, { text: resultado });
    } catch (err) {
      return sock.sendMessage(from, { text: `Erro: ${err.message}\nExemplo: !ip 8.8.8.8` });
    }
  }

if (command.startsWith('!tdr br ')) {
  const texto = command.slice(8).trim();

  if (!texto) {
    await sock.sendMessage(from, { text: 'Digite algo para traduzir.\nEx: !tdr br      hello world' });
    return;
  }

  try {
    const res = await translate(texto, { to: 'pt' });

    await sock.sendMessage(from, {
      text: ` Texto detectado: *${res.from.language.iso}*\n\n Original: ${texto}\n\n Tradução: ${res.text}`
    });
  } catch (err) {
    console.error('Erro ao traduzir:', err);
    await sock.sendMessage(from, { text: 'Erro ao traduzir para português' });

  }

  return;
}

if (command.startsWith('!tdr en ')) {
  const texto = command.slice(8).trim();

  if (!texto) {
    await sock.sendMessage
    return;
  }

  try {
    const res = await translate(texto, { to: 'en' });

    await sock.sendMessage(from, {
      text: ` Texto detectado: *${res.from.language.iso}*\n\n Original: ${texto}\n\n Tradução: ${res.text}`
    });
  } catch (err) {
    console.error('Erro ao traduzir para inglês:', err);
    await sock.sendMessage(from, { text: 'Erro ao traduzir' });
  }

  return;
}

}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const sock = makeWASocket({ auth: state, logger, printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) startBot();
    } else if (connection === 'open') {
      console.log('conectado');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = getMessageText(msg);
    await handleCommands(sock, from, msg, text);
  });
}

console.log(' Iniciando bot');
startBot();