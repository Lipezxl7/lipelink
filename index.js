const crypto = require('crypto')
if (!global.crypto) {
  global.crypto = crypto
}

require('dotenv').config()

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  delay
} = require('@whiskeysockets/baileys')

const axios = require('axios')
const sharp = require('sharp')
const fs = require('fs')
const P = require('pino')
const { PDFDocument } = require('pdf-lib')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
ffmpeg.setFfmpegPath(ffmpegPath)
const path = require('path')
const translate = require('@iamtraction/google-translate')
const { text } = require('stream/consumers')
const qrcode = require('qrcode')
const FormData = require('form-data')
const logger = P({ level: 'silent' })
const authFolder = './auth'
const removeBgKey = 'rM6ncc3ZRBMdSAc8im2ZodtJ'
const monitorando = new Set();
const estadoTraducao = new Map()
const historicoIA = new Map();
const modoConversa = new Set();
const emailSession = new Map();
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
    `📦 *Resultado Do CEP: ${data.cep}*\n\n` +
    `📍 Rua: ${data.logradouro || '-'}\n` +
    `🏘️ Bairro: ${data.bairro || '-'}\n` +
    `🏙️ Cidade: ${data.localidade}/${data.uf}\n` +
    `📞 DDD: ${data.ddd || '-'}\n` +
    `⛰️ Região: ${data.regiao || '-'}\n` +
    `🔢 Código IBGE: ${data.ibge || '-'}`;
    

  cache.cep.set(apenasNumeros, msg)
  return msg
}

