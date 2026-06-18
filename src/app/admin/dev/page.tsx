'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LockButton from '@/components/LockButton';
import IdleLockout from '@/components/IdleLockout';
import {
    DEFAULT_IDLE_LOCKOUT_MINUTES,
    IDLE_LOCKOUT_STORAGE_KEY,
    MAX_IDLE_LOCKOUT_MINUTES,
    MIN_IDLE_LOCKOUT_MINUTES,
    normalizeIdleLockoutMinutes
} from '@/utils/idle-lockout';

export default function DevPanelPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [minutes, setMinutes] = useState(DEFAULT_IDLE_LOCKOUT_MINUTES);
    const [savedMinutes, setSavedMinutes] = useState(DEFAULT_IDLE_LOCKOUT_MINUTES);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (!res.ok || !data.authenticated || !['admin', 'manager'].includes(data.user?.role)) {
                    router.replace('/login');
                    return;
                }

                const configuredMinutes = normalizeIdleLockoutMinutes(
                    window.localStorage.getItem(IDLE_LOCKOUT_STORAGE_KEY) ?? DEFAULT_IDLE_LOCKOUT_MINUTES
                );
                setMinutes(configuredMinutes);
                setSavedMinutes(configuredMinutes);
            } catch {
                router.replace('/login');
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, [router]);

    const handleSave = () => {
        const nextMinutes = normalizeIdleLockoutMinutes(minutes);
        window.localStorage.setItem(IDLE_LOCKOUT_STORAGE_KEY, String(nextMinutes));
        window.dispatchEvent(new StorageEvent('storage', {
            key: IDLE_LOCKOUT_STORAGE_KEY,
            newValue: String(nextMinutes)
        }));
        setMinutes(nextMinutes);
        setSavedMinutes(nextMinutes);
        setError('');
    };

    const handleMinutesChange = (value: string) => {
        const nextValue = Number(value);
        setMinutes(nextValue);

        if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > MAX_IDLE_LOCKOUT_MINUTES) {
            setError(`Use 0 or ${MIN_IDLE_LOCKOUT_MINUTES}-${MAX_IDLE_LOCKOUT_MINUTES} minutes.`);
            return;
        }

        setError('');
    };

    if (isLoading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div role="status" className="flex flex-col items-center gap-3 text-sm font-bold text-[var(--muted)]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]"></div>
                    Loading dev panel
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[var(--bg)] p-3 sm:p-5 font-sans">
            <IdleLockout />
            <section className="mx-auto max-w-[760px] min-h-[calc(100vh-24px)] bg-[var(--surface)] border border-[var(--border)] rounded-[18px] sm:rounded-[24px] shadow-[var(--shadow)] overflow-hidden">
                <header className="p-5 sm:p-7 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-xs font-extrabold mb-1">Tala Table Coffee</p>
                        <h1 className="text-3xl font-display font-bold text-[var(--fg)]">Dev Panel</h1>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => router.push('/')}
                            className="btn-secondary btn-pill min-h-[44px] px-5 border text-sm cursor-pointer transition-all"
                        >
                            Dashboard
                        </button>
                        <LockButton />
                    </div>
                </header>

                <div className="p-5 sm:p-7 space-y-5">
                    <section className="border border-[var(--border)] rounded-[18px] p-5 sm:p-6 bg-[color-mix(in_oklch,var(--bg)_35%,var(--surface))]">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                            <div className="space-y-2">
                                <label htmlFor="idleMinutes" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                    Idle Lockout
                                </label>
                                <input
                                    id="idleMinutes"
                                    type="number"
                                    min={0}
                                    max={MAX_IDLE_LOCKOUT_MINUTES}
                                    value={minutes}
                                    onChange={(event) => handleMinutesChange(event.target.value)}
                                    className="w-full sm:w-[180px] min-h-[54px] px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-lg font-bold focus:outline-none focus:border-[var(--accent)] transition-all"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={Boolean(error)}
                                className="btn-primary min-h-[54px] px-6 rounded-xl border text-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>

                        {error ? (
                            <div role="alert" className="mt-4 text-[var(--danger)] text-xs font-semibold bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] px-3 py-2 rounded-lg">
                                {error}
                            </div>
                        ) : (
                            <p className="mt-4 text-sm text-[var(--muted)]">
                                Current value: <strong className="text-[var(--fg)]">{savedMinutes === 0 ? 'Disabled' : `${savedMinutes} minutes`}</strong>
                            </p>
                        )}
                    </section>
                </div>
            </section>
        </main>
    );
}
