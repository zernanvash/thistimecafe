import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getHomePathForRole, signToken } from '@/utils/auth';

// Global PIN rate-limiting state stored in Node global object to survive dev refreshes
const GLOBAL_PIN_FAILURES = '_globalPinFailures';
const GLOBAL_PIN_LOCKED_UNTIL = '_globalPinLockedUntil';

if (!(global as any)[GLOBAL_PIN_FAILURES]) {
    (global as any)[GLOBAL_PIN_FAILURES] = 0;
}

export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const { passcode } = await req.json();
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

        // Check if keypad is globally locked
        const globalLockUntil = (global as any)[GLOBAL_PIN_LOCKED_UNTIL];
        if (globalLockUntil && new Date(globalLockUntil).getTime() > Date.now()) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: 'system/kiosk',
                details: 'PIN submission blocked: Global keypad lock active',
                ip
            });
            return NextResponse.json({
                error: 'Keypad is locked due to too many failed attempts. Try again in 15 minutes.'
            }, { status: 423 });
        }

        if (!passcode || typeof passcode !== 'string' || !/^\d{6}$/.test(passcode)) {
            return NextResponse.json({ error: 'PIN must be a 6-digit number' }, { status: 400 });
        }

        const user = await db.users.findByPasscode(passcode);
        if (!user) {
            (global as any)[GLOBAL_PIN_FAILURES]++;
            const failures = (global as any)[GLOBAL_PIN_FAILURES];

            if (failures >= 5) {
                (global as any)[GLOBAL_PIN_LOCKED_UNTIL] = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                (global as any)[GLOBAL_PIN_FAILURES] = 0;

                await db.securityLogs.create({
                    event_type: 'account_lockout',
                    username: 'system/kiosk',
                    details: 'Kiosk keypad locked for 15 minutes due to 5 consecutive PIN failures',
                    ip
                });
                return NextResponse.json({
                    error: 'Keypad locked. Too many failed attempts. Locked for 15 minutes.'
                }, { status: 423 });
            } else {
                await db.securityLogs.create({
                    event_type: 'login_failure',
                    username: 'unknown',
                    details: `Invalid PIN entered (attempt ${failures}/5)`,
                    ip
                });
                return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
            }
        }

        // Verify lockout status
        if (user.is_locked) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: user.name,
                details: `PIN login blocked: Account is manually locked`,
                ip
            });
            return NextResponse.json({ error: 'This account has been locked. Please contact the administrator.' }, { status: 423 });
        }

        if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: user.name,
                details: `PIN login blocked: Account is temporarily locked`,
                ip
            });
            return NextResponse.json({ error: 'Account is temporarily locked. Try again later.' }, { status: 423 });
        }

        // Verify role permission (admin cannot use PIN)
        if (['admin'].includes(user.role)) {
            await db.securityLogs.create({
                event_type: 'login_failure',
                username: user.name,
                details: `PIN login blocked: admin accounts must log in with username/password`,
                ip
            });
            return NextResponse.json(
                { error: 'Admin accounts must log in with username and password.' },
                { status: 403 }
            );
        }

        // Reset global failed attempts on successful login
        (global as any)[GLOBAL_PIN_FAILURES] = 0;

        await db.securityLogs.create({
            event_type: 'login_success',
            username: user.name,
            details: `Successfully logged in via PIN (${user.role})`,
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
        console.error('Passcode login error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
