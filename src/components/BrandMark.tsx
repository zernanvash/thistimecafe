'use client';

import Image from 'next/image';

interface BrandMarkProps {
    compact?: boolean;
    className?: string;
}

export default function BrandMark({ compact = false, className = '' }: BrandMarkProps) {
    if (!compact) {
        return (
            <div className={`brand-mark brand-mark-lockup ${className}`}>
                <Image
                    src="/brand/this-time-cafe-lockup.jpg"
                    alt="This Time, Cafe' by Cramming Cafe'"
                    width={300}
                    height={196}
                    className="brand-lockup-photo"
                    priority
                />
            </div>
        );
    }

    return (
        <div className={`brand-mark brand-mark-compact ${className}`}>
            <span className="brand-mark-image" aria-hidden="true">
                <Image
                    src="/brand/this-time-cafe-symbol.jpg"
                    alt=""
                    width={176}
                    height={100}
                    className="brand-mark-photo"
                />
            </span>
            <span className="brand-mark-copy">
                <span className="brand-name">This Time, Cafe&apos;</span>
            </span>
        </div>
    );
}
