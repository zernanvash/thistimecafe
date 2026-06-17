'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarRail from '@/components/SidebarRail';

export default function LoginPage() {
    const router = useRouter();
    const [pin, setPin] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [clock, setClock] = useState<string>('08:42');

    // Run clock ticker
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setClock(now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        tick();
        const interval = setInterval(tick, 10000);
        return () => clearInterval(interval);
    }, []);

    // Handle physical keyboard input for passcode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key >= '0' && e.key <= '9') {
                handleNumberPress(e.key);
            } else if (e.key === 'Backspace') {
                handleBackspace();
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                handleClear();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pin]);

    const handleNumberPress = (num: string) => {
        setError('');
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const handleUnlock = async () => {
        if (pin.length !== 4) {
            setError('Please enter a 4-digit PIN');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login-passcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passcode: pin })
            });
            const data = await res.json();
            
            if (res.ok) {
                if (data.user.role === 'barista') {
                    router.push('/kds');
                } else {
                    router.push('/pos');
                }
            } else {
                setError(data.error || 'Invalid passcode');
                setPin('');
            }
        } catch (err) {
            setError('Connection error, please try again.');
            setPin('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))]">
            <div className="w-full max-w-[1180px] min-h-[820px] bg-[var(--surface)] border border-[var(--border)] rounded-[34px] shadow-[var(--shadow)] overflow-hidden grid grid-cols-[112px_1fr]">
                {/* Left Navigation Rail */}
                <SidebarRail active="login" />

                {/* Right Area */}
                <div className="grid grid-rows-[86px_1fr] min-width-0">
                    {/* Topbar */}
                    <header className="border-b border-[var(--border)] p-6.5 flex items-center justify-between gap-[18px]">
                        <div>
                            <h1 className="text-3xl font-display font-bold leading-none">Staff PIN</h1>
                            <p className="text-[var(--muted)] text-sm mt-1">Large touch login for cashier, barista, manager, and stock roles.</p>
                        </div>
                        <div className="flex gap-2.5 items-center justify-end">
                            <span className="min-h-[40px] inline-flex items-center gap-2 px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--ok)]"></span>
                                Register online
                            </span>
                            <span className="num min-h-[40px] inline-flex items-center gap-2 px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                                {clock}
                            </span>
                        </div>
                    </header>

                    {/* Login Split Screen Content */}
                    <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] p-8.5 gap-7 items-stretch">
                        {/* Welcome panel */}
                        <div className="bg-gradient-to-br from-[color-mix(in_oklch,var(--accent)_14%,var(--surface))] to-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-6 flex flex-col justify-between">
                            <div>
                                <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-xs font-extrabold mb-3">Tala Table Coffee</p>
                                <h2 className="text-[54px] font-display font-bold leading-[0.98] max-w-[7ch] text-[var(--fg)]">Open the shift without slowing the line.</h2>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mt-8">
                                <div className="min-h-[96px] border border-[var(--border)] rounded-2xl p-4 bg-[color-mix(in_oklch,var(--surface)_84%,var(--bg))]">
                                    <strong className="block text-base font-bold text-[var(--fg)]">Cashier</strong>
                                    <span className="text-[var(--muted)] text-xs mt-1 block">Orders, payments, change</span>
                                </div>
                                <div className="min-h-[96px] border border-[var(--border)] rounded-2xl p-4 bg-[color-mix(in_oklch,var(--surface)_84%,var(--bg))]">
                                    <strong className="block text-base font-bold text-[var(--fg)]">Barista</strong>
                                    <span className="text-[var(--muted)] text-xs mt-1 block">KDS queue, drink prep</span>
                                </div>
                                <div className="min-h-[96px] border border-[var(--border)] rounded-2xl p-4 bg-[color-mix(in_oklch,var(--surface)_84%,var(--bg))]">
                                    <strong className="block text-base font-bold text-[var(--fg)]">Manager</strong>
                                    <span className="text-[var(--muted)] text-xs mt-1 block">Reports, staff overrides</span>
                                </div>
                                <div className="min-h-[96px] border border-[var(--border)] rounded-2xl p-4 bg-[color-mix(in_oklch,var(--surface)_84%,var(--bg))]">
                                    <strong className="block text-base font-bold text-[var(--fg)]">Stock</strong>
                                    <span className="text-[var(--muted)] text-xs mt-1 block">Volumes & purchase prep</span>
                                </div>
                            </div>
                        </div>

                        {/* PIN Panel */}
                        <div className="border border-[var(--border)] rounded-[var(--radius)] p-6 grid grid-rows-[auto_1fr_auto] gap-4">
                            <div>
                                <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-xs font-extrabold mb-3">Secure handoff</p>
                                <h2 className="text-3xl font-display font-bold text-[var(--fg)]">Enter staff PIN</h2>
                            </div>

                            {/* PIN Inputs & keypad */}
                            <div className="flex flex-col justify-center">
                                <div className="min-h-[74px] border border-[var(--border)] rounded-2xl flex items-center justify-center gap-3 bg-[color-mix(in_oklch,var(--bg)_58%,var(--surface))]">
                                    {[0, 1, 2, 3].map((idx) => (
                                        <span
                                            key={idx}
                                            className={`w-4 h-4 border-2 border-[var(--border)] rounded-full transition-all ${
                                                pin.length > idx ? 'bg-[var(--fg)] border-[var(--fg)]' : ''
                                            }`}
                                        ></span>
                                    ))}
                                </div>

                                {error && (
                                    <div className="text-red-600 text-xs font-semibold mt-3 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-center">
                                        {error}
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => handleNumberPress(num.toString())}
                                            className="min-h-[72px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-2xl font-extrabold hover:bg-[var(--fg-soft)] active:scale-95 transition-all cursor-pointer"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="min-h-[72px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm font-bold hover:bg-[var(--fg-soft)] cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleNumberPress('0')}
                                        className="min-h-[72px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-2xl font-extrabold hover:bg-[var(--fg-soft)] cursor-pointer"
                                    >
                                        0
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleBackspace}
                                        className="min-h-[72px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm font-bold hover:bg-[var(--fg-soft)] cursor-pointer"
                                    >
                                        Back
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleUnlock}
                                disabled={isSubmitting || pin.length !== 4}
                                className="min-h-[58px] rounded-2xl border border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)] text-sm font-extrabold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer w-full mt-4"
                            >
                                {isSubmitting ? 'Verifying PIN...' : 'Unlock register'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
