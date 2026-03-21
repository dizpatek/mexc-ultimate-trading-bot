import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 🧪 MASTER TEST LAB
 */

async function testLab() {
  const symbol = process.argv[2] || 'BTCUSDT';
  const type = process.argv[3] || 'BUY';
  const userId = 14;

  console.log(`\n--- 🧪 MASTER TEST LAB: SİNYAL SİMÜLASYONU ---`);
  try {
    const res = await DiagnosticsService.triggerSignal(symbol, type, userId);
    if (res.success) {
      console.log(`   ✅ Sinyal enjekte edildi: ${symbol} ${type}`);
    }
  } catch (err) {
    console.error(`\n❌ TEST LAB HATASI:`, err);
  }
}

testLab();
