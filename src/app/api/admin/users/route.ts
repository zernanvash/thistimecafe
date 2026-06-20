import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getSession } from '@/utils/auth';
import { User } from '@/db/schema';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const users = await db.users.list();
        // Hide password hashes for safety
        const safeUsers = users.map(({ password, ...u }) => u);
        return NextResponse.json(safeUsers);
    } catch (error: unknown) {
        console.error('Fetch users error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, email, password, role, passcode } = await req.json();

        if (!name || !role) {
            return NextResponse.json({ error: 'Name and Role are required fields' }, { status: 400 });
        }

        if (role !== 'admin' && !passcode) {
            return NextResponse.json({ error: 'Staff/Owner accounts must have a 6-digit PIN' }, { status: 400 });
        }

        if (passcode && !/^\d{6}$/.test(passcode)) {
            return NextResponse.json({ error: 'PIN must be a 6-digit number' }, { status: 400 });
        }

        // Check if email already exists
        if (email) {
            const existing = await db.users.findByEmail(email);
            if (existing) {
                return NextResponse.json({ error: 'Email/username is already in use' }, { status: 400 });
            }
        }

        // Check if PIN already exists
        if (passcode) {
            const existingPin = await db.users.findByPasscode(passcode);
            if (existingPin) {
                return NextResponse.json({ error: 'This PIN is already in use by another user' }, { status: 400 });
            }
        }

        const userId = 'u-' + crypto.randomBytes(4).toString('hex');
        
        const newUser: User = {
            id: userId,
            name,
            email: email || undefined,
            password: password || undefined,
            role,
            passcode: passcode || undefined,
            is_locked: false,
            failed_attempts: 0,
            created_at: new Date().toISOString()
        };

        await db.users.create(newUser);

        // Audit Log
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        await db.securityLogs.create({
            event_type: 'user_created',
            username: name,
            details: `Created new user account: ${name} (${role})`,
            ip
        });

        return NextResponse.json({ success: true, user: { id: newUser.id, name: newUser.name, role: newUser.role } });
    } catch (error: unknown) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
