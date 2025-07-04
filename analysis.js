
// const config = require('./config');

// function analyzePatterns(candles) {
//     const patterns = {
//         hammers: [],
//         invertedHammers: [],
//         dojis: []
//     };

//     //if (candles.length < 3) return patterns;
//     if (candles.length < 4) return patterns;


//     candles.forEach((candle, index) => {
//         if(index < 1) return;
        
//         const body = Math.abs(candle.open - candle.close);
//         const totalRange = candle.high - candle.low;
//         const upperShadow = candle.high - Math.max(candle.open, candle.close);
//         const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
//         const isGreen = candle.close > candle.open;
//         const isRed = candle.close < candle.open;

//         // Martelo (verde no fundo = compra, vermelho no topo = venda)
//         if(config.PATTERNS.HAMMERS && 
//             lowerShadow >= body * 1.5 &&
//             upperShadow <= totalRange * 0.2 &&
//             totalRange > (candles[index-1].high - candles[index-1].low))
//         {
//             if(isGreen && candle.low >= Math.min(...candles.slice(index-2, index+1).map(c => c.low))) {
//                 patterns.hammers.push({price: candle.close, type: 'compra'});
//             } else if(isRed && candle.high <= Math.max(...candles.slice(index-2, index+1).map(c => c.high))) {
//                 patterns.hammers.push({price: candle.close, type: 'venda'});
//             }
//         }

//         // Martelo Invertido (verde no fundo = compra, vermelho no topo = venda)
//         if(config.PATTERNS.INVERTED_HAMMERS && 
//             upperShadow >= body * 1.5 &&
//             lowerShadow <= totalRange * 0.2 &&
//             totalRange > (candles[index-1].high - candles[index-1].low))
//         {
//             if(isRed && candle.high <= Math.max(...candles.slice(index-2, index+1).map(c => c.high))) {
//                 patterns.invertedHammers.push({price: candle.close, type: 'venda'});
//             } else if(isGreen && candle.low >= Math.min(...candles.slice(index-2, index+1).map(c => c.low))) {
//                 patterns.invertedHammers.push({price: candle.close, type: 'compra'});
//             }
//         }

//         // Doji (verde no fundo = compra, vermelho no topo = venda)
//         if(config.PATTERNS.DOJIS && 
//            // body <= totalRange * 0.05)
//             body <= totalRange * 0.03)

//         {
//             if(isGreen && candle.low >= Math.min(...candles.slice(index-2, index+1).map(c => c.low))) {
//                 patterns.dojis.push({price: candle.close, type: 'compra'});
//             } else if(isRed && candle.high <= Math.max(...candles.slice(index-2, index+1).map(c => c.high))) {
//                 patterns.dojis.push({price: candle.close, type: 'venda'});
//             }
//         }
//     });

//     return patterns;
// }

// module.exports = { analyzePatterns };

const config = require('./config');

function analyzeCandles(candles) {
    const results = {
        hammers: [],
        invertedHammers: [],
        dojisTop: [],
        dojisBottom: [],
        strongMoves: []
    };

    for (let i = 2; i < candles.length - 2; i++) {
        const candle = candles[i];
        const bodySize = Math.abs(candle.open - candle.close);
        const totalRange = candle.high - candle.low;
        if (totalRange === 0) continue;

        const bodyRatio = bodySize / totalRange;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;

        // Martelo
        if (bodyRatio < 0.3 && lowerShadow > 2 * bodySize && upperShadow < bodySize) {
            results.hammers.push({ time: candle.openTime, price: candle.close });
        }

        // Martelo Invertido
        if (bodyRatio < 0.3 && upperShadow > 2 * bodySize && lowerShadow < bodySize) {
            results.invertedHammers.push({ time: candle.openTime, price: candle.close });
        }

        // Doji
        if (bodyRatio < 0.1) {
            const isBottom = candles[i-1].low > candle.low && candles[i+1].low > candle.low;
            const isTop = candles[i-1].high < candle.high && candles[i+1].high < candle.high;
            
            if (isBottom) results.dojisBottom.push({ time: candle.openTime, price: candle.close });
            if (isTop) results.dojisTop.push({ time: candle.openTime, price: candle.close });
        }

        // Movimentos Fortes
        if ((bodySize / candle.open) * 100 > 0.25) {
            results.strongMoves.push({
                time: candle.openTime,
                price: candle.close,
                direction: candle.close > candle.open ? 'BUY' : 'SELL'
            });
        }
    }

    return results;
}

function getTrendDirection(candles, lookback = 14) {
    if (candles.length < lookback) return 'neutral';
    
    const closes = candles.slice(-lookback).map(c => c.close);
    const sma = closes.reduce((a,b) => a + b, 0) / lookback;
    const current = candles[candles.length-1].close;
    
    return current > sma * 1.002 ? 'up' :
           current < sma * 0.998 ? 'down' : 'neutral';
}

module.exports = {
    analyzeCandles,
    getTrendDirection
};
