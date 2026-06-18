'use strict';
'use client';

import { useRouter } from 'next/navigation';

interface LockButtonProps {
    label?: string;
}

export default function LockButton({ label = 'Lock / logout' }: LockButtonProps) {
    const router = useRouter();

    const handleLock = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
            router.replace('/login');
        }
    };

    return (
        <button
            type="button"
            onClick={handleLock}
            className="btn-danger btn-pill min-h-[44px] px-5 border text-sm cursor-pointer transition-all active:scale-95 flex items-center gap-2"
            aria-label={label}
        >
            <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {label}
        </button>
    );
}
