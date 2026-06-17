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
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 3. Role-based authorization
    if (session) {
        // Dev console paths require admin or manager credentials
        const isDevPath = pathname.startsWith('/admin/dev') || pathname.startsWith('/api/admin/dev');
        if (isDevPath && !['admin', 'manager'].includes(session.role)) {
            if (pathname.startsWith('/api/')) {
                return new NextResponse(
                    JSON.stringify({ error: 'Forbidden. Developer/Admin privileges required.' }),
                    { status: 403, headers: { 'content-type': 'application/json' } }
                );
            }
            return NextResponse.redirect(new URL('/', request.url));
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
