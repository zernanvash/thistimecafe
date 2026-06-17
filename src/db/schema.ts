export interface User {
    id: string;
    name: string;
    email?: string;
    password?: string; // hashed
    role: 'admin' | 'cashier' | 'barista' | 'manager';
    passcode?: string; // 6-digit PIN for role-specific staff access
    created_at: string;
}

export interface MenuItemCustomization {
    type: 'sizes' | 'milk' | 'syrup' | 'espresso';
    name: string;
    price_impact: number;
}

export interface Product {
    id: string;
    name: string;
    category: 'Espresso / Hot Coffee' | 'Cold Brew / Iced Coffee' | 'Non-Coffee' | 'Frappes' | 'Pastries & Bakery' | 'Retail';
    price: number; // base price
    cost?: number; // base cost
    sku?: string;
    stock?: number; // for finished goods, e.g. pastry stock
    track_stock: boolean; // if true, deduct from stock when sold
    recipe?: { ingredient_id: string; quantity: number }[]; // raw ingredients decomposition
    created_at: string;
}

export interface Ingredient {
    id: string;
    name: string;
    stock: number; // current stock (e.g. 5000g of Espresso Beans)
    unit: 'g' | 'ml' | 'unit' | 'kg';
    min_threshold: number; // low stock alert threshold
    created_at: string;
}

export interface OrderItem {
    product_id: string;
    name: string;
    quantity: number;
    price: number; // final price per item (base + customization)
    customizations: { name: string; price_impact: number }[];
    notes?: string;
}

export interface Order {
    id: string;
    order_number: string;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'voided';
    payment_method: 'cash' | 'card' | 'qr';
    created_at: string;
    created_by: string; // User ID of cashier
    dining_option: 'dine-in' | 'takeout' | 'delivery';
    payment_details?: {
        amount_tendered?: number;
        change_returned?: number;
    };
}

export interface PurchaseOrderItem {
    ingredient_id: string;
    name: string;
    quantity: number;
    unit: string;
    cost_per_unit: number;
}

export interface PurchaseOrder {
    id: string;
    supplier_name: string;
    items: PurchaseOrderItem[];
    total_cost: number;
    status: 'ordered' | 'received' | 'cancelled';
    created_at: string;
}
