const axios = require('axios');
const fs = require('fs');

// --- CONFIGURAÇÃO ---
const MINHA_KEY = "sk_f250c257ef5fdf2255f737393334d9a49cff9c393523f466"; // Cole a chave que deu "FUNCIONANDO" no teste anterior
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ID da Rachel (Padrão)
const MODEL_ID = "eleven_multilingual_v2"; // Modelo que estamos usando
// --------------------

async function diagnosticoCompleto() {
    console.log("🕵️ INICIANDO DIAGNÓSTICO DE VOZ...\n");

    // 1. TESTE DE CONEXÃO (CHAVE)
    console.log("1️⃣ Testando a Chave API...");
    try {
        const userResp = await axios.get('https://api.elevenlabs.io/v1/user', {
            headers: { 'xi-api-key': MINHA_KEY.trim() }
        });
        console.log(`✅ Chave OK! (Saldo: ${userResp.data.subscription.character_limit - userResp.data.subscription.character_count})`);
    } catch (e) {
        console.log(`❌ ERRO NA CHAVE: ${e.response ? e.response.status : e.message}`);
        if (e.response?.status === 401) console.log("   -> Significa: Senha incorreta. Verifique se colou certo.");
        return; // Para aqui se a chave for ruim
    }

    // 2. TESTE SE A VOZ EXISTE
    console.log("\n2️⃣ Verificando se o Voice ID existe...");
    try {
        // Tenta pegar detalhes dessa voz específica
        const voiceResp = await axios.get(`https://api.elevenlabs.io/v1/voices/${VOICE_ID}`, {
            headers: { 'xi-api-key': MINHA_KEY.trim() }
        });
        console.log(`✅ Voz Encontrada: "${voiceResp.data.name}" (Categoria: ${voiceResp.data.category})`);
    } catch (e) {
        console.log(`❌ ERRO NO VOICE ID: ${e.response ? e.response.status : e.message}`);
        if (e.response?.status === 404) console.log("   -> Significa: Esse ID de voz não existe ou foi deletado.");
        return;
    }

    // 3. TESTE DE GERAÇÃO (O PROVA REAL)
    console.log("\n3️⃣ Tentando gerar áudio de teste...");
    try {
        const audioResp = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
            data: {
                text: "Teste de som, um dois três.",
                model_id: MODEL_ID,
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            },
            headers: { 
                'xi-api-key': MINHA_KEY.trim(),
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });
        
        fs.writeFileSync('teste_audio.mp3', audioResp.data);
        console.log("✅ SUCESSO! Áudio gerado e salvo como 'teste_audio.mp3'.");
        console.log("   -> Conclusão: Sua chave, voz e código estão perfeitos.");

    } catch (e) {
        console.log(`❌ ERRO NA GERAÇÃO: ${e.response ? e.response.status : e.message}`);
        if (e.response) {
            console.log("   Dados do erro:", e.response.data.toString());
        }
        if (e.response?.status === 400) console.log("   -> Significa: Modelo incompatível ou parâmetros errados.");
    }
}

diagnosticoCompleto();





const listaChaves = [
        { nome: "KEY 1", key: process.env.ELEVENLABS_API_KEY1 },
        { nome: "KEY 2", key: process.env.ELEVENLABS_API_KEY2 },
        { nome: "KEY 3", key: process.env.ELEVENLABS_API_KEY3 },
        { nome: "KEY 4", key: process.env.ELEVENLABS_API_KEY4 },
        { nome: "KEY 5", key: process.env.ELEVENLABS_API_KEY5 }
    ];