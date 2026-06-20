import { MongoClient, Db } from 'mongodb';
import crypto from 'crypto';
import { DBInstance, UserRepository, ProductRepository, IngredientRepository, OrderRepository, PurchaseOrderRepository } from './db';
import { User, Product, Ingredient, Order, PurchaseOrder } from './schema';

// Helper to hash password using Node.js built-in crypto (PBKDF2)
function hashPassword(password: string): string {
    const salt = 'ttc-pos-salt'; // same salt as SQLite for consistency
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function getMongoUri(): string {
    if (process.env.DB_URI) {
        return process.env.DB_URI;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Missing DB_URI. Set the MongoDB Atlas connection string in Vercel Environment Variables.');
    }
    return 'mongodb://localhost:27017';
}

const uri = getMongoUri();
const dbName = process.env.DB_DATABASE || 'ttc_pos';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let db: Db;

function getClientPromise(): Promise<MongoClient> {
    if (clientPromise) return clientPromise;

    if (process.env.NODE_ENV === 'production') {
        const cli = new MongoClient(uri, { maxPoolSize: 10 });
        clientPromise = cli.connect().then(resolvedClient => {
            client = resolvedClient;
            return resolvedClient;
        });
    } else {
        if (!(global as any)._mongoClientPromise) {
            const cli = new MongoClient(uri, { maxPoolSize: 10 });
            (global as any)._mongoClientPromise = cli.connect();
        }
        clientPromise = (global as any)._mongoClientPromise.then((resolvedClient: MongoClient) => {
            client = resolvedClient;
            return resolvedClient;
        });
    }
    return clientPromise!;
}

const mongoDbInstance: DBInstance = {
    users: {
        async findById(id) {
            const user = await db.collection<User>('users').findOne({ id });
            return user ? { ...user } : null;
        },
        async findByEmail(email) {
            const user = await db.collection<User>('users').findOne({ email });
            return user ? { ...user } : null;
        },
        async findByPasscode(passcode) {
            const user = await db.collection<User>('users').findOne({ passcode });
            return user ? { ...user } : null;
        },
        async create(user) {
            const cloned = { ...user };
            if (cloned.password) {
                cloned.password = hashPassword(cloned.password);
            }
            await db.collection<User>('users').insertOne(cloned as any);
            return user;
        },
        async update(id, user) {
            const cloned = { ...user };
            if (cloned.password) {
                cloned.password = hashPassword(cloned.password);
            }
            await db.collection('users').updateOne({ id }, { $set: cloned });
            return this.findById(id);
        },
        async list() {
            const users = await db.collection<User>('users').find().sort({ created_at: -1 }).toArray();
            return users.map(u => ({ ...u }));
        },
        async delete(id) {
            const res = await db.collection('users').deleteOne({ id });
            return (res.deletedCount ?? 0) > 0;
        }
    },

    products: {
        async findById(id) {
            const product = await db.collection<Product>('products').findOne({ id });
            return product ? { ...product } : null;
        },
        async create(product) {
            await db.collection<Product>('products').insertOne({ ...product } as any);
            return product;
        },
        async update(id, product) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const updated = { ...existing, ...product };
            // Remove MongoDB internal _id if it's there
            const { _id, ...rest } = updated as any;
            await db.collection<Product>('products').replaceOne({ id }, rest as any);
            return updated;
        },
        async list() {
            const products = await db.collection<Product>('products').find().sort({ name: 1 }).toArray();
            return products.map(p => ({ ...p }));
        },
        async delete(id) {
            const res = await db.collection('products').deleteOne({ id });
            return (res.deletedCount || 0) > 0;
        }
    },

    ingredients: {
        async findById(id) {
            const ingredient = await db.collection<Ingredient>('ingredients').findOne({ id });
            return ingredient ? { ...ingredient } : null;
        },
        async create(ingredient) {
            const doc = {
                ...ingredient,
                max_capacity: ingredient.max_capacity ?? ingredient.stock
            };
            await db.collection<Ingredient>('ingredients').insertOne(doc as any);
            return doc;
        },
        async update(id, ingredient) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const updated = { ...existing, ...ingredient };
            const { _id, ...rest } = updated as any;
            await db.collection<Ingredient>('ingredients').replaceOne({ id }, rest as any);
            return updated;
        },
        async list() {
            const ingredients = await db.collection<Ingredient>('ingredients').find().sort({ name: 1 }).toArray();
            return ingredients.map(i => ({ ...i }));
        },
        async delete(id) {
            const res = await db.collection('ingredients').deleteOne({ id });
            return (res.deletedCount || 0) > 0;
        }
    },

    orders: {
        async findById(id) {
            const order = await db.collection<Order>('orders').findOne({ id });
            return order ? { ...order } : null;
        },
        async create(order) {
            await db.collection<Order>('orders').insertOne({ ...order } as any);
            return order;
        },
        async updateStatus(id, status) {
            await db.collection('orders').updateOne({ id }, { $set: { status } });
            return this.findById(id);
        },
        async update(id, order) {
            const existing = await this.findById(id);
            if (!existing) return null;

            const updated = { ...existing, ...order };
            const { _id, ...rest } = updated as any;
            await db.collection<Order>('orders').replaceOne({ id }, rest as any);
            return updated;
        },
        async list(options) {
            const filter: any = {};
            if (options?.status && options.status.length > 0) {
                filter.status = { $in: options.status };
            }

            let cursor = db.collection<Order>('orders').find(filter).sort({ created_at: -1 });
            if (options?.limit) {
                cursor = cursor.limit(options.limit);
            }

            const orders = await cursor.toArray();
            return orders.map(o => ({ ...o }));
        },
        async getSalesSummary(startDate, endDate) {
            const result = await db.collection<Order>('orders').aggregate([
                {
                    $match: {
                        created_at: { $gte: startDate, $lte: endDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: '$total' },
                        totalOrders: { $sum: 1 },
                        taxCollected: { $sum: '$tax' },
                        discountsGiven: { $sum: '$discount' }
                    }
                }
            ]).toArray();

            if (result.length === 0) {
                return {
                    totalSales: 0,
                    totalOrders: 0,
                    taxCollected: 0,
                    discountsGiven: 0
                };
            }

            return {
                totalSales: result[0].totalSales || 0,
                totalOrders: result[0].totalOrders || 0,
                taxCollected: result[0].taxCollected || 0,
                discountsGiven: result[0].discountsGiven || 0
            };
        }
    },

    purchaseOrders: {
        async findById(id) {
            const po = await db.collection<PurchaseOrder>('purchase_orders').findOne({ id });
            return po ? { ...po } : null;
        },
        async create(po) {
            await db.collection<PurchaseOrder>('purchase_orders').insertOne({ ...po } as any);
            return po;
        },
        async updateStatus(id, status) {
            await db.collection('purchase_orders').updateOne({ id }, { $set: { status } });
            return this.findById(id);
        },
        async list() {
            const pos = await db.collection<PurchaseOrder>('purchase_orders').find().sort({ created_at: -1 }).toArray();
            return pos.map(p => ({ ...p }));
        }
    },

    securityLogs: {
        async create(log) {
            const newLog = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                ...log
            };
            await db.collection('security_logs').insertOne(newLog);
            return newLog as any;
        },
        async list() {
            const logs = await db.collection('security_logs').find().sort({ timestamp: -1 }).toArray();
            return logs.map(l => ({ ...l })) as any[];
        }
    },

    async initialize() {
        if (db) return;

        const resolvedClient = await getClientPromise();
        db = resolvedClient.db(dbName);

        // Ensure indexes
        await db.collection('users').createIndex({ id: 1 }, { unique: true });
        await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
        await db.collection('users').createIndex({ passcode: 1 }, { unique: true, sparse: true });
        await db.collection('products').createIndex({ id: 1 }, { unique: true });
        await db.collection('ingredients').createIndex({ id: 1 }, { unique: true });
        await db.collection('orders').createIndex({ id: 1 }, { unique: true });
        await db.collection('purchase_orders').createIndex({ id: 1 }, { unique: true });

        // Keep local seeded accounts aligned with the current 6-digit PIN rule.
        await db.collection('users').bulkWrite([
            { updateOne: { filter: { id: 'u-1' }, update: { $set: { passcode: '749215' } } } },
            { updateOne: { filter: { id: 'u-2' }, update: { $set: { passcode: '385624' } } } }
        ], { ordered: false });

        // Migration to populate max_capacity with stock if it is missing in ingredients
        try {
            await db.collection('ingredients').updateMany(
                { max_capacity: { $exists: false } },
                [
                    { $set: { max_capacity: "$stock" } }
                ]
            );
        } catch (migErr) {
            console.error('Failed to migrate max_capacity on MongoDB:', migErr);
        }

        // Seed if users is empty
        const userCount = await db.collection('users').countDocuments();
        if (userCount === 0) {
            console.log('Seeding MongoDB Database...');

            const adminUser: User = {
                id: 'u-admin',
                name: 'adm1nadm1n',
                email: 'adm1nadm1n',
                password: hashPassword('H3r0br1n3$'),
                role: 'admin',
                created_at: new Date().toISOString()
            };
            const dynUser: User = {
                id: 'u-1',
                name: 'dyn3',
                email: 'dyn3@thistimecafe.tech',
                password: hashPassword('tTc_dyN3_92s#pWx'),
                role: 'owner',
                passcode: '749215',
                created_at: new Date().toISOString()
            };
            const jrlieUser: User = {
                id: 'u-2',
                name: 'jrlie',
                email: 'jrlie@thistimecafe.tech',
                password: hashPassword('tTc_jrLie_83k!zQp'),
                role: 'owner',
                passcode: '385624',
                created_at: new Date().toISOString()
            };
            await db.collection('users').insertMany([adminUser, dynUser, jrlieUser] as any);

            // Seed Ingredients
            const seedIngredients: Ingredient[] = [
                { id: 'i-1', name: 'Espresso Beans', stock: 0, unit: 'g', min_threshold: 2000, max_capacity: 10000, created_at: new Date().toISOString() },
                { id: 'i-2', name: 'Fresh Milk', stock: 0, unit: 'ml', min_threshold: 4000, max_capacity: 20000, created_at: new Date().toISOString() },
                { id: 'i-3', name: 'Caramel Syrup', stock: 0, unit: 'ml', min_threshold: 1000, max_capacity: 5000, created_at: new Date().toISOString() },
                { id: 'i-4', name: 'Matcha Powder', stock: 0, unit: 'g', min_threshold: 500, max_capacity: 2000, created_at: new Date().toISOString() },
                { id: 'i-5', name: 'Paper Cups (Hot)', stock: 0, unit: 'unit', min_threshold: 200, max_capacity: 1000, created_at: new Date().toISOString() },
                { id: 'i-6', name: 'Plastic Cups (Cold)', stock: 0, unit: 'unit', min_threshold: 200, max_capacity: 1000, created_at: new Date().toISOString() },
                { id: 'i-7', name: 'Cup Lids', stock: 0, unit: 'unit', min_threshold: 400, max_capacity: 2000, created_at: new Date().toISOString() },
                { id: 'i-8', name: 'Chocolate Sauce', stock: 0, unit: 'ml', min_threshold: 1000, max_capacity: 5000, created_at: new Date().toISOString() },
                { id: 'i-9', name: 'Taro Powder', stock: 0, unit: 'g', min_threshold: 500, max_capacity: 2000, created_at: new Date().toISOString() },
                { id: 'i-10', name: 'Strawberry Puree', stock: 0, unit: 'ml', min_threshold: 600, max_capacity: 3000, created_at: new Date().toISOString() },
                { id: 'i-11', name: 'Blueberry Puree', stock: 0, unit: 'ml', min_threshold: 600, max_capacity: 3000, created_at: new Date().toISOString() },
                { id: 'i-12', name: 'Cookie Dough', stock: 0, unit: 'unit', min_threshold: 20, max_capacity: 100, created_at: new Date().toISOString() },
                { id: 'i-13', name: 'Brownie Mix', stock: 0, unit: 'unit', min_threshold: 20, max_capacity: 100, created_at: new Date().toISOString() }
            ];
            await db.collection('ingredients').insertMany(seedIngredients as any);

            // Seed Products
            const seedProducts: Product[] = [
                // Hot Coffee
                { id: 'p-1', name: 'Hot Americano', category: 'Hot Coffee', price: 69.00, cost: 15.00, sku: 'HOT-AME', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-2', name: 'Hot Coffee Latte\'', category: 'Hot Coffee', price: 79.00, cost: 20.00, sku: 'HOT-LAT', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-3', name: 'Hot Caramel Macchiato', category: 'Hot Coffee', price: 89.00, cost: 25.00, sku: 'HOT-MAC', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-3', quantity: 15 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-4', name: 'Hot Creamy Hazelnut', category: 'Hot Coffee', price: 89.00, cost: 22.00, sku: 'HOT-HAZ', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-5', name: 'Hot Mocha Latte\'', category: 'Hot Coffee', price: 89.00, cost: 25.00, sku: 'HOT-MOC', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-8', quantity: 15 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-6', name: 'Hot Spanish Latte\'', category: 'Hot Coffee', price: 89.00, cost: 22.00, sku: 'HOT-SPA', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-7', name: 'Hot Seasalt Latte\'', category: 'Hot Coffee', price: 89.00, cost: 22.00, sku: 'HOT-SEA', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-8', name: 'Hot Vanilla Latte\'', category: 'Hot Coffee', price: 89.00, cost: 22.00, sku: 'HOT-VAN', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-5', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },

                // Iced Coffee (Classic)
                { id: 'p-9', name: 'Iced Americano (Classic)', category: 'Iced Coffee (Classic)', price: 69.00, cost: 15.00, sku: 'ICC-AME', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-10', name: 'Iced Coffee Latte\' (Classic)', category: 'Iced Coffee (Classic)', price: 79.00, cost: 20.00, sku: 'ICC-LAT', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-11', name: 'Iced Caramel Latte\' (Classic)', category: 'Iced Coffee (Classic)', price: 89.00, cost: 25.00, sku: 'ICC-CRL', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-3', quantity: 15 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-12', name: 'Iced Caramel Macchiato (Classic)', category: 'Iced Coffee (Classic)', price: 99.00, cost: 30.00, sku: 'ICC-MAC', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-3', quantity: 15 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-13', name: 'Iced Creamy Hazelnut (Classic)', category: 'Iced Coffee (Classic)', price: 89.00, cost: 25.00, sku: 'ICC-HAZ', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-14', name: 'Iced Mocha Latte\' (Classic)', category: 'Iced Coffee (Classic)', price: 89.00, cost: 28.00, sku: 'ICC-MOC', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-8', quantity: 15 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-15', name: 'Iced Spanish Latte\' (Classic)', category: 'Iced Coffee (Classic)', price: 89.00, cost: 25.00, sku: 'ICC-SPA', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-16', name: 'Iced Seasalt Latte\' (Classic)', category: 'Iced Coffee (Classic)', price: 89.00, cost: 25.00, sku: 'ICC-SEA', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-17', name: 'Iced Vanilla Latte\' (Classic)', category: 'Iced Coffee (Classic)', price: 89.00, cost: 25.00, sku: 'ICC-VAN', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },

                // Iced Coffee (Premium)
                { id: 'p-18', name: 'Iced Caramel Macchiato (Premium)', category: 'Iced Coffee (Premium)', price: 109.00, cost: 35.00, sku: 'ICP-MAC', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-3', quantity: 20 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-19', name: 'Iced Creamy Hazelnut (Premium)', category: 'Iced Coffee (Premium)', price: 99.00, cost: 30.00, sku: 'ICP-HAZ', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-20', name: 'Iced Mocha Latte\' (Premium)', category: 'Iced Coffee (Premium)', price: 109.00, cost: 35.00, sku: 'ICP-MOC', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-8', quantity: 20 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-21', name: 'Iced Seasalt Latte\' (Premium)', category: 'Iced Coffee (Premium)', price: 109.00, cost: 32.00, sku: 'ICP-SEA', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-22', name: 'Iced Dirty Matcha', category: 'Iced Coffee (Premium)', price: 119.00, cost: 38.00, sku: 'ICP-DIR', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 150 }, { ingredient_id: 'i-4', quantity: 5 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-23', name: 'Iced Salted Caramel', category: 'Iced Coffee (Premium)', price: 109.00, cost: 32.00, sku: 'ICP-SAL', track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-3', quantity: 20 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },

                // Non-Coffee
                { id: 'p-24', name: 'Matcha Latte\'', category: 'Non-Coffee', price: 109.00, cost: 30.00, sku: 'NCF-MAT', track_stock: false, recipe: [{ ingredient_id: 'i-4', quantity: 5 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-25', name: 'Caramel Matcha', category: 'Non-Coffee', price: 109.00, cost: 35.00, sku: 'NCF-CMT', track_stock: false, recipe: [{ ingredient_id: 'i-4', quantity: 5 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-3', quantity: 15 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-26', name: 'Milo Lava', category: 'Non-Coffee', price: 109.00, cost: 25.00, sku: 'NCF-MIL', track_stock: false, recipe: [{ ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-27', name: 'Milo Matcha', category: 'Non-Coffee', price: 109.00, cost: 35.00, sku: 'NCF-MMA', track_stock: false, recipe: [{ ingredient_id: 'i-4', quantity: 5 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-28', name: 'Cookies & Cream Cloud', category: 'Non-Coffee', price: 119.00, cost: 32.00, sku: 'NCF-CCN', track_stock: false, recipe: [{ ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-29', name: 'Taro Cloud Latte\'', category: 'Non-Coffee', price: 109.00, cost: 30.00, sku: 'NCF-TAR', track_stock: false, recipe: [{ ingredient_id: 'i-9', quantity: 10 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },

                // Berries Series
                { id: 'p-30', name: 'Strawberry Latte\'', category: 'Berries Series', price: 109.00, cost: 32.00, sku: 'BER-SLT', track_stock: false, recipe: [{ ingredient_id: 'i-10', quantity: 30 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-31', name: 'Strawberry Choco', category: 'Berries Series', price: 109.00, cost: 35.00, sku: 'BER-SCH', track_stock: false, recipe: [{ ingredient_id: 'i-10', quantity: 30 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-8', quantity: 15 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-32', name: 'Strawberry Matcha', category: 'Berries Series', price: 119.00, cost: 38.00, sku: 'BER-SMA', track_stock: false, recipe: [{ ingredient_id: 'i-10', quantity: 30 }, { ingredient_id: 'i-4', quantity: 5 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-33', name: 'Strawberry Taro', category: 'Berries Series', price: 119.00, cost: 38.00, sku: 'BER-STA', track_stock: false, recipe: [{ ingredient_id: 'i-10', quantity: 30 }, { ingredient_id: 'i-9', quantity: 10 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-34', name: 'Blueberry Latte\'', category: 'Berries Series', price: 109.00, cost: 32.00, sku: 'BER-BLT', track_stock: false, recipe: [{ ingredient_id: 'i-11', quantity: 30 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-35', name: 'Blueberry Cloud', category: 'Berries Series', price: 119.00, cost: 35.00, sku: 'BER-BCL', track_stock: false, recipe: [{ ingredient_id: 'i-11', quantity: 30 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-36', name: 'Blueberry Choco', category: 'Berries Series', price: 109.00, cost: 35.00, sku: 'BER-BCH', track_stock: false, recipe: [{ ingredient_id: 'i-11', quantity: 30 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-8', quantity: 15 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
                { id: 'p-37', name: 'Blueberry Matcha', category: 'Berries Series', price: 119.00, cost: 38.00, sku: 'BER-BMA', track_stock: false, recipe: [{ ingredient_id: 'i-11', quantity: 30 }, { ingredient_id: 'i-4', quantity: 5 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },

                // Pastries
                { id: 'p-38', name: 'Classic Cookies', category: 'Pastries', price: 25.00, cost: 10.00, sku: 'PST-CCO', stock: 0, track_stock: true, created_at: new Date().toISOString() },
                { id: 'p-39', name: 'M&M Cookies', category: 'Pastries', price: 35.00, cost: 15.00, sku: 'PST-MMC', stock: 0, track_stock: true, created_at: new Date().toISOString() },
                { id: 'p-40', name: 'Oatmilk Cookies', category: 'Pastries', price: 45.00, cost: 20.00, sku: 'PST-OCO', stock: 0, track_stock: true, created_at: new Date().toISOString() },
                { id: 'p-41', name: 'Biscoff Cookies', category: 'Pastries', price: 45.00, cost: 20.00, sku: 'PST-BCO', stock: 0, track_stock: true, created_at: new Date().toISOString() },
                { id: 'p-42', name: 'Classic Brownies', category: 'Pastries', price: 25.00, cost: 10.00, sku: 'PST-CBR', stock: 0, track_stock: true, created_at: new Date().toISOString() },
                { id: 'p-43', name: 'Peanut Brownies', category: 'Pastries', price: 35.00, cost: 15.00, sku: 'PST-PBR', stock: 0, track_stock: true, created_at: new Date().toISOString() }
            ];
            await db.collection('products').insertMany(seedProducts as any);

            console.log('MongoDB Seeding Complete!');
        }
    },
    async wipeDatabase() {
        if (client) {
            const collections = await db.listCollections().toArray();
            for (const col of collections) {
                await db.collection(col.name).drop();
            }
            const cli = client;
            client = null;
            clientPromise = null;
            if (process.env.NODE_ENV !== 'production') {
                delete (global as any)._mongoClientPromise;
            }
            await cli.close();
        }
        await this.initialize();
    }
};

export { mongoDbInstance };
