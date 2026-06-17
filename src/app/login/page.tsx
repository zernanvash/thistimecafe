'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clock, setClock] = useState('08:42');

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setClock(now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        tick();
        const interval = setInterval(tick, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key >= '0' && event.key <= '9') {
                setError('');
                setPin(prev => prev.length < 6 ? prev + event.key : prev);
                return;
            }

            if (event.key === 'Backspace') {
                setPin(prev => prev.slice(0, -1));
                return;
            }

            if (event.key === 'Escape' || event.key.toLowerCase() === 'c') {
                setPin('');
                setError('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleNumberPress = (num: string) => {
        setError('');
        setPin(prev => prev.length < 6 ? prev + num : prev);
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const handleUnlock = async () => {
        if (pin.length !== 6) {
            setError('Enter your 6-digit PIN');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/auth/login-passcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passcode: pin })
            });
            const data = await response.json();

            if (response.ok) {
                router.replace(data.redirectTo || '/');
                return;
            }

            setError(data.error || 'PIN not recognized');
            setPin('');
        } catch {
            setError('Connection issue. Try again.');
            setPin('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))] font-sans">
            <section className="w-full max-w-[460px] bg-[var(--surface)] border border-[var(--border)] rounded-[34px] shadow-[var(--shadow)] overflow-hidden">
                <header className="px-7 py-6 border-b border-[var(--border)] flex items-center justify-between gap-4">
                    <div>
                        <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-xs font-extrabold mb-1">Tala Table Coffee</p>
                        <h1 className="text-3xl font-display font-bold leading-none text-[var(--fg)]">Staff PIN</h1>
                    </div>
                    <span className="num min-h-[40px] inline-flex items-center px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                        {clock}
                    </span>
                </header>

                <div className="p-7 space-y-5">
                    <div>
                        <h2 className="text-2xl font-display font-bold text-[var(--fg)]">Open your station</h2>
                        <p className="text-[var(--muted)] text-sm mt-1">Enter six digits. Cashiers go to orders, baristas go to the queue, and managers go to controls.</p>
                    </div>

                    <div className="min-h-[76px] border border-[var(--border)] rounded-2xl flex items-center justify-center gap-3 bg-[color-mix(in_oklch,var(--bg)_58%,var(--surface))]">
                        {[0, 1, 2, 3, 4, 5].map(idx => (
                            <span
                                key={idx}
                                className={`w-4 h-4 border-2 border-[var(--border)] rounded-full transition-all ${
                                    pin.length > idx ? 'bg-[var(--fg)] border-[var(--fg)]' : ''
                                }`}
                            />
                        ))}
                    </div>

                    {error && (
                        <div className="text-red-600 text-xs font-semibold bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
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
                            className="min-h-[72px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-2xl font-extrabold hover:bg-[var(--fg-soft)] active:scale-95 transition-all cursor-pointer"
                        >
                            0
                        </button>
                        <button
                            type="button"
                            onClick={() => setPin(prev => prev.slice(0, -1))}
                            className="min-h-[72px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm font-bold hover:bg-[var(--fg-soft)] cursor-pointer"
                        >
                            Back
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleUnlock}
                        disabled={isSubmitting || pin.length !== 6}
                        className="w-full min-h-[60px] rounded-2xl border border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)] text-sm font-extrabold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        {isSubmitting ? 'Checking PIN...' : 'Open my workspace'}
                    </button>
                </div>
            </section>
        </main>
    );
}
