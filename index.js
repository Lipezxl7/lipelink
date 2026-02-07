// ============================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS
// ============================================================
require('dotenv').config();
const https = require('https');
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const P = require('pino');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const schedule = require('node-schedule');
const { PDFDocument } = require('pdf-lib');
const translate = require('@iamtraction/google-translate');
const qrcode = require('qrcode');
const FormData = require('form-data');
const { MongoClient } = require('mongodb');
const { 
    default: makeWASocket, 
    DisconnectReason, 
    downloadMediaMessage, 
    fetchLatestBaileysVersion, 
    BufferJSON, 
    delay 
} = require('@whiskeysockets/baileys');

// Configuração Global Crypto
if (!global.crypto) {
    global.crypto = crypto;
}

// Configuração FFMPEG
ffmpeg.setFfmpegPath(ffmpegPath);

// ============================================================
// 2. VARIÁVEIS GLOBAIS E ESTADOS
// ============================================================
const app = express();
const logger = P({ level: 'silent' });

// Configurações de Banco e API
const MONGO_URL = process.env.MONGODB_URI || "mongodb+srv://ylipe:%40Senha6614@cluster0.k9yi2p9.mongodb.net/?appName=Cluster0";
const removeBgKey = process.env.removeBgKey;
let chaveAtualIndex = 0;
let qrCodeImagem = null;

// Mapas de Memória (Estados)
const estadoLembrete = new Map();
const monitorando = new Set();
const estadoTraducao = new Map();
const historicoIA = new Map();
const tempMailSession = new Map();
const sessaoPDF = new Map();
const modoVozIA = new Set();
const modoConversa = new Set();
const emailSession = new Map();
const cache = {
    cep: new Map(),
    ip: new Map()
};


// SERVIDOR WEB (EXPRESS)

app.get("/", (request, response) => {
    const ping = new Date();
    ping.setHours(ping.getHours() - 3);
    console.log(`Ping recebido às ${ping.getUTCHours()}:${ping.getUTCMinutes()}:${ping.getUTCSeconds()}`);

    if (qrCodeImagem) {
        response.send(`
        <html>
          <meta http-equiv="refresh" content="5">
          <body style="display:flex; justify-content:center; align-items:center; background:#121212; height:100vh;">
            <div style="text-align:center; color:white; font-family:sans-serif;">
                <h1>Escaneie para conectar</h1>
                <img src="${qrCodeImagem}" style="border:5px solid white; border-radius:10px;">
                <p>Atualizando automaticamente...</p>
            </div>
          </body>
        </html>
      `);
    } else {
        response.send('<h1 style="text-align:center; margin-top:20%; font-family:sans-serif;">Bot Online com Mongo! ✅<br>Se não apareceu o QR, aguarde ou você já está conectado.</h1>');
    }
});

app.listen(process.env.PORT || 5000);


// FUNÇÕES AUXILIARES

