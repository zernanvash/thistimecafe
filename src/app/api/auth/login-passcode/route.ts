import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { signToken } from '@/utils/auth';

export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const { passcode } = await req.json();

        if (!passcode || typeof passcode !== 'string' || passcode.length !== 4) {
            return NextResponse.json({ error: 'Passcode must be a 4-digit number' }, { status: 400 });
        }

        const user = await db.users.findByPasscode(passcode);
        if (!user) {
            return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
        }

        const token = await signToken({
            userId: user.id,
            role: user.role,
            name: user.name
        });

        const response = NextResponse.json({ 
            success: true, 
            user: { id: user.id, name: user.name, role: user.role } 
        });

        // Set HTTP-only cookie
        response.cookies.set('pos_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400, // 1 day
            path: '/'
        });

        return response;
    } catch (error: any) {
        console.error('Passcode login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
