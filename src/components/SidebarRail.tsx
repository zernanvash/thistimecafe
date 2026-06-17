'use strict';
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface SidebarRailProps {
    active: 'login' | 'pos' | 'kds' | 'admin';
    userRole?: string;
}

export default function SidebarRail({ active, userRole }: SidebarRailProps) {
    const router = useRouter();

    const handleQuickLock = async () => {
        // Quick lock redirects to login screen but doesn't necessarily clear session
        // Or if clicking logout, it logs out. In POS workflows, quick lock returns to passcode pad.
        router.push('/login');
    };

    return (
        <aside className="w-28 bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] border-r border-[var(--border)] p-4.5 flex flex-col gap-3 shrink-0 select-none">
            {/* Brand Mark */}
            <div className="h-18 grid place-items-center border border-[var(--border)] rounded-[20px] bg-[var(--surface)] font-display font-bold text-3xl text-[var(--accent)]">
                T
            </div>

            {/* Nav Rail Buttons */}
            <button
                onClick={handleQuickLock}
                className={`min-h-[72px] border border-transparent rounded-[18px] bg-transparent text-[var(--muted)] flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold transition-all cursor-pointer ${
                    active === 'login'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_24%,var(--border))]'
                        : 'hover:text-[var(--fg)] hover:bg-[var(--fg-soft)]'
                }`}
                aria-label="Staff PIN Login"
            >
                <svg className="w-6 h-6 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Lock
            </button>

            <button
                onClick={() => router.push('/pos')}
                className={`min-h-[72px] border border-transparent rounded-[18px] bg-transparent text-[var(--muted)] flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold transition-all cursor-pointer ${
                    active === 'pos'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_24%,var(--border))]'
                        : 'hover:text-[var(--fg)] hover:bg-[var(--fg-soft)]'
                }`}
                aria-label="Order taking screen"
            >
                <svg className="w-6 h-6 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18 16v4M16 18h4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Orders
            </button>

            {/* KDS Button */}
            <button
                onClick={() => router.push('/kds')}
                className={`min-h-[72px] border border-transparent rounded-[18px] bg-transparent text-[var(--muted)] flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold transition-all cursor-pointer ${
                    active === 'kds'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_24%,var(--border))]'
                        : 'hover:text-[var(--fg)] hover:bg-[var(--fg-soft)]'
                }`}
                aria-label="Kitchen display"
            >
                <svg className="w-6 h-6 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 13h6V5H4v8Zm10 6h6V5h-6v14ZM4 19h6v-3H4v3Z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Kitchen
            </button>

            {/* Stock Manager (Only visible or active for admin/manager) */}
            <button
                onClick={() => router.push('/admin/inventory')}
                className={`min-h-[72px] border border-transparent rounded-[18px] bg-transparent text-[var(--muted)] flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold transition-all cursor-pointer ${
                    active === 'admin'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_24%,var(--border))]'
                        : 'hover:text-[var(--fg)] hover:bg-[var(--fg-soft)]'
                }`}
                aria-label="Inventory screen"
            >
                <svg className="w-6 h-6 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 7h16v13H4z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 7l2-3h12l2 3M9 12h6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Stock
            </button>

            {/* Shift Card */}
            <div className="mt-auto border border-[var(--border)] rounded-[18px] p-2 bg-[var(--surface)] text-[var(--muted)] text-[10px] text-center">
                Shift
                <strong className="block text-[var(--fg)] text-[11px] font-bold mt-0.5">Morning</strong>
                <span className="num block mt-0.5">06:30-14:30</span>
            </div>
        </aside>
    );
}
