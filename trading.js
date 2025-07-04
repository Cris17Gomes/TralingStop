

// const { client } = require('./connection');
// const config = require('./config');

// const state = {
//     pairs: {},
//     openPositions: new Map(),
//     stopMonitors: new Map()
// };

// // ========== INICIALIZAÇÃO SIMPLIFICADA ==========
// async function initialize() {
//     try {
//         console.log('⚙️ Inicializando pares...');
        
//         const balance = await getAvailableBalance();
//         console.log(`ℹ️ Saldo Disponível: ${balance.toFixed(2)} USDT`);

//         if (balance < config.RISK_MANAGEMENT.MIN_BALANCE) {
//             console.log('⚠️ Saldo abaixo do mínimo. Verifique posições.');
//             await emergencyCloseAll();
//             return false;
//         }

//         for (const pair of Object.keys(config.PAIRS)) {
//             if (!config.PAIRS[pair]) continue;

//             const exchangeInfo = await client.futuresExchangeInfo();
//             const symbol = exchangeInfo.symbols.find(s => s.symbol === pair);

//             state.pairs[pair] = {
//                 quantityPrecision: symbol.quantityPrecision,
//                 pricePrecision: symbol.pricePrecision,
//                 stepSize: parseFloat(symbol.filters.find(f => f.filterType === 'LOT_SIZE').stepSize),
//                 tickSize: parseFloat(symbol.filters.find(f => f.filterType === 'PRICE_FILTER').tickSize),
//                 minNotional: parseFloat(symbol.filters.find(f => f.filterType === 'MIN_NOTIONAL').notional)
//             };

//             // Configuração única de alavancagem para todos os pares
//             try {
//                 await client.futuresMarginType({
//                     symbol: pair,
//                     marginType: config.MARGIN_TYPE
//                 });

//                 await client.futuresLeverage({
//                     symbol: pair,
//                     leverage: config.RISK_MANAGEMENT.LEVERAGE // Alavancagem única
//                 });

//                 console.log(`✅ ${pair} | ${config.MARGIN_TYPE} ${config.RISK_MANAGEMENT.LEVERAGE}x`);

//             } catch (error) {
//                 if (error.message.includes('No need to change')) {
//                     console.log(`⚠️ ${pair} | Configuração já aplicada`);
//                 } else {
//                     console.error(`❌ Erro em ${pair}:`, error.message);
//                 }
//             }
//         }

//         console.log('\n✅ Configuração concluída');
//         return true;

//     } catch (error) {
//         console.error('❌ Falha na inicialização:', error.message);
//         process.exit(1);
//     }
// }

// // ========== SISTEMA DE PROTEÇÃO ==========
// async function startProtectionSystem(pair, side, entryPrice, quantity) {
//     const stopData = {
//         entryPrice,
//         worstPrice: entryPrice,
//         active: true,
//         side,
//         timer: Date.now()
//     };

//     state.stopMonitors.set(pair, stopData);

//     const protectionInterval = setInterval(async () => {
//         try {
//             const currentPrice = await getCurrentPrice(pair);
//             if (!currentPrice || !stopData.active) return;

//             stopData.worstPrice = side === 'BUY'
//                 ? Math.min(stopData.worstPrice, currentPrice)
//                 : Math.max(stopData.worstPrice, currentPrice);

//             const loss = side === 'BUY'
//                 ? ((entryPrice - currentPrice) / entryPrice) * 100
//                 : ((currentPrice - entryPrice) / entryPrice) * 100;

//             if (loss >= config.RISK_MANAGEMENT.MAX_LOSS_PERCENTAGE) {
//                 console.log(`\n🚨 STOP LOSS (${loss.toFixed(2)}%)`);
//                 await forceClosePosition(pair, quantity);
//                 clearInterval(protectionInterval);
//             }

//         } catch (error) {
//             console.error(`❌ Monitor ${pair}:`, error.message);
//         }
//     }, 3000);
// }

