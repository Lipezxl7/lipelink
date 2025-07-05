require('dotenv').config()

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require('@whiskeysockets/baileys')

const qrcode = require('qrcode-terminal')
const axios = require('axios')
const sharp = require('sharp')
const fs = require('fs')
const P = require('pino')
const { Boom } = require('@hapi/boom')
const { PDFDocument } = require('pdf-lib')
const translate = require('@iamtraction/google-translate')

const logger = P({ level: 'silent' })
const authFolder = './auth'

const cache = {
  cep: new Map(),
  ip: new Map()
}

function pegarTextoMensagem(msg) {
  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    ''
  )
}

async function buscarCEP(cep) {
  const apenasNumeros = cep.replace(/\D/g, '')
  if (apenasNumeros.length !== 8) throw new Error('CEP inválido')

  if (cache.cep.has(apenasNumeros)) {
    return cache.cep.get(apenasNumeros) + '\n(cache)'
  }

  const res = await axios.get(`https://viacep.com.br/ws/${apenasNumeros}/json/`)
  if (res.data.erro) throw new Error('CEP não encontrado')
  const data = res.data

  const msg = 
  `📦 *Resultado para ${data.cep}*\n\n` +
    `📍 Logradouro: ${data.logradouro || '-'}\n` +
    `🏘️ Bairro: ${data.bairro || '-'}\n` +
    `🏙️ Cidade: ${data.localidade}/${data.uf}\n` +
    `🔢 Código IBGE: ${data.ibge || '-'}`;

  cache.cep.set(apenasNumeros, msg)
  return msg
}

