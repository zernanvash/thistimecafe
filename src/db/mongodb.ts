import { MongoClient, Db } from 'mongodb';
import crypto from 'crypto';
import { DBInstance, UserRepository, ProductRepository, IngredientRepository, OrderRepository, PurchaseOrderRepository } from './db';
import { User, Product, Ingredient, Order, PurchaseOrder } from './schema';

// Helper to hash password using Node.js built-in crypto (PBKDF2)
function hashPassword(password: string): string {
    const salt = 'ttc-pos-salt'; // same salt as SQLite for consistency
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

const uri = process.env.DB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_DATABASE || 'ttc_pos';

let client: MongoClient;
let db: Db;

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
        async list() {
            const users = await db.collection<User>('users').find().sort({ created_at: -1 }).toArray();
            return users.map(u => ({ ...u }));
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
            await db.collection<Ingredient>('ingredients').insertOne({ ...ingredient } as any);
            return ingredient;
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

    async initialize() {
        if (client) return;

        client = new MongoClient(uri);
        await client.connect();
        db = client.db(dbName);

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
            { updateOne: { filter: { id: 'u-1' }, update: { $set: { passcode: '123456' } } } },
            { updateOne: { filter: { id: 'u-2' }, update: { $set: { passcode: '111111' } } } },
            { updateOne: { filter: { id: 'u-3' }, update: { $set: { passcode: '222222' } } } }
        ], { ordered: false });

        // Seed if users is empty
        const userCount = await db.collection('users').countDocuments();
        if (userCount === 0) {
            console.log('Seeding MongoDB Database...');

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

            await db.collection('users').insertMany([adminUser, cashierUser, baristaUser] as any);

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
            await db.collection('ingredients').insertMany(seedIngredients as any);

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
                        { ingredient_id: 'i-1', quantity: 18 },
                        { ingredient_id: 'i-5', quantity: 1 },
                        { ingredient_id: 'i-7', quantity: 1 }
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
                        { ingredient_id: 'i-1', quantity: 18 },
                        { ingredient_id: 'i-2', quantity: 250 },
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
                        { ingredient_id: 'i-2', quantity: 200 },
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
                        { ingredient_id: 'i-3', quantity: 30 },
                        { ingredient_id: 'i-6', quantity: 1 },
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
                        { ingredient_id: 'i-4', quantity: 10 },
                        { ingredient_id: 'i-2', quantity: 250 },
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
            client = null as any;
            await cli.close();
        }
        await this.initialize();
    }
};

export { mongoDbInstance };
