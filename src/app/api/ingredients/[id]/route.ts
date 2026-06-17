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
        const updatedIngredient = await db.ingredients.update(id, body);
        
        if (!updatedIngredient) {
            return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, ingredient: updatedIngredient });
    } catch (error: any) {
        console.error('Update ingredient error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

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

        const deleted = await db.ingredients.delete(id);
        if (!deleted) {
            return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Ingredient deleted successfully' });
    } catch (error: any) {
        console.error('Delete ingredient error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
