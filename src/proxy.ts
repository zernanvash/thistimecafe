import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canRoleAccessPath, getHomePathForRole, getSession } from './utils/auth';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const session = await getSession(request);

    // Protected paths
    const isAuthPage = pathname === '/login' || pathname === '/admin/login';
    const isHomePath = pathname === '/';
    const isPOSPath = pathname.startsWith('/pos');
    const isAdminPath = pathname.startsWith('/admin') && pathname !== '/admin/login';
    const isApiPath = pathname.startsWith('/api/') && !pathname.startsWith('/api/auth');

    // 1. If not logged in and trying to access a protected route
    if (!session && (isHomePath || isPOSPath || isAdminPath || isApiPath)) {
        if (isApiPath) {
            return new NextResponse(
                JSON.stringify({ error: 'Unauthorized. Please log in.' }),
                { status: 401, headers: { 'content-type': 'application/json' } }
            );
        }
        if (isAdminPath) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    // 2. If logged in and trying to access the login page
    if (session && isAuthPage) {
        return NextResponse.redirect(new URL(getHomePathForRole(session.role), request.url));
    }

    // 3. Role-based authorization
    if (session && !canRoleAccessPath(session.role, pathname)) {
        if (pathname.startsWith('/api/')) {
            return new NextResponse(
                JSON.stringify({ error: 'Forbidden. This PIN does not allow that workspace.' }),
                { status: 403, headers: { 'content-type': 'application/json' } }
            );
        }
        return NextResponse.redirect(new URL(getHomePathForRole(session.role), request.url));
    }
    return NextResponse.next();
}

// Config to specify matching routes
export const config = {
    matcher: [
        '/',
        '/login',
        '/pos/:path*',
        '/admin/:path*',
        '/api/admin/:path*',
        '/api/orders/:path*',
        '/api/ingredients/:path*',
        '/api/products/:path*',
    ],
};
