import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './utils/auth';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const session = await getSession(request);

    // Protected paths
    const isAuthPage = pathname === '/login';
    const isPOSPath = pathname.startsWith('/pos');
    const isKDSPath = pathname.startsWith('/kds');
    const isAdminPath = pathname.startsWith('/admin');
    const isApiPath = pathname.startsWith('/api/') && !pathname.startsWith('/api/auth');

    // 1. If not logged in and trying to access a protected route
    if (!session && (isPOSPath || isKDSPath || isAdminPath || isApiPath)) {
        if (isApiPath) {
            return new NextResponse(
                JSON.stringify({ error: 'Unauthorized. Please log in.' }),
                { status: 401, headers: { 'content-type': 'application/json' } }
            );
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. If logged in and trying to access the login page
    if (session && isAuthPage) {
        if (session.role === 'barista') {
            return NextResponse.redirect(new URL('/kds', request.url));
        }
        return NextResponse.redirect(new URL('/pos', request.url));
    }

    // 3. Role-based authorization
    if (session) {
        // POS access: admin, manager, cashier
        if (isPOSPath && !['admin', 'manager', 'cashier'].includes(session.role)) {
            return NextResponse.redirect(new URL('/kds', request.url));
        }

        // KDS access: admin, manager, barista
        if (isKDSPath && !['admin', 'manager', 'barista'].includes(session.role)) {
            return NextResponse.redirect(new URL('/pos', request.url));
        }

        // Admin paths: admin, manager
        if (isAdminPath && !['admin', 'manager'].includes(session.role)) {
            return NextResponse.redirect(new URL('/pos', request.url));
        }

        // Admin API endpoints: admin, manager
        if (isApiPath && pathname.startsWith('/api/admin') && !['admin', 'manager'].includes(session.role)) {
            return new NextResponse(
                JSON.stringify({ error: 'Forbidden. Admin privileges required.' }),
                { status: 403, headers: { 'content-type': 'application/json' } }
            );
        }
    }

    return NextResponse.next();
}

// Config to specify matching routes
export const config = {
    matcher: [
        '/login',
        '/pos/:path*',
        '/kds/:path*',
        '/admin/:path*',
        '/api/admin/:path*',
        '/api/orders/:path*',
        '/api/ingredients/:path*',
        '/api/products/:path*',
    ],
};
