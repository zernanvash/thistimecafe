'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
    DEFAULT_IDLE_LOCKOUT_MINUTES,
    IDLE_LOCKOUT_STORAGE_KEY,
    normalizeIdleLockoutMinutes
} from '@/utils/idle-lockout';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

function readIdleLockoutMinutes(): number {
    if (typeof window === 'undefined') {
        return DEFAULT_IDLE_LOCKOUT_MINUTES;
    }

    return normalizeIdleLockoutMinutes(
        window.localStorage.getItem(IDLE_LOCKOUT_STORAGE_KEY) ?? DEFAULT_IDLE_LOCKOUT_MINUTES
    );
}

export default function IdleLockout() {
    const pathname = usePathname();
    const router = useRouter();
    const timeoutRef = useRef<number | null>(null);
    const isLockingRef = useRef(false);

    useEffect(() => {
        const isAuthPage = pathname === '/login' || pathname === '/admin/login';
        if (isAuthPage) {
            return;
        }

        const clearLockTimer = () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };

        const lockSession = async () => {
            if (isLockingRef.current) {
                return;
            }
            isLockingRef.current = true;
            clearLockTimer();

            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } finally {
                router.replace('/login');
            }
        };

        const scheduleLock = () => {
            clearLockTimer();
            const minutes = readIdleLockoutMinutes();
            if (minutes === 0) {
                return;
            }
            timeoutRef.current = window.setTimeout(lockSession, minutes * 60 * 1000);
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === IDLE_LOCKOUT_STORAGE_KEY) {
                scheduleLock();
            }
        };

        isLockingRef.current = false;
        scheduleLock();
        ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, scheduleLock, { passive: true }));
        window.addEventListener('storage', handleStorage);

        return () => {
            clearLockTimer();
            ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, scheduleLock));
            window.removeEventListener('storage', handleStorage);
        };
    }, [pathname, router]);

    return null;
}
