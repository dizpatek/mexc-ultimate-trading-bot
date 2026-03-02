
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    
    if (authHeader === 'fail' || searchParams.get('fail') === 'true') {
        return NextResponse.json({ 
            success: false, 
            error: 'Unauthorized', 
            message: 'Failed to change system state' 
        }, { status: 403 });
    }

    return NextResponse.json({
        success: true,
        killSwitchEnabled: true,
        systemMessage: 'Trading paused - Kill Switch ON',
        systemState: {
            killSwitch: true,
            status: 'KILLED'
        }
    });
}

export async function GET() {
    return NextResponse.json({
        killSwitchEnabled: false,
        systemMessage: 'IDLE',
        systemState: {
            killSwitch: false,
            status: 'READY'
        }
    });
}
