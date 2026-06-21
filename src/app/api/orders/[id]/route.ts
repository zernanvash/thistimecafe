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
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { status } = body as { status: any };

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }

        const allowedStatuses = ['pending', 'preparing', 'ready', 'completed', 'voided'];
        if (!allowedStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
        }

        const order = await db.orders.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // If voiding the order, put the stock/ingredients back!
        if (status === 'voided' && order.status !== 'voided') {
            for (const item of order.items) {
                const product = await db.products.findById(item.product_id);
                if (product) {
                    // Restore finished product stock
                    if (product.track_stock) {
                        await db.products.update(product.id, {
                            stock: (product.stock || 0) + item.quantity
                        });
                    }

                    // Restore raw ingredient stock
                    if (product.recipe && product.recipe.length > 0) {
                        for (const recipeItem of product.recipe) {
                            const ingredient = await db.ingredients.findById(recipeItem.ingredient_id);
                            if (ingredient) {
                                await db.ingredients.update(ingredient.id, {
                                    stock: ingredient.stock + (recipeItem.quantity * item.quantity)
                                });
                            }
                        }
                    }
                }
            }
        }

        const updatedOrder = await db.orders.updateStatus(id, status);
        return NextResponse.json({ success: true, order: updatedOrder });
    } catch (error: any) {
        console.error('Update order status error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Delete single order (admin only)
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await ensureDb();
        const { id } = await context.params;

        const session = await getSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (session.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const order = await db.orders.findById(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const success = await db.orders.delete(id);
        return NextResponse.json({ success });
    } catch (error: any) {
        console.error('Delete order error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
