const axios = require('axios');

// As suas 5 chaves do painel
const chaves = [
    "7e660ef106416f3f8a37cd8aa7702e53164586e694d594a405c328979df12bb8",
    "58a338d232f8c0cb81ba24c3ecd15112f5b0028700273c9fe66186a328169c62",
    "a205d7bc6f4a81ea2c87e43a1824865dd12d379fff19e2616e88c2ba501a919e",
    "0a8c0707696d42560021aa128d76b08d735f045cf3023d3e50d6f709f0282b87",
    "e333663c4776997e51ec205ffc635ca0052c34babda1811e184fadfdee0c4491"
];

async function cruzarVozes() {
    console.log("🔍 Iniciando a varredura nas 5 contas...\n");
    let vozesEmComum = null;

    for (let i = 0; i < chaves.length; i++) {
        const chave = chaves[i];
        console.log(`⏳ Lendo vozes da Chave ${i + 1}...`);
        
        try {
            const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': chave }
            });

            // Extrai apenas o ID e o Nome das vozes dessa chave
            const vozesDestaChave = response.data.voices.map(v => ({
                id: v.voice_id,
                nome: v.name
            }));

            if (vozesEmComum === null) {
                // Na primeira chave, a lista base é a dela mesma
                vozesEmComum = vozesDestaChave;
            } else {
                // A partir da segunda, faz o "filtro". Só mantém quem já estava na lista.
                vozesEmComum = vozesEmComum.filter(vozBase => 
                    vozesDestaChave.some(vozNova => vozNova.id === vozBase.id)
                );
            }

        } catch (error) {
            console.log(`❌ Erro ao ler a Chave ${i + 1}. Detalhe: ${error.response ? error.response.data.detail : error.message}`);
        }
    }

    console.log("\n=================================================");
    console.log(`🎯 RESULTADO: Encontramos ${vozesEmComum.length} vozes compatíveis com TODAS as chaves!`);
    console.log("=================================================\n");

    // Mostra as 10 primeiras para não inundar o seu terminal
    const limiteParaMostrar = Math.min(vozesEmComum.length, 10);
    
    for (let i = 0; i < limiteParaMostrar; i++) {
        console.log(`🗣️ Nome: ${vozesEmComum[i].nome}`);
        console.log(`🔑 ID: "${vozesEmComum[i].id}"`);
        console.log(`-----------------------------------`);
    }

    if (vozesEmComum.length > 10) {
        console.log(`... e mais ${vozesEmComum.length - 10} vozes disponíveis.`);
    }
}

cruzarVozes();