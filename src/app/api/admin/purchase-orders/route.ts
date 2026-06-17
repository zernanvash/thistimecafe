import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getSession } from '@/utils/auth';
import { PurchaseOrder } from '@/db/schema';

export async function GET(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);
        if (!session || !['admin', 'manager'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const pos = await db.purchaseOrders.list();
        return NextResponse.json(pos);
    } catch (error: any) {
        console.error('Fetch purchase orders error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);
        if (!session || !['admin', 'manager'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { supplier_name, items } = body as {
            supplier_name: string;
            items: {
                ingredient_id: string;
                name: string;
                quantity: number;
                unit: string;
                cost_per_unit: number;
            }[];
        };

        if (!supplier_name || !items || items.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Calculate total cost
        const total_cost = items.reduce((sum, item) => sum + (item.quantity * item.cost_per_unit), 0);

        const newPO: PurchaseOrder = {
            id: `po-${Date.now()}`,
            supplier_name,
            items,
            total_cost,
            status: 'ordered',
            created_at: new Date().toISOString()
        };

        const created = await db.purchaseOrders.create(newPO);
        return NextResponse.json({ success: true, purchaseOrder: created });
    } catch (error: any) {
        console.error('Create purchase order error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
