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
        const { id } = await context.params;

        const session = await getSession(req);
        if (!session || !['admin', 'manager'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { status } = body as { status: any };

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }

        const allowedStatuses = ['ordered', 'received', 'cancelled'];
        if (!allowedStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid purchase order status' }, { status: 400 });
        }

        const po = await db.purchaseOrders.findById(id);
        if (!po) {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }

        // Automatic Inventory Addition on PO receipt
        if (status === 'received' && po.status === 'ordered') {
            for (const item of po.items) {
                const ingredient = await db.ingredients.findById(item.ingredient_id);
                if (ingredient) {
                    await db.ingredients.update(ingredient.id, {
                        stock: ingredient.stock + item.quantity
                    });
                }
            }
        }

        const updatedPO = await db.purchaseOrders.updateStatus(id, status);
        return NextResponse.json({ success: true, purchaseOrder: updatedPO });
    } catch (error: any) {
        console.error('Update purchase order error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
