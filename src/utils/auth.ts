import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'ttc-pos-super-secret-key-change-me';

// Base64url helper functions using native JS
function base64urlEncode(str: string | Uint8Array): string {
    let base64 = '';
    if (typeof str === 'string') {
        base64 = btoa(unescape(encodeURIComponent(str)));
    } else {
        const binString = Array.from(str, (x) => String.fromCharCode(x)).join('');
        base64 = btoa(binString);
    }
    return base64
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64urlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
}

function base64urlDecodeToBuffer(str: string): ArrayBuffer {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const binString = atob(base64);
    const buf = new ArrayBuffer(binString.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < binString.length; i++) {
        bufView[i] = binString.charCodeAt(i);
    }
    return buf;
}

export interface JWTPayload {
    userId: string;
    role: StaffRole;
    name: string;
    exp: number;
}

export type StaffRole = 'admin' | 'cashier' | 'barista' | 'manager' | 'owner';

export function getHomePathForRole(role: StaffRole): string {
    if (role === 'manager' || role === 'admin' || role === 'owner') {
        return '/';
    }
    return '/pos';
}

export function canRoleAccessPath(role: StaffRole, pathname: string): boolean {
    if (pathname === '/' || pathname.startsWith('/api/auth')) return true;

    // Admin has full access to all paths
    if (role === 'admin') {
        return true;
    }

    // Owner, Manager, Cashier, Barista cannot access security or user admin pages/APIs
    if (pathname.startsWith('/admin/security') || pathname.startsWith('/api/admin/users')) {
        return false;
    }

    // Manager allowed paths (all paths except security/user admin)
    if (role === 'manager') {
        return true;
    }

    // Owner allowed paths (full access to inventory, reports, POS, POs)
    if (role === 'owner') {
        const ownerAllowed = [
            '/pos',
            '/admin/inventory',
            '/api/products',
            '/api/ingredients',
            '/api/orders',
            '/api/admin/purchase-orders'
        ];
        return ownerAllowed.some((path) => pathname.startsWith(path));
    }

    // Cashier allowed paths
    if (role === 'cashier') {
        const cashierAllowed = [
            '/pos',
            '/admin/inventory', // allowed for viewing own sales history
            '/api/products',
            '/api/ingredients',
            '/api/orders'
        ];
        return cashierAllowed.some((path) => pathname.startsWith(path));
    }

    // Barista allowed paths
    if (role === 'barista') {
        const baristaAllowed = [
            '/pos', // allowed to build/record orders (read-only checkout)
            '/admin/inventory', // allowed to view stock and request replenishment (PO)
            '/api/products',
            '/api/ingredients',
            '/api/orders',
            '/api/admin/purchase-orders'
        ];
        return baristaAllowed.some((path) => pathname.startsWith(path));
    }

    return false;
}

// Get SubtleCrypto key
async function getCryptoKey(): Promise<CryptoKey> {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        enc.encode(JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function hashPassword(password: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: enc.encode('ttc-pos-salt'),
            iterations: 1000,
            hash: 'SHA-512'
        },
        keyMaterial,
        512
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function signToken(payload: Omit<JWTPayload, 'exp'>, expiresInSeconds: number = 86400): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload: JWTPayload = { ...payload, exp };

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));

    const key = await getCryptoKey();
    const enc = new TextEncoder();
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(`${encodedHeader}.${encodedPayload}`)
    );
    
    const encodedSignature = base64urlEncode(new Uint8Array(signature));

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [header, payload, signature] = parts;
        const key = await getCryptoKey();
        const enc = new TextEncoder();
        
        const data = enc.encode(`${header}.${payload}`);
        const sigBuffer = base64urlDecodeToBuffer(signature);
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            sigBuffer,
            data
        );

        if (!isValid) return null;

        const decodedPayload = JSON.parse(base64urlDecode(payload)) as JWTPayload;
        if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired
        }

        return decodedPayload;
    } catch {
        return null;
    }
}

export async function getSession(req: NextRequest): Promise<JWTPayload | null> {
    const cookieToken = req.cookies.get('pos_session')?.value;
    if (cookieToken) {
        return verifyToken(cookieToken);
    }
    
    // Fallback to Authorization Header
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return verifyToken(token);
    }

    return null;
}
