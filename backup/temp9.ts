import { getBotConfig } from './src/lib/db';

async function main() {
    console.log("Fetching bot config...");
    const config = await getBotConfig();
    console.log("RAW CONFIG:", JSON.stringify(config, null, 2));
    console.log("Type of pilot_mtf_threshold:", typeof config.pilot_mtf_threshold);
    console.log("Value:", config.pilot_mtf_threshold);
    console.log("Parsed logic:", Number(config.pilot_mtf_threshold) || 80);
    
    // Simulate Strategy logic
    const mtfThreshold = Number(config.pilot_mtf_threshold) || 80;
    console.log("mtfThreshold assigned:", mtfThreshold);
    process.exit(0);
}

main().catch(console.error);
