import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('pos_session', '', {
        path: '/',
        maxAge: 0 // Expire immediately
    });
    return response;
}
