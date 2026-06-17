import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DBInstance, UserRepository, ProductRepository, IngredientRepository, OrderRepository, PurchaseOrderRepository } from './db';
import { User, Product, Ingredient, Order, PurchaseOrder } from './schema';

// Helper to hash password using Node.js built-in crypto (PBKDF2)
function hashPassword(password: string): string {
    const salt = 'ttc-pos-salt'; // simple constant salt for seeders and simplicity
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

const dbPath = process.env.DB_SQLITE_PATH || path.join(process.cwd(), 'src', 'db', 'database.sqlite');

// Ensure db directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

let connection: Database.Database;

const sqliteDbInstance: DBInstance = {
    users: {
        async findById(id) {
            const row = connection.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
            return row ? { ...row } : null;
        },
        async findByEmail(email) {
            const row = connection.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
            return row ? { ...row } : null;
        },
        async findByPasscode(passcode) {
            const row = connection.prepare('SELECT * FROM users WHERE passcode = ?').get(passcode) as any;
            return row ? { ...row } : null;
        },
        async create(user) {
            if (user.password) {
                user.password = hashPassword(user.password);
            }
            connection.prepare(`
                INSERT INTO users (id, name, email, password, role, passcode, created_at)
                VALUES (@id, @name, @email, @password, @role, @passcode, @created_at)
            `).run({
                id: user.id,
                name: user.name,
                email: user.email ?? null,
                password: user.password ?? null,
                role: user.role,
                passcode: user.passcode ?? null,
                created_at: user.created_at
            });
            return user;
        },
        async list() {
            const rows = connection.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as any[];
            return rows.map(r => ({ ...r }));
        }
    },

    products: {
        async findById(id) {
            const row = connection.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
            if (!row) return null;
            return {
                ...row,
                track_stock: !!row.track_stock,
                recipe: row.recipe ? JSON.parse(row.recipe) : undefined
            };
        },
        async create(product) {
            const serialized = {
                id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                cost: product.cost ?? null,
                sku: product.sku ?? null,
                stock: product.stock ?? null,
                track_stock: product.track_stock ? 1 : 0,
                recipe: product.recipe ? JSON.stringify(product.recipe) : null,
                created_at: product.created_at
            };
            connection.prepare(`
                INSERT INTO products (id, name, category, price, cost, sku, stock, track_stock, recipe, created_at)
                VALUES (@id, @name, @category, @price, @cost, @sku, @stock, @track_stock, @recipe, @created_at)
            `).run(serialized);
            return product;
        },
        async update(id, product) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const updated = { ...existing, ...product };
            const serialized = {
                id: updated.id,
                name: updated.name,
                category: updated.category,
                price: updated.price,
                cost: updated.cost ?? null,
                sku: updated.sku ?? null,
                stock: updated.stock ?? null,
                track_stock: updated.track_stock ? 1 : 0,
                recipe: updated.recipe ? JSON.stringify(updated.recipe) : null,
                created_at: updated.created_at
            };

            connection.prepare(`
                UPDATE products 
                SET name = @name, category = @category, price = @price, cost = @cost, 
                    sku = @sku, stock = @stock, track_stock = @track_stock, recipe = @recipe
                WHERE id = @id
            `).run(serialized);
            return updated;
        },
        async list() {
            const rows = connection.prepare('SELECT * FROM products ORDER BY name ASC').all() as any[];
            return rows.map(row => ({
                ...row,
                track_stock: !!row.track_stock,
                recipe: row.recipe ? JSON.parse(row.recipe) : undefined
            }));
        },
        async delete(id) {
            const res = connection.prepare('DELETE FROM products WHERE id = ?').run(id);
            return res.changes > 0;
        }
    },

    ingredients: {
        async findById(id) {
            const row = connection.prepare('SELECT * FROM ingredients WHERE id = ?').get(id) as any;
            return row ? { ...row } : null;
        },
        async create(ingredient) {
            connection.prepare(`
                INSERT INTO ingredients (id, name, stock, unit, min_threshold, created_at)
                VALUES (@id, @name, @stock, @unit, @min_threshold, @created_at)
            `).run(ingredient);
            return ingredient;
        },
        async update(id, ingredient) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const updated = { ...existing, ...ingredient };
            connection.prepare(`
                UPDATE ingredients 
                SET name = @name, stock = @stock, unit = @unit, min_threshold = @min_threshold
                WHERE id = @id
            `).run(updated);
            return updated;
        },
        async list() {
            const rows = connection.prepare('SELECT * FROM ingredients ORDER BY name ASC').all() as any[];
            return rows.map(r => ({ ...r }));
        },
        async delete(id) {
            const res = connection.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
            return res.changes > 0;
        }
    },

    orders: {
        async findById(id) {
            const row = connection.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
            if (!row) return null;
            return {
                ...row,
                items: JSON.parse(row.items),
                payment_details: row.payment_details ? JSON.parse(row.payment_details) : undefined
            };
        },
        async create(order) {
            const serialized = {
                ...order,
                items: JSON.stringify(order.items),
                payment_details: order.payment_details ? JSON.stringify(order.payment_details) : null
            };
            connection.prepare(`
                INSERT INTO orders (id, order_number, items, subtotal, tax, discount, total, status, 
                                    payment_method, created_at, created_by, dining_option, payment_details)
                VALUES (@id, @order_number, @items, @subtotal, @tax, @discount, @total, @status, 
                        @payment_method, @created_at, @created_by, @dining_option, @payment_details)
            `).run(serialized);
            return order;
        },
        async updateStatus(id, status) {
            connection.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
            return this.findById(id);
        },
        async update(id, order) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const updated = { ...existing, ...order };
            const serialized = {
                ...updated,
                items: JSON.stringify(updated.items),
                payment_details: updated.payment_details ? JSON.stringify(updated.payment_details) : null
            };

            connection.prepare(`
                UPDATE orders
                SET items = @items, subtotal = @subtotal, tax = @tax, discount = @discount, 
                    total = @total, status = @status, payment_method = @payment_method, 
                    dining_option = @dining_option, payment_details = @payment_details
                WHERE id = @id
            `).run(serialized);
            return updated;
        },
        async list(options) {
            let query = 'SELECT * FROM orders';
            const params: any[] = [];

            if (options?.status && options.status.length > 0) {
                const placeholders = options.status.map(() => '?').join(',');
                query += ` WHERE status IN (${placeholders})`;
                params.push(...options.status);
            }

            query += ' ORDER BY created_at DESC';

            if (options?.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

            const rows = connection.prepare(query).all(...params) as any[];
            return rows.map(row => ({
                ...row,
                items: JSON.parse(row.items),
                payment_details: row.payment_details ? JSON.parse(row.payment_details) : undefined
            }));
        },
        async getSalesSummary(startDate, endDate) {
            const row = connection.prepare(`
                SELECT 
                    SUM(total) as totalSales, 
                    COUNT(id) as totalOrders,
                    SUM(tax) as taxCollected,
                    SUM(discount) as discountsGiven
                FROM orders 
                WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
            `).get(startDate, endDate) as any;

            return {
                totalSales: row?.totalSales || 0,
                totalOrders: row?.totalOrders || 0,
                taxCollected: row?.taxCollected || 0,
                discountsGiven: row?.discountsGiven || 0
            };
        }
    },

    purchaseOrders: {
        async findById(id) {
            const row = connection.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as any;
            if (!row) return null;
            return {
                ...row,
                items: JSON.parse(row.items)
            };
        },
        async create(po) {
            const serialized = {
                ...po,
                items: JSON.stringify(po.items)
            };
            connection.prepare(`
                INSERT INTO purchase_orders (id, supplier_name, items, total_cost, status, created_at)
                VALUES (@id, @supplier_name, @items, @total_cost, @status, @created_at)
            `).run(serialized);
            return po;
        },
        async updateStatus(id, status) {
            connection.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(status, id);
            return this.findById(id);
        },
        async list() {
            const rows = connection.prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC').all() as any[];
            return rows.map(row => ({
                ...row,
                items: JSON.parse(row.items)
            }));
        }
    },

    async initialize() {
        if (connection) return;

        connection = new Database(dbPath);
        connection.pragma('journal_mode = WAL');

        // Create Tables
        connection.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                password TEXT,
                role TEXT NOT NULL,
                passcode TEXT UNIQUE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price REAL NOT NULL,
                cost REAL,
                sku TEXT,
                stock INTEGER,
                track_stock INTEGER DEFAULT 0,
                recipe TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ingredients (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                stock REAL NOT NULL,
                unit TEXT NOT NULL,
                min_threshold REAL NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                order_number TEXT NOT NULL,
                items TEXT NOT NULL,
                subtotal REAL NOT NULL,
                tax REAL NOT NULL,
                discount REAL NOT NULL,
                total REAL NOT NULL,
                status TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                dining_option TEXT NOT NULL,
                payment_details TEXT
            );

            CREATE TABLE IF NOT EXISTS purchase_orders (
                id TEXT PRIMARY KEY,
                supplier_name TEXT NOT NULL,
                items TEXT NOT NULL,
                total_cost REAL NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        `);

        // Keep local seeded accounts aligned with the current 6-digit PIN rule.
        const seedPinUpdates = [
            { id: 'u-1', passcode: '123456' },
            { id: 'u-2', passcode: '111111' },
            { id: 'u-3', passcode: '222222' }
        ];
        const updateSeedPin = connection.prepare('UPDATE users SET passcode = ? WHERE id = ?');
        seedPinUpdates.forEach((user) => updateSeedPin.run(user.passcode, user.id));

        // Check if database needs seeding
        const userCount = connection.prepare('SELECT COUNT(*) as count FROM users').get() as any;
        if (userCount.count === 0) {
            console.log('Seeding SQLite Database...');

            // Seed Users
            const adminUser: User = {
                id: 'u-1',
                name: 'Admin User',
                email: 'admin@example.com',
                password: hashPassword('password'),
                role: 'admin',
                passcode: '123456',
                created_at: new Date().toISOString()
            };
            const cashierUser: User = {
                id: 'u-2',
                name: 'Cashier User',
                email: 'cashier@example.com',
                password: hashPassword('password'),
                role: 'cashier',
                passcode: '111111',
                created_at: new Date().toISOString()
            };
            const baristaUser: User = {
                id: 'u-3',
                name: 'Barista User',
                email: 'barista@example.com',
                password: hashPassword('password'),
                role: 'barista',
                passcode: '222222',
                created_at: new Date().toISOString()
            };

            connection.prepare(`INSERT INTO users VALUES (@id, @name, @email, @password, @role, @passcode, @created_at)`).run(adminUser);
            connection.prepare(`INSERT INTO users VALUES (@id, @name, @email, @password, @role, @passcode, @created_at)`).run(cashierUser);
            connection.prepare(`INSERT INTO users VALUES (@id, @name, @email, @password, @role, @passcode, @created_at)`).run(baristaUser);

            // Seed Ingredients
            const seedIngredients: Ingredient[] = [
                { id: 'i-1', name: 'Espresso Beans', stock: 5000, unit: 'g', min_threshold: 1000, created_at: new Date().toISOString() },
                { id: 'i-2', name: 'Fresh Milk', stock: 10000, unit: 'ml', min_threshold: 2000, created_at: new Date().toISOString() },
                { id: 'i-3', name: 'Caramel Syrup', stock: 2000, unit: 'ml', min_threshold: 500, created_at: new Date().toISOString() },
                { id: 'i-4', name: 'Matcha Powder', stock: 1000, unit: 'g', min_threshold: 200, created_at: new Date().toISOString() },
                { id: 'i-5', name: 'Paper Cups (Hot)', stock: 500, unit: 'unit', min_threshold: 100, created_at: new Date().toISOString() },
                { id: 'i-6', name: 'Plastic Cups (Cold)', stock: 500, unit: 'unit', min_threshold: 100, created_at: new Date().toISOString() },
                { id: 'i-7', name: 'Cup Lids', stock: 1000, unit: 'unit', min_threshold: 200, created_at: new Date().toISOString() }
            ];

            const insertIngredient = connection.prepare(`
                INSERT INTO ingredients (id, name, stock, unit, min_threshold, created_at)
                VALUES (@id, @name, @stock, @unit, @min_threshold, @created_at)
            `);
            seedIngredients.forEach(i => insertIngredient.run(i));

            // Seed Products
            const seedProducts: Product[] = [
                {
                    id: 'p-1',
                    name: 'Espresso',
                    category: 'Espresso / Hot Coffee',
                    price: 120.00,
                    cost: 30.00,
                    sku: 'COF-ESP',
                    track_stock: false,
                    recipe: [
                        { ingredient_id: 'i-1', quantity: 18 }, // 18g espresso beans
                        { ingredient_id: 'i-5', quantity: 1 },  // 1 hot paper cup
                        { ingredient_id: 'i-7', quantity: 1 }   // 1 lid
                    ],
                    created_at: new Date().toISOString()
                },
                {
                    id: 'p-2',
                    name: 'Cafe Latte',
                    category: 'Espresso / Hot Coffee',
                    price: 150.00,
                    cost: 45.00,
                    sku: 'COF-LAT',
                    track_stock: false,
                    recipe: [
                        { ingredient_id: 'i-1', quantity: 18 }, // 18g beans
                        { ingredient_id: 'i-2', quantity: 250 }, // 250ml milk
                        { ingredient_id: 'i-5', quantity: 1 },
                        { ingredient_id: 'i-7', quantity: 1 }
                    ],
                    created_at: new Date().toISOString()
                },
                {
                    id: 'p-3',
                    name: 'Cappuccino',
                    category: 'Espresso / Hot Coffee',
                    price: 150.00,
                    cost: 42.00,
                    sku: 'COF-CAP',
                    track_stock: false,
                    recipe: [
                        { ingredient_id: 'i-1', quantity: 18 },
                        { ingredient_id: 'i-2', quantity: 200 }, // 200ml milk
                        { ingredient_id: 'i-5', quantity: 1 },
                        { ingredient_id: 'i-7', quantity: 1 }
                    ],
                    created_at: new Date().toISOString()
                },
                {
                    id: 'p-4',
                    name: 'Iced Caramel Latte',
                    category: 'Cold Brew / Iced Coffee',
                    price: 170.00,
                    cost: 55.00,
                    sku: 'COF-ICL',
                    track_stock: false,
                    recipe: [
                        { ingredient_id: 'i-1', quantity: 18 },
                        { ingredient_id: 'i-2', quantity: 250 },
                        { ingredient_id: 'i-3', quantity: 30 }, // 30ml caramel syrup
                        { ingredient_id: 'i-6', quantity: 1 }, // cold cup
                        { ingredient_id: 'i-7', quantity: 1 }
                    ],
                    created_at: new Date().toISOString()
                },
                {
                    id: 'p-5',
                    name: 'Matcha Latte',
                    category: 'Non-Coffee',
                    price: 160.00,
                    cost: 50.00,
                    sku: 'TEA-MAT',
                    track_stock: false,
                    recipe: [
                        { ingredient_id: 'i-4', quantity: 10 }, // 10g matcha powder
                        { ingredient_id: 'i-2', quantity: 250 }, // 250ml milk
                        { ingredient_id: 'i-5', quantity: 1 },
                        { ingredient_id: 'i-7', quantity: 1 }
                    ],
                    created_at: new Date().toISOString()
                },
                {
                    id: 'p-6',
                    name: 'Chocolate Croissant',
                    category: 'Pastries & Bakery',
                    price: 110.00,
                    cost: 40.00,
                    sku: 'BAK-CRO',
                    stock: 15,
                    track_stock: true,
                    created_at: new Date().toISOString()
                },
                {
                    id: 'p-7',
                    name: 'Blueberry Muffin',
                    category: 'Pastries & Bakery',
                    price: 95.00,
                    cost: 32.00,
                    sku: 'BAK-MUF',
                    stock: 10,
                    track_stock: true,
                    created_at: new Date().toISOString()
                }
            ];

            const insertProduct = connection.prepare(`
                INSERT INTO products (id, name, category, price, cost, sku, stock, track_stock, recipe, created_at)
                VALUES (@id, @name, @category, @price, @cost, @sku, @stock, @track_stock, @recipe, @created_at)
            `);

            seedProducts.forEach(p => {
                insertProduct.run({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    price: p.price,
                    cost: p.cost ?? null,
                    sku: p.sku ?? null,
                    stock: p.stock ?? null,
                    track_stock: p.track_stock ? 1 : 0,
                    recipe: p.recipe ? JSON.stringify(p.recipe) : null,
                    created_at: p.created_at
                });
            });

            console.log('SQLite Seeding Complete!');
        }
    },
    async wipeDatabase() {
        if (connection) {
            connection.exec(`
                DROP TABLE IF EXISTS purchase_orders;
                DROP TABLE IF EXISTS orders;
                DROP TABLE IF EXISTS ingredients;
                DROP TABLE IF EXISTS products;
                DROP TABLE IF EXISTS users;
            `);
            const conn = connection;
            connection = null as any;
            conn.close();
        }
        await this.initialize();
    }
};

export { sqliteDbInstance };