// // ========== GESTÃO DE ORDENS ==========
// async function executeOrder(pair, side, entryPrice) {
//     try {
//         if (state.openPositions.has(pair)) {
//             console.log(`⏩ ${pair} | Posição já ativa`);
//             return false;
//         }

//         const quantity = await calculateQuantity(pair, entryPrice);
//         if (!quantity) return false;

//         console.log(`\n⚡ ${side} ${pair} @ ${entryPrice.toFixed(state.pairs[pair].pricePrecision)}`);
//         console.log(`   ▸ Qtd: ${quantity} | Alavancagem: ${config.RISK_MANAGEMENT.LEVERAGE}x | Risco: ${config.RISK_MANAGEMENT.RISK_PER_TRADE}%`);

//         const order = await client.futuresOrder({
//             symbol: pair,
//             side: side,
//             type: 'MARKET',
//             quantity: quantity.toFixed(state.pairs[pair].quantityPrecision)
//         });

//         const executedTrade = await verifyExecution(order.orderId);
//         state.openPositions.set(pair, true);

//         await setTrailingStop(pair, side, quantity, executedTrade.price);
//         await startProtectionSystem(pair, side, executedTrade.price, quantity);

//         return true;

//     } catch (error) {
//         console.error(`❌ Falha na ordem: ${error.message}`);
//         await emergencyClose(pair);
//         return false;
//     }
// }

// async function setTrailingStop(pair, side, quantity, executedPrice) {
//     try {
//         const callbackRate = parseFloat(config.RISK_MANAGEMENT.TRAILING_STOP_CALLBACK);
//         const activationPrice = side === 'BUY'
//             ? executedPrice * (1 + callbackRate / 100)
//             : executedPrice * (1 - callbackRate / 100);

//         const order = await client.futuresOrder({
//             symbol: pair,
//             side: side === 'BUY' ? 'SELL' : 'BUY',
//             type: 'TRAILING_STOP_MARKET',
//             quantity: quantity.toFixed(state.pairs[pair].quantityPrecision),
//             activationPrice: activationPrice.toFixed(state.pairs[pair].pricePrecision),
//             callbackRate: callbackRate,
//             reduceOnly: 'true',
//             workingType: 'MARK_PRICE'
//         });

//         console.log(`✅ Trailing Stop: ${callbackRate}% | Ativação: ${activationPrice.toFixed(state.pairs[pair].pricePrecision)}`);
//         return order;
//     } catch (error) {
//         console.error(`❌ Trailing Stop falhou: ${error.message}`);
//         throw error;
//     }
// }

// // ========== FECHAMENTO ==========
// async function forceClosePosition(pair, quantity) {
//     try {
//         const monitor = state.stopMonitors.get(pair);
//         if (monitor) monitor.active = false;

//         await client.futuresOrder({
//             symbol: pair,
//             side: monitor.side === 'BUY' ? 'SELL' : 'BUY',
//             type: 'MARKET',
//             quantity: quantity.toFixed(state.pairs[pair].quantityPrecision),
//             reduceOnly: 'true'
//         });

//         // Cancela ordens pendentes
//         const orders = await client.futuresOpenOrders({ symbol: pair });
//         await Promise.all(orders.map(order => 
//             client.futuresCancelOrder({
//                 symbol: pair,
//                 orderId: order.orderId
//             })
//         ));

//         state.openPositions.delete(pair);
//         console.log('✅ Posição forçada encerrada');
//     } catch (error) {
//         console.error('❌ Fechamento forçado falhou:', error.message);
//     }
// }

// async function emergencyClose(pair) {
//     try {
//         console.log(`\n🚨 Emergência em ${pair}`);
//         const positions = await client.futuresPositionRisk({ symbol: pair });
//         const position = positions.find(p => Math.abs(parseFloat(p.positionAmt)) > 0);
        
//         if (position) {
//             await forceClosePosition(
//                 pair,
//                 Math.abs(parseFloat(position.positionAmt))
//             );
//         }
//     } catch (error) {
//         console.error('❌ Falha crítica:', error.message);
//     }
// }

