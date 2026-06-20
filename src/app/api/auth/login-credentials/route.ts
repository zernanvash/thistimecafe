import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getHomePathForRole, signToken, hashPassword } from '@/utils/auth';

export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const user = await db.users.findByEmail(email);
        if (!user) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: email,
                details: 'Login attempt failed: Email/username not found',
                ip
            });
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Verify lockout status
        if (user.is_locked) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: user.name,
                details: 'Login blocked: Account is manually locked',
                ip
            });
            return NextResponse.json({ error: 'This account has been locked. Please contact the administrator.' }, { status: 423 });
        }

        if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: user.name,
                details: 'Login blocked: Account is temporarily locked',
                ip
            });
            return NextResponse.json({ error: 'Too many failed attempts. Try again later.' }, { status: 423 });
        }

        // Verify password
        const hashedPassword = await hashPassword(password);
        if (user.password !== hashedPassword) {
            const failedAttempts = (user.failed_attempts || 0) + 1;
            const updates: any = { failed_attempts: failedAttempts };
            let isLockout = false;

            if (failedAttempts >= 3) {
                updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                isLockout = true;
            }

            await db.users.update(user.id, updates);

            if (isLockout) {
                await db.securityLogs.create({
                    event_type: 'account_lockout',
                    username: user.name,
                    details: 'Account temporarily locked due to 3 failed credential attempts',
                    ip
                });
                return NextResponse.json({ error: 'Too many failed attempts. Account locked for 15 minutes.' }, { status: 423 });
            } else {
                await db.securityLogs.create({
                    event_type: 'login_failure',
                    username: user.name,
                    details: `Failed credentials attempt ${failedAttempts}/3`,
                    ip
                });
                return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
            }
        }

        // Verify role permission (only managers/admins/owners can login via credentials)
        if (!['admin', 'manager', 'owner'].includes(user.role)) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: user.name,
                details: `Login blocked: credentials access denied for role ${user.role}`,
                ip
            });
            return NextResponse.json({ error: 'Access denied. Standard staff must use passcode login.' }, { status: 403 });
        }

        // Reset failed attempts on success
        await db.users.update(user.id, { failed_attempts: 0, locked_until: undefined });

        await db.securityLogs.create({
            event_type: 'login_success',
            username: user.name,
            details: `Successfully logged in via credentials (${user.role})`,
            ip
        });

        const token = await signToken({
            userId: user.id,
            role: user.role,
            name: user.name
        });

        const response = NextResponse.json({ 
            success: true, 
            user: { id: user.id, name: user.name, role: user.role },
            redirectTo: getHomePathForRole(user.role)
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
    } catch (error: unknown) {
        console.error('Credentials login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
