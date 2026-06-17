import { db } from './db';

let initialized = false;

export async function ensureDb() {
    if (initialized) return;
    try {
        await db.initialize();
        initialized = true;
        console.log(`Database (${process.env.DB_CONNECTION || 'sqlite'}) initialized successfully.`);
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}