// async function emergencyCloseAll() {
//     try {
//         console.log('\n🛑 Fechando TODAS as posições');
//         const positions = await client.futuresPositionRisk();
//         await Promise.all(positions
//             .filter(p => Math.abs(parseFloat(p.positionAmt)) > 0)
//             .map(p => emergencyClose(p.symbol))
//         );
//     } catch (error) {
//         console.error('❌ Falha no fechamento total:', error);
//     }
// }

// // ========== UTILITÁRIOS ==========
// async function verifyExecution(orderId) {
//     try {
//         let attempts = 3;
//         while (attempts-- > 0) {
//             const trades = await client.futuresUserTrades({ orderId });
//             if (trades.length) return trades[0];
//             await new Promise(resolve => setTimeout(resolve, 2000));
//         }
//         throw new Error('Confirmação não recebida');
//     } catch (error) {
//         console.error('❌ Verificação falhou:', error.message);
//         throw error;
//     }
// }

// async function calculateQuantity(pair, price) {
//     try {
//         const pairConfig = state.pairs[pair];
//         const balance = await getAvailableBalance();
//         const riskAmount = balance * (config.RISK_MANAGEMENT.RISK_PER_TRADE / 100);
        
//         let quantity = (riskAmount * config.RISK_MANAGEMENT.LEVERAGE) / price;
//         quantity = Math.floor(quantity / pairConfig.stepSize) * pairConfig.stepSize;
//         quantity = parseFloat(quantity.toFixed(pairConfig.quantityPrecision));

//         // Validação
//         if ((quantity * price) < pairConfig.minNotional) {
//             throw new Error(`Valor mínimo não atingido (${pairConfig.minNotional} USDT)`);
//         }

//         console.log(`ℹ️ Risco: $${riskAmount.toFixed(2)} (${config.RISK_MANAGEMENT.RISK_PER_TRADE}%)`);
//         return quantity;
//     } catch (error) {
//         console.error(`❌ Cálculo falhou: ${error.message}`);
//         return null;
//     }
// }

// async function getCurrentPrice(pair) {
//     try {
//         const ticker = await client.futuresMarkPrice({ symbol: pair });
//         return parseFloat(ticker.markPrice);
//     } catch (error) {
//         console.error(`❌ Preço de ${pair}:`, error.message);
//         return null;
//     }
// }

// async function getAvailableBalance() {
//     try {
//         const account = await client.futuresAccountInfo();
//         return parseFloat(account.availableBalance);
//     } catch (error) {
//         console.error('❌ Saldo indisponível:', error);
//         return 0;
//     }
// }

// module.exports = {
//     initialize,
//     enterLong: (pair, price) => executeOrder(pair, 'BUY', price),
//     enterShort: (pair, price) => executeOrder(pair, 'SELL', price),
//     emergencyClose,
//     emergencyCloseAll,
//     hasOpenPosition: (pair) => state.openPositions.has(pair)
// };

const { client } = require('./connection');
const config = require('./config');

const state = {
    pairs: {},
    openPositions: new Map(),
    stopMonitors: new Map()
};

async function initialize() {
    try {
        console.log('⚙️ Inicializando pares...');
        
        const balance = await getAvailableBalance();
        console.log(`ℹ️ Saldo Disponível: ${balance.toFixed(2)} USDT`);

        if (balance < config.RISK_MANAGEMENT.MIN_BALANCE) {
            console.log('⚠️ Saldo abaixo do mínimo. Verifique posições.');
            await emergencyCloseAll();
            return false;
        }

        for (const pair of Object.keys(config.PAIRS)) {
            if (!config.PAIRS[pair].enabled) continue;

            const exchangeInfo = await client.futuresExchangeInfo();
            const symbol = exchangeInfo.symbols.find(s => s.symbol === pair);

            state.pairs[pair] = {
                quantityPrecision: symbol.quantityPrecision,
                pricePrecision: symbol.pricePrecision,
                stepSize: parseFloat(symbol.filters.find(f => f.filterType === 'LOT_SIZE').stepSize),
                minNotional: parseFloat(symbol.filters.find(f => f.filterType === 'MIN_NOTIONAL').notional)
            };

            try {
                await client.futuresMarginType({
                    symbol: pair,
                    marginType: config.MARGIN_TYPE
                });

                await client.futuresLeverage({
                    symbol: pair,
                    leverage: config.PAIRS[pair].leverage
                });

                console.log(`✅ ${pair} | ${config.MARGIN_TYPE} ${config.PAIRS[pair].leverage}x`);

            } catch (error) {
                if (error.message.includes('No need to change')) {
                    console.log(`⚠️ ${pair} | Configuração já aplicada`);
                } else {
                    console.error(`❌ Erro em ${pair}:`, error.message);
                }
            }
        }

        console.log('\n✅ Configuração concluída');
        return true;

    } catch (error) {
        console.error('❌ Falha na inicialização:', error.message);
        process.exit(1);
    }
}

