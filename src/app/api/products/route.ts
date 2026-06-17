import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';

export async function GET(req: NextRequest) {
    try {
        await ensureDb();
        const products = await db.products.list();
        return NextResponse.json(products);
    } catch (error: any) {
        console.error('Fetch products error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