// Autenticação MongoDB
async function useMongoDBAuthState(collection) {
    const writeData = (data, file) => {
        return collection.updateOne(
            { _id: file },
            { $set: { data: JSON.stringify(data, BufferJSON.replacer) } },
            { upsert: true }
        );
    };
    const readData = async (file) => {
        const doc = await collection.findOne({ _id: file });
        if (doc) {
            return JSON.parse(doc.data, BufferJSON.reviver);
        }
        return null;
    };
    const removeData = async (file) => {
        await collection.deleteOne({ _id: file });
    };
    const creds = (await readData('creds')) || (await (require('@whiskeysockets/baileys').initAuthCreds)());
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = require('@whiskeysockets/baileys/lib/Utils/auth-utils').proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        if (value) data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) tasks.push(writeData(value, key));
                            else tasks.push(removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

// Extrair texto da mensagem
function pegarTextoMensagem(msg) {
    return (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        ''
    );
}

// Buscar CEP
async function buscarCEP(cep) {
    const apenasNumeros = cep.replace(/\D/g, '');
    if (apenasNumeros.length !== 8) throw new Error('CEP inválido');

    if (cache.cep.has(apenasNumeros)) {
        return cache.cep.get(apenasNumeros) + '\n(cache)';
    }

    const res = await axios.get(`https://viacep.com.br/ws/${apenasNumeros}/json/`);
    if (res.data.erro) throw new Error('CEP não encontrado');
    const data = res.data;

    const msg =
        `📦 *Resultado Do CEP: ${data.cep}*\n\n` +
        `📍 Rua: ${data.logradouro || '-'}\n` +
        `🏘️ Bairro: ${data.bairro || '-'}\n` +
        `🏙️ Cidade: ${data.localidade}/${data.uf}\n` +
        `📞 DDD: ${data.ddd || '-'}\n` +
        `⛰️ Região: ${data.regiao || '-'}\n` +
        `🔢 Código IBGE: ${data.ibge || '-'}`;

    cache.cep.set(apenasNumeros, msg);
    return msg;
}


// TRATAMENTO DE COMANDOS
async function tratarComandos(sock, de, msg, txt, lembretesCollection, historicoCollection) {
    const cmd = txt.trim().toLowerCase();

    
   // Estados que bloqueiam comandos normais

    // 1.1 Estado Lembrete
    if (estadoLembrete.has(de)) {
        const status = estadoLembrete.get(de);

        if (txt === '0' || (status.etapa === 'MENU_PRINCIPAL' && !['1', '2', '3'].includes(txt))) {
            estadoLembrete.delete(de);
            return sock.sendMessage(de, { text: ' *Operação cancelada.* O menu de lembretes foi fechado.' });
        }

        if (status.etapa === 'MENU_PRINCIPAL') {
            if (txt === '1') {
                estadoLembrete.set(de, { etapa: 'ESPERANDO_MENSAGEM' });
                return sock.sendMessage(de, { text: '📝 O que você deseja que eu anote?\n\n_(Digite 0 para cancelar)_' });
            }
            if (txt === '2') {
                estadoLembrete.delete(de);
                const lista = await lembretesCollection.find({ chatId: de }).toArray();
                if (lista.length === 0) return sock.sendMessage(de, { text: 'Você não tem lembretes ativos.' });

                let msgLista = '📅 *Seus Lembretes:*\n\n';
                lista.forEach((l, i) => {
                    msgLista += `${i + 1}. ${l.mensagem}\n⏰ ${new Date(l.dataAlvo).toLocaleString('pt-BR')}\n\n`;
                });
                return sock.sendMessage(de, { text: msgLista });
            }
            if (txt === '3') {
                estadoLembrete.delete(de);
                await lembretesCollection.deleteMany({ chatId: de });
                return sock.sendMessage(de, { text: '🗑️ Todos os seus lembretes foram removidos com sucesso!' });
            }
        }

        if (status.etapa === 'ESPERANDO_MENSAGEM') {
            estadoLembrete.set(de, { etapa: 'ESPERANDO_DIA', mensagem: txt.trim() });
            return sock.sendMessage(de, { text: '📅 Para qual *dia* do mês? (Ex: 15)\n\n_(Digite 0 para cancelar)_' });
        }

        if (status.etapa === 'ESPERANDO_DIA') {
            const dia = parseInt(txt.trim());
            if (isNaN(dia) || dia < 1 || dia > 31) return sock.sendMessage(de, { text: '⚠️ Dia inválido! Digite um número de 1 a 31:' });

            estadoLembrete.set(de, { etapa: 'ESPERANDO_HORA', mensagem: status.mensagem, dia: dia });
            return sock.sendMessage(de, { text: '🕒 Qual o *horário*? (Ex: 14:30):' });
        }

        if (status.etapa === 'ESPERANDO_HORA') {
            const horaMinuto = txt.trim();
            if (!horaMinuto.includes(':')) return sock.sendMessage(de, { text: '⚠️ Use o formato HH:MM (Ex: 08:00):' });

            const { mensagem, dia } = status;
            const [h, m] = horaMinuto.split(':').map(Number);
            const dataAlvo = new Date();
            dataAlvo.setDate(dia);
            dataAlvo.setHours(h, m, 0);

            if (dataAlvo < new Date()) dataAlvo.setMonth(dataAlvo.getMonth() + 1);

            try {
                const novoLembrete = { chatId: de, mensagem: mensagem, dataAlvo: dataAlvo };
                await lembretesCollection.insertOne(novoLembrete);

                schedule.scheduleJob(dataAlvo, async () => {
                    await sock.sendMessage(de, { text: `⏰ *AVISO:* ${mensagem}` });
                    await lembretesCollection.deleteOne({ _id: novoLembrete._id });
                });

                estadoLembrete.delete(de);
                return sock.sendMessage(de, { text: `✅ *Salvo!* Vou te lembrar em: ${dataAlvo.toLocaleString('pt-BR')}` });
            } catch (e) {
                estadoLembrete.delete(de);
                return sock.sendMessage(de, { text: ' Erro ao salvar no banco de dados.' });
            }
        }
    }

    // 1.2 Estado Tradução
    if (estadoTraducao.has(de)) {
        if (['1', '2', '3'].includes(cmd.trim())) {
            const textoOriginal = estadoTraducao.get(de);
            let lang = 'pt';
            if (cmd.trim() === '2') lang = 'en';
            if (cmd.trim() === '3') lang = 'es';

            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(textoOriginal)}`;
                const { data } = await axios.get(url);
                const textoTraduzido = data[0][0][0];
                await sock.sendMessage(de, { text: `🔄 ${textoTraduzido}` });
            } catch (e) {
                await sock.sendMessage(de, { text: 'Erro ao traduzir.' });
            }
            estadoTraducao.delete(de);
            return;
        }
    }

    // 1.3 Modo Conversa (IA)
    if (modoConversa.has(de)) {
        if (txt.toLowerCase().startsWith('!sair')) {
            modoConversa.delete(de);
            modoVozIA.delete(de);
            await historicoCollection.deleteMany({ chatId: de });
            return sock.sendMessage(de, { text: '🔚 *Modo Conversa encerrado.*' });
        }

        if (txt.startsWith('!')) return; // Permite usar comandos dentro do modo IA

        let contextoImagem = "";
        const isImage = msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

        if (isImage) {
            await sock.sendPresenceUpdate('composing', de);
            try {
                const messageToDownload = msg.message.imageMessage ? msg : {
                    message: msg.message.extendedTextMessage.contextInfo.quotedMessage
                };
                const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {}, { logger: P() });
                const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                const formData = new FormData();
                formData.append('base64Image', base64Image);
                formData.append('language', 'por');

                const { data } = await axios.post('https://api.ocr.space/parse/image', formData, {
                    headers: { ...formData.getHeaders(), 'apikey': 'K81806803688957' }
                });

                const textoLido = data.ParsedResults[0]?.ParsedText;
                if (textoLido) {
                    contextoImagem = `\n\n[O USUÁRIO ENVIOU UMA IMAGEM CONTENDO]: "${textoLido}"`;
                }
            } catch (e) {
                console.log("Erro ao ler imagem na conversa (silencioso)");
            }
        }

        await sock.sendPresenceUpdate(modoVozIA.has(de) ? 'recording' : 'composing', de);

        try {
            const historico = await historicoCollection.find({ chatId: de }).sort({ data: -1 }).limit(5).toArray();
            let messagesIA = historico.reverse().map(m => ({ role: m.role, content: m.texto }));
            messagesIA.push({ role: "user", content: txt + contextoImagem });

            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "Você e o Lipe. Responda de forma curta e natural. voce le imagem mas somente o que esta escrito nao analisar. seja um amigo para o usuario." },
                    ...messagesIA
                ]
            }, {
                headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY.trim()}` }
            });

            const respostaTexto = response.data.choices[0].message.content;
            await historicoCollection.insertOne({ chatId: de, role: "assistant", texto: respostaTexto, data: new Date() });

            if (modoVozIA.has(de)) {
                const voiceId = "rMwcnNkYjU42aYnT4R2G";
                const audioRes = await axios({
                    method: 'post',
                    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                    data: { text: respostaTexto, model_id: "eleven_v3" },
                    headers: { 'xi-api-key': chavesEleven[chaveAtualIndex].trim(), 'Content-Type': 'application/json' },
                    responseType: 'arraybuffer'
                });
                return sock.sendMessage(de, { audio: Buffer.from(audioRes.data), mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
            }

            return sock.sendMessage(de, { text: "*Lipe:* " + respostaTexto });

        } catch (e) {
            return sock.sendMessage(de, { text: ' Erro na IA.' });
        }
    }

    
    // COMANDOS GERAIS

    // 2.1 Básicos
    if (cmd === '!git') {
        return sock.sendMessage(de, { text: 'https://github.com/Lipezxl7/lipelink' });
    }

    if (cmd === '!on') {
        return sock.sendMessage(de, { text: 'to on lendario' });
    }

    if (cmd === '!menu') {
        const lista =
            ` *MENU DO LIPELINK ✅* \n\n` +
            `*INTELIGÊNCIA ARTIFICIAL*\n` +
            `🤖 !ia - Conversa com IA (Texto e Voz)\n` +
            `📖 !ler [foto] - Lê tudo na imagem\n` +
            `📄 !txt [audio] - Transcreve áudio\n` +
            `🎨 !logo [nome] - Cria uma logo com IA\n\n\n` +

            `*FERRAMENTAS ÚTEIS*\n` +
            `📝 !pdf [foto] - Converte foto para pdf\n` +
            `🖌️ !bg [foto] - Remove fundo de imagem\n` +
            `📦 !cep [número] - Consulta CEP\n` +
            `🌐 !link [url] - Encurta links longos\n` +
            `🔒 !senha [tamanho] - Gera senha forte\n` +
            `🌍 !tdr [texto] - Tradutor rápido\n\n\n` +

            `*MÍDIA & FIGURINHAS*\n` +
            `🖼️ !fig [foto/video] - Cria figurinha\n` +
            `🖼️ !fig2 [foto] - Cria figurinha quadrada\n` +
            `🎵 !mp3 [video] - Extrai áudio de vídeo\n` +
            `📲 !ta [texto] - Converte texto pra Audio\n` +
            `⬛ !qr [texto] - Cria um QR Code\n\n\n` +

            `*OUTROS*\n` +
            `📧 !tm - Cria um tempmail\n` +
            `🔗 !wme [numero] - Cria link de contato\n` +
            `📅 !lembrete - Gerencia seus lembretes\n` +
            `⛅ !clima [cidade] - Previsão do tempo\n` +
            `🟢 !on - Verifica status do bot\n\n` +
            `*AVISO*: Se você for falar com a IA so precisa dar o comando (!ia) que voce entrará no modo conversa`;

        try {
            const caminhoImagem = path.join(__dirname, 'menu.jpg');
            if (fs.existsSync(caminhoImagem)) {
                const imagemLocal = fs.readFileSync(caminhoImagem);
                return sock.sendMessage(de, { image: imagemLocal, caption: lista });
            } else {
                console.log('Arquivo menu.jpg não encontrado na pasta');
                return sock.sendMessage(de, { text: lista });
            }
        } catch (e) {
            console.log('Erro ao enviar imagem:', e);
            return sock.sendMessage(de, { text: lista });
        }
    }

    // 2.2 Inteligência Artificial e Conversão
    if (cmd === '!ia') {
        modoConversa.add(de);
        const msgAtivacao =
            ` *Modo Conversa ATIVADO!* \n\n` +
            `Agora você pode falar comigo sem usar comandos. \n\n` +
            `🎙️ *DICA:* Se você quiser escutar a IA falando, basta escrever *!ia_voz* agora mesmo!\n\n` +
            ` Para encerrar, digite *!sair*.`;
        return sock.sendMessage(de, { text: msgAtivacao });
    }

    if (cmd === '!ia_voz') {
        modoVozIA.add(de);
        modoConversa.add(de);
        return sock.sendMessage(de, { text: ' *Modo Voz Ativado!* Agora todas as minhas respostas serão em áudio.\n\nDigite *!sair* para voltar ao normal.' });
    }

    if (cmd === '!ler') {
        const isImage = msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!isImage) {
            return sock.sendMessage(de, { text: 'Erro: Envie uma foto com !ler ou responda a uma foto.' });
        }

        await sock.sendMessage(de, { text: '🔍 Lendo e organizando com IA...' }, { quoted: msg });

        try {
            const messageToDownload = msg.message.imageMessage ? msg : {
                message: msg.message.extendedTextMessage.contextInfo.quotedMessage
            };
            const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {}, { logger: P() });
            const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

            const formData = new FormData();
            formData.append('base64Image', base64Image);
            formData.append('language', 'por');

            const { data } = await axios.post('https://api.ocr.space/parse/image', formData, {
                headers: { ...formData.getHeaders(), 'apikey': 'K81806803688957' }
            });

            const textoBruto = data.ParsedResults[0]?.ParsedText;
            if (!textoBruto) {
                return sock.sendMessage(de, { text: '📭 Não consegui extrair nenhum texto.' });
            }

            const responseIA = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.3-70b-versatile",
                    messages: [{
                            role: "system",
                            content: "Você é um assistente que organiza textos extraídos de imagens via OCR. Sua tarefa é pegar o texto bagunçado e organizar exatamente como estaria na imagem original (listas, menus, recibos, etc). Remova símbolos desnecessários do OCR e mantenha apenas a informação útil. Se houver preços, mantenha-os alinhados."
                        },
                        {
                            role: "user",
                            content: `Organize este texto extraído de uma imagem:\n\n${textoBruto}`
                        }
                    ],
                    temperature: 0.3
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY.trim()}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const textoOrganizado = responseIA.data?.choices?.[0]?.message?.content;
            return sock.sendMessage(de, { text: `✅ *Resultado Organizado por IA:*\n\n${textoOrganizado}` });

        } catch (e) {
            console.log("Erro no !ler com IA:", e.message);
            return sock.sendMessage(de, { text: ' Erro ao processar ou organizar a imagem.' });
        }
    }

    if (cmd === '!txt') {
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg?.audioMessage) return sock.sendMessage(de, { text: ' Responda a um áudio com o comando *!txt* para eu transcrever.' });

        await sock.sendMessage(de, { text: '👂 *Ouvindo e transcrevendo...*' }, { quoted: msg });

        try {
            const buffer = await downloadMediaMessage({ message: quotedMsg }, 'buffer', {}, { logger: P() });
            const nomeArquivo = `audio_${Date.now()}`;
            const inputPath = path.join(__dirname, `${nomeArquivo}.ogg`);
            const outputPath = path.join(__dirname, `${nomeArquivo}.mp3`);

            fs.writeFileSync(inputPath, buffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            const formData = new FormData();
            formData.append('file', fs.createReadStream(outputPath));
            formData.append('model', 'whisper-large-v3');
            formData.append('response_format', 'json');
            formData.append('language', 'pt');

            const { data } = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY.trim()}`
                }
            });

            await sock.sendMessage(de, { text: `📝 *Transcrição do Áudio:*\n\n"${data.text}"` }, { quoted: msg });

            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        } catch (e) {
            console.log("Erro no !txt:", e.message);
            return sock.sendMessage(de, { text: ' Erro ao transcrever o áudio.' });
        }
    }

    if (cmd.startsWith('!logo ')) {
        const textoLogo = txt.slice(6).trim();
        if (!textoLogo) return sock.sendMessage(de, { text: ' Digite o nome da logo!' });

        await sock.sendMessage(de, { text: `🎨 Criando design para: *${textoLogo}*` });

        try {
            const urlIcone = `https://api.dicebear.com/7.x/identicon/png?seed=${encodeURIComponent(textoLogo)}`;
            await sock.sendMessage(de, {
                image: { url: urlIcone },
                caption: `\n\n` +
                    `📝 *Texto:* ${textoLogo}\n` +
                    `🆔 *ID Único:* #${Math.floor(Math.random() * 9999)}\n\n` +
                    `*Status:* Arte gerada com sucesso!`
            });
        } catch (e) {
            const fs = require('fs');
            await sock.sendMessage(de, {
                image: fs.readFileSync('./menu.jpg'),
                caption: `✅ *Logo Local:* ${textoLogo}\n\n(Servidores externos ocupados, usei sua base padrão)`
            });
        }
    }
    // Tradutor Humanizado
    
    // Tradutor Humanizado (CORRIGIDO)
    if (cmd.startsWith('!ta ')) {
        // CORREÇÃO AQUI: Criamos a variável pegando tudo depois do "!ta "
        const texto = txt.slice(4).trim(); 
        
        if (!texto) return sock.sendMessage(de, { text: ' O que devo falar? Digite: !ta Olá mundo' });

        try {
            // URL do Google TTS
            const googleURL = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt&q=${encodeURIComponent(texto)}`;

            await sock.sendMessage(de, { 
                audio: { url: googleURL }, 
                mimetype: 'audio/mp4', 
                ptt: true // Envia como nota de voz (azulzinha)
            });

        } catch (e) {
            console.log(e);
            return sock.sendMessage(de, { text: ' Erro ao gerar o áudio.' });
        }
    }

    // 2.3 Utilidades
    if (cmd === '!lembrete') {
        estadoLembrete.set(de, { etapa: 'MENU_PRINCIPAL' });
        const menu =
            `⏰ *MENU DE LEMBRETES*\n\n` +
            `1️⃣ - Criar novo lembrete\n` +
            `2️⃣ - Ver meus lembretes\n` +
            `3️⃣ - Apagar tudo\n\n` +
            `0️⃣ - Sair/Voltar\n\n` +
            `_Escolha uma opção acima._`;
        return sock.sendMessage(de, { text: menu });
    }

    if (cmd.startsWith('!wme ')) {
        const numero = txt.slice(5).replace(/[^0-9]/g, '');
        if (numero.length < 10) return sock.sendMessage(de, { text: 'Digite o número com DDD. Ex: *!wme 11900000*' });
        const link = `https://wa.me/55${numero}`;
        return sock.sendMessage(de, { text: `*🔗 link direto:*\n\n${link}` });
    }

    
    
// Tempmail otimizado

if (cmd === '!tm') {
    await sock.sendMessage(de, { text: '🔄 *Criando e-mail...*' });

    try {
        
        const resDomains = await axios.get('https://api.mail.tm/domains');
        const dominio = resDomains.data['hydra:member'][0].domain;

        
        const usuario = `user${Math.floor(Math.random() * 999999)}`;
        const senha = `pwd${Math.floor(Math.random() * 999999)}`;
        const emailCompleto = `${usuario}@${dominio}`;

        
        await axios.post('https://api.mail.tm/accounts', {
            address: emailCompleto,
            password: senha
        });

        
        const resToken = await axios.post('https://api.mail.tm/token', {
            address: emailCompleto,
            password: senha
        });

        const token = resToken.data.token;

        
        tempMailSession.set(de, { email: emailCompleto, token: token });

        return sock.sendMessage(de, { 
            text: `📧 *E-MAIL GERADO COM SUCESSO*\n\n \`${emailCompleto}\`\n\n(Use *!inbox* para ler os códigos)` 
        });

    } catch (e) {
        console.log("ERRO TEMPMAIL:", e.response ? e.response.data : e.message);
        return sock.sendMessage(de, { text: ' Erro ao criar conta de e-mail temporário.' });
    }
}

if (cmd === '!inbox') {
    const sessao = tempMailSession.get(de);
    if (!sessao || !sessao.token) {
        return sock.sendMessage(de, { text: ' Crie um e-mail primeiro com *!tempmail*.' });
    }

    await sock.sendMessage(de, { text: '🔄 *Buscando mensagens...*' });

    try {
        
        const resMsgs = await axios.get('https://api.mail.tm/messages', {
            headers: { Authorization: `Bearer ${sessao.token}` }
        });

        const mensagens = resMsgs.data['hydra:member'];

        if (mensagens.length === 0) {
            return sock.sendMessage(de, { text: '📭 *Caixa Vazia.*\nNada chegou ainda. Espere 10 segundos e tente de novo.' });
        }

        
        const msgRecente = mensagens[0];

        
        const resDetalhe = await axios.get(`https://api.mail.tm/messages/${msgRecente.id}`, {
            headers: { Authorization: `Bearer ${sessao.token}` }
        });

        const info = resDetalhe.data;
        const textoEmail = info.text || "Conteúdo ilegível ou HTML apenas.";

        const resposta = `📬 *NOVA MENSAGEM!*\n` +
                         `👤 *De:* ${info.from.address}\n` +
                         `🏷️ *Assunto:* ${info.subject}\n\n` +
                         `📝 *Mensagem:*\n${textoEmail}`;

        return sock.sendMessage(de, { text: resposta });

    } catch (e) {
        console.log("ERRO INBOX:", e.message);
        return sock.sendMessage(de, { text: ' Erro ao ler mensagens.' });
    }
}
    
       if (cmd.startsWith('!senha')) {
        let tamanho = parseInt(cmd.slice(6).trim());
        if (!tamanho || tamanho > 100) return sock.sendMessage(de, { text: '*Limite de 100 Caracteres*' });
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

    
    if (!urlOriginal || !urlOriginal.startsWith('http')) {
        return sock.sendMessage(de, { text: ' Cole o link completo. Ex: *!link https://google.com*' });
    }

    await sock.sendMessage(de, { text: '🔄 *Gerando opções de link...*' });

    try {
        const urlEnc = encodeURIComponent(urlOriginal);

        // Todos sao bons mas se o 1 cair certeza que os outros cai
        const resultados = await Promise.all([
            // 1. is.gd (mais instavel)
            axios.get(`https://is.gd/create.php?format=simple&url=${urlEnc}`).catch(() => ({ data: ' Erro' })),
            
            // 2. TinyURL
            axios.get(`https://tinyurl.com/api-create.php?url=${urlEnc}`).catch(() => ({ data: ' Erro' })),
            
            // 3. v.gd
            axios.get(`https://v.gd/create.php?format=simple&url=${urlEnc}`).catch(() => ({ data: ' Erro' })),

            // 4. da.gd
            axios.get(`https://da.gd/s?url=${urlEnc}`).catch(() => ({ data: ' Erro' })),

            // 5. clck.ru 
            axios.get(`https://clck.ru/--?url=${urlEnc}`).catch(() => ({ data: ' Erro' }))
        ]);

        
        const msg = `🔗 *LINKS ENCURTADOS*\n\n` +
                    `1️⃣ *Is.gd:* ${resultados[0].data}\n` +
                    `2️⃣ *TinyURL:* ${resultados[1].data}\n` +
                    `3️⃣ *V.gd:* ${resultados[2].data}\n` +
                    `4️⃣ *Da.gd:* ${resultados[3].data.toString().trim()}\n` +
                    `5️⃣ *Clck.ru:* ${resultados[4].data}\n\n`

        return sock.sendMessage(de, { text: msg });

    } catch (e) {
        console.log("Erro no !link:", e.message);
        return sock.sendMessage(de, { text: 'Falha ao conectar com os encurtadores.' });
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

    if (cmd.startsWith('!cep ')) {
        const cep = cmd.slice(5).trim();
        try {
            const resposta = await buscarCEP(cep);
            return sock.sendMessage(de, { text: resposta });
        } catch (e) {
            return sock.sendMessage(de, { text: 'Erro: ' + e.message });
        }
    }

    if (cmd.startsWith('!clima ')) {
        const cidade = txt.slice(7).trim();
        if (!cidade) return sock.sendMessage(de, { text: 'Digite o nome da cidade. Ex: !clima São Paulo' });

        try {
            const apiKey = process.env.OPENWEATHER_API_KEY;
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&appid=${apiKey}&units=metric&lang=pt_br`;
            const { data } = await axios.get(url);
            const fusoHorarioSegundos = data.timezone;
            const dataAtualUTC = new Date();
            const dataLocal = new Date(dataAtualUTC.getTime() + (fusoHorarioSegundos * 1000) + (dataAtualUTC.getTimezoneOffset() * 60000));
            const horaFormatada = dataLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const msgClima =
                `🌍 *Clima em ${data.name}, ${data.sys.country}*\n` +
                `🕒 *Hora Local:* ${horaFormatada}\n\n` +
                `🌡️ *Temperatura:* ${data.main.temp}°C\n` +
                `🤔 *Sensação:* ${data.main.feels_like}°C\n` +
                `💧 *Umidade:* ${data.main.humidity}%\n` +
                `☁️ *Condição:* ${data.weather[0].description.toUpperCase()}\n` +
                `💨 *Vento:* ${data.wind.speed} km/h`;
            return sock.sendMessage(de, { text: msgClima });
        } catch (e) {
            console.log("Erro no comando !clima:", e.message);
            if (e.response && e.response.status === 404) {
                return sock.sendMessage(de, { text: 'Cidade não encontrada. Verifique se escreveu corretamente.' });
            }
            return sock.sendMessage(de, { text: 'Erro ao consultar o clima.' });
        }
    }

    if (cmd.startsWith('!tdr ')) {
        const texto = cmd.slice(5).trim();
        if (!texto) return sock.sendMessage(de, { text: 'Escreva o texto. Ex: !tdr Hello World' });
        estadoTraducao.set(de, texto);
        const menu = `*Para qual idioma?*\n\n1. 🇧🇷 Português\n2. 🇺🇸 Inglês\n3. 🇪🇸 Espanhol\n\nDigite o número:`;
        return sock.sendMessage(de, { text: menu });
    }

    // 2.4 PDF
    if (cmd === '!pdf') {
        const isImage = msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!isImage) return sock.sendMessage(de, { text: '❌ Envie uma foto com !pdf para começar.' });
        try {
            const messageToDownload = msg.message.imageMessage ? msg : { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
            const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {}, { logger: P() });
            let paginas = sessaoPDF.get(de) || [];
            paginas.push(buffer);
            sessaoPDF.set(de, paginas);
            return sock.sendMessage(de, { text: `📄 *Página ${paginas.length} adicionada!*\n\nEnvie mais fotos com *!pdf* ou digite *!gerarpdf* para finalizar.` });
        } catch (e) {
            return sock.sendMessage(de, { text: ' Erro ao processar imagem.' });
        }
    }

    if (cmd === '!gerarpdf') {
        const paginas = sessaoPDF.get(de);
        if (!paginas || paginas.length === 0) return sock.sendMessage(de, { text: 'Você ainda não adicionou nenhuma página! Mande fotos com !pdf.' });
        await sock.sendMessage(de, { text: '⏳ Criando PDF com ' + paginas.length + ' página(s)...' });
        try {
            const { PDFDocument } = require('pdf-lib');
            const pdfDoc = await PDFDocument.create();
            for (const p of paginas) {
                const img = await pdfDoc.embedJpg(p).catch(() => pdfDoc.embedPng(p));
                const page = pdfDoc.addPage([img.width, img.height]);
                page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
            }
            const pdfBytes = await pdfDoc.save();
            sessaoPDF.delete(de);
            return sock.sendMessage(de, {
                document: Buffer.from(pdfBytes),
                mimetype: 'application/pdf',
                fileName: 'Documento_712.pdf'
            });
        } catch (e) {
            console.log(e);
            return sock.sendMessage(de, { text: ' Erro técnico ao gerar o PDF.' });
        }
    }

    // 2.5 Mídia e Figurinha
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
            return sock.sendMessage(de, { text: 'Erro API' });
        }
    }

    if (cmd === '!fig') {
        if (msg.message.imageMessage || msg.message.videoMessage) {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() });
            if (msg.message.imageMessage) {
                const sticker = await sharp(buffer)
                    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp()
                    .toBuffer();
                return sock.sendMessage(de, { sticker });
            }
            if (msg.message.videoMessage) {
                const id = Date.now();
                const inputPath = path.join(__dirname, `input_${id}.mp4`);
                const outputPath = path.join(__dirname, `sticker_${id}.webp`);
                fs.writeFileSync(inputPath, buffer);
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
                            .on('error', reject);
                    });
                    const sticker = fs.readFileSync(outputPath);
                    await sock.sendMessage(de, { sticker });
                } catch (err) {
                    await sock.sendMessage(de, { text: 'erro' });
                } finally {
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                }
            }
        } else {
            return sock.sendMessage(de, { text: 'o comando !fig' });
        }
    }

    if (cmd === '!fig2') {
        if (msg.message.imageMessage || msg.message.videoMessage) {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: P() });
            if (msg.message.imageMessage) {
                const sticker = await sharp(buffer)
                    .resize(512, 512, { fit: 'cover', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp()
                    .toBuffer();
                return sock.sendMessage(de, { sticker });
            }
            return sock.sendMessage(de, { sticker: buffer });
        } else {
            return sock.sendMessage(de, { text: 'cade imagem??' });
        }
    }
}


// INICIALIZAÇÃO 

async function start() {
    console.log("Conectando ao MongoDB...");
    const mongoClient = new MongoClient(MONGO_URL, {
    family: 4,});
    await mongoClient.connect();
    console.log("MongoDB Conectado!");
    // Salvando no mongodb
    const db = mongoClient.db("whatsapp_bot");
    const authCollection = db.collection("auth_sessions");
    const lembretesCollection = db.collection("lembretes");
    const historicoCollection = db.collection("historico_conversas");

    const { state, saveCreds } = await useMongoDBAuthState(authCollection);

    // Recuperar lembretes
    const lembretesAntigos = await lembretesCollection.find({}).toArray();

    // Iniciar Baileys
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ["Lipelink", "Chrome", "20.0.04"],
        version,
        logger: P({ level: "silent" })
    });

    // Reagendar lembretes com o socket ativo
    lembretesAntigos.forEach(lembrete => {
        const dataAlvo = new Date(lembrete.dataAlvo);
        if (dataAlvo > new Date()) {
            schedule.scheduleJob(dataAlvo, async () => {
                await sock.sendMessage(lembrete.chatId, { text: '*AVISO DE LEMBRETE RECUPERADO:* ' + lembrete.mensagem });
                await lembretesCollection.deleteOne({ _id: lembrete._id });
            });
        } else {
            sock.sendMessage(lembrete.chatId, { text: '*LEMBRETE ATRASADO:* ' + lembrete.mensagem });
            lembretesCollection.deleteOne({ _id: lembrete._id });
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("Gerando QR Code para o site...");
            qrCodeImagem = await qrcode.toDataURL(qr);
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconectando...");
                start();
            } else {
                console.log("Sessão expirada. Apague a pasta 'auth'.");
            }
        } else if (connection === "open") {
            console.log("CONECTADO \n");
            qrCodeImagem = null;
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const de = msg.key.remoteJid;
        const txt = pegarTextoMensagem(msg);
        if (txt) await tratarComandos(sock, de, msg, txt, lembretesCollection, historicoCollection);
    });
}

console.log("bot ligando...");
start();