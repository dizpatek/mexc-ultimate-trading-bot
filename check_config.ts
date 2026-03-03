import { sql } from './src/lib/postgres';
import { getBotConfig } from './src/lib/db';

async function check() {
    try {
        const config = await getBotConfig();
        console.log('CURRENT CONFIG:', JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('ERROR:', e);
    }
}
check();
