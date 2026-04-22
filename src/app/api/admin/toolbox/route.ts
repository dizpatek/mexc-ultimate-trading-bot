import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const { tool, userId } = await req.json();
    if (!tool || typeof tool !== 'string') return NextResponse.json({ success: false, error: 'Tool parameter missing' });

    // Sadece master_ prefixli dosyalar çalıştırılabilir (Güvenlik)
    if (!tool.startsWith('master_')) {
        return NextResponse.json({ success: false, error: 'Invalid or unauthorized tool' });
    }

    const rootDir = process.cwd();
    // Yeni dizin: _tools/system/
    const toolsDir = path.join(rootDir, '_tools', 'system');
    
    // Dosya uzantısını dinamik kontrol et (.ts veya .js)
    let toolPath = path.join(toolsDir, `${tool}.ts`);
    if (!fs.existsSync(toolPath)) {
        toolPath = path.join(toolsDir, `${tool}.js`);
    }

    if (!fs.existsSync(toolPath)) {
        return NextResponse.json({ success: false, error: `Tool not found at ${toolPath}` });
    }

    const args = userId ? ` ${userId}` : '';

    return new Promise((resolve) => {
      // npx tsx --no-warnings --env-file=.env.local _tools/system/master_xxx.ts
      exec(`npx tsx --no-warnings --env-file=.env.local ${toolPath}${args}`, 
        { cwd: rootDir, env: { ...process.env, NODE_NO_WARNINGS: '1' }, maxBuffer: 1024 * 5000 }, 
        (error, stdout, stderr) => {
        resolve(NextResponse.json({
          success: true,
          logs: stdout + (stderr ? '\nERRORS:\n' + stderr : ''),
          error: error ? error.message : null
        }));
      });
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
