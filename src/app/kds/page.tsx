'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LockButton from '@/components/LockButton';
import { Order } from '@/db/schema';

export default function KDSPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [now, setNow] = useState<Date>(new Date());
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

    // Check user session
    useEffect(() => {
        const checkSession = async () => {
            const res = await fetch('/api/auth/session');
            const data = await res.json();
            if (res.ok && data.authenticated) {
                // Session is valid; route access is enforced by proxy/API guards.
            } else {
                router.push('/login');
            }
        };
        checkSession();
    }, [router]);

    // Poll for orders every 3 seconds
    useEffect(() => {
        const fetchKDSOrders = async () => {
            try {
                const res = await fetch('/api/orders?status=pending,preparing,ready');
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data);
                }
            } catch (err) {
                console.error('KDS Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchKDSOrders();
        const interval = setInterval(fetchKDSOrders, 3000);
        return () => clearInterval(interval);
    }, []);

    // Update order age calculators
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    const updateOrderStatus = async (id: string, newStatus: Order['status']) => {
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o).filter(o => {
                    return !['completed', 'voided'].includes(newStatus) || o.id !== id;
                }));
            }
        } catch (err) {
            console.error('Failed to update order:', err);
        }
    };

    const getOrderAge = (createdAtStr: string) => {
        const created = new Date(createdAtStr);
        const diffMs = now.getTime() - created.getTime();
        return Math.floor(diffMs / 60000);
    };

    // Age styling matching prototype: ok (green), warn (orange), danger (pulsing red)
    const getOrderUrgencyState = (mins: number) => {
        if (mins >= 10) return { className: 'border-[var(--danger)] kds-card-urgent', badgeColor: 'text-[var(--danger)]', label: 'Late' };
        if (mins >= 5) return { className: 'border-[var(--warn)]', badgeColor: 'text-[var(--warn)]', label: 'Soon' };
        return { className: 'border-[var(--ok)]', badgeColor: 'text-[var(--ok)]', label: 'On track' };
    };

    const activeQueue = orders.filter(o => ['pending', 'preparing'].includes(o.status));
    const readyQueue = orders.filter(o => o.status === 'ready');

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))] font-sans">
            <div className="w-full max-w-[1280px] min-h-[820px] bg-[var(--surface)] border border-[var(--border)] rounded-[34px] shadow-[var(--shadow)] overflow-hidden">
                {/* Workspace area */}
                <div className="grid grid-rows-[86px_1fr] min-width-0">
                    
                    {/* Header */}
                    <header className="border-b border-[var(--border)] p-6.5 flex items-center justify-between gap-[18px]">
                        <div>
                            <h1 className="text-3xl font-display font-bold leading-none">Barista queue</h1>
                            <p className="text-[var(--muted)] text-sm mt-1">Green is on time, orange is waiting, red needs attention.</p>
                        </div>
                        <div className="flex gap-2.5 items-center justify-end">
                            <span className="min-h-[40px] inline-flex items-center gap-2 px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--ok)] animate-ping"></span>
                                Register online
                            </span>
                            <span className="num min-h-[40px] inline-flex items-center gap-2 px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                                {clock}
                            </span>
                            <LockButton />
                        </div>
                    </header>

                    {/* KDS Split view */}
                    <div className="grid grid-cols-12 overflow-hidden min-height-0">
                        {/* Preparation Queue (Left Column - 70%) */}
                        <div className="col-span-8 flex flex-col p-6 border-r border-[var(--border)] overflow-hidden min-height-0">
                            <div className="flex justify-between items-center mb-5">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-display font-bold text-[var(--fg)]">Make now</h2>
                                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--border)] text-xs font-extrabold text-[var(--accent)] num">
                                        {activeQueue.length} Orders
                                    </span>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex-1 flex justify-center items-center text-[var(--muted)]">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                                </div>
                            ) : activeQueue.length === 0 ? (
                                <div className="flex-1 flex flex-col justify-center items-center text-[var(--muted)] gap-3">
                                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span className="text-sm font-semibold">Preparation queue is empty. Ready for orders!</span>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto pr-1 no-scrollbar pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {activeQueue.map((order) => {
                                        const ageMins = getOrderAge(order.created_at);
                                        const urgency = getOrderUrgencyState(ageMins);
                                        const isPreparing = order.status === 'preparing';

                                        return (
                                            <div
                                                key={order.id}
                                                className={`rounded-[18px] border-2 bg-[var(--surface)] p-4.5 flex flex-col justify-between shadow-sm transition-all ${urgency.className}`}
                                            >
                                                {/* Card Header */}
                                                <div className="flex justify-between items-start pb-3 border-b border-[var(--border)]">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-display font-extrabold text-lg text-[var(--fg)]">{order.order_number}</span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                                                                order.dining_option === 'dine-in'
                                                                    ? 'bg-blue-500/10 text-blue-500'
                                                                    : 'bg-orange-500/10 text-orange-500'
                                                            }`}>
                                                                {order.dining_option}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-[var(--muted)] mt-1">Placed: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className={`num font-black text-sm ${urgency.badgeColor}`}>
                                                            {ageMins} min
                                                        </div>
                                                        <div className="text-[9px] text-[var(--muted)] mt-0.5 font-bold uppercase tracking-wider">{urgency.label}</div>
                                                    </div>
                                                </div>

                                                {/* Items detail list */}
                                                <div className="flex-1 py-4 space-y-3">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="text-sm">
                                                            <div className="font-bold text-[var(--fg)]">
                                                                {item.quantity}x {item.name}
                                                            </div>
                                                            {item.customizations?.length > 0 && (
                                                                <div className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                                                                    {item.customizations.map(c => c.name).join(', ')}
                                                                </div>
                                                            )}
                                                            {item.notes && (
                                                                <div className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-1 rounded-lg border border-[var(--border)] mt-1 inline-block">
                                                                    Note: &quot;{item.notes}&quot;
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Card Actions */}
                                                <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, 'voided')}
                                                        className="px-3.5 py-3 border border-[var(--border)] rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 cursor-pointer transition-all"
                                                    >
                                                        Void
                                                    </button>
                                                    {isPreparing ? (
                                                        <button
                                                            onClick={() => updateOrderStatus(order.id, 'ready')}
                                                            className="flex-1 py-3 bg-[var(--ok)] text-white font-extrabold rounded-xl text-xs shadow-sm cursor-pointer hover:opacity-90 flex items-center justify-center gap-1"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                                                            </svg>
                                                            Mark as Ready
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                            className="flex-1 py-3 bg-[var(--accent)] text-white font-extrabold rounded-xl text-xs shadow-sm cursor-pointer hover:opacity-90"
                                                        >
                                                            Start Preparing
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Handout/Ready Queue (Right Column - 30%) */}
                        <div className="col-span-4 flex flex-col p-6 bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] overflow-hidden min-height-0">
                            <div className="flex justify-between items-center mb-5">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-display font-bold text-[var(--fg)]">Ready for pickup</h2>
                                    <span className="px-2.5 py-0.5 rounded-full bg-green-100 border border-green-200 text-xs font-extrabold text-green-600 num">
                                        {readyQueue.length} Orders
                                    </span>
                                </div>
                            </div>

                            {loading ? null : readyQueue.length === 0 ? (
                                <div className="flex-1 flex flex-col justify-center items-center text-[var(--muted)] gap-3 opacity-50">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span className="text-xs font-semibold">No orders waiting for pickup</span>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 no-scrollbar pb-6">
                                    {readyQueue.map((order) => (
                                        <div
                                            key={order.id}
                                            className="p-4 bg-[var(--surface)] border-2 border-[var(--ok)] rounded-[18px] flex flex-col gap-3.5 shadow-sm"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-display font-extrabold text-base text-[var(--fg)]">
                                                        {order.order_number}
                                                    </div>
                                                    <div className="text-[10px] text-[var(--muted)] capitalize mt-0.5 font-semibold">{order.dining_option}</div>
                                                </div>
                                                <div className="text-[9px] font-bold text-[var(--ok)] bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg">
                                                    Ready
                                                </div>
                                            </div>

                                            <div className="text-xs text-[var(--fg)]/80 space-y-1 pl-1">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="font-bold">
                                                        {item.quantity}x {item.name}
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'completed')}
                                                className="w-full py-3 bg-[var(--ok)] text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md transition-all hover:opacity-90"
                                            >
                                                Hand Out / Complete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
