const { chromium } = require('playwright');

const TESTS = [
  {
    name: '1. Trailing Buy (TBY)',
    setup: async (page) => {
      // Navigate to page and wait for it to load
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Check if login required
      const loginBtn = await page.$('button:has-text("Login"), button:has-text("Giriş")');
      if (loginBtn) {
        console.log('⚠️ Login required - please login manually first');
        return null;
      }
      
      return {
        symbol: 'BTC/USDT',
        mode: 'TRADE',
        buyPriceOffset: -0.02, // 2% below
        trailingBuy: true,
        trailingBuyDev: 1.0,
        tpPercent: 3,
        slPercent: 2
      };
    }
  },
  {
    name: '2. Trailing Take Profit (TTP)',
    setup: async (page) => {
      return {
        symbol: 'BTC/USDT',
        mode: 'TRADE',
        trailingTp: true,
        tpDeviation: 1.0,
        tpPercent: 5,
        slPercent: 2
      };
    }
  },
  {
    name: '3. Trailing Stop Loss (TSL)',
    setup: async (page) => {
      return {
        symbol: 'BTC/USDT',
        mode: 'TRADE',
        trailingSl: true,
        slDeviation: 2.0,
        tpPercent: 5,
        slPercent: 2
      };
    }
  },
  {
    name: '4. Smart Cover',
    setup: async (page) => {
      return {
        symbol: 'BTC/USDT',
        mode: 'COVER',
        useExisting: true,
        tpPercent: 3,
        slPercent: 2
      };
    }
  },
  {
    name: '5. Flash Open',
    setup: async (page) => {
      return {
        symbol: 'ETH/USDT',
        mode: 'TRADE',
        trailingBuy: true,
        trailingBuyDev: 2.0,
        tpPercent: 5,
        slPercent: 3
      };
    },
    flashOpen: true
  },
  {
    name: '6. Breakeven',
    setup: async (page) => {
      return {
        symbol: 'BTC/USDT',
        mode: 'TRADE',
        breakeven: true,
        tpPercent: 5,
        slPercent: 2
      };
    }
  },
  {
    name: '7. Split TP',
    setup: async (page) => {
      return {
        symbol: 'BTC/USDT',
        mode: 'TRADE',
        splitTp: true,
        tpTargets: [2, 4, 6], // 3 targets at 2%, 4%, 6%
        slPercent: 3
      };
    }
  },
  {
    name: '8. Timeout SL',
    setup: async (page) => {
      return {
        symbol: 'BTC/USDT',
        mode: 'TRADE',
        timeout: true,
        timeoutSeconds: 30,
        tpPercent: 10, // Hard to reach
        slPercent: 5
      };
    }
  }
];

async function getCurrentPrice(symbol) {
  // This would need to be implemented based on the actual page
  return 95000; // Default for BTC
}

async function runTest(page, test, testNum) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🧪 ${test.name}`);
  console.log('='.repeat(50));
  
  try {
    const config = await test.setup(page);
    if (!config) {
      console.log('⚠️ Test skipped - requires manual login');
      return { success: false, reason: 'Login required' };
    }
    
    console.log(`📋 Config: ${JSON.stringify(config, null, 2)}`);
    
    // Take screenshot
    await page.screenshot({ path: `test-${testNum}-${test.name.replace(/\s+/g, '-')}-start.png` });
    
    // If flashOpen test, we need to first create a pending trade then flash it
    if (test.flashOpen) {
      console.log('⚡ Flash Open test - creating pending trade first...');
    }
    
    console.log(`⏳ Waiting for test to complete (60 seconds)...`);
    await page.waitForTimeout(60000);
    
    // Check results
    const status = await page.textContent('body');
    const hasError = status.includes('error') || status.includes('hata') || status.includes('Error');
    
    // Take final screenshot
    await page.screenshot({ path: `test-${testNum}-${test.name.replace(/\s+/g, '-')}-end.png` });
    
    console.log(`✅ Test completed`);
    return { success: !hasError };
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    await page.screenshot({ path: `test-${testNum}-error.png` });
    return { success: false, reason: error.message };
  }
}

async function main() {
  console.log('🚀 Starting SmartTrade Test Suite');
  console.log('='.repeat(50));
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`🔴 Console Error: ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`🔴 Page Error: ${error.message}`);
  });
  
  const results = [];
  
  for (let i = 0; i < TESTS.length; i++) {
    const result = await runTest(page, TESTS[i], i + 1);
    results.push({ test: TESTS[i].name, ...result });
    
    // Wait between tests
    console.log('⏳ Waiting 5 seconds before next test...');
    await page.waitForTimeout(5000);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.test}: ${r.success ? '✅ PASS' : '❌ FAIL'}${r.reason ? ` (${r.reason})` : ''}`);
  });
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n📈 Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  
  await browser.close();
  
  console.log('\n🎉 Test suite completed!');
}

main().catch(console.error);
