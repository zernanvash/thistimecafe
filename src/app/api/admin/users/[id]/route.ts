import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getSession } from '@/utils/auth';

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await ensureDb();
        const session = await getSession(req);
        const { id } = await context.params;

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await db.users.findById(id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Prevent self-lock or self-role-change for safety
        if (user.id === session.userId && req.body) {
            const body = await req.json();
            if (body.is_locked !== undefined || body.role !== undefined) {
                return NextResponse.json({ error: 'You cannot lock or change the role of your own logged-in admin account' }, { status: 400 });
            }
        }

        // Re-read JSON body
        const body = await req.json();
        const updates: any = {};
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

        if (body.name !== undefined) updates.name = body.name;
        if (body.role !== undefined) updates.role = body.role;
        if (body.email !== undefined) updates.email = body.email;

        // Change password
        if (body.password) {
            updates.password = body.password;
            await db.securityLogs.create({
                event_type: 'password_change',
                username: user.name,
                details: `Password changed for account: ${user.name}`,
                ip
            });
        }

        // Change passcode (PIN)
        if (body.passcode) {
            if (!/^\d{6}$/.test(body.passcode)) {
                return NextResponse.json({ error: 'PIN must be a 6-digit number' }, { status: 400 });
            }
            // Check uniqueness
            const existingPin = await db.users.findByPasscode(body.passcode);
            if (existingPin && existingPin.id !== id) {
                return NextResponse.json({ error: 'This PIN is already in use by another user' }, { status: 400 });
            }
            updates.passcode = body.passcode;
        }

        // Manual lock/unlock
        if (body.is_locked !== undefined) {
            updates.is_locked = body.is_locked;
            if (body.is_locked) {
                // Manually locked: reset failed attempts
                updates.failed_attempts = 0;
                updates.locked_until = null;
                await db.securityLogs.create({
                    event_type: 'account_lock',
                    username: user.name,
                    details: `Account manually locked by administrator`,
                    ip
                });
            } else {
                // Unlocked
                updates.failed_attempts = 0;
                updates.locked_until = null;
                await db.securityLogs.create({
                    event_type: 'account_unlock',
                    username: user.name,
                    details: `Account manually unlocked by administrator`,
                    ip
                });
            }
        }

        await db.users.update(id, updates);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await ensureDb();
        const session = await getSession(req);
        const { id } = await context.params;

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await db.users.findById(id);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.id === session.userId) {
            return NextResponse.json({ error: 'You cannot delete your own logged-in admin account' }, { status: 400 });
        }

        // SQLite or Mongo deletion.
        const success = await db.users.delete(id);
        if (!success) {
            return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
        }

        // Audit log
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        await db.securityLogs.create({
            event_type: 'user_deleted',
            username: user.name,
            details: `Deleted user account: ${user.name} (${user.role})`,
            ip
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
