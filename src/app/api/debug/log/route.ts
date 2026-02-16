import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { level, message, context } = await request.json();
        const timestamp = new Date().toISOString();
        
        console.log('\n' + '='.repeat(50));
        console.log(`🚀 [CLIENT-${level.toUpperCase()}] ${timestamp}`);
        console.log(`📝 Message: ${message}`);
        if (context) {
            console.log('📦 Context:');
            console.log(JSON.stringify(context, null, 2));
        }
        console.log('='.repeat(50) + '\n');

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