async function tratarComandos(sock, de, msg, txt) {
  const cmd = txt.trim().toLowerCase()

if (cmd== '!git') {
  return sock.sendMessage(de, { text: 'https://github.com/Lipezxl7/lipelink'})
}

  if (cmd === '!on') {
    return sock.sendMessage(de, { text: 'to on lendario' })
  }

  if (cmd === '!menu') {
    const lista = `*Menu do Lipelink ✅*\n\n` +
      `🟢 !on - Verifica se o bot está online\n` +
      `📦 !cep - Consulta CEP\n` +
      `⬛ !qr - Gera um QRcode\n` +
      `🌐 !link - Encurtar um Link\n\n\n` +
      
      
      `📖 !ler - Pega Todo texto Da Imagem\n` +
      `🤖 !ia - converse com a IA\n` +
      `🖌️ !bg -  Remove o fundo da imagem\n` +
      `🎨 !img - Faz imagem com IA\n\n\n` +


      `🎵 !mp3 - Transforma video em audio\n` +
      `🖼️ !fig - Cria figurinha de imagem\n` +
      `🖼️ !fig2 - Cria figurinha de imagem(quadrado)\n` +
      `📝 !pdf - Transforma imagem em PDF\n\n\n` +
      
      `🔒 !senha [digitos] - Gera Senha Aleatoria\n` +
      `🌍 !tdr [texto] - Traduz Texto\n` +
      `🪙 !moeda - Lista de Cotação\n` +
      `❓ !menu - Mostra este menu\n\n` +
      `*AVISO*: Se você for falar com a IA so precisa dar o comando (!ia) que voce entrará no modo conversa\n`;
      
    try {
       
        const caminhoImagem = path.join(__dirname, 'menu.jpg');
        
        
        if (fs.existsSync(caminhoImagem)) {
            const imagemLocal = fs.readFileSync(caminhoImagem);
            return sock.sendMessage(de, { image: imagemLocal, caption: lista })
        } else {
            console.log('Arquivo menu.jpg não encontrado na pasta')
            return sock.sendMessage(de, { text: lista })
        }
    } catch (e) {
        console.log('Erro ao enviar imagem:', e)
        return sock.sendMessage(de, { text: lista })
    }
  }

  if (cmd.startsWith('!senha')) {
      
      let tamanho = parseInt(cmd.slice(6).trim());
      if (!tamanho || tamanho > 100) return sock.sendMessage(de, { text: '*Limite de 100 Caracteres*' })

      const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*()';
      let senha = '';

      for (let i = 0; i < tamanho; i++) {
          const aleatorio = Math.floor(Math.random() * caracteres.length);
          senha += caracteres[aleatorio];
      }

      return sock.sendMessage(de, { text: ` *Nova Senha Gerada:*\n\n\`${senha}\`` });
  }

  
  if (cmd.startsWith('!link ')) {
      const urlOriginal = txt.slice(6).trim();
      
      if (!urlOriginal) return sock.sendMessage(de, { text: 'Cole o link na frente. Ex: !link https://google.com' });

      
      await sock.sendPresenceUpdate('composing', de);

      try {
          
          const { data } = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(urlOriginal)}`);

          const msg = `*LINK ENCURTADO*\n\n` +
                      ` *LINK* ${data}\n` ;

          return sock.sendMessage(de, { text: msg });

      } catch (e) {
          return sock.sendMessage(de, { text: ' Erro Verifique se o link está certo' });
      }
  }
  
  if (cmd === '!ler') {
      if (!msg.message.imageMessage) return sock.sendMessage(de, { text: 'Mande uma foto com a legenda !ler' });

      await sock.sendMessage(de, { text: 'lendo a imagem ' }, { quoted: msg });

      try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() });
          
          
          const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

          const formData = new FormData();
          formData.append('base64Image', base64Image);
          formData.append('language', 'por'); 
          
          
          const { data } = await axios.post('https://api.ocr.space/parse/image', formData, {
              headers: {
                  ...formData.getHeaders(),
                  'apikey': 'K81806803688957'
              }
          });

          if (data.IsErroredOnProcessing) {
              return sock.sendMessage(de, { text: 'Erro ao processar imagem tnte com uma outra imagem ' });
          }

          const textoExtraido = data.ParsedResults[0]?.ParsedText;

          if (!textoExtraido) {
              return sock.sendMessage(de, { text: 'Não consegui ler nada nessa imagem' });
          }

          return sock.sendMessage(de, { text: `*Texto Encontrado:*\n\n${textoExtraido}` });

      } catch (e) {
          console.log(e);
          return sock.sendMessage(de, { text: 'Erro ao conectar com o leitor.' });
      }
  }

  if (cmd.startsWith('!qr ')) {
      const texto = txt.slice(4).trim();
      if (!texto) return sock.sendMessage(de, { text: 'Escreva o texto ou link para o QR Code' });

      try {
          
          const buffer = await qrcode.toBuffer(texto, { scale: 8 });
          
          await sock.sendMessage(de, { 
              image: buffer, 
              caption: `Aqui está seu QR Code para:\n"${texto}"` 
          });
      } catch (e) {
          console.log(e);
          return sock.sendMessage(de, { text: 'Erro no geramento' });
      }
  }




  if (cmd === '!mp3') {
    if (!msg.message.videoMessage) return sock.sendMessage(de, { text: 'Mande um video com a legenda !mp3' });

    await sock.sendMessage(de, { text: ' Convertendo em audio (mp3)' }, { quoted: msg });

    try {
        
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() });

        
        const id = Date.now();
        const inputPath = path.join(__dirname, `video_${id}.mp4`);
        const outputPath = path.join(__dirname, `audio_${id}.mp3`);

        
        fs.writeFileSync(inputPath, buffer);

        
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions('-vn')
                .audioCodec('libmp3lame') 
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        
        await sock.sendMessage(de, { 
            audio: fs.readFileSync(outputPath), 
            mimetype: 'audio/mpeg',
            ptt: false 
        }, { quoted: msg });

        
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

    } catch (e) {
        console.log(e);
        return sock.sendMessage(de, { text: 'Erro ao converter o video' });
    }
  }

  if (cmd === '!bg') {
    if (!msg.message.imageMessage) return sock.sendMessage(de, { text: 'Mande uma foto com a legenda !bg' });
    
    if (removeBgKey === 'secredo') return sock.sendMessage(de, { text: 'cade a api pae??' });

    await sock.sendMessage(de, { text: 'Aguarde, removendo o fundo...' }, { quoted: msg });

    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() });
        
        const formulario = new FormData();
        formulario.append('image_file', buffer, 'image.jpg');
        formulario.append('size', 'auto');

        const resposta = await axios.post('https://api.remove.bg/v1.0/removebg', formulario, {
            headers: {
                ...formulario.getHeaders(),
                'X-Api-Key': removeBgKey
            },
            responseType: 'arraybuffer'
        });

       
        await sock.sendMessage(de, { image: Buffer.from(resposta.data), caption: 'Fundo removido!' }, { quoted: msg });
      

    } catch (e) {
        console.log(e);
        return sock.sendMessage(de, { text: 'Erro. Verifique se a chave da API está certa ou se acabaram os créditos.' });
    }
  }

  if (cmd.trim() === '!ia') {
      modoConversa.add(de)
      return sock.sendMessage(de, { text: 'Modo Conversa ATIVADO. Digite !sair para encerrar.' })
  }

  if (modoConversa.has(de)) {
      if (cmd.trim().toLowerCase() === '!sair') {
          modoConversa.delete(de)
          historicoIA.delete(de)
          return sock.sendMessage(de, { text: 'Modo Conversa DESATIVADO.' })
      }

      await sock.sendPresenceUpdate('composing', de)

      try {
          let conversa = historicoIA.get(de) || ''
          const prompt = `${conversa}\nUser: ${cmd}\nAI:` 
          const { data } = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`)
          historicoIA.set(de, `${prompt} ${data}`)
          return sock.sendMessage(de, { text: data })
      } catch (e) {
          return sock.sendMessage(de, { text: 'Erro na IA.' })
      }
  }

  if (cmd.startsWith('!ia ')) {
      const pergunta = cmd.slice(4).trim()

      if (pergunta === 'limpar') {
          historicoIA.delete(de)
          return sock.sendMessage(de, { text: 'Ok pode começar outro assunto.' })
      }

      if (!pergunta) return sock.sendMessage(de, { text: 'pergunta algo pae que eu falo pra voce usando !ia' })
      
      await sock.sendPresenceUpdate('composing', de)

      try {
          let conversa = historicoIA.get(de) || ''
          const prompt = `${conversa}\nUser: ${pergunta}\nAI:`
          const { data } = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`)
          historicoIA.set(de, `${prompt} ${data}`)
          return sock.sendMessage(de, { text: `IA: ${data}` })
      } catch (e) {
          historicoIA.delete(de)
          return sock.sendMessage(de, { text: 'Erro na IA.' })
      }
  }

  if (cmd.startsWith('!img ')) {
      const pedido = cmd.slice(5).trim();
      if (!pedido) return sock.sendMessage(de, { text: ' Escreva o que você quer desenhar. Ex: !img gato de oculos' });
      await sock.sendMessage(de, { text: `aguarde, vou gerar a tua imagem sobre: ${pedido}` }, { quoted: msg });
      try {
          
          const urlImagem = `https://image.pollinations.ai/prompt/${encodeURIComponent(pedido)}`;
          
          const urlFinal = `${urlImagem}?n=${Math.random()}`;
          
          await sock.sendMessage(de, { 
              image: { url: urlFinal }, 
              caption: `*Desenho:* ${pedido}` 
          });
      } catch (e) {
          return sock.sendMessage(de, { text: 'Erro ao gerar imagem.' });
      }
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

  if (cmd === '!moeda' || cmd === '!coins') {
      try {
          await sock.sendMessage(de, { text: '🔄 Buscando cotações atualizadas...' });

          
          const { data } = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL,ETH-BRL,SOL-BRL');

          
          const usd = data.USDBRL;
          const eur = data.EURBRL;
          const gbp = data.GBPBRL; 
          
          const btc = data.BTCBRL; 
          const eth = data.ETHBRL; 
          const sol = data.SOLBRL; 

          const resposta = `*COTAÇÃO DO MERCADO*\n` +
                           `_(Valores em Reais R$)_\n\n` +
                           
                           `*MOEDAS MUNDIAIS:*\n` +
                           `🇺🇸 *Dólar:* R$ ${parseFloat(usd.bid).toFixed(2)}\n` +
                           `🇪🇺 *Euro:* R$ ${parseFloat(eur.bid).toFixed(2)}\n` +
                           `🇬🇧 *Libra:* R$ ${parseFloat(gbp.bid).toFixed(2)}\n\n` +

                           ` *CRIPTOMOEDAS:*\n` +
                           ` *Bitcoin:* R$ ${parseFloat(btc.bid).toLocaleString('pt-BR')}\n` +
                           ` *Ethereum:* R$ ${parseFloat(eth.bid).toLocaleString('pt-BR')}\n` +
                           ` *Solana:* R$ ${parseFloat(sol.bid).toLocaleString('pt-BR')}\n\n` +

                           `📊 *Variação (24h):*\n` +
                           `Dólar: ${usd.pctChange}% | BTC: ${btc.pctChange}%`;

          return sock.sendMessage(de, { text: resposta });

      } catch (e) {
          console.log(e);
          return sock.sendMessage(de, { text: 'Erro ao buscar cotação' });
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

      if (msg.message.videoMessage) {
        const id = Date.now()
        const inputPath = path.join(__dirname, `input_${id}.mp4`)
        const outputPath = path.join(__dirname, `sticker_${id}.webp`)
        fs.writeFileSync(inputPath, buffer)

        try {
          await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
              .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=black@0.0, split [a][b];[a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];[b][p] paletteuse',
                '-loop', '0',
                '-ss', '00:00:00',
                '-t', '00:00:05',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
              ])
              .toFormat('webp')
              .save(outputPath)
              .on('end', resolve)
              .on('error', reject)
          })

          const sticker = fs.readFileSync(outputPath)
          await sock.sendMessage(de, { sticker })
        } catch (err) {
          await sock.sendMessage(de, { text: 'erro' })
        } finally {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
        }
      }
    } else {
      return sock.sendMessage(de, { text: 'o comando !fig' })
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
        fileName: 'live712.pdf'
      })
    } catch (e) {
      return sock.sendMessage(de, { text: 'deu erro ' })
    }
  }

  if (estadoTraducao.has(de)) {
      if (['1', '2', '3'].includes(cmd.trim())) {
          const textoOriginal = estadoTraducao.get(de)
          let lang = 'pt' 
          
          if (cmd.trim() === '2') lang = 'en'
          if (cmd.trim() === '3') lang = 'es'

          try {
              
              const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(textoOriginal)}`
              const { data } = await axios.get(url)
              
              
              const textoTraduzido = data[0][0][0]

              await sock.sendMessage(de, { text: `🔄 ${textoTraduzido}` })
          } catch (e) {
              await sock.sendMessage(de, { text: 'Erro ao traduzir.' })
          }

          estadoTraducao.delete(de) 
          return 
      }
  }

  
  if (cmd.startsWith('!tdr ')) {
      const texto = cmd.slice(5).trim()
      
      if (!texto) return sock.sendMessage(de, { text: 'Escreva o texto. Ex: !tdr Hello World' })

      estadoTraducao.set(de, texto)

      const menu = `*Para qual idioma?*\n\n1. 🇧🇷 Português\n2. 🇺🇸 Inglês\n3. 🇪🇸 Espanhol\n\nDigite o número:`
      return sock.sendMessage(de, { text: menu })
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder)
  const { version } = await fetchLatestBaileysVersion()
  const meuNumero = "5521965495577" 

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    version,
    logger: P({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode

      if (reason !== DisconnectReason.loggedOut) {
        console.log("Reconectando...")
        start()
      } else {
        console.log("Sessão expirada. Apague a pasta 'auth'.")
      }
    } else if (connection === "open") {
      console.log("BCONECTADO \n")
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    if (msg.key.remoteJid?.endsWith("@newsletter")) return
    if (msg.key.remoteJid === "status@broadcast") return

    const de = msg.key.remoteJid
    const txt = pegarTextoMensagem(msg)

    await tratarComandos(sock, de, msg, txt)
  })
}

console.log("bot ligando...")
start()