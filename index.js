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
  try {
    cep = cep.replace(/\D/g, '');
    
    if (cep.length !== 8) {
      throw new Error('CEP deve ter 8 dígitos');
    }

    if (cache.cep.has(cep)) {
      return cache.cep.get(cep) + '\n( dados em cache)';
    }

    const { data } = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, {
      timeout: 5000
    });

    if (data.erro) {
      throw new Error('CEP não encontrado');
    }

    const resultado = `📦 *Resultado para ${data.cep}*\n\n` +
                     `📍 Logradouro: ${data.logradouro || '-'}\n` +
                     `🏘️ Bairro: ${data.bairro || '-'}\n` +
                     `🏙️ Cidade: ${data.localidade}/${data.uf}\n` +
                     `🔢 Código IBGE: ${data.ibge || '-'}`;

    cache.cep.set(cep, resultado);
    return resultado;

  } catch (error) {
    console.error('Erro na consulta CEP:', error.message);
    throw new Error(`Falha ao consultar CEP: ${error.message}`);
  }
}


async function consultarIP(ip) {
  try {
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      throw new Error('Formato de IP inválido');
    }

    if (cache.ip.has(ip)) {
      return cache.ip.get(ip) + '\n(🔄 dados em cache)';
    }

    const { data } = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,zip,lat,lon,isp,org,as,query`,
      { timeout: 5000 }
    );

    if (data.status !== 'success') {
      throw new Error(data.message || 'IP não encontrado');
    }

    const resultado = `🌐 *Informações do IP ${data.query}*\n\n` +
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

  } catch (error) {
    console.error('Erro na consulta IP:', error.message);
    throw new Error(`Falha ao consultar IP: ${error.message}`);
  }
}

async function handleCommands(sock, from, msg, text) {
  const command = text.toLowerCase().trim();

if (command.startsWith('!bin ')) {
  const bin = command.slice(5).replace(/\D/g, "").slice(0, 6);

  if (bin.length !== 6) {
    await sock.sendMessage(from, { text: " Envie um BIN com 6 dígitos. Exemplo: !bin 411111" });
    return;
  }

  try {
    const { data } = await axios.get(`https://lookup.binlist.net/${bin}`);

    const resposta =
      `🏦 *Informações do BIN ${bin}*\n\n` +
      `💳 Bandeira: ${data.scheme?.toUpperCase() || "Desconhecida"}\n` +
      `🏦 Banco: ${data.bank?.name || "Não disponível"}\n` +
      `🌍 País: ${data.country?.name || "Desconhecido"}\n` +
      `💼 Tipo: ${data.type?.toUpperCase() || "Desconhecido"}\n`;

    await sock.sendMessage(from, { text: resposta });
  } catch (err) {
    await sock.sendMessage(from, { text: " Erro ao consultar o BIN. Talvez inválido ou fora do ar." });
  }

  return;
}

  if (command === '!menu') {
 const menu = `📋 *Menu do LipeLink ✅*\n\n` +
             `🟢 !on - Verifica se o bot está online\n` +
             `📦 !cep 01001000 - Consulta CEP\n` +
             `🌐 !ip 8.8.8.8 - Consulta informações de IP\n` +
             `💳 !bin 411111 - Verifica dados do cartão\n` +
             `🖼️ !fig - Cria figurinha de imagem ou vídeo\n` +
             `❓ !menu - Mostra este menu\n` +
             `📝 !pdf - ele transforma uma foto em pdf`;

    await sock.sendMessage(from, { text: menu });
    return;
  }

  if (command === '!on') {
    await sock.sendMessage(from, { text: '✅ To on lendario! ' });
    return;
  }


    if (text?.toLowerCase() === "!fig") {
      if (msg.message.imageMessage) {
        const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger: P() });
        const resizedImage = await sharp(buffer)
          .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();

        await sock.sendMessage(from, { sticker: resizedImage });
        return;
      } else if (msg.message.videoMessage) {
        const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger: P() });
        await sock.sendMessage(from, { sticker: buffer });
        return;
      } else {
        await sock.sendMessage(from, { text: "e a imagem??" });
        return;
      }
    }

if (text?.toLowerCase() === "!pdf") {
  if (msg.message.imageMessage) {
    try {
      const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger: P() });

      const pdfPath = `./temp-${Date.now()}.pdf`;

      await sharp(buffer)
        .resize({ width: 1240 })
        .toFormat('pdf')
        .toFile(pdfPath);

      const pdfBuffer = fs.readFileSync(pdfPath);
      await sock.sendMessage(from, {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: 'imagem_convertida.pdf'
      });

      fs.unlinkSync(pdfPath);
    } catch (err) {
      await sock.sendMessage(from, { text: " Erro ao converter imagem em PDF." });
    }
  } else {
    await sock.sendMessage(from, {
      text: "Envie uma imagem junto com o comando !pdf para converter em arquivo PDF."
    });
  }
  return;
}




  if (command.startsWith('!cep ')) {
    try {
      const cep = command.slice(5).trim();
      await sock.sendMessage(from, { text: '🔍 Consultando CEP...' });
      const resultado = await consultarCEP(cep);
      await sock.sendMessage(from, { text: resultado });
    } catch (error) {
      await sock.sendMessage(from, { 
        text: ` Erro: ${error.message}\nFormato correto: !cep 01001000`
      });
    }
    return;
  }

  if (command.startsWith('!ip ')) {
    try {
      const ip = command.slice(4).trim();
      await sock.sendMessage(from, { text: '🔍 Consultando IP...' });
      const resultado = await consultarIP(ip);
      await sock.sendMessage(from, { text: resultado });
    } catch (error) {
      await sock.sendMessage(from, { 
        text: ` Erro: ${error.message}\nExemplo: !ip 8.8.8.8`
      });
    }
    return;
  }

  return;
}

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    const sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('Escaneie o QR Code abaixo:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('Reconectando...');
          startBot();
        }
      } else if (connection === 'open') {
        console.log(' Conectado');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      try {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = getMessageText(msg);
        await handleCommands(sock, from, msg, text);
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
      }
    });

  } catch (error) {
    console.error('Erro ao iniciar bot:', error);
    process.exit(1);
  }
}


console.log(' Iniciando bot WhatsApp...');
startBot().catch(err => {
  console.error(' Erro fatal:', err);
  process.exit(1);
});