import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { signToken, hashPassword } from '@/utils/auth';

export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = await db.users.findByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Verify password
        const hashedPassword = await hashPassword(password);
        if (user.password !== hashedPassword) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Verify role permission (only managers/admins can login via credentials)
        if (!['admin', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Access denied. Standard staff must use passcode login.' }, { status: 403 });
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
        console.error('Credentials login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
