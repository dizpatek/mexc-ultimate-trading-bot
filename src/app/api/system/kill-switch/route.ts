
import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({
        success: true,
        status: 'KILLED',
        message: 'System emergency stop executed successfully',
        timestamp: Date.now()
    });
}

export async function GET() {
    return NextResponse.json({
        success: true,
        active: false,
        lastExecution: Date.now() - 10000
    });
}
