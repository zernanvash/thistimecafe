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
        },
        async delete(id) {
            const res = await db.collection('orders').deleteOne({ id });
            return (res.deletedCount ?? 0) > 0;
        },
        async clearAll() {
            await db.collection('orders').deleteMany({});
            return true;
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