async function startProtectionSystem(pair, side, entryPrice, quantity) {
    const stopData = {
        entryPrice,
        worstPrice: entryPrice,
        active: true,
        side,
        timer: Date.now()
    };

    state.stopMonitors.set(pair, stopData);

    const protectionInterval = setInterval(async () => {
        try {
            const currentPrice = await getCurrentPrice(pair);
            if (!currentPrice || !stopData.active) return;

            stopData.worstPrice = side === 'BUY'
                ? Math.min(stopData.worstPrice, currentPrice)
                : Math.max(stopData.worstPrice, currentPrice);

            const loss = side === 'BUY'
                ? ((entryPrice - currentPrice) / entryPrice) * 100
                : ((currentPrice - entryPrice) / entryPrice) * 100;

            if (loss >= config.RISK_MANAGEMENT.MAX_LOSS_PERCENTAGE) {
                console.log(`\n🚨 STOP LOSS (${loss.toFixed(2)}%)`);
                await forceClosePosition(pair, quantity);
                clearInterval(protectionInterval);
            }

        } catch (error) {
            console.error(`❌ Monitor ${pair}:`, error.message);
        }
    }, 3000);
}

async function executeOrder(pair, side, entryPrice) {
    try {
        if (state.openPositions.has(pair)) {
            console.log(`⏩ ${pair} | Posição já ativa`);
            return false;
        }

        const quantity = await calculateQuantity(pair, entryPrice);
        if (!quantity) return false;

        console.log(`\n⚡ ${side} ${pair} @ ${entryPrice.toFixed(state.pairs[pair].pricePrecision)}`);
        console.log(`   ▸ Qtd: ${quantity} | Risco: ${config.RISK_MANAGEMENT.RISK_PER_TRADE}%`);

        const order = await client.futuresOrder({
            symbol: pair,
            side: side,
            type: 'MARKET',
            quantity: quantity.toFixed(state.pairs[pair].quantityPrecision)
        });

        const executedTrade = await verifyExecution(order.orderId);
        state.openPositions.set(pair, true);

        await setTrailingStop(pair, side, quantity, executedTrade.price);
        await startProtectionSystem(pair, side, executedTrade.price, quantity);

        return true;

    } catch (error) {
        console.error(`❌ Falha na ordem: ${error.message}`);
        await emergencyClose(pair);
        return false;
    }
}

async function setTrailingStop(pair, side, quantity, executedPrice) {
    try {
        const callbackRate = parseFloat(config.RISK_MANAGEMENT.TRAILING_STOP_CALLBACK);
        const activationPrice = side === 'BUY'
            ? executedPrice * (1 + callbackRate / 100)
            : executedPrice * (1 - callbackRate / 100);

        const order = await client.futuresOrder({
            symbol: pair,
            side: side === 'BUY' ? 'SELL' : 'BUY',
            type: 'TRAILING_STOP_MARKET',
            quantity: quantity.toFixed(state.pairs[pair].quantityPrecision),
            activationPrice: activationPrice.toFixed(state.pairs[pair].pricePrecision),
            callbackRate: callbackRate,
            reduceOnly: 'true',
            workingType: 'MARK_PRICE'
        });

        console.log(`✅ Trailing Stop: ${callbackRate}% | Ativação: ${activationPrice.toFixed(state.pairs[pair].pricePrecision)}`);
        return order;
    } catch (error) {
        console.error(`❌ Trailing Stop falhou: ${error.message}`);
        throw error;
    }
}

