require('dotenv').config();
const { client, checkConnection } = require('./connection');

async function obterCandles(par = 'XRPUSDT', intervalo = '1m', limite = 100) {
    try {
        const candles = await client.futuresCandles({ symbol: par, interval: intervalo, limit: limite });
        return candles.map(c => ({
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            time: new Date(c.openTime).toISOString()
        }));
    } catch (error) {
        console.error('Erro ao obter candles:', error);
        return [];
    }
}

function analisarPadroes(candles) {
    const martelos = [];
    const martelosInvertidos = [];
    const dojis = [];
    const topos = [];
    const fundos = [];
    
    for (let i = 2; i < candles.length - 2; i++) {
        let c1 = candles[i - 2];
        let c2 = candles[i - 1];
        let c3 = candles[i];  // Candle atual
        let c4 = candles[i + 1];
        let c5 = candles[i + 2];
        
        let corpo = Math.abs(c3.open - c3.close);
        let sombraSuperior = c3.high - Math.max(c3.open, c3.close);
        let sombraInferior = Math.min(c3.open, c3.close) - c3.low;
        let tamanhoTotal = c3.high - c3.low;
        
        // Padrão de Martelo (fundo)
        if (c1.close > c2.close && c2.close > c3.open &&
            sombraInferior >= corpo && corpo / tamanhoTotal < 0.4 && c3.close > c3.open &&
            c4.close > c3.close) {
            martelos.push({ index: i, preco: c3.low, data: c3.time });
            fundos.push({ index: i, preco: c3.low, data: c3.time });
        }
        
        // Padrão de Martelo Invertido (topo)
        if (c1.close < c2.close && c2.close < c3.open &&
            sombraSuperior >= corpo && corpo / tamanhoTotal < 0.4 && c3.close < c3.open &&
            c4.close < c3.close) {
            martelosInvertidos.push({ index: i, preco: c3.high, data: c3.time });
            topos.push({ index: i, preco: c3.high, data: c3.time });
        }
        
        // Padrão de Doji (corpo pequeno e sombras longas ou inexistentes)
        if (corpo / tamanhoTotal < 0.1) {  // Corpo menor que 10% do tamanho total
            dojis.push({ index: i, preco: c3.close, data: c3.time });
        }
    }
    
    return { martelos, martelosInvertidos, dojis, topos, fundos };
}

async function executarBacktest() {
    const candles = await obterCandles();
    if (candles.length === 0) {
        console.log('Não foi possível obter candles.');
        return;
    }

    const sinais = analisarPadroes(candles);
    console.log('📊 Padrões identificados:', sinais);
}

// Executar backtest ao rodar o script
(async () => {
    await checkConnection();
    await executarBacktest();
})();

