import fs from 'fs';
const presets = fs.readFileSync('temp_bot_presets.ts', 'utf8');
fs.appendFileSync('src/lib/constants/bot-defaults.ts', '\n' + presets);
console.log("Appended presets successfully.");
