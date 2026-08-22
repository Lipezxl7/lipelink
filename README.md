<div align="center">
  <a href="https://github.com/Lipezxl7/lipelink">
    <img src="https://raw.githubusercontent.com/Lipezxl7/lipelink/main/menu.jpg" alt="Logo LipeLink" width="80%" />
  </a>
</div>

O **LipeLink** é um bot de WhatsApp feito com **Baileys** e pensado para estudo prático de programação. Ele junta automação, inteligência artificial, manipulação de mídia e utilitários em um só projeto.

Também existe uma página simples em Express para mostrar o status do bot e, quando necessário, o QR Code de conexão.

## Destaques

- Conversa com IA em texto e voz
- Geração de imagem com IA
- OCR de imagem e transcrição de áudio
- Download de mídias de redes sociais compatíveis
- Ferramentas úteis como CEP, clima, link curto, senha, QR Code e tradução
- Conversão de imagens, vídeos, áudio e PDF
- Lembretes salvos em arquivo JSON
- Cache para CEP e cotação de moedas

## Como funciona

- O bot conecta no WhatsApp com autenticação em múltiplos arquivos
- Os lembretes são salvos localmente em JSON
- O histórico da conversa é preservado por chat
- Algumas funções usam serviços externos como IA, tradução, clima, remove.bg, tempmail e cotação
- A raiz do projeto responde com uma página simples de status/QR

## Tecnologias e bibliotecas

- Node.js
- Express
- Baileys
- Axios
- Sharp
- Fluent FFmpeg
- FFmpeg Static
- Node Schedule
- PDF-Lib
- Qrcode
- Qrcode-terminal
- Form-data
- Pino
- Dotenv


## Comandos principais

### IA e conversa
- `!ia` ativa o modo conversa com IA
- `!ia_voz` ativa a resposta em áudio
- `!sair` encerra o modo conversa
- `!img [descrição]` gera imagem com IA
- `!logo [texto]` cria uma logo simples com IA
- `!ler [foto]` faz leitura de texto em imagem
- `!txt [áudio]` transcreve áudio para texto

### Ferramentas de mídia
- `!baixar [link]` baixa mídias de redes compatíveis
- `!apps` lista os apps suportados no download
- `!pdf [foto]` adiciona imagem como página de PDF
- `!gerarpdf` gera o PDF final
- `!mp3 [vídeo]` extrai o áudio do vídeo
- `!bg [foto]` remove o fundo da imagem
- `!fig` cria figurinha de imagem ou vídeo
- `!fig2` cria figurinha quadrada
- `!ta [texto]` converte texto em áudio

### Utilidades
- `!cep [cep]` consulta endereço
- `!clima [cidade]` consulta o clima da cidade
- `!link [url]` encurta links
- `!qr [texto]` gera QR Code
- `!senha [tamanho]` gera senha aleatória
- `!tdr [texto]` traduz texto
- `!moeda` mostra cotação de moedas
- `!wme [numero]` gera link direto do WhatsApp
- `!tm` cria e-mail temporário
- `!inbox` lê mensagens do e-mail temporário
- `!lembrete` abre o menu de lembretes
- `!on` verifica se o bot está online
- `!git` mostra o link do repositório
- `!menu` mostra o menu completo
