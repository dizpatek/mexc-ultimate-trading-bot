import { sql, pool } from './postgres';
import fs from 'fs';
import path from 'path';

/**
 * 🛠️ CORE DIAGNOSTICS SERVICE
 * Powers both CLI Master Tools and Web Admin Dashboard.
 */

export const DiagnosticsService = {
  // 1. System Audit
  async getSystemAudit(userId: number = 14) {
    const { rows: dbTest } = await sql`SELECT version(), now()`;
    const dbInfo = dbTest[0] as any;
    const tables = ['system_settings', 'bot_configs', 'strategy_signals', 'orders', 'system_logs', 'portfolio'];
    const tableStatus = [];

    for (const t of tables) {
      const { rows } = await sql`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = ${t}
      `;
      tableStatus.push({ name: t, exists: rows.length > 0 });
    }

    const { rows: settings } = await sql`SELECT key, value FROM system_settings WHERE user_id = ${userId}`;
    const clientTime = Date.now();
    const serverTime = new Date(dbInfo?.now).getTime();
    
    return {
      dbVersion: dbInfo?.version?.split(' ')[0],
      serverTime: dbInfo?.now,
      tableStatus,
      settings,
      drift: clientTime - serverTime
    };
  },

  // 2. Pilot Hub
  async getPilotHub(userId: number = 14) {
    const { rows: config } = await sql`SELECT pilot_mode, auto_trade, pilot_timeframe, pilot_only_holdings FROM bot_configs WHERE user_id = ${userId}`;
    const { rows: signals } = await sql`
      SELECT symbol, signal_type as type, timeframe, timestamp 
      FROM strategy_signals 
      WHERE user_id = ${userId}
      ORDER BY timestamp DESC LIMIT 5
    `;
    const { rows: logs } = await sql`
      SELECT message, timestamp FROM system_logs 
      WHERE user_id = ${userId} AND (message ILIKE '%scan%' OR message ILIKE '%tarama%')
      ORDER BY timestamp DESC LIMIT 5
    `;

    return {
      config: config[0],
      recentSignals: signals,
      recentScans: logs
    };
  },

  // 3. Portfolio Guardian
  async getPortfolioGuardian(userId: number = 14) {
    const { rows: holdings } = await sql`SELECT symbol, balance FROM portfolio WHERE user_id = ${userId}`;
    const { rows: memory } = await sql`
      SELECT symbol, status, (meta::jsonb->>'exitPrice')::numeric as exit_price, (meta::jsonb->>'executedQty')::numeric as qty
      FROM orders 
      WHERE user_id = ${userId} AND status = 'CLOSED' AND meta::jsonb->>'smartTrade' = 'true'
      ORDER BY updated_at DESC LIMIT 5
    `;
    
    // Anomalies
    const { rows: activeOrders } = await sql`SELECT symbol FROM orders WHERE user_id = ${userId} AND status = 'FILLED'`;
    const anomalies = activeOrders.filter(o => !holdings.some(h => (h as any).symbol === o.symbol));

    return {
      holdings,
      memory,
      anomalies
    };
  },

  // 4. Performance Analyzer
  async getPerformance(userId: number = 14) {
    const { rows: trades } = await sql`
      SELECT (meta::jsonb->>'entryPrice')::numeric as entry_price, (meta::jsonb->>'exitPrice')::numeric as exit_price,
             (meta::jsonb->>'executedQty')::numeric as qty, meta::jsonb->>'exitReason' as exit_reason
      FROM orders WHERE user_id = ${userId} AND status = 'CLOSED' 
      ORDER BY updated_at DESC LIMIT 50
    `;

    let profit = 0, loss = 0;
    const reasons: Record<string, number> = {};
    
    trades.forEach((t: any) => {
      const pnl = (Number(t.exit_price || 0) - Number(t.entry_price || 0)) * Number(t.qty || 0);
      if (pnl > 0) profit++; else loss++;
      const r = t.exit_reason || 'Unknown';
      reasons[r] = (reasons[r] || 0) + 1;
    });

    return {
      total: trades.length,
      winRate: trades.length > 0 ? (profit / trades.length) * 100 : 0,
      reasons
    };
  },

  // 5. Maintenance Kit
  async getMaintenance(userId: number = 14) {
    const { rows: duplicates } = await sql`
      SELECT symbol, count(*) FROM orders WHERE user_id = ${userId} AND status = 'FILLED'
      GROUP BY symbol, meta::jsonb->>'mode' HAVING count(*) > 1
    `;
    const { rows: indexes } = await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname LIKE '%user_id%'`;

    return {
      duplicates,
      indexHealth: indexes.length > 0
    };
  },

  // 6. DB Orchestrator
  async getDbStatus() {
    const schemaPath = path.resolve('scripts/schema.sql');
    const { rows: users } = await sql`SELECT count(*) FROM users`;
    return {
      schemaFileExists: fs.existsSync(schemaPath),
      userCount: (users[0] as any).count
    };
  },

  // 7. Deployment Hub (Detailed)
  async getDeploymentStatus() {
    const serviceFile = path.resolve('scripts/nf-service.json');
    const addonFile = path.resolve('scripts/nf-addon.json');
    const dockerFile = path.resolve('Dockerfile');
    const envFile = path.resolve('.env.local');

    let serviceInfo = {};
    let addonInfo = {};

    if (fs.existsSync(serviceFile)) {
      const content = JSON.parse(fs.readFileSync(serviceFile, 'utf8'));
      serviceInfo = {
        name: content.name,
        plan: content.billing?.deploymentPlan,
        instances: content.deployment?.instances,
        repo: content.vcsData?.projectUrl,
        branch: content.vcsData?.projectBranch
      };
    }

    if (fs.existsSync(addonFile)) {
      const content = JSON.parse(fs.readFileSync(addonFile, 'utf8'));
      addonInfo = {
        name: content.name,
        dbType: content.type,
        dbVersion: content.version,
        plan: content.billing?.deploymentPlan,
        storage: content.billing?.storage
      };
    }

    return {
      service: serviceInfo,
      addon: addonInfo,
      dockerReady: fs.existsSync(dockerFile),
      envFound: fs.existsSync(envFile)
    };
  },

  // 8. Worker Heartbeat info
  async getWorkerHeartbeat() {
    // These reflect bot-worker.mjs intervals
    return {
      intervals: [
        { name: 'STRATEGIES', interval: '90s', target: 'Test & Production' },
        { name: 'TRAILING STOP', interval: '45s', target: 'Profit Monitor' },
        { name: 'ALARMS', interval: '15m', target: 'Security' },
        { name: 'PRICE HISTORY', interval: '1h', target: 'Analytics' },
        { name: 'SNAPSHOT', interval: '24h', target: 'Portfolio' }
      ]
    };
  },

  // 9. Live Logs
  async getLiveLogs(limit = 50) {
    const { rows: logs } = await sql`
      SELECT id, message, level as type, timestamp 
      FROM system_logs 
      ORDER BY timestamp DESC LIMIT ${limit}
    `;
    return logs;
  },

  // 10. Force Cleanup (Legacy cleanup_duplicate_trades.js logic)
  async runForceCleanup(userId: number = 14) {
    const { rows: allActive } = await sql`
      SELECT id, symbol, (meta::jsonb->>'mode') as mode 
      FROM orders 
      WHERE user_id = ${userId} AND status = 'FILLED' AND meta::jsonb->>'smartTrade' = 'true'
      ORDER BY created_at DESC
    `;

    if (allActive.length <= 1) return { success: true, removedCount: 0 };

    // Sembol bazında gruplayarak, HER SEMBOL İÇİN ayrı ayrı en güncel olanı tut.
    const bySymbol: Record<string, any[]> = {};
    for (const row of allActive) {
      const o = row as any;
      if (!bySymbol[o.symbol]) bySymbol[o.symbol] = [];
      bySymbol[o.symbol].push(o);
    }

    const idsToClose: any[] = [];
    for (const symbol in bySymbol) {
      const ordersForSymbol = bySymbol[symbol];
      if (ordersForSymbol.length <= 1) continue;

      const tradeToKeep = ordersForSymbol.find(o => o.mode === 'TRADE');
      const coverToKeep = ordersForSymbol.find(o => o.mode === 'COVER');

      for (const o of ordersForSymbol) {
        if (o.id !== tradeToKeep?.id && o.id !== coverToKeep?.id) {
          idsToClose.push(o.id);
        }
      }
    }

    if (idsToClose.length > 0) {
      const res = await sql`
        UPDATE orders 
        SET status = 'CLOSED', 
            updated_at = ${Date.now()},
            meta = (meta::jsonb || ${JSON.stringify({exitReason: "ADMIN_FORCE_CLEANUP", cleaned_at: Date.now()})}::jsonb)::text
        WHERE id = ANY(${idsToClose})
      `;
      return { success: true, removedCount: (res as any).rowCount };
    }
    return { success: true, removedCount: 0 };
  },

  // 10.5 Portfolio Anomaly Fixer (Hayalet Emir Temizliği)
  async runAnomalyCleanup(userId: number = 14) {
    const { rows: holdings } = await sql`SELECT symbol, balance FROM portfolio WHERE user_id = ${userId}`;
    const { rows: activeOrders } = await sql`
      SELECT id, symbol FROM orders 
      WHERE user_id = ${userId} AND status = 'FILLED' AND meta::jsonb->>'smartTrade' = 'true'
    `;
    
    // Find orders where the symbol is NOT in holdings, OR balance is effectively 0
    const ghostOrderIds = activeOrders
      .filter(o => {
        const h = holdings.find(h => (h as any).symbol === o.symbol);
        return !h || Number((h as any).balance) < 0.00000001; // Extremely small dust or zero
      })
      .map(o => o.id);

    if (ghostOrderIds.length > 0) {
      const res = await sql`
        UPDATE orders 
        SET status = 'CLOSED', 
            updated_at = ${Date.now()},
            meta = (meta::jsonb || ${JSON.stringify({exitReason: "GHOST_ORDER_CLEANUP", cleaned_at: Date.now()})}::jsonb)::text
        WHERE id = ANY(${ghostOrderIds})
      `;
      return { success: true, removedCount: ghostOrderIds.length, symbols: ghostOrderIds.map(id => activeOrders.find(o => o.id === id)?.symbol) };
    }
    return { success: true, removedCount: 0, symbols: [] };
  },

  // 11. Advanced User Management
  async getAllUsers() {
    const { rows } = await sql`
      SELECT id, username, email, is_admin, created_at,
      (SELECT count(*) FROM orders WHERE user_id = users.id) as order_count,
      (SELECT count(*) FROM portfolio WHERE user_id = users.id) as asset_count
      FROM users ORDER BY id ASC
    `;
    return rows;
  },

  async toggleAdmin(userId: number, isAdmin: boolean) {
    if (userId === 1) return { error: "Main admin status cannot be changed" };
    await sql`UPDATE users SET is_admin = ${isAdmin} WHERE id = ${userId}`;
    return { success: true };
  },

  // 12. DB Explorer Engine
  async getTables() {
    const { rows } = await sql`
      SELECT table_name, table_schema FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name ASC
    `;
    return rows; // Returns [{table_name, table_schema}, ...]
  },

  async getTableData(tableName: string, limit = 50, schema = 'public') {
    // Validate schema and table name against info schema to prevent injection
    const { rowCount } = await sql`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = ${tableName} AND table_schema = ${schema}
    `;
    if (rowCount === 0) throw new Error("Invalid table or schema");

    const result = await pool.query(`SELECT * FROM ${schema}.${tableName} ORDER BY 1 DESC LIMIT ${limit}`);
    return result.rows;
  },

  async deleteRecord(tableName: string, id: any) {
    const rows = await this.getTables();
    if (!rows.find((r: any) => r.table_name === tableName)) throw new Error("Invalid table name");
    
    await pool.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    return { success: true };
  },

  async clearTable(tableName: string) {
    const rows = await this.getTables();
    if (!rows.find((r: any) => r.table_name === tableName)) throw new Error("Invalid table name");
    
    await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
    return { success: true, message: `Table ${tableName} cleared.` };
  },

  // 13. Reusable User Purge (Extracted from Admin API)
  async purgeUser(userId: number) {
    if (userId === 1) throw new Error("Main admin cannot be purged");
    
    const tables = [
      'system_logs', 'alarm_logs', 'alarms', 'dca_bots', 'performance_metrics', 
      'panic_snapshots', 'system_settings', 'strategy_signals', 'strategies', 
      'trade_history', 'orders', 'portfolio', 'portfolio_snapshots',
      'bot_configs', 'notifications', 'notification_reads'
    ];

    for (const t of tables) {
      try {
        await sql`DELETE FROM ${t} WHERE user_id = ${userId}`;
      } catch (e) {
        console.warn(`Purge step fail on ${t}:`, e);
      }
    }

    await sql`DELETE FROM users WHERE id = ${userId}`;
    return { success: true };
  },

  async triggerSignal(symbol: string, type: string, userId: number | 'ALL' = 14) {
    const targetIds = userId === 'ALL' 
       ? (await this.getAllUsers()).map((u: any) => u.id)
       : [userId];

    for (const id of targetIds) {
      await sql`DELETE FROM strategy_signals WHERE symbol = ${symbol} AND user_id = ${id}`;
      const timestamp = Date.now();
      await sql`
        INSERT INTO strategy_signals (user_id, symbol, timeframe, signal_type, side, price, timestamp, executed)
        VALUES (${id}, ${symbol}, '15m', ${type}, ${type}, 65000, ${timestamp}, false)
      `;
    }
    return { success: true, targets: targetIds.length };
  },

  // 15. Trade Audit — Admin işlem analizi
  async getTradeAudit(userId: number = 14) {
    // Aktif SmartTrade işlemleri
    const { rows: active } = await sql`
      SELECT id, symbol, side, status, price as entry_price, qty, quote,
             meta, created_at
      FROM orders
      WHERE user_id = ${userId}
        AND status IN ('FILLED','PENDING','OPEN','ACTIVE','NEW')
        AND meta::jsonb->>'smartTrade' = 'true'
      ORDER BY created_at DESC
    `;

    // Son 40 kapalı işlem
    const { rows: closed } = await sql`
      SELECT id, symbol, side, status, price as entry_price, qty,
             (meta::jsonb->>'exitPrice') as close_price,
             (meta::jsonb->>'closedAt') as closed_ts,
             meta
      FROM orders
      WHERE user_id = ${userId}
        AND meta::jsonb->>'smartTrade' = 'true'
        AND (
          status IN ('CLOSED','CANCELLED','STOPPED','DONE')
          OR (meta::jsonb->>'exitReason') IS NOT NULL
        )
      ORDER BY COALESCE((meta::jsonb->>'closedAt')::bigint, created_at) DESC
      LIMIT 40
    `;

    // Sembol özeti
    const { rows: bySymbol } = await sql`
      SELECT symbol,
             COUNT(*) as total_trades,
             COUNT(CASE WHEN meta::jsonb->>'exitReason' ILIKE '%TP%' THEN 1 END) as tp_count,
             COUNT(CASE WHEN meta::jsonb->>'exitReason' ILIKE '%SL%' THEN 1 END) as sl_count
      FROM orders
      WHERE user_id = ${userId}
        AND meta::jsonb->>'smartTrade' = 'true'
        AND (status IN ('CLOSED','DONE','STOPPED') OR (meta::jsonb->>'exitReason') IS NOT NULL)
      GROUP BY symbol
      ORDER BY total_trades DESC
      LIMIT 12
    `;

    return { active, closed, bySymbol };
  }
};
