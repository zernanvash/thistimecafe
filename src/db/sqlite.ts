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
            return row ? { ...row, is_locked: !!row.is_locked } : null;
        },
        async findByEmail(email) {
            const row = connection.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
            return row ? { ...row, is_locked: !!row.is_locked } : null;
        },
        async findByPasscode(passcode) {
            const row = connection.prepare('SELECT * FROM users WHERE passcode = ?').get(passcode) as any;
            return row ? { ...row, is_locked: !!row.is_locked } : null;
        },
        async create(user) {
            if (user.password) {
                user.password = hashPassword(user.password);
            }
            connection.prepare(`
                INSERT INTO users (id, name, email, password, role, passcode, is_locked, failed_attempts, locked_until, created_at)
                VALUES (@id, @name, @email, @password, @role, @passcode, @is_locked, @failed_attempts, @locked_until, @created_at)
            `).run({
                id: user.id,
                name: user.name,
                email: user.email ?? null,
                password: user.password ?? null,
                role: user.role,
                passcode: user.passcode ?? null,
                is_locked: user.is_locked ? 1 : 0,
                failed_attempts: user.failed_attempts ?? 0,
                locked_until: user.locked_until ?? null,
                created_at: user.created_at
            });
            return user;
        },
        async update(id, user) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const cloned = { ...user };
            if (cloned.password) {
                cloned.password = hashPassword(cloned.password);
            }
            const updated = { ...existing, ...cloned };
            const serialized = {
                id: updated.id,
                name: updated.name,
                email: updated.email ?? null,
                password: updated.password ?? null,
                role: updated.role,
                passcode: updated.passcode ?? null,
                is_locked: updated.is_locked ? 1 : 0,
                failed_attempts: updated.failed_attempts ?? 0,
                locked_until: updated.locked_until ?? null,
                created_at: updated.created_at
            };

            connection.prepare(`
                UPDATE users 
                SET name = @name, email = @email, password = @password, role = @role, 
                    passcode = @passcode, is_locked = @is_locked, 
                    failed_attempts = @failed_attempts, locked_until = @locked_until
                WHERE id = @id
            `).run(serialized);

            return {
                ...updated,
                is_locked: !!updated.is_locked
            };
        },
        async list() {
            const rows = connection.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as any[];
            return rows.map(r => ({ ...r, is_locked: !!r.is_locked }));
        },
        async delete(id) {
            const res = connection.prepare('DELETE FROM users WHERE id = ?').run(id);
            return res.changes > 0;
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
                INSERT INTO ingredients (id, name, stock, unit, min_threshold, max_capacity, created_at)
                VALUES (@id, @name, @stock, @unit, @min_threshold, @max_capacity, @created_at)
            `).run({
                ...ingredient,
                max_capacity: ingredient.max_capacity ?? ingredient.stock
            });
            return ingredient;
        },
        async update(id, ingredient) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const updated = { ...existing, ...ingredient };
            connection.prepare(`
                UPDATE ingredients 
                SET name = @name, stock = @stock, unit = @unit, min_threshold = @min_threshold, max_capacity = @max_capacity
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

    securityLogs: {
        async create(log) {
            const newLog = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                ...log
            };
            connection.prepare(`
                INSERT INTO security_logs (id, timestamp, event_type, username, details, ip)
                VALUES (@id, @timestamp, @event_type, @username, @details, @ip)
            `).run(newLog);
            return newLog;
        },
        async list() {
            const rows = connection.prepare('SELECT * FROM security_logs ORDER BY timestamp DESC').all() as any[];
            return rows.map(r => ({ ...r }));
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
                passcode TEXT,
                is_locked INTEGER DEFAULT 0,
                failed_attempts INTEGER DEFAULT 0,
                locked_until TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS security_logs (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                username TEXT NOT NULL,
                details TEXT NOT NULL,
                ip TEXT
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
                max_capacity REAL,
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

        // Ensure max_capacity column exists in ingredients table (migration)
        try {
            connection.prepare('SELECT max_capacity FROM ingredients LIMIT 1').get();
        } catch (err) {
            try {
                connection.exec('ALTER TABLE ingredients ADD COLUMN max_capacity REAL;');
                console.log('Added max_capacity column to ingredients table.');
            } catch (alterErr) {
                console.error('Failed to add max_capacity column:', alterErr);
            }
        }

        // Migration to populate max_capacity with stock if it is null
        try {
            connection.exec('UPDATE ingredients SET max_capacity = stock WHERE max_capacity IS NULL;');
        } catch (migErr) {
            console.error('Failed to backfill max_capacity in ingredients table:', migErr);
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
                DROP TABLE IF EXISTS security_logs;
            `);
            const conn = connection;
            connection = null as any;
            conn.close();
        }
        await this.initialize();
    }
};

export { sqliteDbInstance };
