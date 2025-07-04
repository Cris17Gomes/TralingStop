
const Binance = require('binance-api-node').default;
require('dotenv').config();

// Configuração corrigida do cliente
const client = Binance({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.SECRET_KEY,
  futures: true // Adicione esta linha para ativar o modo futures
});

async function checkConnection() {
  try {
    await client.futuresPing();
    const account = await client.futuresAccountInfo();
    console.log(`✅ Conectado | Saldo Disponível: ${parseFloat(account.availableBalance).toFixed(2)} USDT`);
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    return false;
  }
}

module.exports = { client, checkConnection };