async function forceClosePosition(pair, quantity) {
    try {
        const monitor = state.stopMonitors.get(pair);
        if (monitor) monitor.active = false;

        await client.futuresOrder({
            symbol: pair,
            side: monitor.side === 'BUY' ? 'SELL' : 'BUY',
            type: 'MARKET',
            quantity: quantity.toFixed(state.pairs[pair].quantityPrecision),
            reduceOnly: 'true'
        });

        const orders = await client.futuresOpenOrders({ symbol: pair });
        await Promise.all(orders.map(order => 
            client.futuresCancelOrder({
                symbol: pair,
                orderId: order.orderId
            })
        ));

        state.openPositions.delete(pair);
        console.log('✅ Posição forçada encerrada');
    } catch (error) {
        console.error('❌ Fechamento forçado falhou:', error.message);
    }
}

async function emergencyClose(pair) {
    try {
        console.log(`\n🚨 Emergência em ${pair}`);
        const positions = await client.futuresPositionRisk({ symbol: pair });
        const position = positions.find(p => Math.abs(parseFloat(p.positionAmt)) > 0);
        
        if (position) {
            await forceClosePosition(
                pair,
                Math.abs(parseFloat(position.positionAmt))
            );
        }
    } catch (error) {
        console.error('❌ Falha crítica:', error.message);
    }
}

async function emergencyCloseAll() {
    try {
        console.log('\n🛑 Fechando TODAS as posições');
        const positions = await client.futuresPositionRisk();
        await Promise.all(positions
            .filter(p => Math.abs(parseFloat(p.positionAmt)) > 0)
            .map(p => emergencyClose(p.symbol))
        );
    } catch (error) {
        console.error('❌ Falha no fechamento total:', error);
    }
}

async function verifyExecution(orderId) {
    try {
        let attempts = 3;
        while (attempts-- > 0) {
            const trades = await client.futuresUserTrades({ orderId });
            if (trades.length) return trades[0];
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Confirmação não recebida');
    } catch (error) {
        console.error('❌ Verificação falhou:', error.message);
        throw error;
    }
}

async function calculateQuantity(pair, price) {
    try {
        const pairConfig = state.pairs[pair];
        const balance = await getAvailableBalance();
        const riskAmount = balance * (config.RISK_MANAGEMENT.RISK_PER_TRADE / 100);
        
        let quantity = (riskAmount * config.PAIRS[pair].leverage) / price;
        quantity = Math.floor(quantity / pairConfig.stepSize) * pairConfig.stepSize;
        quantity = parseFloat(quantity.toFixed(pairConfig.quantityPrecision));

        if ((quantity * price) < 1) { // Força mínimo de 1 USDT
            quantity = (1 / price).toFixed(pairConfig.quantityPrecision);
        }

        console.log(`ℹ️ Risco: $${riskAmount.toFixed(2)}`);
        return quantity;
    } catch (error) {
        console.error(`❌ Cálculo falhou: ${error.message}`);
        return null;
    }
}

async function getCurrentPrice(pair) {
    try {
        const ticker = await client.futuresMarkPrice({ symbol: pair });
        return parseFloat(ticker.markPrice);
    } catch (error) {
        console.error(`❌ Preço de ${pair}:`, error.message);
        return null;
    }
}

async function getAvailableBalance() {
    try {
        const account = await client.futuresAccountInfo();
        return parseFloat(account.availableBalance);
    } catch (error) {
        console.error('❌ Saldo indisponível:', error);
        return 0;
    }
}

module.exports = {
    initialize,
    enterLong: (pair, price) => executeOrder(pair, 'BUY', price),
    enterShort: (pair, price) => executeOrder(pair, 'SELL', price),
    emergencyClose,
    emergencyCloseAll,
    hasOpenPosition: (pair) => state.openPositions.has(pair)
};


    