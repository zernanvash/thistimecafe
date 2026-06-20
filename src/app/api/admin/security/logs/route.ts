import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getSession } from '@/utils/auth';

export async function GET(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const logs = await db.securityLogs.list();
        return NextResponse.json(logs);
    } catch (error: unknown) {
        console.error('Fetch security logs error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
