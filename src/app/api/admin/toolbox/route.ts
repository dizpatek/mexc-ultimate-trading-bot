import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { tool, userId } = await req.json();
    if (!tool || typeof tool !== 'string') return NextResponse.json({ success: false, error: 'Tool parameter missing' });

    // Sadece master_ prefixli dosyalar çalıştırılabilir (Güvenlik)
    if (!tool.startsWith('master_')) {
        return NextResponse.json({ success: false, error: 'Invalid or unauthorized tool' });
    }

    const rootDir = process.cwd();
    const toolPath = path.join(rootDir, 'scripts', 'toolbox', `${tool}.ts`);
    const args = userId ? ` ${userId}` : '';

    return new Promise((resolve) => {
      // 1MB buffer limiti artırıldı ve npx tsx çalıştırılıyor
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
