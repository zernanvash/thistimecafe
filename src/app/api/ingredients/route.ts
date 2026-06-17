import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getSession } from '@/utils/auth';
import { Ingredient } from '@/db/schema';

export async function GET(req: NextRequest) {
    try {
        await ensureDb();
        const ingredients = await db.ingredients.list();
        return NextResponse.json(ingredients);
    } catch (error: any) {
        console.error('Fetch ingredients error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, stock, unit, min_threshold } = body as {
            name: string;
            stock: number;
            unit: 'g' | 'ml' | 'unit' | 'kg';
            min_threshold: number;
        };

        if (!name || stock === undefined || !unit || min_threshold === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newIngredient: Ingredient = {
            id: `i-${Date.now()}`,
            name,
            stock,
            unit,
            min_threshold,
            created_at: new Date().toISOString()
        };

        const created = await db.ingredients.create(newIngredient);
        return NextResponse.json({ success: true, ingredient: created });
    } catch (error: any) {
        console.error('Create ingredient error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
