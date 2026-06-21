const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const dns = require('dns');

// Configure Node.js to use Google DNS directly to bypass local resolver bugs
console.log('Configuring Node DNS resolution to Google DNS (8.8.8.8)...');
try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
    console.warn('Could not set custom DNS servers:', e.message);
}

// 1. Load environment variables
const envPath = path.join(__dirname, '.env');
console.log('Reading database settings from .env...');
let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
    console.error('Could not read .env file:', e.message);
    process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        env[key] = value;
    }
});

const uri = env.DB_URI || 'mongodb://localhost:27017';
const dbName = env.DB_DATABASE || 'ttc_pos';

function hashPassword(password) {
    const salt = 'ttc-pos-salt';
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

async function run() {
    console.log('Connecting to database...');
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('Connected to MongoDB successfully!');
        const db = client.db(dbName);

        // Clear existing tables
        console.log('Clearing existing collections (users, ingredients, products, orders, purchase_orders, security_logs)...');
        await db.collection('users').deleteMany({});
        await db.collection('ingredients').deleteMany({});
        await db.collection('products').deleteMany({});
        await db.collection('orders').deleteMany({});
        await db.collection('purchase_orders').deleteMany({});
        await db.collection('security_logs').deleteMany({});

        // Users Seed
        console.log('Seeding Users...');
        const users = [
            {
                id: "u-admin",
                name: "adm1nadm1n",
                email: "adm1nadm1n",
                password: hashPassword("H3r0br1n3$"),
                role: "admin",
                is_locked: false,
                failed_attempts: 0,
                created_at: new Date().toISOString()
            },
            {
                id: "u-1",
                name: "dyn3",
                email: "dyn3@thistimecafe.tech",
                password: hashPassword("tTc_dyN3_92s#pWx"),
                role: "owner",
                passcode: "749215",
                is_locked: false,
                failed_attempts: 0,
                created_at: new Date().toISOString()
            },
            {
                id: "u-2",
                name: "jrlie",
                email: "jrlie@thistimecafe.tech",
                password: hashPassword("tTc_jrLie_83k!zQp"),
                role: "owner",
                passcode: "385624",
                is_locked: false,
                failed_attempts: 0,
                created_at: new Date().toISOString()
            },
            {
                id: "u-3",
                name: "cashier1",
                email: "cashier@thistimecafe.tech",
                password: hashPassword("cashier123"),
                role: "cashier",
                passcode: "123456",
                is_locked: false,
                failed_attempts: 0,
                created_at: new Date().toISOString()
            }
        ];
        await db.collection('users').insertMany(users);
        console.log(`Seeded ${users.length} users.`);

        // Ingredients Seed
        console.log('Seeding Ingredients...');
        const ingredients = [
            { id: "i-1", name: "Espresso Beans", stock: 0, unit: "g", min_threshold: 2000, max_capacity: 10000, created_at: new Date().toISOString() },
            { id: "i-2", name: "Fresh Milk", stock: 0, unit: "ml", min_threshold: 4000, max_capacity: 20000, created_at: new Date().toISOString() },
            { id: "i-3", name: "Caramel Syrup", stock: 0, unit: "ml", min_threshold: 1000, max_capacity: 5000, created_at: new Date().toISOString() },
            { id: "i-4", name: "Matcha Powder", stock: 0, unit: "g", min_threshold: 500, max_capacity: 2000, created_at: new Date().toISOString() },
            { id: "i-5", name: "Paper Cups (Hot)", stock: 0, unit: "unit", min_threshold: 200, max_capacity: 1000, created_at: new Date().toISOString() },
            { id: "i-6", name: "Plastic Cups (Cold)", stock: 0, unit: "unit", min_threshold: 200, max_capacity: 1000, created_at: new Date().toISOString() },
            { id: "i-7", name: "Cup Lids", stock: 0, unit: "unit", min_threshold: 400, max_capacity: 2000, created_at: new Date().toISOString() },
            { id: "i-8", name: "Chocolate Sauce", stock: 0, unit: "ml", min_threshold: 1000, max_capacity: 5000, created_at: new Date().toISOString() },
            { id: "i-9", name: "Taro Powder", stock: 0, unit: "g", min_threshold: 500, max_capacity: 2000, created_at: new Date().toISOString() },
            { id: "i-10", name: "Strawberry Puree", stock: 0, unit: "ml", min_threshold: 600, max_capacity: 3000, created_at: new Date().toISOString() },
            { id: "i-11", name: "Blueberry Puree", stock: 0, unit: "ml", min_threshold: 600, max_capacity: 3000, created_at: new Date().toISOString() },
            { id: "i-12", name: "Cookie Dough", stock: 0, unit: "unit", min_threshold: 20, max_capacity: 100, created_at: new Date().toISOString() },
            { id: "i-13", name: "Brownie Mix", stock: 0, unit: "unit", min_threshold: 20, max_capacity: 100, created_at: new Date().toISOString() }
        ];
        await db.collection('ingredients').insertMany(ingredients);
        console.log(`Seeded ${ingredients.length} ingredients.`);

        // Products Seed
        console.log('Seeding Products...');
        const products = [
            // Hot Coffee
            { id: "p-1", name: "Hot Americano", category: "Hot Coffee", price: 69.00, cost: 15.00, sku: "HOT-AME", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-2", name: "Hot Coffee Latte'", category: "Hot Coffee", price: 79.00, cost: 20.00, sku: "HOT-LAT", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-3", name: "Hot Caramel Macchiato", category: "Hot Coffee", price: 89.00, cost: 25.00, sku: "HOT-MAC", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-3", quantity: 15 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-4", name: "Hot Creamy Hazelnut", category: "Hot Coffee", price: 89.00, cost: 22.00, sku: "HOT-HAZ", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-5", name: "Hot Mocha Latte'", category: "Hot Coffee", price: 89.00, cost: 25.00, sku: "HOT-MOC", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-8", quantity: 15 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-6", name: "Hot Spanish Latte'", category: "Hot Coffee", price: 89.00, cost: 22.00, sku: "HOT-SPA", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-7", name: "Hot Seasalt Latte'", category: "Hot Coffee", price: 89.00, cost: 22.00, sku: "HOT-SEA", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-8", name: "Hot Vanilla Latte'", category: "Hot Coffee", price: 89.00, cost: 22.00, sku: "HOT-VAN", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-5", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },

            // Iced Coffee (Classic)
            { id: "p-9", name: "Iced Americano (Classic)", category: "Iced Coffee (Classic)", price: 69.00, cost: 15.00, sku: "ICC-AME", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-10", name: "Iced Coffee Latte' (Classic)", category: "Iced Coffee (Classic)", price: 79.00, cost: 20.00, sku: "ICC-LAT", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-11", name: "Iced Caramel Latte' (Classic)", category: "Iced Coffee (Classic)", price: 89.00, cost: 25.00, sku: "ICC-CRL", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-3", quantity: 15 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-12", name: "Iced Caramel Macchiato (Classic)", category: "Iced Coffee (Classic)", price: 99.00, cost: 30.00, sku: "ICC-MAC", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-3", quantity: 15 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-13", name: "Iced Creamy Hazelnut (Classic)", category: "Iced Coffee (Classic)", price: 89.00, cost: 25.00, sku: "ICC-HAZ", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-14", name: "Iced Mocha Latte' (Classic)", category: "Iced Coffee (Classic)", price: 89.00, cost: 28.00, sku: "ICC-MOC", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-8", quantity: 15 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-15", name: "Iced Spanish Latte' (Classic)", category: "Iced Coffee (Classic)", price: 89.00, cost: 25.00, sku: "ICC-SPA", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-16", name: "Iced Seasalt Latte' (Classic)", category: "Iced Coffee (Classic)", price: 89.00, cost: 25.00, sku: "ICC-SEA", track_stock: false, recipe: [{ ingredient_id: 'i-1', quantity: 18 }, { ingredient_id: 'i-2', quantity: 200 }, { ingredient_id: 'i-6', quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-17", name: "Iced Vanilla Latte' (Classic)", category: "Iced Coffee (Classic)", price: 89.00, cost: 25.00, sku: "ICC-VAN", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },

            // Iced Coffee (Premium)
            { id: "p-18", name: "Iced Caramel Macchiato (Premium)", category: "Iced Coffee (Premium)", price: 109.00, cost: 35.00, sku: "ICP-MAC", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-3", quantity: 20 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-19", name: "Iced Creamy Hazelnut (Premium)", category: "Iced Coffee (Premium)", price: 99.00, cost: 30.00, sku: "ICP-HAZ", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-20", name: "Iced Mocha Latte' (Premium)", category: "Iced Coffee (Premium)", price: 109.00, cost: 35.00, sku: "ICP-MOC", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-8", quantity: 20 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-21", name: "Iced Seasalt Latte' (Premium)", category: "Iced Coffee (Premium)", price: 109.00, cost: 32.00, sku: "ICP-SEA", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-22", name: "Iced Dirty Matcha", category: "Iced Coffee (Premium)", price: 119.00, cost: 38.00, sku: "ICP-DIR", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 150 }, { ingredient_id: "i-4", quantity: 5 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-23", name: "Iced Salted Caramel", category: "Iced Coffee (Premium)", price: 109.00, cost: 32.00, sku: "ICP-SAL", track_stock: false, recipe: [{ ingredient_id: "i-1", quantity: 18 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-3", quantity: 20 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },

            // Non-Coffee
            { id: "p-24", name: "Matcha Latte'", category: "Non-Coffee", price: 109.00, cost: 30.00, sku: "NCF-MAT", track_stock: false, recipe: [{ ingredient_id: "i-4", quantity: 5 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-25", name: "Caramel Matcha", category: "Non-Coffee", price: 109.00, cost: 35.00, sku: "NCF-CMT", track_stock: false, recipe: [{ ingredient_id: "i-4", quantity: 5 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-3", quantity: 15 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-26", name: "Milo Lava", category: "Non-Coffee", price: 109.00, cost: 25.00, sku: "NCF-MIL", track_stock: false, recipe: [{ ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-27", name: "Milo Matcha", category: "Non-Coffee", price: 109.00, cost: 35.00, sku: "NCF-MMA", track_stock: false, recipe: [{ ingredient_id: "i-4", quantity: 5 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-28", name: "Cookies & Cream Cloud", category: "Non-Coffee", price: 119.00, cost: 32.00, sku: "NCF-CCN", track_stock: false, recipe: [{ ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-29", name: "Taro Cloud Latte'", category: "Non-Coffee", price: 109.00, cost: 30.00, sku: "NCF-TAR", track_stock: false, recipe: [{ ingredient_id: "i-9", quantity: 10 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },

            // Berries Series
            { id: "p-30", name: "Strawberry Latte'", category: "Berries Series", price: 109.00, cost: 32.00, sku: "BER-SLT", track_stock: false, recipe: [{ ingredient_id: "i-10", quantity: 30 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-31", name: "Strawberry Choco", category: "Berries Series", price: 109.00, cost: 35.00, sku: "BER-SCH", track_stock: false, recipe: [{ ingredient_id: "i-10", quantity: 30 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-8", quantity: 15 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-32", name: "Strawberry Matcha", category: "Berries Series", price: 119.00, cost: 38.00, sku: "BER-SMA", track_stock: false, recipe: [{ ingredient_id: "i-10", quantity: 30 }, { ingredient_id: "i-4", quantity: 5 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-33", name: "Strawberry Taro", category: "Berries Series", price: 119.00, cost: 38.00, sku: "BER-STA", track_stock: false, recipe: [{ ingredient_id: "i-10", quantity: 30 }, { ingredient_id: "i-9", quantity: 10 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-34", name: "Blueberry Latte'", category: "Berries Series", price: 109.00, cost: 32.00, sku: "BER-BLT", track_stock: false, recipe: [{ ingredient_id: "i-11", quantity: 30 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-35", name: "Blueberry Cloud", category: "Berries Series", price: 119.00, cost: 35.00, sku: "BER-BCL", track_stock: false, recipe: [{ ingredient_id: "i-11", quantity: 30 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-36", name: "Blueberry Choco", category: "Berries Series", price: 109.00, cost: 35.00, sku: "BER-BCH", track_stock: false, recipe: [{ ingredient_id: "i-11", quantity: 30 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-8", quantity: 15 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: "i-7", quantity: 1 }], created_at: new Date().toISOString() },
            { id: "p-37", name: "Blueberry Matcha", category: "Berries Series", price: 119.00, cost: 38.00, sku: "BER-BMA", track_stock: false, recipe: [{ ingredient_id: "i-11", quantity: 30 }, { ingredient_id: "i-4", quantity: 5 }, { ingredient_id: "i-2", quantity: 200 }, { ingredient_id: "i-6", quantity: 1 }, { ingredient_id: 'i-7', quantity: 1 }], created_at: new Date().toISOString() },

            // Pastries
            { id: "p-38", name: "Classic Cookies", category: "Pastries", price: 25.00, cost: 10.00, sku: "PST-CCO", stock: 0, track_stock: true, created_at: new Date().toISOString() },
            { id: "p-39", name: "M&M Cookies", category: "Pastries", price: 35.00, cost: 15.00, sku: "PST-MMC", stock: 0, track_stock: true, created_at: new Date().toISOString() },
            { id: "p-40", name: "Oatmilk Cookies", category: "Pastries", price: 45.00, cost: 20.00, sku: "PST-OCO", stock: 0, track_stock: true, created_at: new Date().toISOString() },
            { id: "p-41", name: "Biscoff Cookies", category: "Pastries", price: 45.00, cost: 20.00, sku: "PST-BCO", stock: 0, track_stock: true, created_at: new Date().toISOString() },
            { id: "p-42", name: "Classic Brownies", category: "Pastries", price: 25.00, cost: 10.00, sku: "PST-CBR", stock: 0, track_stock: true, created_at: new Date().toISOString() },
            { id: "p-43", name: "Peanut Brownies", category: "Pastries", price: 35.00, cost: 15.00, sku: "PST-PBR", stock: 0, track_stock: true, created_at: new Date().toISOString() }
        ];
        await db.collection('products').insertMany(products);
        console.log(`Seeded ${products.length} products.`);

        console.log('Database manual seeding successfully completed!');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await client.close();
        console.log('Database connection closed.');
    }
}

run();
