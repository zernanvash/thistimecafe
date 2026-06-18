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

        // Restrict update to admin, manager, or barista roles
        if (session.role !== 'admin' && session.role !== 'manager' && session.role !== 'barista') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const updatedProduct = await db.products.update(id, body);
        
        if (!updatedProduct) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, product: updatedProduct });
    } catch (error: any) {
        console.error('Update product error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
