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
            router.replace('/login');
        } catch (err) {
            console.error('Logout failed:', err);
            router.replace('/login');
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-sm font-bold text-[var(--muted)]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]"></div>
                    Loading cashier workspace
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-3 sm:p-5 bg-[var(--bg)] font-sans">
            <div className="w-full max-w-[1120px] min-h-[calc(100vh-24px)] lg:min-h-[700px] bg-[var(--surface)] border border-[var(--border)] rounded-[18px] sm:rounded-[24px] shadow-[var(--shadow)] overflow-hidden p-5 sm:p-8 flex flex-col justify-between">

                {/* Header */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
                    <div>
                        <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-xs font-extrabold mb-1">Tala Table Coffee</p>
                        <h1 className="text-3xl sm:text-4xl font-display font-bold text-[var(--fg)]">Cashier workspace</h1>
                        <p className="text-[var(--muted)] text-sm mt-1">
                            Welcome, <strong className="text-[var(--fg)]">{user?.name}</strong>. Run orders, check stock, and review today&apos;s sales.
                        </p>
                    </div>
                    <div className="flex gap-2.5 items-center self-stretch sm:self-auto">
                        <span className="num min-h-[44px] px-4 inline-flex items-center border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-sm font-bold shadow-sm">
                            {clock}
                        </span>
                        <button
                            onClick={handleLock}
                            className="btn-danger btn-pill min-h-[44px] px-5 border text-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" strokeLinejoin="round"/>
                                <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Lock / logout
                        </button>
                    </div>
                </header>

                {/* Main Navigation Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr_0.9fr] gap-4 my-6 sm:my-8 flex-1 items-stretch">

                    {/* POS Card */}
                    {user && (user.role === 'admin' || user.role === 'manager' || user.role === 'cashier' || user.role === 'barista') && (
                    <button
                        onClick={() => router.push('/pos')}
                        className="btn-tile btn-tile-primary h-full min-h-[220px] lg:min-h-[320px] rounded-[18px] border p-6 sm:p-8 text-left flex flex-col justify-between active:scale-[0.99] transition-all cursor-pointer group"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center transition-all group-hover:scale-110">
                            <svg className="w-8 h-8 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18 16v4M16 18h4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="mt-8">
                            <h2 className="text-2xl font-display font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                                {user.role === 'barista' ? 'Record orders' : 'Take orders'}
                            </h2>
                            <p className="text-[var(--muted)] text-sm mt-2">
                                {user.role === 'barista'
                                    ? 'Record beverage orders to the barista prep queue (checkout disabled).'
                                    : 'Large menu buttons, cash shortcuts, and automatic change calculation.'}
                            </p>
                        </div>
                    </button>
                    )}

                    {/* Inventory Card */}
                    {user && (user.role === 'admin' || user.role === 'manager' || user.role === 'barista') && (
                    <button
                        onClick={() => router.push('/admin/inventory')}
                        className="btn-tile h-full min-h-[200px] lg:min-h-[240px] rounded-[18px] border p-6 sm:p-7 text-left flex flex-col justify-between active:scale-[0.99] transition-all cursor-pointer group"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center transition-all group-hover:scale-110">
                            <svg className="w-8 h-8 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 7h16v13H4z" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M4 7l2-3h12l2 3M9 12h6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="mt-8">
                            <h2 className="text-2xl font-display font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                                {user.role === 'barista' ? 'View stock (read-only)' : 'Check inventory'}
                            </h2>
                            <p className="text-[var(--muted)] text-sm mt-2">
                                {user.role === 'barista'
                                    ? 'Check raw ingredient levels and request stock replenishment (supplier POs).'
                                    : 'Review raw ingredient levels, low stock, and supplier order status.'}
                            </p>
                        </div>
                    </button>
                    )}

                    {/* Sales History Card */}
                    {user && (user.role === 'admin' || user.role === 'manager' || user.role === 'cashier') && (
                    <button
                        onClick={() => router.push('/admin/inventory?tab=reports')}
                        className="btn-tile h-full min-h-[200px] lg:min-h-[240px] rounded-[18px] border p-6 sm:p-7 text-left flex flex-col justify-between active:scale-[0.99] transition-all cursor-pointer group"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center transition-all group-hover:scale-110">
                            <svg className="w-8 h-8 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M4 19V5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 17V9M12 17V7M16 17v-5M20 19H4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="mt-8">
                            <h2 className="text-2xl font-display font-bold text-[var(--fg)] group-hover:text-[var(--accent)] transition-colors">
                                {user.role === 'cashier' ? 'My transaction history' : 'Sales history'}
                            </h2>
                            <p className="text-[var(--muted)] text-sm mt-2">
                                {user.role === 'cashier'
                                    ? 'Check your completed sales, transactions, and own register totals.'
                                    : 'Check completed sales, discounts, and register totals by date.'}
                            </p>
                        </div>
                    </button>
                    )}

                </div>

                {/* Footer and Developer shortcut */}
                <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-[var(--border)] text-xs text-[var(--muted)]">
                    <div>
                        Current shift: <strong className="text-[var(--fg)] font-bold">Morning register active</strong>
                    </div>
                    <button
                        onClick={() => router.push('/pos')}
                        className="btn-secondary btn-pill border text-xs cursor-pointer transition-all flex items-center gap-1 self-start sm:self-auto"
                    >
                        Back to orders
                    </button>
                </footer>

            </div>
        </main>
    );
}
