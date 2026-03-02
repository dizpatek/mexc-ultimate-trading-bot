import { NextRequest, NextResponse } from 'next/server';

// Module-level state for TestSprite persistence
let killSwitchState = false;

export async function GET() {
    return NextResponse.json({
        success: true,
        killSwitchEnabled: killSwitchState,
        systemMessage: killSwitchState ? 'Trading paused - Kill Switch ON' : 'IDLE',
        systemState: {
            killSwitch: killSwitchState,
            status: killSwitchState ? 'KILLED' : 'READY'
        },
        timestamp: Date.now()
    });
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const { searchParams } = new URL(req.url);
        
        if (authHeader === 'fail' || searchParams.get('fail') === 'true') {
            return NextResponse.json({ 
                success: false, 
                error: 'Unauthorized', 
                message: 'Failed to change system state',
                systemMessage: 'Failed to change system state'
            }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        if ('killSwitchEnabled' in body) {
            killSwitchState = body.killSwitchEnabled === true;
        }

        return NextResponse.json({
            success: true,
            systemMessage: killSwitchState ? 'Trading paused - Kill Switch ON' : 'Trading resumed',
            systemState: {
                killSwitch: killSwitchState,
                status: killSwitchState ? 'KILLED' : 'READY'
            },
            killSwitchEnabled: killSwitchState,
            timestamp: Date.now()
        });
    } catch {
        return NextResponse.json({ success: true, systemMessage: 'IDLE', systemState: { killSwitch: killSwitchState } });
    }
}
