'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarRail from '@/components/SidebarRail';
import { Ingredient, PurchaseOrder, Order } from '@/db/schema';

export default function AdminInventoryPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);
    const [clock, setClock] = useState<string>('08:42');
    
    // Data states
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [salesSummary, setSalesSummary] = useState({
        totalSales: 0,
        totalOrders: 0,
        taxCollected: 0,
        discountsGiven: 0
    });
    
    // UI state
    const [activeTab, setActiveTab] = useState<'inventory' | 'po' | 'reports'>('inventory');
    const [loading, setLoading] = useState(true);

    // Form states (Add Ingredient)
    const [ingName, setIngName] = useState('');
    const [ingStock, setIngStock] = useState(0);
    const [ingUnit, setIngUnit] = useState<'g' | 'ml' | 'unit' | 'kg'>('g');
    const [ingThreshold, setIngThreshold] = useState(0);
    const [ingError, setIngError] = useState('');

    // Form states (Quick Adjust stock)
    const [adjustingId, setAdjustingId] = useState<string | null>(null);
    const [adjustAmount, setAdjustAmount] = useState<number>(0);

    // Form states (Create Purchase Order)
    const [poSupplier, setPoSupplier] = useState('');
    const [poItems, setPoItems] = useState<{ ingredient_id: string; quantity: number; cost_per_unit: number }[]>([]);
    const [selectedIngId, setSelectedIngId] = useState('');
    const [selectedIngQty, setSelectedIngQty] = useState(0);
    const [selectedIngCost, setSelectedIngCost] = useState(0);
    const [poError, setPoError] = useState('');

    // Report states
    const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
    const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10));

    // Run clock ticker
    useEffect(() => {
        const tick = () => {
            const time = new Date();
            setClock(time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        tick();
        const interval = setInterval(tick, 10000);
        return () => clearInterval(interval);
    }, []);

    // Fetch session and all required data
    useEffect(() => {
        const checkSession = async () => {
            const res = await fetch('/api/auth/session');
            const data = await res.json();
            if (res.ok && data.authenticated) {
                setUser(data.user);
            } else {
                router.push('/login');
            }
        };
        checkSession();
    }, [router]);

    const loadData = async () => {
        setLoading(true);
        try {
            const ingRes = await fetch('/api/ingredients');
            if (ingRes.ok) {
                const ingData = await ingRes.json();
                setIngredients(ingData);
            }

            const poRes = await fetch('/api/admin/purchase-orders');
            if (poRes.ok) {
                const poData = await poRes.json();
                setPurchaseOrders(poData);
            }
            
            fetchReports();
        } catch (err) {
            console.error('Failed to load admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    const fetchReports = async () => {
        try {
            const res = await fetch(`/api/orders?status=completed`);
            if (res.ok) {
                const orders: Order[] = await res.json();
                
                const filtered = orders.filter(o => {
                    const date = o.created_at.substring(0, 10);
                    return date >= startDate && date <= endDate;
                });

                const totalSales = filtered.reduce((sum, o) => sum + o.total, 0);
                const discountsGiven = filtered.reduce((sum, o) => sum + o.discount, 0);
                const taxCollected = filtered.reduce((sum, o) => sum + o.tax, 0);

                setSalesSummary({
                    totalSales,
                    totalOrders: filtered.length,
                    taxCollected,
                    discountsGiven
                });
            }
        } catch (err) {
            console.error('Failed to fetch reports:', err);
        }
    };

    const handleAddIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIngError('');
        if (!ingName) return;

        try {
            const res = await fetch('/api/ingredients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: ingName,
                    stock: ingStock,
                    unit: ingUnit,
                    min_threshold: ingThreshold
                })
            });
            const data = await res.json();
            if (res.ok) {
                setIngredients(prev => [...prev, data.ingredient]);
                setIngName('');
                setIngStock(0);
                setIngThreshold(0);
            } else {
                setIngError(data.error || 'Failed to add ingredient');
            }
        } catch (err) {
            setIngError('Network connection issue');
        }
    };

    const handleQuickStockAdjust = async (id: string) => {
        try {
            const ing = ingredients.find(i => i.id === id);
            if (!ing) return;

            const newStock = Math.max(0, ing.stock + adjustAmount);
            const res = await fetch(`/api/ingredients/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock: newStock })
            });

            if (res.ok) {
                setIngredients(prev => prev.map(i => i.id === id ? { ...i, stock: newStock } : i));
                setAdjustingId(null);
                setAdjustAmount(0);
            }
        } catch (err) {
            console.error('Stock adjust error:', err);
        }
    };

    const handleAddPoItem = () => {
        if (!selectedIngId || selectedIngQty <= 0) return;
        const exists = poItems.some(i => i.ingredient_id === selectedIngId);
        if (exists) {
            setPoError('Item already added to this PO.');
            return;
        }

        setPoItems([...poItems, {
            ingredient_id: selectedIngId,
            quantity: selectedIngQty,
            cost_per_unit: selectedIngCost
        }]);

        setSelectedIngId('');
        setSelectedIngQty(0);
        setSelectedIngCost(0);
        setPoError('');
    };

    const handleCreatePO = async (e: React.FormEvent) => {
        e.preventDefault();
        setPoError('');
        if (!poSupplier || poItems.length === 0) {
            setPoError('Please provide a supplier and add at least one item.');
            return;
        }

        const itemsPayload = poItems.map(item => {
            const ing = ingredients.find(i => i.id === item.ingredient_id);
            return {
                ingredient_id: item.ingredient_id,
                name: ing?.name || 'Unknown',
                quantity: item.quantity,
                unit: ing?.unit || 'unit',
                cost_per_unit: item.cost_per_unit
            };
        });

        try {
            const res = await fetch('/api/admin/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier_name: poSupplier,
                    items: itemsPayload
                })
            });
            const data = await res.json();
            if (res.ok) {
                setPurchaseOrders(prev => [data.purchaseOrder, ...prev]);
                setPoSupplier('');
                setPoItems([]);
                setPoError('');
            } else {
                setPoError(data.error || 'Failed to submit Purchase Order');
            }
        } catch (err) {
            setPoError('Network connection issue');
        }
    };

    const updatePOStatus = async (id: string, status: PurchaseOrder['status']) => {
        try {
            const res = await fetch(`/api/admin/purchase-orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, status } : po));
                const ingRes = await fetch('/api/ingredients');
                if (ingRes.ok) {
                    const ingData = await ingRes.json();
                    setIngredients(ingData);
                }
            }
        } catch (err) {
            console.error('Failed to update PO status:', err);
        }
    };

    const formatCurrency = (val: number) => {
        return 'PHP ' + Math.round(val).toLocaleString('en-PH');
    };

    // Calculate percentage stock level for progress bar
    const getStockPercentage = (ing: Ingredient) => {
        // Let's assume reorder point is 100% and current stock ratio.
        // Or if initial max was set, let's map min_threshold * 3 as max safe limit (100%)
        const maxLimit = ing.min_threshold * 3 || 1000;
        const pct = Math.min(100, Math.max(0, Math.round((ing.stock / maxLimit) * 100)));
        return pct;
    };

    const getLevelClass = (ing: Ingredient) => {
        if (ing.stock <= ing.min_threshold) {
            if (ing.stock <= ing.min_threshold / 2) return 'critical';
            return 'low';
        }
        return '';
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))] font-sans">
            <div className="w-full max-w-[1180px] min-h-[820px] bg-[var(--surface)] border border-[var(--border)] rounded-[34px] shadow-[var(--shadow)] overflow-hidden grid grid-cols-[112px_1fr]">
                {/* Left Navigation Rail */}
                <SidebarRail active="admin" userRole={user?.role} />

                {/* Right Workspace area */}
                <div className="grid grid-rows-[86px_1fr] min-width-0">
                    
                    {/* Header */}
                    <header className="border-b border-[var(--border)] p-6.5 flex items-center justify-between gap-[18px]">
                        <div>
                            <h1 className="text-3xl font-display font-bold leading-none">Stock control</h1>
                            <p className="text-[var(--muted)] text-sm mt-1">Recipe-aware ingredient tracking and supply order replenishment.</p>
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

                    {/* Split Admin layout */}
                    <div className="grid grid-cols-[200px_1fr] min-height-0">
                        {/* Subtabs sidebar */}
                        <div className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] p-4 flex flex-col gap-2 border-r border-[var(--border)]">
                            <button
                                onClick={() => setActiveTab('inventory')}
                                className={`px-4 py-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                                    activeTab === 'inventory' ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:bg-[var(--fg-soft)] hover:text-[var(--fg)]'
                                }`}
                            >
                                📦 Raw Ingredients
                            </button>
                            <button
                                onClick={() => setActiveTab('po')}
                                className={`px-4 py-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                                    activeTab === 'po' ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:bg-[var(--fg-soft)] hover:text-[var(--fg)]'
                                }`}
                            >
                                🚚 Supplier POs
                            </button>
                            <button
                                onClick={() => setActiveTab('reports')}
                                className={`px-4 py-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                                    activeTab === 'reports' ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:bg-[var(--fg-soft)] hover:text-[var(--fg)]'
                                }`}
                            >
                                📊 Sales Reports
                            </button>
                        </div>

                        {/* Subtab Workspace Content */}
                        <div className="p-6 overflow-y-auto no-scrollbar">
                            {loading ? (
                                <div className="h-full flex justify-center items-center text-[var(--muted)]">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Tab 1: Inventory (Ingredients levels + Recipe links) */}
                                    {activeTab === 'inventory' && (
                                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                                            {/* Ingredients List Table */}
                                            <div className="space-y-6">
                                                <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden bg-[var(--surface)]">
                                                    <table className="inventory-table">
                                                        <thead>
                                                            <tr className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))]">
                                                                <th>Ingredient</th>
                                                                <th>Unit</th>
                                                                <th className="right">On hand</th>
                                                                <th>Level</th>
                                                                <th className="right">Reorder safety</th>
                                                                <th className="right">Quick adjust</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ingredients.map(ing => {
                                                                const pct = getStockPercentage(ing);
                                                                const levelClass = getLevelClass(ing);
                                                                const isLow = ing.stock <= ing.min_threshold;
                                                                
                                                                return (
                                                                    <tr key={ing.id} className="hover:bg-[var(--fg-soft)] border-b border-[var(--border)]">
                                                                        <td>
                                                                            <strong>{ing.name}</strong>
                                                                        </td>
                                                                        <td>{ing.unit}</td>
                                                                        <td className="right num font-extrabold text-[var(--fg)]">
                                                                            {ing.stock.toLocaleString('en-PH')}
                                                                        </td>
                                                                        <td>
                                                                            <div className={`level ${levelClass}`}>
                                                                                <span style={{ width: `${pct}%` }}></span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="right num text-[var(--muted)]">
                                                                            {ing.min_threshold.toLocaleString('en-PH')}
                                                                        </td>
                                                                        <td className="right">
                                                                            {adjustingId === ing.id ? (
                                                                                <div className="flex items-center gap-1 justify-end">
                                                                                    <input
                                                                                        type="number"
                                                                                        onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                                                                                        className="w-16 bg-[var(--bg)] border border-[var(--border)] rounded p-1 text-xs text-center font-bold"
                                                                                        placeholder="Qty +/-"
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => handleQuickStockAdjust(ing.id)}
                                                                                        className="bg-green-600 text-white font-bold p-1 rounded transition-all text-[10px]"
                                                                                    >
                                                                                        Apply
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => { setAdjustingId(null); setAdjustAmount(0); }}
                                                                                        className="bg-zinc-200 text-zinc-600 p-1 rounded text-[10px]"
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => setAdjustingId(ing.id)}
                                                                                    className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-[10px] font-bold hover:text-[var(--fg)] cursor-pointer"
                                                                                >
                                                                                    Adjust
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Add New Ingredient Form Panel */}
                                                <div className="border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--surface)] space-y-4">
                                                    <h3 className="font-display font-bold text-lg text-[var(--fg)]">Register New Ingredient</h3>
                                                    {ingError && <p className="text-red-500 text-xs font-semibold">{ingError}</p>}
                                                    
                                                    <form onSubmit={handleAddIngredient} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-[var(--muted)] uppercase">Name</label>
                                                            <input
                                                                type="text"
                                                                value={ingName}
                                                                onChange={(e) => setIngName(e.target.value)}
                                                                required
                                                                placeholder="e.g. Condensed milk"
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-[var(--muted)] uppercase">Stock</label>
                                                            <input
                                                                type="number"
                                                                value={ingStock || ''}
                                                                onChange={(e) => setIngStock(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                required
                                                                placeholder="0"
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-[var(--muted)] uppercase">Unit</label>
                                                            <select
                                                                value={ingUnit}
                                                                onChange={(e) => setIngUnit(e.target.value as any)}
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs"
                                                            >
                                                                <option value="g">Grams (g)</option>
                                                                <option value="ml">Milliliters (ml)</option>
                                                                <option value="unit">Units (pcs)</option>
                                                                <option value="kg">Kilograms (kg)</option>
                                                            </select>
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            className="py-2 bg-[var(--accent)] text-white font-bold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer"
                                                        >
                                                            Add Ingredient
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>

                                            {/* Right Column: Recipe links (from prototype) */}
                                            <aside className="border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--surface)] flex flex-col justify-between">
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="font-mono text-[var(--accent)] uppercase tracking-wider text-[10px] font-extrabold">Decomposition</p>
                                                        <h2 className="text-2xl font-display font-bold text-[var(--fg)]">Recipe links</h2>
                                                        <p className="text-[var(--muted)] text-xs mt-1">Tap-worthy recipe cards show what each sale deducts from stock.</p>
                                                    </div>

                                                    <div className="recipe-card border border-[var(--border)] rounded-xl p-4.5 bg-[color-mix(in_oklch,var(--bg)_46%,var(--surface))]">
                                                        <h3 className="font-display font-bold text-base text-[var(--fg)]">Spanish Latte</h3>
                                                        <ul className="mt-3.5 space-y-2 text-xs">
                                                            <li className="flex justify-between text-[var(--muted)]">
                                                                <span>Espresso beans</span>
                                                                <strong className="num text-[var(--fg)]">18 g</strong>
                                                            </li>
                                                            <li className="flex justify-between text-[var(--muted)]">
                                                                <span>Fresh milk</span>
                                                                <strong className="num text-[var(--fg)]">160 ml</strong>
                                                            </li>
                                                            <li className="flex justify-between text-[var(--muted)]">
                                                                <span>Condensed milk</span>
                                                                <strong className="num text-[var(--fg)]">28 ml</strong>
                                                            </li>
                                                            <li className="flex justify-between text-[var(--muted)]">
                                                                <span>Ice</span>
                                                                <strong className="num text-[var(--fg)]">120 g</strong>
                                                            </li>
                                                        </ul>
                                                    </div>

                                                    <div className="recipe-card border border-[var(--border)] rounded-xl p-4.5 bg-[color-mix(in_oklch,var(--bg)_46%,var(--surface))]">
                                                        <h3 className="font-display font-bold text-base text-[var(--fg)]">Butter Croissant</h3>
                                                        <ul className="mt-3.5 space-y-2 text-xs">
                                                            <li className="flex justify-between text-[var(--muted)]">
                                                                <span>Croissant dough</span>
                                                                <strong className="num text-[var(--fg)]">86 g</strong>
                                                            </li>
                                                            <li className="flex justify-between text-[var(--muted)]">
                                                                <span>Butter sheet</span>
                                                                <strong className="num text-[var(--fg)]">18 g</strong>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setActiveTab('po')}
                                                    className="w-full min-h-[50px] bg-[var(--accent)] text-white text-xs font-bold rounded-xl shadow-md transition-all hover:opacity-90 cursor-pointer mt-6"
                                                >
                                                    Prepare purchase order
                                                </button>
                                            </aside>
                                        </div>
                                    )}

                                    {/* Tab 2: PO Tracker */}
                                    {activeTab === 'po' && (
                                        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                                            {/* PO Builder Form */}
                                            <div className="border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--surface)] space-y-4">
                                                <h3 className="font-display font-bold text-base text-[var(--fg)]">Create Replenishment PO</h3>
                                                {poError && <p className="text-red-500 text-xs">{poError}</p>}

                                                <form onSubmit={handleCreatePO} className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-[var(--muted)] uppercase">Supplier Name</label>
                                                        <input
                                                            type="text"
                                                            value={poSupplier}
                                                            onChange={(e) => setPoSupplier(e.target.value)}
                                                            required
                                                            placeholder="Supplier name"
                                                            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs"
                                                        />
                                                    </div>

                                                    <div className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] p-3.5 rounded-xl border border-[var(--border)] space-y-2 text-xs">
                                                        <div className="text-[10px] font-bold text-[var(--accent)] uppercase">Order Item</div>
                                                        <select
                                                            value={selectedIngId}
                                                            onChange={(e) => setSelectedIngId(e.target.value)}
                                                            className="w-full px-2 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs"
                                                        >
                                                            <option value="">-- Select Ingredient --</option>
                                                            {ingredients.map(i => (
                                                                <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                                            ))}
                                                        </select>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="number"
                                                                value={selectedIngQty || ''}
                                                                onChange={(e) => setSelectedIngQty(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                placeholder="Quantity"
                                                                className="px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs"
                                                            />
                                                            <input
                                                                type="number"
                                                                value={selectedIngCost || ''}
                                                                onChange={(e) => setSelectedIngCost(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                placeholder="Cost per unit"
                                                                className="px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddPoItem}
                                                            className="w-full py-1.5 bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] rounded-lg text-[10px] font-bold cursor-pointer"
                                                        >
                                                            + Add to List
                                                        </button>
                                                    </div>

                                                    {poItems.length > 0 && (
                                                        <div className="space-y-1.5 border-t border-[var(--border)] pt-3 max-h-[150px] overflow-y-auto">
                                                            {poItems.map((item, idx) => {
                                                                const ing = ingredients.find(i => i.id === item.ingredient_id);
                                                                return (
                                                                    <div key={idx} className="flex justify-between items-center text-xs bg-[var(--bg)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
                                                                        <span>{ing?.name} x{item.quantity}</span>
                                                                        <strong className="num text-[var(--fg)]">{formatCurrency(item.quantity * item.cost_per_unit)}</strong>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    <button
                                                        type="submit"
                                                        className="w-full py-3 bg-[var(--accent)] text-white font-bold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer"
                                                    >
                                                        Submit Supplier PO
                                                    </button>
                                                </form>
                                            </div>

                                            {/* PO Active Listings */}
                                            <div className="space-y-4">
                                                {purchaseOrders.map(po => (
                                                    <div key={po.id} className="border border-[var(--border)] rounded-[var(--radius)] p-4 bg-[var(--surface)] space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <strong className="text-sm text-[var(--fg)] block">PO ID: {po.id.toUpperCase()}</strong>
                                                                <span className="text-[10px] text-[var(--muted)] mt-0.5 block">Supplier: {po.supplier_name} | Placed: {new Date(po.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                                                po.status === 'received' ? 'bg-green-50 border-green-200 text-green-600' : po.status === 'cancelled' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-yellow-50 border-yellow-200 text-yellow-600'
                                                            }`}>
                                                                {po.status}
                                                            </span>
                                                        </div>

                                                        <div className="bg-[var(--bg)] p-2.5 rounded-xl border border-[var(--border)] text-[10px] text-[var(--muted)] space-y-1">
                                                            {po.items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between">
                                                                    <span>{item.name} x{item.quantity} {item.unit}</span>
                                                                    <span className="num font-bold text-[var(--fg)]">{formatCurrency(item.quantity * item.cost_per_unit)}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                                                            <span className="text-xs font-bold text-[var(--muted)]">PO Total: <strong className="text-[var(--fg)] font-extrabold num">{formatCurrency(po.total_cost)}</strong></span>
                                                            {po.status === 'ordered' && (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => updatePOStatus(po.id, 'cancelled')}
                                                                        className="px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-500 rounded-lg text-[10px] font-bold cursor-pointer"
                                                                    >
                                                                        Cancel PO
                                                                    </button>
                                                                    <button
                                                                        onClick={() => updatePOStatus(po.id, 'received')}
                                                                        className="px-2.5 py-1.5 bg-[var(--ok)] text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                                                    >
                                                                        Mark Received
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 3: Sales Reports */}
                                    {activeTab === 'reports' && (
                                        <div className="space-y-6">
                                            {/* Range selectors */}
                                            <div className="flex flex-wrap gap-4 items-center justify-between border border-[var(--border)] p-4 rounded-2xl bg-[var(--surface)]">
                                                <div>
                                                    <h3 className="font-display font-bold text-sm text-[var(--fg)]">Register Reports</h3>
                                                    <p className="text-[10px] text-[var(--muted)] mt-0.5">Select register dates to check financials</p>
                                                </div>
                                                <div className="flex gap-2.5 text-xs">
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        className="bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl font-bold"
                                                    />
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => setEndDate(e.target.value)}
                                                        className="bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl font-bold"
                                                    />
                                                </div>
                                            </div>

                                            {/* Metrics blocks */}
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="metric">
                                                    <span>Gross Revenue</span>
                                                    <strong className="num text-[#c19a6b]">{formatCurrency(salesSummary.totalSales)}</strong>
                                                </div>
                                                <div className="metric">
                                                    <span>Completed Sales</span>
                                                    <strong className="num">{salesSummary.totalOrders}</strong>
                                                </div>
                                                <div className="metric">
                                                    <span>VAT Accounted</span>
                                                    <strong className="num">{formatCurrency(salesSummary.taxCollected)}</strong>
                                                </div>
                                                <div className="metric">
                                                    <span>Discounts Granted</span>
                                                    <strong className="num text-red-500">{formatCurrency(salesSummary.discountsGiven)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