async function buscarIP(ip) {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    throw new Error('IP parece inválido.')
  }

  if (cache.ip.has(ip)) {
    return cache.ip.get(ip) + '\n(cache)'
  }

  const { data } = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,zip,lat,lon,isp,org,as,query`)
  if (data.status !== 'success') throw new Error(data.message || 'IP não encontrado')

  const info =
  `🌐 *Informações do IP ${data.query}*\n\n` +
    `🛡️ Status: ${data.status}\n` +
    `🗺️ País: ${data.country}\n` +
    `🏙️ Cidade: ${data.city} (${data.regionName})\n` +
    `📮 CEP: ${data.zip || 'N/D'}\n` +
    `📡 Provedor: ${data.isp}\n` +
    `🏢 Organização: ${data.org}\n` +
    `📍 Localização: ${data.lat}, ${data.lon}\n` +
    `🔢 AS: ${data.as}`;

  cache.ip.set(ip, info)
  return info
}

async function tratarComandos(sock, de, msg, txt) {
  const cmd = txt.trim().toLowerCase()

  if (cmd === '!on') {
    return sock.sendMessage(de, { text: 'to on lendario' }) 
  }

  if (cmd === '!menu') {
    const lista = `*Menu do LipeLink ✅*\n\n` +
  `🟢 !on - Verifica se o bot está online\n` +
  `📦 !cep - Consulta CEP\n` +
  `🌐 !ip - Consulta informações de IP\n` +
  `💳 !bin - Verifica dados do cartão\n` +
  `🖼️ !fig - Cria figurinha de imagem(original a imagem)\n` +
  `🖼️ !fig2 - Cria figurinha de imagem(quadrado)\n` +
  `📝 !pdf - Transforma imagem em PDF\n` +
  `🌍 !tdr br [texto] - Traduz para Português\n` +
  `🌍 !tdr en [texto] - Traduz para Inglês\n` +
  `❓ !menu - Mostra este menu`;
    return sock.sendMessage(de, { text: lista })
  }

  if (cmd.startsWith('!cep ')) {
    const cep = cmd.slice(5).trim()
    try {
      const resposta = await buscarCEP(cep)
      return sock.sendMessage(de, { text: resposta })
    } catch (e) {
      return sock.sendMessage(de, { text: 'Erro: ' + e.message })
    }
  }

  if (cmd.startsWith('!ip ')) {
    const ip = cmd.slice(4).trim()
    try {
      const dados = await buscarIP(ip)
      return sock.sendMessage(de, { text: dados })
    } catch (e) {
      return sock.sendMessage(de, { text: 'Erro: ' + e.message })
    }
  }

  if (cmd.startsWith('!bin ')) {
    const bin = cmd.slice(5).replace(/\D/g, '').slice(0, 6)
    if (bin.length !== 6) {
      return sock.sendMessage(de, { text: 'Formato de BIN inválido. Use 6 dígitos.' })
    }

    try {
      const { data } = await axios.get(`https://lookup.binlist.net/${bin}`)
      const info = `🏦 *Informações do BIN ${bin}*\n\n` +
        `💳 Bandeira: ${data.scheme?.toUpperCase() || 'Desconhecida'}\n` +
        `🏦 Banco: ${data.bank?.name || 'Não disponível'}\n` +
        `🌍 País: ${data.country?.name || 'Desconhecido'}\n` +
        `💼 Tipo: ${data.type?.toUpperCase() || 'Desconhecido'}`;
      return sock.sendMessage(de, { text: info })
    } catch {
      return sock.sendMessage(de, { text: 'bin errada ou invalida' }) 
    }
  }

  if (cmd === '!fig') {
    if (msg.message.imageMessage || msg.message.videoMessage) {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() })

      if (msg.message.imageMessage) {
        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer()
        return sock.sendMessage(de, { sticker })
      }

      return sock.sendMessage(de, { sticker: buffer })
    } else {
      return sock.sendMessage(de, { text: 'cade imagem??' }) 
    }
  }



  if (cmd === '!fig2') {
    if (msg.message.imageMessage || msg.message.videoMessage) {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() })

      if (msg.message.imageMessage) {
        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: 'cover', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer()
        return sock.sendMessage(de, { sticker })
      }

      return sock.sendMessage(de, { sticker: buffer })
    } else {
      return sock.sendMessage(de, { text: 'cade imagem??' }) 
    }
  }

  if (cmd === '!pdf') {
    if (!msg.message.imageMessage) return sock.sendMessage(de, { text: 'cade a imagem??' }) 

    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() })
      const pdfDoc = await PDFDocument.create()

      let img
      try {
        img = await pdfDoc.embedJpg(buffer)
      } catch {
        try {
          img = await pdfDoc.embedPng(buffer)
        } catch {
          return sock.sendMessage(de, { text: 'Imagem inválida para PDF ' })
        }
      }

      const pg = pdfDoc.addPage([img.width, img.height])
      pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      const file = await pdfDoc.save()

      return sock.sendMessage(de, {
        document: Buffer.from(file),
        mimetype: 'application/pdf',
        fileName: 'lipelink.pdf'
      })
    } catch (e) {
      return sock.sendMessage(de, { text: 'deu erro ' }) 
    }
  }

  if (cmd.startsWith('!tdr br ')) {
    const texto = cmd.slice(8).trim()
    if (!texto) return sock.sendMessage(de, { text: 'escreve algo em ingles' }) 

    try {
      const res = await translate(texto, { to: 'pt' })
      return sock.sendMessage(de, {
        text: ` *Tradução (para PT):*\n\n *idioma detectado*: ${res.from.language.iso}\n\n *Original*: ${texto}\n\n *Tradução*: ${res.text}`
      })
    } catch (e) {
      return sock.sendMessage(de, { text: 'deu erro' })
    }
  }

  if (cmd.startsWith('!tdr en ')) {
    const texto = cmd.slice(8).trim()
    if (!texto) return sock.sendMessage(de, { text: 'escreve algo em portugues' }) 

    try {
      const res = await translate(texto, { to: 'en' })
      return sock.sendMessage(de, {
        text: ` *Translation (EN)*:\n\n *idioma detectado*: ${res.from.language.iso}\n\n *Original*: ${texto}\n\n*Tradução*: ${res.text}`
      })
    } catch (e) {
      return sock.sendMessage(de, { text: 'deu erro' }) 
    }
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder)
  const sock = makeWASocket({ auth: state, logger, printQRInTerminal: true })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true })

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) start()
    } else if (connection === 'open') {
      console.log(' conectado') 
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const de = msg.key.remoteJid
    const txt = pegarTextoMensagem(msg)

    await tratarComandos(sock, de, msg, txt)
  })
}

console.log('bot ligando...') 
start()