import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getSession } from '@/utils/auth';
import { Order, OrderItem } from '@/db/schema';

// GET database diagnostic details (restricted to admin/manager)
export async function GET(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);
        if (!session || !['admin', 'manager'].includes(session.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const activeConnection = process.env.DB_CONNECTION || 'sqlite';
        
        // Fetch diagnostic counts
        const users = await db.users.list();
        const products = await db.products.list();
        const ingredients = await db.ingredients.list();
        const orders = await db.orders.list();
        const purchaseOrders = await db.purchaseOrders.list();

        return NextResponse.json({
            driver: activeConnection,
            counts: {
                users: users.length,
                products: products.length,
                ingredients: ingredients.length,
                orders: orders.length,
                purchaseOrders: purchaseOrders.length
            },
            raw: {
                users: users.slice(0, 10),
                products: products.slice(0, 10),
                ingredients: ingredients.slice(0, 10),
                orders: orders.slice(0, 10),
                purchaseOrders: purchaseOrders.slice(0, 10)
            }
        });
    } catch (error: any) {
        console.error('Dev GET error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST dev operations: reset-db, generate-mock-orders
export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);
        if (!session || !['admin', 'manager'].includes(session.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body as { action: 'reset-db' | 'generate-mock-orders' };

        if (action === 'reset-db') {
            await db.wipeDatabase();
            return NextResponse.json({ success: true, message: 'Database wiped and re-seeded successfully' });
        }

        if (action === 'generate-mock-orders') {
            const products = await db.products.list();
            if (products.length === 0) {
                return NextResponse.json({ error: 'No products available to generate mock orders. Reset database first.' }, { status: 400 });
            }

            const diningOptions: ('dine-in' | 'takeout')[] = ['dine-in', 'takeout'];
            const paymentMethods: ('cash' | 'card' | 'qr')[] = ['cash', 'card', 'qr'];
            const notesList = ['No lid', 'Extra hot', 'Less ice', 'Double shot', 'Warm croissant'];

            const mockOrdersInserted: Order[] = [];

            // Generate 5 mock orders spanning different hours today
            for (let i = 0; i < 5; i++) {
                const numItems = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
                const selectedItems: OrderItem[] = [];
                let subtotal = 0;

                const stockDeductions: { type: 'product' | 'ingredient'; id: string; amount: number }[] = [];

                for (let j = 0; j < numItems; j++) {
                    const product = products[Math.floor(Math.random() * products.length)];
                    const qty = Math.floor(Math.random() * 2) + 1; // 1 or 2 quantity
                    
                    // Random customizations for drinks
                    const customizations: { name: string; price_impact: number }[] = [];
                    let itemPrice = product.price;

                    const isDrink = ['Espresso / Hot Coffee', 'Cold Brew / Iced Coffee', 'Non-Coffee'].includes(product.category);
                    if (isDrink) {
                        if (Math.random() > 0.5) {
                            customizations.push({ name: 'Large Size', price_impact: 20 });
                            itemPrice += 20;
                        }
                        if (Math.random() > 0.7) {
                            customizations.push({ name: 'Oat Milk', price_impact: 30 });
                            itemPrice += 30;
                        }
                    }

                    selectedItems.push({
                        product_id: product.id,
                        name: product.name,
                        quantity: qty,
                        price: itemPrice,
                        customizations,
                        notes: Math.random() > 0.6 ? notesList[Math.floor(Math.random() * notesList.length)] : undefined
                    });

                    subtotal += itemPrice * qty;

                    // Queue stock updates
                    if (product.track_stock) {
                        stockDeductions.push({ type: 'product', id: product.id, amount: qty });
                    }

                    if (product.recipe && product.recipe.length > 0) {
                        for (const recipeItem of product.recipe) {
                            stockDeductions.push({ 
                                type: 'ingredient', 
                                id: recipeItem.ingredient_id, 
                                amount: recipeItem.quantity * qty 
                            });
                        }
                    }
                }

                // Apply stock deductions
                for (const dec of stockDeductions) {
                    if (dec.type === 'product') {
                        const p = await db.products.findById(dec.id);
                        if (p) {
                            await db.products.update(dec.id, { stock: Math.max(0, (p.stock || 0) - dec.amount) });
                        }
                    } else {
                        const ing = await db.ingredients.findById(dec.id);
                        if (ing) {
                            await db.ingredients.update(dec.id, { stock: Math.max(0, ing.stock - dec.amount) });
                        }
                    }
                }

                // Randomize created_at hour within today
                const orderDate = new Date();
                orderDate.setHours(orderDate.getHours() - (4 - i) * 2 - Math.floor(Math.random() * 2)); // spaced out timings
                
                // Formulate order status: pending, preparing, ready, completed
                // Make 3 completed, 1 preparing, 1 ready for picker
                const statuses: Order['status'][] = ['completed', 'completed', 'completed', 'preparing', 'ready'];
                const status = statuses[i];

                const discount = Math.random() > 0.7 ? 20.00 : 0;
                const total = Math.max(0, subtotal - discount);
                const tax = Math.round(total * 0.12 * 100) / 100;
                const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

                const orderNumber = `MOCK-ORD-${1000 + i + Date.now() % 100}`;

                const newOrder: Order = {
                    id: `o-mock-${i}-${Date.now()}`,
                    order_number: orderNumber,
                    items: selectedItems,
                    subtotal,
                    tax,
                    discount,
                    total,
                    status,
                    payment_method: method,
                    created_at: orderDate.toISOString(),
                    created_by: session.userId,
                    dining_option: diningOptions[Math.floor(Math.random() * diningOptions.length)],
                    payment_details: method === 'cash' ? {
                        amount_tendered: Math.ceil(total / 100) * 100,
                        change_returned: Math.ceil(total / 100) * 100 - total
                    } : undefined
                };

                const created = await db.orders.create(newOrder);
                mockOrdersInserted.push(created);
            }

            return NextResponse.json({ 
                success: true, 
                message: 'Successfully generated 5 mock orders with randomized times, items, and status.',
                orders: mockOrdersInserted 
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Dev POST error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
