const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");

console.log("Iniciando bot...");

async function startBot() {
  try {
    const { state } = await useMultiFileAuthState("auth");
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true
    });

    sock.ev.on("connection.update", (update) => {
      if (update.qr) console.log("✔ QR Code está sendo gerado!");
      if (update.connection === "open") console.log(" Conectado!");
    });
  } catch (err) {
    console.error(" ERRO GRAVE:", err);
  }
}

startBot();