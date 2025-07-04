const axios = require('axios');
const { client } = require('./connection');

async function getCandles(symbol = 'XRPUSDT', interval = '1m', limit = 10) {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    try {
        const response = await axios.get(url);
        return response.data.map(candle => ({
            openTime: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5]),
            closeTime: candle[6]
        }));
    } catch (error) {
        console.error('Erro ao obter candles:', error);
        return [];
    }
}

// Exemplo de uso:
getCandles().then(candles => console.log(candles));
 async function position(){
const response = await client.futuresPositionMode();
console.log(response);
 }
    position(client);