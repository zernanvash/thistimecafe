import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/db/init';
import { db } from '@/db/db';
import { getSession } from '@/utils/auth';
import { Order, OrderItem } from '@/db/schema';

// List orders
export async function GET(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get('status');
        const limitParam = searchParams.get('limit');

        const status = statusParam ? (statusParam.split(',') as any[]) : undefined;
        const limit = limitParam ? parseInt(limitParam, 10) : undefined;

        let orders = await db.orders.list({ status, limit });
        if (session.role === 'cashier') {
            orders = orders.filter(o => o.created_by === session.userId);
        }
        return NextResponse.json(orders);
    } catch (error: any) {
        console.error('Fetch orders error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Create order (Checkout)
export async function POST(req: NextRequest) {
    try {
        await ensureDb();
        const session = await getSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (session.role === 'barista') {
            return NextResponse.json({ error: 'Baristas are not allowed to checkout orders' }, { status: 403 });
        }

        const body = await req.json();
        const { items, dining_option, payment_method, discount, payment_details, bypass_stock } = body as {
            items: {
                product_id: string;
                quantity: number;
                customizations: { name: string; price_impact: number }[];
                notes?: string;
            }[];
            dining_option: 'dine-in' | 'takeout' | 'delivery';
            payment_method: 'cash' | 'card' | 'qr';
            discount: number; // Flat discount amount
            payment_details?: {
                amount_tendered?: number;
                change_returned?: number;
            };
            bypass_stock?: boolean;
        };

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 });
        }

        // Fetch all products involved to calculate prices and check stock
        const orderItems: OrderItem[] = [];
        let subtotal = 0;

        // Keep track of stock updates to run atomically/sequentially
        const stockDeductions: { type: 'product' | 'ingredient'; id: string; amount: number; name: string }[] = [];

        // Temporary local stock state for validation
        const productStockTemp: Record<string, number> = {};
        const ingredientStockTemp: Record<string, number> = {};

        for (const item of items) {
            const product = await db.products.findById(item.product_id);
            if (!product) {
                return NextResponse.json({ error: `Product not found: ${item.product_id}` }, { status: 404 });
            }

            // Calculate final price of item with customizations
            let itemPrice = product.price;
            item.customizations.forEach(c => {
                itemPrice += c.price_impact;
            });

            subtotal += itemPrice * item.quantity;

            orderItems.push({
                product_id: product.id,
                name: product.name,
                quantity: item.quantity,
                price: itemPrice,
                customizations: item.customizations,
                notes: item.notes
            });

            // Stock tracking logic
            if (product.track_stock) {
                // If we haven't loaded this product's stock into temp state, do it
                if (productStockTemp[product.id] === undefined) {
                    productStockTemp[product.id] = product.stock || 0;
                }

                if (productStockTemp[product.id] < item.quantity) {
                    if (!bypass_stock) {
                        return NextResponse.json({ 
                            error: `Insufficient stock for product: ${product.name}. Available: ${productStockTemp[product.id]}` 
                        }, { status: 400 });
                    }
                }

                // Reserve stock in temp state
                productStockTemp[product.id] = Math.max(0, productStockTemp[product.id] - item.quantity);
                stockDeductions.push({
                    type: 'product',
                    id: product.id,
                    amount: item.quantity,
                    name: product.name
                });
            }

            // Ingredients recipes stock tracking logic
            if (product.recipe && product.recipe.length > 0) {
                for (const recipeItem of product.recipe) {
                    const ingredient = await db.ingredients.findById(recipeItem.ingredient_id);
                    if (!ingredient) {
                        return NextResponse.json({ 
                            error: `Ingredient recipe error. Ingredient not found: ${recipeItem.ingredient_id}` 
                        }, { status: 500 });
                    }

                    if (ingredientStockTemp[ingredient.id] === undefined) {
                        ingredientStockTemp[ingredient.id] = ingredient.stock;
                    }

                    const requiredQty = recipeItem.quantity * item.quantity;
                    if (ingredientStockTemp[ingredient.id] < requiredQty) {
                        if (!bypass_stock) {
                            return NextResponse.json({ 
                                error: `Insufficient stock for ingredient: ${ingredient.name}. Required: ${requiredQty}${ingredient.unit}, Available: ${ingredientStockTemp[ingredient.id]}${ingredient.unit}` 
                            }, { status: 400 });
                        }
                    }

                    ingredientStockTemp[ingredient.id] = Math.max(0, ingredientStockTemp[ingredient.id] - requiredQty);
                    stockDeductions.push({
                        type: 'ingredient',
                        id: ingredient.id,
                        amount: requiredQty,
                        name: ingredient.name
                    });
                }
            }
        }

        // Calculate Tax (e.g. 8% standard rate included in checkout, or added on top. Let's make it 8% standard included in subtotal or calculated from subtotal after discount)
        const taxableAmount = Math.max(0, subtotal - discount);
        const taxRate = 0.08;
        const tax = Math.round(taxableAmount * taxRate * 100) / 100;
        const total = taxableAmount;

        // Perform stock deductions in database
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

        // Generate Order Number
        const allOrders = await db.orders.list({ limit: 1 });
        const lastOrder = allOrders[0];
        let orderIndex = 1;
        if (lastOrder && lastOrder.order_number) {
            const parts = lastOrder.order_number.split('-');
            if (parts.length === 2) {
                orderIndex = parseInt(parts[1], 10) + 1;
            }
        }
        const orderNumber = `ORD-${1000 + orderIndex}`;

        // Create the Order Object
        const newOrder: Order = {
            id: `o-${Date.now()}`,
            order_number: orderNumber,
            items: orderItems,
            subtotal,
            tax,
            discount,
            total,
            status: 'completed',
            payment_method,
            created_at: new Date().toISOString(),
            created_by: session.userId,
            dining_option,
            payment_details
        };

        const createdOrder = await db.orders.create(newOrder);

        return NextResponse.json({ success: true, order: createdOrder });
    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
