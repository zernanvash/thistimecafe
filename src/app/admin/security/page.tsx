'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/BrandMark';
import LockButton from '@/components/LockButton';
import IdleLockout from '@/components/IdleLockout';
import { User, SecurityLog } from '@/db/schema';

export default function SecurityConsolePage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [logFilter, setLogFilter] = useState<string>('all');
    
    // User Form state
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'owner' | 'manager' | 'cashier' | 'barista'>('cashier');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Selected user for editing/deleting
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [newPin, setNewPin] = useState('');

    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (!res.ok || !data.authenticated || data.user?.role !== 'admin') {
                    router.replace('/login');
                    return;
                }

                await loadData();
            } catch {
                router.replace('/login');
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, [router]);

    const loadData = async () => {
        try {
            const [usersRes, logsRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/security/logs')
            ]);
            if (usersRes.ok && logsRes.ok) {
                setUsers(await usersRes.json());
                setLogs(await logsRes.json());
            }
        } catch (err) {
            console.error('Failed to load security console data:', err);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!pin) {
            setError('Staff/Owner accounts must have a 6-digit PIN');
            return;
        }

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: username,
                    email: email || undefined,
                    password: password || undefined,
                    role,
                    passcode: pin || undefined
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to create user');
                return;
            }

            setSuccess('User created successfully!');
            setUsername('');
            setEmail('');
            setPassword('');
            setPin('');
            await loadData();
        } catch {
            setError('Connection error');
        }
    };

    const handleToggleLock = async (user: User) => {
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_locked: !user.is_locked })
            });

            if (res.ok) {
                await loadData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update lock status');
            }
        } catch {
            alert('Connection error');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to permanently delete this account?')) return;

        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await loadData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete user');
            }
        } catch {
            alert('Connection error');
        }
    };

    const handleUpdateCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            const res = await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: newPassword || undefined,
                    passcode: newPin || undefined
                })
            });

            if (res.ok) {
                alert('Credentials updated successfully!');
                setNewPassword('');
                setNewPin('');
                setEditingUser(null);
                await loadData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update credentials');
            }
        } catch {
            alert('Connection error');
        }
    };

    const filteredLogs = logs.filter(log => {
        if (logFilter === 'all') return true;
        return log.event_type === logFilter;
    });

    if (isLoading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div role="status" className="flex flex-col items-center gap-3 text-sm font-bold text-[var(--muted)]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]"></div>
                    Loading security console
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[var(--bg)] p-3 sm:p-5 font-sans">
            <IdleLockout />
            <section className="mx-auto max-w-[1200px] min-h-[calc(100vh-24px)] bg-[var(--surface)] border border-[var(--border)] rounded-[18px] sm:rounded-[24px] shadow-[var(--shadow)] overflow-hidden flex flex-col">
                
                {/* Header */}
                <header className="p-5 sm:p-7 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="font-mono text-[var(--danger)] uppercase tracking-[0.08em] text-xs font-extrabold mb-1">TTC Security Panel</p>
                        <h1 className="text-3xl font-display font-bold text-[var(--fg)]">Security Console</h1>
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

                <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 flex-1">
                    
                    {/* Left Pane - Users List and Audit Logs */}
                    <div className="space-y-6">
                        
                        {/* Users Accounts List */}
                        <section className="border border-[var(--border)] rounded-[18px] p-5 sm:p-6 bg-[color-mix(in_oklch,var(--bg)_15%,var(--surface))]">
                            <h2 className="text-lg font-bold text-[var(--fg)] mb-4">Staff & Owner Accounts</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-[var(--border)] text-[var(--muted)] font-bold uppercase tracking-wider">
                                            <th className="py-2">Name</th>
                                            <th className="py-2">Username/Email</th>
                                            <th className="py-2">Role</th>
                                            <th className="py-2">PIN</th>
                                            <th className="py-2">Status</th>
                                            <th className="py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {users.map(u => (
                                            <tr key={u.id} className="hover:bg-[var(--bg)]/30 transition-colors">
                                                <td className="py-3 font-semibold text-[var(--fg)]">{u.name}</td>
                                                <td className="py-3 text-[var(--muted)]">{u.email || 'N/A'}</td>
                                                <td className="py-3 capitalize">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        u.role === 'admin' ? 'bg-[color-mix(in_oklch,var(--danger)_12%,var(--surface))] text-[var(--danger)] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))]' :
                                                        u.role === 'owner' ? 'bg-[color-mix(in_oklch,var(--accent)_12%,var(--surface))] text-[var(--accent)] border border-[color-mix(in_oklch,var(--accent)_24%,var(--border))]' :
                                                        'bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)]/80'
                                                    }`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 font-mono text-[var(--fg)]/90">{u.passcode || 'None'}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        u.is_locked
                                                            ? 'bg-[color-mix(in_oklch,var(--danger)_12%,var(--surface))] text-[var(--danger)]'
                                                            : 'bg-[color-mix(in_oklch,var(--ok)_12%,var(--surface))] text-[var(--ok)]'
                                                    }`}>
                                                        {u.is_locked ? 'Locked' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                                                    {u.role !== 'admin' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleToggleLock(u)}
                                                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                                                                    u.is_locked 
                                                                        ? 'btn-secondary text-[var(--ok)]' 
                                                                        : 'btn-danger text-[var(--danger)] border-[color-mix(in_oklch,var(--danger)_28%,var(--border))]'
                                                                }`}
                                                            >
                                                                {u.is_locked ? 'Unlock' : 'Lock'}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingUser(u)}
                                                                className="btn-secondary px-3 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id)}
                                                                className="btn-secondary px-3 py-1.5 rounded-lg border text-[10px] font-bold text-[var(--danger)] border-[color-mix(in_oklch,var(--danger)_12%,var(--border))] cursor-pointer transition-all"
                                                            >
                                                                Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Audit Logs Viewer */}
                        <section className="border border-[var(--border)] rounded-[18px] p-5 sm:p-6 bg-[color-mix(in_oklch,var(--bg)_15%,var(--surface))]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <h2 className="text-lg font-bold text-[var(--fg)]">Security Audit Logs</h2>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="filter" className="text-xs font-bold text-[var(--muted)]">Event:</label>
                                    <select
                                        id="filter"
                                        value={logFilter}
                                        onChange={(e) => setLogFilter(e.target.value)}
                                        className="bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] rounded-lg text-xs px-2.5 py-1.5 focus:outline-none"
                                    >
                                        <option value="all">All Events</option>
                                        <option value="login_success">Successful Logins</option>
                                        <option value="login_failure">Failed Logins</option>
                                        <option value="account_lockout">Account Lockouts</option>
                                        <option value="password_change">Password Changes</option>
                                        <option value="account_lock">Admin Account Locks</option>
                                        <option value="account_unlock">Admin Account Unlocks</option>
                                        <option value="user_created">User Registrations</option>
                                        <option value="user_deleted">User Deletions</option>
                                    </select>
                                </div>
                            </div>
                            <div className="overflow-x-auto max-h-[360px] overflow-y-auto pr-1">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-[var(--border)] text-[var(--muted)] font-bold uppercase tracking-wider sticky top-0 bg-[var(--surface)] z-10">
                                            <th className="py-2">Timestamp</th>
                                            <th className="py-2">Event</th>
                                            <th className="py-2">User</th>
                                            <th className="py-2">Details</th>
                                            <th className="py-2">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {filteredLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-[var(--bg)]/30 transition-colors">
                                                <td className="py-2 text-[var(--muted)] font-mono whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleString('en-PH', { hour12: false })}
                                                </td>
                                                <td className="py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                        log.event_type === 'login_success' ? 'bg-[color-mix(in_oklch,var(--ok)_12%,var(--surface))] text-[var(--ok)]' :
                                                        log.event_type === 'login_failure' ? 'bg-[color-mix(in_oklch,var(--danger)_12%,var(--surface))] text-[var(--danger)]' :
                                                        log.event_type === 'account_lockout' ? 'bg-[color-mix(in_oklch,var(--danger)_24%,var(--surface))] text-[var(--danger)] border border-[var(--danger)]' :
                                                        'bg-[var(--surface)] text-[var(--fg)]/80 border border-[var(--border)]'
                                                    }`}>
                                                        {log.event_type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="py-2 font-semibold">{log.username}</td>
                                                <td className="py-2 text-[var(--fg)]/80">{log.details}</td>
                                                <td className="py-2 font-mono text-[var(--muted)]">{log.ip || '127.0.0.1'}</td>
                                            </tr>
                                        ))}
                                        {filteredLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-6 text-[var(--muted)]">No logs match this event type.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    {/* Right Pane - Create and Edit Forms */}
                    <div className="space-y-6">
                        
                        {/* Edit User Modal/Panel */}
                        {editingUser && (
                            <section className="border border-[var(--danger)] rounded-[18px] p-5 sm:p-6 bg-[color-mix(in_oklch,var(--danger)_4%,var(--surface))] shadow-lg relative">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="absolute top-4 right-4 text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)]"
                                >
                                    Close
                                </button>
                                <h2 className="text-lg font-bold text-[var(--fg)] mb-4">Edit {editingUser.name}</h2>
                                <form onSubmit={handleUpdateCredentials} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label htmlFor="newPassword" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                            New Password (Optional)
                                        </label>
                                        <input
                                            id="newPassword"
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Leave blank to keep current"
                                            className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="newPin" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                            New 6-Digit PIN (Optional)
                                        </label>
                                        <input
                                            id="newPin"
                                            type="text"
                                            maxLength={6}
                                            value={newPin}
                                            onChange={(e) => setNewPin(e.target.value)}
                                            placeholder="Leave blank to keep current"
                                            className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full min-h-[44px] rounded-lg bg-[var(--accent)] text-[var(--surface)] text-xs font-bold cursor-pointer transition-all hover:opacity-90"
                                    >
                                        Update Credentials
                                    </button>
                                </form>
                            </section>
                        )}

                        {/* Create Staff Account Form */}
                        <section className="border border-[var(--border)] rounded-[18px] p-5 sm:p-6 bg-[color-mix(in_oklch,var(--bg)_15%,var(--surface))]">
                            <h2 className="text-lg font-bold text-[var(--fg)] mb-4">Create Staff / Owner Account</h2>
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                
                                {error && (
                                    <div className="text-[var(--danger)] text-xs font-semibold bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] px-3 py-2 rounded-lg text-center">
                                        {error}
                                    </div>
                                )}
                                {success && (
                                    <div className="text-[var(--ok)] text-xs font-semibold bg-[color-mix(in_oklch,var(--ok)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--ok)_24%,var(--border))] px-3 py-2 rounded-lg text-center">
                                        {success}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label htmlFor="regName" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                        Staff Name
                                    </label>
                                    <input
                                        id="regName"
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="e.g. Maria Clara"
                                        className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="regEmail" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                        Username or Email (Optional)
                                    </label>
                                    <input
                                        id="regEmail"
                                        type="text"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="e.g. maria"
                                        className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="regPassword" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                        Password (Optional)
                                    </label>
                                    <input
                                        id="regPassword"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password for credentials login"
                                        className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="regRole" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                        Staff Role
                                    </label>
                                    <select
                                        id="regRole"
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as any)}
                                        className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs focus:outline-none focus:border-[var(--accent)]"
                                    >
                                        <option value="cashier">Cashier</option>
                                        <option value="barista">Barista</option>
                                        <option value="manager">Manager</option>
                                        <option value="owner">Owner</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="regPin" className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                        6-Digit PIN (Keypad login)
                                    </label>
                                    <input
                                        id="regPin"
                                        type="text"
                                        maxLength={6}
                                        required
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value)}
                                        placeholder="e.g. 123456"
                                        className="w-full min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] text-xs focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full min-h-[50px] rounded-xl bg-[var(--accent)] text-[var(--surface)] text-xs font-extrabold uppercase tracking-wider cursor-pointer transition-all hover:opacity-90 active:scale-95 mt-4"
                                >
                                    Create Account
                                </button>

                            </form>
                        </section>
                    </div>

                </div>
            </section>
        </main>
    );
}
