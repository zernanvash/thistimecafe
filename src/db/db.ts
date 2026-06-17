import { User, Product, Ingredient, Order, PurchaseOrder } from './schema';

export interface UserRepository {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByPasscode(passcode: string): Promise<User | null>;
    create(user: User): Promise<User>;
    list(): Promise<User[]>;
}

export interface ProductRepository {
    findById(id: string): Promise<Product | null>;
    create(product: Product): Promise<Product>;
    update(id: string, product: Partial<Product>): Promise<Product | null>;
    list(): Promise<Product[]>;
    delete(id: string): Promise<boolean>;
}

export interface IngredientRepository {
    findById(id: string): Promise<Ingredient | null>;
    create(ingredient: Ingredient): Promise<Ingredient>;
    update(id: string, ingredient: Partial<Ingredient>): Promise<Ingredient | null>;
    list(): Promise<Ingredient[]>;
    delete(id: string): Promise<boolean>;
}

export interface OrderRepository {
    findById(id: string): Promise<Order | null>;
    create(order: Order): Promise<Order>;
    updateStatus(id: string, status: Order['status']): Promise<Order | null>;
    update(id: string, order: Partial<Order>): Promise<Order | null>;
    list(options?: { status?: Order['status'][]; limit?: number }): Promise<Order[]>;
    getSalesSummary(startDate: string, endDate: string): Promise<{
        totalSales: number;
        totalOrders: number;
        taxCollected: number;
        discountsGiven: number;
    }>;
}

export interface PurchaseOrderRepository {
    findById(id: string): Promise<PurchaseOrder | null>;
    create(po: PurchaseOrder): Promise<PurchaseOrder>;
    updateStatus(id: string, status: PurchaseOrder['status']): Promise<PurchaseOrder | null>;
    list(): Promise<PurchaseOrder[]>;
}

export interface DBInstance {
    users: UserRepository;
    products: ProductRepository;
    ingredients: IngredientRepository;
    orders: OrderRepository;
    purchaseOrders: PurchaseOrderRepository;
    initialize(): Promise<void>;
}

// Select driver based on environment variables
const dbConnection = process.env.DB_CONNECTION || 'sqlite';

let db: DBInstance;

if (dbConnection === 'mongodb') {
    const { mongoDbInstance } = require('./mongodb');
    db = mongoDbInstance;
} else {
    const { sqliteDbInstance } = require('./sqlite');
    db = sqliteDbInstance;
}

export { db };
export default db;
