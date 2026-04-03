const fs = require('fs');
let C = fs.readFileSync('scripts/sync_maker_taker.ts', 'utf8');

const target1 = "const trades = await exchange.fetchTrades(targetSymbol, from, 1000);";
const repl1 = `const params: any = {};
        if (['MEXC_SPOT', 'COINBASE_SPOT', 'MEXC_PERP'].includes(exchangeStr)) {
            params.until = to;
        }
        const trades = await exchange.fetchTrades(targetSymbol, from, 1000, params);`;

C = C.replace(target1, repl1);

const target2 = `console.warn(\`[SYNC/CCXT-ERR] \${exchangeStr} veri cekilemedi: \${e.message.split('\\n')[0].substring(0, 150)}\`);`;
const repl2 = `// console.warn(\`[SYNC/CCXT-ERR] \${exchangeStr} veri cekilemedi: \${e.message.split('\\n')[0].substring(0, 150)}\`);`;

C = C.replace(target2, repl2);

fs.writeFileSync('scripts/sync_maker_taker.ts', C);
console.log("Patch successfully applied!");
