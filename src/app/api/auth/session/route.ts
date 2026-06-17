import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';

export async function GET(req: NextRequest) {
    const session = await getSession(req);
    if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ 
        authenticated: true, 
        user: { 
            id: session.userId, 
            name: session.name, 
            role: session.role 
        } 
    });
}
