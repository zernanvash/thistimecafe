export const IDLE_LOCKOUT_STORAGE_KEY = 'ttc_idle_lockout_minutes';
export const DEFAULT_IDLE_LOCKOUT_MINUTES = 15;
export const MIN_IDLE_LOCKOUT_MINUTES = 1;
export const MAX_IDLE_LOCKOUT_MINUTES = 240;

export function normalizeIdleLockoutMinutes(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_IDLE_LOCKOUT_MINUTES;
    }
    if (parsed <= 0) {
        return 0;
    }
    return Math.min(MAX_IDLE_LOCKOUT_MINUTES, Math.max(MIN_IDLE_LOCKOUT_MINUTES, Math.round(parsed)));
}
