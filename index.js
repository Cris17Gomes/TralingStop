// const { client, checkConnection } = require('./connection');
// const trading = require('./trading');
// const analysis = require('./analysis');
// const config = require('./config');

// let isRunning = false;

// async function start() {
//     try {
//         if(!await checkConnection()) return;
//         await trading.initialize();
//         isRunning = true;
//         console.log('🤖 Bot iniciado');
//         runCycle();
//     } catch (error) {
//         console.error('❌ Falha crítica:', error);
//         process.exit(1);
//     }
// }

// function runCycle() {
//     if(!isRunning) return;
    
//     analyzeMarket()
//         .then(() => setTimeout(runCycle, config.CHECK_INTERVAL))
//         .catch(error => {
//             console.error('❌ Erro no ciclo:', error);
//             stop();
//         });
// }

// async function analyzeMarket() {
//     try {
//         console.log('\n🔎 Varredura do mercado...');
//         for(const pair of Object.keys(config.PAIRS)) {
//             if(!config.PAIRS[pair]) continue;
            
//             const candles = await client.futuresCandles({
//                 symbol: pair,
//                 interval: config.INTERVAL,
//                 limit: 20  //10
//             });
            
//             const parsed = candles.map(c => ({
//                 open: parseFloat(c.open),
//                 high: parseFloat(c.high),
//                 low: parseFloat(c.low),
//                 close: parseFloat(c.close)
//             }));
            
//             const patterns = analysis.analyzePatterns(parsed);
//             checkSignals(pair, patterns, parsed[parsed.length-1].close);
//         }
//     } catch (error) {
//         console.error('❌ Erro na análise:', error.message);
//     }
// }

// async function checkSignals(pair, patterns, price) {
//     try {
//         if(await trading.hasOpenPosition(pair)) return;
        
//         // Verificar padrões de compra
//         const buySignals = [
//             ...patterns.hammers.filter(p => p.type === 'compra'),
//             ...patterns.invertedHammers.filter(p => p.type === 'compra'),
//             ...patterns.dojis.filter(p => p.type === 'compra')
//         ];
        
//         // Verificar padrões de venda
//         const sellSignals = [
//             ...patterns.hammers.filter(p => p.type === 'venda'),
//             ...patterns.invertedHammers.filter(p => p.type === 'venda'),
//             ...patterns.dojis.filter(p => p.type === 'venda')
//         ];
        
//         if(buySignals.length > 0) {
//             console.log(`🟢 ${pair} | Sinal COMPRA detectado`);
//             await trading.enterLong(pair, price);
//         }
//         else if(sellSignals.length > 0) {
//             console.log(`🔴 ${pair} | Sinal VENDA detectado`);
//             await trading.enterShort(pair, price);
//         }
//     } catch (error) {
//         console.error(`❌ Erro em ${pair}:`, error.message);
//     }
// }

// function stop() {
//     isRunning = false;
//     console.log('\n🛑 Desligamento seguro...');
//     setTimeout(() => process.exit(0), 3000);
// }

// process.on('SIGINT', stop);
// process.on('SIGTERM', stop);

// if(require.main === module) start();

const { client, checkConnection } = require('./connection');
const { analyzeCandles, getTrendDirection } = require('./analysis');
const config = require('./config');
const trading = require('./trading');

const enabledPairs = Object.keys(config.PAIRS).filter(pair => config.PAIRS[pair].enabled);

const state = {
    isRunning: false,
    activePairs: enabledPairs
};

async function startBot() {
    if (state.isRunning) return;
    state.isRunning = true;

    console.log('🚀 Iniciando monitoramento...');
    const balance = await checkConnection();
    
    if (balance < config.RISK_MANAGEMENT.MIN_BALANCE) {
        console.log('❌ Saldo insuficiente para operar');
        return;
    }

    await trading.initialize(balance);

    while (state.isRunning) {
        try {
            await tradingCycle();
            await sleep(config.CHECK_INTERVAL);
        } catch (error) {
            console.error('❌ Erro no ciclo:', error);
        }
    }
}

async function tradingCycle() {
    for (const pair of state.activePairs) {
        try {
            const candles = await getCandles(pair);
            if (!candles.length) continue;

            const analysis = analyzeCandles(candles);
            const trend = getTrendDirection(candles);
            await evaluateSignals(pair, candles, analysis, trend);
        } catch (error) {
            console.error(`⚠️ Erro em ${pair}:`, error.message);
        }
    }
}

async function getCandles(pair) {
    try {
        const candles = await client.futuresCandles({
            symbol: pair,
            interval: config.INTERVAL,
            limit: 20
        });

        return candles.map(c => ({
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            volume: parseFloat(c.volume),
            openTime: c.openTime
        }));
    } catch (error) {
        console.error(`❌ Falha ao buscar candles de ${pair}:`, error.message);
        return [];
    }
}

async function evaluateSignals(pair, candles, analysis, trend) {
    const lastCandle = candles[candles.length - 1];
    const price = lastCandle.close;

    console.log(`\n🔎 ${pair} | Preço: ${price} | Tendência: ${trend}`);

    if (await trading.hasOpenPosition(pair)) {
        console.log(`⏸️ ${pair} já em operação`);
        return;
    }

    if (config.DEBUG_MODE) {
        console.log('Padrões encontrados:', {
            martelos: analysis.hammers.length,
            martelosInvertidos: analysis.invertedHammers.length,
            dojisTopo: analysis.dojisTop.length,
            dojisFundo: analysis.dojisBottom.length
        });
    }

    if (analysis.hammers.length > 0 && trend === 'up') {
        console.log('🟢 Sinal COMPRA (Martelo)');
        await trading.enterLong(pair, price);
    }
    else if (analysis.invertedHammers.length > 0 && trend === 'down') {
        console.log('🔴 Sinal VENDA (Martelo Invertido)');
        await trading.enterShort(pair, price);
    }
    else if (analysis.dojisBottom.length > 0 && trend === 'up') {
        console.log('🟢 Sinal COMPRA (Doji no fundo)');
        await trading.enterLong(pair, price);
    }
    else if (analysis.dojisTop.length > 0 && trend === 'down') {
        console.log('🔴 Sinal VENDA (Doji no topo)');
        await trading.enterShort(pair, price);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

startBot().catch(console.error);

module.exports = { startBot };