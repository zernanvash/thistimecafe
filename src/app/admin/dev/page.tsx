'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarRail from '@/components/SidebarRail';

export default function AdminDevPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);
    const [clock, setClock] = useState<string>('08:42');
    const [loading, setLoading] = useState<boolean>(true);
    
    // Diagnostic stats states
    const [diagnostics, setDiagnostics] = useState<{
        driver: string;
        counts: {
            users: number;
            products: number;
            ingredients: number;
            orders: number;
            purchaseOrders: number;
        };
        raw: {
            users: any[];
            products: any[];
            ingredients: any[];
            orders: any[];
            purchaseOrders: any[];
        };
    } | null>(null);

    // Active collection tab for JSON browser
    const [activeTab, setActiveTab] = useState<'users' | 'products' | 'ingredients' | 'orders' | 'purchaseOrders'>('products');
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isActionPending, setIsActionPending] = useState<boolean>(false);

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

    // Load diagnostics and session
    const loadDiagnostics = async () => {
        try {
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json();
            if (sessionRes.ok && sessionData.authenticated && ['admin', 'manager'].includes(sessionData.user.role)) {
                setUser(sessionData.user);
            } else {
                router.push('/login');
                return;
            }

            const diagRes = await fetch('/api/admin/dev');
            if (diagRes.ok) {
                const diagData = await diagRes.json();
                setDiagnostics(diagData);
            }
        } catch (err) {
            console.error('Failed to load dev diagnostic data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDiagnostics();
    }, [router]);

    // Handle Quick actions
    const runDevAction = async (action: 'reset-db' | 'generate-mock-orders') => {
        setIsActionPending(true);
        setActionMessage(null);
        try {
            const res = await fetch('/api/admin/dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            if (res.ok) {
                setActionMessage({ type: 'success', text: data.message || 'Action executed successfully.' });
                await loadDiagnostics(); // reload database tallies and raw JSON browser
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Failed to complete action.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Network connection issue. Check server status.' });
        } finally {
            setIsActionPending(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))] font-sans">
            <div className="w-full max-w-[1180px] min-h-[820px] bg-[var(--surface)] border border-[var(--border)] rounded-[34px] shadow-[var(--shadow)] overflow-hidden grid grid-cols-[112px_1fr]">
                {/* Left Navigation Rail */}
                <SidebarRail active="admin" userRole={user?.role} />

                {/* Right Workspace area */}
                <div className="grid grid-rows-[86px_1fr] min-width-0">
                    
                    {/* Header */}
                    <header className="border-b border-[var(--border)] p-6.5 flex items-center justify-between gap-[18px]">
                        <div>
                            <h1 className="text-3xl font-display font-bold leading-none">Web console</h1>
                            <p className="text-[var(--muted)] text-sm mt-1">Diagnostic tools and raw collection viewers for developers.</p>
                        </div>
                        <div className="flex gap-2.5 items-center justify-end">
                            <span className="min-h-[40px] inline-flex items-center gap-2 px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--ok)] animate-pulse"></span>
                                {diagnostics?.driver ? `DB: ${diagnostics.driver}` : 'Connecting...'}
                            </span>
                            <span className="num min-h-[40px] inline-flex items-center gap-2 px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                                {clock}
                            </span>
                        </div>
                    </header>

                    {/* Content split workspace */}
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-[var(--muted)]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] min-height-0 overflow-y-auto no-scrollbar">
                            
                            {/* Left Side: DB stats and Quick Actions */}
                            <div className="border-r border-[var(--border)] p-6 space-y-6 bg-[color-mix(in_oklch,var(--fg)_2%,var(--surface))] flex flex-col justify-between">
                                <div className="space-y-6">
                                    {/* DB stats cards */}
                                    <div>
                                        <h3 className="text-xs font-extrabold uppercase text-[var(--muted)] tracking-wider mb-3">Database statistics</h3>
                                        <div className="grid grid-cols-2 gap-3.5">
                                            <div className="border border-[var(--border)] p-3 rounded-xl bg-[var(--surface)] shadow-sm">
                                                <span className="text-[10px] font-bold text-[var(--muted)] uppercase block">Products</span>
                                                <strong className="num text-xl font-bold text-[var(--fg)] mt-1 block">{diagnostics?.counts.products || 0}</strong>
                                            </div>
                                            <div className="border border-[var(--border)] p-3 rounded-xl bg-[var(--surface)] shadow-sm">
                                                <span className="text-[10px] font-bold text-[var(--muted)] uppercase block">Ingredients</span>
                                                <strong className="num text-xl font-bold text-[var(--fg)] mt-1 block">{diagnostics?.counts.ingredients || 0}</strong>
                                            </div>
                                            <div className="border border-[var(--border)] p-3 rounded-xl bg-[var(--surface)] shadow-sm">
                                                <span className="text-[10px] font-bold text-[var(--muted)] uppercase block">Orders</span>
                                                <strong className="num text-xl font-bold text-[var(--fg)] mt-1 block">{diagnostics?.counts.orders || 0}</strong>
                                            </div>
                                            <div className="border border-[var(--border)] p-3 rounded-xl bg-[var(--surface)] shadow-sm">
                                                <span className="text-[10px] font-bold text-[var(--muted)] uppercase block">Purchase POs</span>
                                                <strong className="num text-xl font-bold text-[var(--fg)] mt-1 block">{diagnostics?.counts.purchaseOrders || 0}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dev Actions */}
                                    <div className="space-y-3 pt-2">
                                        <h3 className="text-xs font-extrabold uppercase text-[var(--muted)] tracking-wider mb-1">Developer Actions</h3>
                                        
                                        <button
                                            onClick={() => runDevAction('reset-db')}
                                            disabled={isActionPending}
                                            className="w-full py-3.5 border border-red-200 text-red-500 rounded-xl bg-red-50 hover:bg-red-100 hover:text-red-700 transition-all font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                                        >
                                            ⚠️ Reset & Seed Database
                                        </button>
                                        
                                        <button
                                            onClick={() => runDevAction('generate-mock-orders')}
                                            disabled={isActionPending}
                                            className="w-full py-3.5 border border-[var(--border)] text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[color-mix(in_oklch,var(--accent)_20%,var(--surface))] transition-all font-bold text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                                        >
                                            ⚡ Inject 5 Mock Orders
                                        </button>
                                    </div>
                                </div>

                                {/* Status Messages */}
                                {actionMessage && (
                                    <div className={`p-4 rounded-xl border text-xs font-bold ${
                                        actionMessage.type === 'success' 
                                            ? 'bg-green-50 border-green-200 text-green-700' 
                                            : 'bg-red-50 border-red-200 text-red-700'
                                    }`}>
                                        {actionMessage.type === 'success' ? '✓ ' : '✕ '}
                                        {actionMessage.text}
                                    </div>
                                )}
                            </div>

                            {/* Right Side: Raw JSON Browser */}
                            <div className="p-6 flex flex-col justify-between gap-4">
                                <div className="space-y-4 flex-1 flex flex-col min-height-0">
                                    <div className="flex justify-between items-center flex-wrap gap-2.5">
                                        <h3 className="text-base font-display font-bold text-[var(--fg)]">Raw collections browser</h3>
                                        
                                        {/* Browser tab headers */}
                                        <div className="flex border border-[var(--border)] rounded-xl bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] p-0.5 text-xs font-bold">
                                            {(['users', 'products', 'ingredients', 'orders', 'purchaseOrders'] as const).map(tab => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setActiveTab(tab)}
                                                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                                                        activeTab === tab 
                                                            ? 'bg-white text-[var(--accent)] shadow-sm' 
                                                            : 'text-[var(--muted)] hover:text-[var(--fg)]'
                                                    }`}
                                                >
                                                    {tab}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Raw JSON displayer */}
                                    <div className="flex-1 min-h-[420px] max-h-[520px] overflow-auto bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] border border-[var(--border)] rounded-2xl p-4.5 font-mono text-xs text-[var(--fg)] select-text relative">
                                        <span className="absolute top-2 right-4 text-[9px] font-mono font-bold uppercase text-[var(--muted)]">Last 10 records</span>
                                        <pre className="no-scrollbar">
                                            {diagnostics?.raw[activeTab] 
                                                ? JSON.stringify(diagnostics.raw[activeTab], null, 2)
                                                : '// No records loaded'}
                                        </pre>
                                    </div>
                                </div>

                                <div className="text-[10px] text-[var(--muted)] font-mono border-t border-[var(--border)] pt-4 flex justify-between">
                                    <span>Tala Table Coffee Register web admin suite v1.0.0</span>
                                    <span>Environment: {process.env.NODE_ENV}</span>
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </div>
        </main>
    );
}
