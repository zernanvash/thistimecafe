'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/BrandMark';

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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

    const handleCredentialsUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Enter both email and password');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/auth/login-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                router.replace(data.redirectTo || '/');
                return;
            }

            setError(data.error || 'Invalid email or password');
        } catch {
            setError('Connection issue. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-[var(--bg)] font-sans">
            <section className="w-full max-w-[460px] bg-[var(--surface)] border border-[var(--border)] rounded-[18px] sm:rounded-[24px] shadow-[var(--shadow)] overflow-hidden">
                <header className="px-5 sm:px-7 py-5 sm:py-6 border-b border-[var(--border)] flex items-center justify-between gap-4">
                    <div className="space-y-3">
                        <BrandMark />
                        <h1 className="text-2xl sm:text-3xl font-display font-bold leading-none text-[var(--fg)]">Admin Login</h1>
                    </div>
                    <span className="num min-h-[40px] inline-flex items-center px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                        {clock}
                    </span>
                </header>

                <div className="p-5 sm:p-7 space-y-5">
                    <div>
                        <h2 className="text-2xl font-display font-bold text-[var(--fg)]">Admin Console</h2>
                        <p className="text-[var(--muted)] text-sm mt-1">Enter credentials to configure inventory, products, and shifts.</p>
                    </div>

                    {error && (
                        <div role="alert" className="text-[var(--danger)] text-xs font-semibold bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] px-3 py-2 rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleCredentialsUnlock} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                Username or Email
                            </label>
                            <input
                                id="email"
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Username or Email"
                                disabled={isSubmitting}
                                className="w-full min-h-[54px] px-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--bg)_40%,var(--surface))] text-[var(--fg)] text-sm focus:outline-none focus:border-[var(--accent)] transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={isSubmitting}
                                className="w-full min-h-[54px] px-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--bg)_40%,var(--surface))] text-[var(--fg)] text-sm focus:outline-none focus:border-[var(--accent)] transition-all"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !email || !password}
                            className="w-full min-h-[60px] rounded-2xl border border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)] text-sm font-extrabold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer mt-6"
                        >
                            {isSubmitting ? 'Authenticating...' : 'Sign in to Console'}
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}
