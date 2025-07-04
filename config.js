

// module.exports = {
//     DEBUG_MODE: false,
//     PAIRS: {
//         'DOGEUSDT': true,
//         'ADAUSDT': false,
//         'TRXUSDT': false,
//         'ETHUSDT': false,
//         'XRPUSDT': true,
//         'SUIUSDT': false,
//         '1000PEPEUSDT': false,
//     },

//     MARGIN_TYPE: 'ISOLATED',

//     INTERVAL: '1m',
//     CHECK_INTERVAL: 30000,
    
//     RISK_MANAGEMENT: {
//         LEVERAGE: 10,
//         RISK_PER_TRADE: 30,
//         MIN_BALANCE: 1,
//         TRAILING_STOP_CALLBACK: "0.20",
//         MAX_LOSS_PERCENTAGE: 0.18,
//     },

//     PATTERNS: {
//         HAMMERS: true,
//         INVERTED_HAMMERS: true,
//         DOJIS: true
//     },
    
//     CONFIRMATION_CANDLES: 3,
//     SWING_LOOKBACK: 5,
// };

module.exports = {
    DEBUG_MODE: true,
    PAIRS: {
        'DOGEUSDT': { enabled: true, leverage: 10 },
        'ADAUSDT': { enabled: false, leverage: 10 },
        'TRXUSDT': { enabled: false, leverage: 10 },
        'ETHUSDT': { enabled: false, leverage: 10 },
        'XRPUSDT': { enabled: false, leverage: 10 },
        'SUIUSDT': { enabled: false, leverage: 10 },
        '1000PEPEUSDT': { enabled: false, leverage: 10 },
    },

    MARGIN_TYPE: 'ISOLATED',
    INTERVAL: '1m',
    CHECK_INTERVAL: 15000,
    
    RISK_MANAGEMENT: {
        RISK_PER_TRADE: 50,
        MIN_BALANCE: 1,
        TRAILING_STOP_CALLBACK: "0.20",
        MAX_LOSS_PERCENTAGE: 0.18
    },

    PATTERNS: {
        HAMMERS: true,
        INVERTED_HAMMERS: true,
        DOJIS: true
    },
    
    CONFIRMATION_CANDLES: 3,
    SWING_LOOKBACK: 5
};
