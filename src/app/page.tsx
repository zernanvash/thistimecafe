'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [clock, setClock] = useState<string>('08:42');

    // Run clock ticker
    useEffect(() => {
        const tick = () => {
            const time = new Date();
            setClock(time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        tick();
        const interval = setInterval(tick, 10000);
        return () => clearInterval(interval);
    }, []);

    // Check session
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated) {
                        setUser(data.user);
                    } else {
                        router.push('/login');
                    }
                } else {
                    router.push('/login');
                }
            } catch (err) {
                console.error('Session check error:', err);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };
        checkSession();
    }, [router]);

    const handleLock = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch (err) {
            console.error('Logout failed:', err);
            router.push('/login');
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]"></div>
            </main>
        );
    }

    const isAdmin = user && ['admin', 'manager'].includes(user.role);

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))] font-sans">
            <div className="w-full max-w-[1080px] min-h-[720px] bg-[var(--surface)] border border-[var(--border)] rounded-[34px] shadow-[var(--shadow)] overflow-hidden p-8 flex flex-col justify-between">
                
                {/* Header */}
                <header className="flex items-center justify-between pb-6 border-b border-[var(--border)]">
                    <div>
                        <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-xs font-extrabold mb-1">Tala Table Coffee</p>
                        <h1 className="text-4xl font-display font-bold text-[var(--fg)]">Register unlocked</h1>
                        <p className="text-[var(--muted)] text-sm mt-1">
                            Welcome, <strong className="text-[var(--fg)]">{user?.name}</strong> ({user?.role})
                        </p>
                    </div>
                    <div className="flex gap-2.5 items-center">
                        <span className="num min-h-[44px] px-4 inline-flex items-center border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-sm font-bold shadow-sm">
                            {clock}
                        </span>
                        <button
                            onClick={handleLock}
                            className="min-h-[44px] px-5 bg-[color-mix(in_oklch,var(--danger)_10%,transparent)] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] text-[var(--danger)] rounded-full text-sm font-extrabold cursor-pointer hover:bg-[var(--danger)] hover:text-white transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                        >
                            <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" strokeLinejoin="round"/>
                                <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Lock register
                        </button>
                    </div>
                </header>

                {/* Main Navigation Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-10 flex-1 items-center">
                    
                    {/* POS Card */}
                    <button
                        onClick={() => router.push('/pos')}
                        className="h-full min-h-[280px] rounded-[24px] border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklch,var(--bg)_20%,var(--surface))] p-8 text-left flex flex-col justify-between hover:border-[var(--accent)] hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer group shadow-sm"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center transition-all group-hover:scale-110">
                            <svg className="w-8 h-8 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18 16v4M16 18h4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="mt-8">
                            <h2 className="text-2xl font-display font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">Take orders</h2>
                            <p className="text-[var(--muted)] text-sm mt-2">Cashier terminal, customization, discounts, GCash receipts & checkouts.</p>
                        </div>
                    </button>

                    {/* KDS Card */}
                    <button
                        onClick={() => router.push('/kds')}
                        className="h-full min-h-[280px] rounded-[24px] border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklch,var(--bg)_20%,var(--surface))] p-8 text-left flex flex-col justify-between hover:border-[var(--accent)] hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer group shadow-sm"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center transition-all group-hover:scale-110">
                            <svg className="w-8 h-8 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 13h6V5H4v8Zm10 6h6V5h-6v14ZM4 19h6v-3H4v3Z" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="mt-8">
                            <h2 className="text-2xl font-display font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">Kitchen display</h2>
                            <p className="text-[var(--muted)] text-sm mt-2">Barista orders queue, prep timers, aging alerts, and order handout logs.</p>
                        </div>
                    </button>

                    {/* Inventory Card */}
                    <button
                        onClick={() => router.push('/admin/inventory')}
                        className="h-full min-h-[280px] rounded-[24px] border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_oklch,var(--bg)_20%,var(--surface))] p-8 text-left flex flex-col justify-between hover:border-[var(--accent)] hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer group shadow-sm"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center transition-all group-hover:scale-110">
                            <svg className="w-8 h-8 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 7h16v13H4z" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M4 7l2-3h12l2 3M9 12h6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="mt-8">
                            <h2 className="text-2xl font-display font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">Stock control</h2>
                            <p className="text-[var(--muted)] text-sm mt-2">Recipe-aware inventory alert status, supplier POs, and daily sales metrics.</p>
                        </div>
                    </button>

                </div>

                {/* Footer and Developer shortcut */}
                <footer className="flex items-center justify-between pt-6 border-t border-[var(--border)] text-xs text-[var(--muted)]">
                    <div>
                        Current shift: <strong className="text-[var(--fg)] font-bold">Morning register active</strong>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => router.push('/admin/dev')}
                            className="font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            🛠️ Dev Settings & DB Admin Panel
                        </button>
                    )}
                </footer>

            </div>
        </main>
    );
}
