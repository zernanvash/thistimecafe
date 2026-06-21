'use strict';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LockButton from '@/components/LockButton';
import BrandMark from '@/components/BrandMark';
import IdleLockout from '@/components/IdleLockout';
import { Ingredient, PurchaseOrder, Order, Product } from '@/db/schema';

type InventoryTab = 'inventory' | 'po' | 'reports' | 'items';

function getInitialTab(): InventoryTab {
    if (typeof window === 'undefined') return 'inventory';

    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'inventory' || tab === 'po' || tab === 'reports' || tab === 'items') {
        return tab;
    }

    return 'inventory';
}

export default function AdminInventoryPage() {
    const router = useRouter();
    const [clock, setClock] = useState<string>('08:42');
    const [userRole, setUserRole] = useState<string | null>(null);

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
    const [activeTab, setActiveTab] = useState<InventoryTab>(getInitialTab);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [products, setProducts] = useState<Product[]>([]);
    const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);

    // Product editor states
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPrice, setEditPrice] = useState(0);
    const [editTrackStock, setEditTrackStock] = useState(false);
    const [editStock, setEditStock] = useState(0);
    const [editRecipe, setEditRecipe] = useState<{ ingredient_id: string; quantity: number }[]>([]);
    const [editError, setEditError] = useState('');
    const [editSuccess, setEditSuccess] = useState('');
    const [recipeIngId, setRecipeIngId] = useState('');
    const [recipeIngQty, setRecipeIngQty] = useState(0);

    // Menu search states
    const [menuSearchQuery, setMenuSearchQuery] = useState('');
    const [menuActiveCategory, setMenuActiveCategory] = useState('All items');

    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [showComparison, setShowComparison] = useState(false);

    // Form states (Add Ingredient)
    const [ingName, setIngName] = useState('');
    const [ingStock, setIngStock] = useState(0);
    const [ingUnit, setIngUnit] = useState<'g' | 'ml' | 'unit' | 'kg'>('g');
    const [ingThreshold, setIngThreshold] = useState(0);
    const [ingMaxCapacity, setIngMaxCapacity] = useState(0);
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
            if (res.ok && data.authenticated && data.user) {
                setUserRole(data.user.role);

                // Adjust tab based on role restrictions
                if (data.user.role === 'cashier') {
                    setActiveTab('reports');
                } else if (data.user.role === 'barista') {
                    const initialTab = getInitialTab();
                    if (initialTab === 'reports') {
                        setActiveTab('inventory');
                    }
                }
            } else {
                router.push('/login');
            }
        };
        checkSession();
    }, [router]);

    const fetchReports = useCallback(async () => {
        try {
            const res = await fetch(`/api/orders?status=completed`);
            if (res.ok) {
                const orders: Order[] = await res.json();
                setCompletedOrders(orders);

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
            } else {
                setLoadError('Sales history could not be loaded.');
            }
        } catch (err) {
            console.error('Failed to fetch reports:', err);
            setLoadError('Sales history could not be loaded.');
        }
    }, [startDate, endDate]);

    const loadData = useCallback(async () => {
        setLoadError('');
        try {
            if (userRole !== 'cashier') {
                const ingRes = await fetch('/api/ingredients');
                if (ingRes.ok) {
                    const ingData = await ingRes.json();
                    setIngredients(ingData);
                    setSelectedIngredientId(prev => prev ?? ingData[0]?.id ?? null);
                } else {
                    setLoadError('Inventory data could not be loaded.');
                }

                const prodRes = await fetch('/api/products');
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    setProducts(prodData);
                } else {
                    setLoadError('Products data could not be loaded.');
                }

                const poRes = await fetch('/api/admin/purchase-orders');
                if (poRes.ok) {
                    const poData = await poRes.json();
                    setPurchaseOrders(poData);
                } else {
                    setLoadError('Supplier orders could not be loaded.');
                }
            }

            if (userRole !== 'barista') {
                await fetchReports();
            }
        } catch (err) {
            console.error('Failed to load admin data:', err);
            setLoadError('Stock and sales data could not be refreshed.');
        } finally {
            setLoading(false);
        }
    }, [fetchReports, userRole]);

    useEffect(() => {
        if (userRole === null) return;
        const timer = window.setTimeout(() => {
            void loadData();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadData, userRole]);

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
                    min_threshold: ingThreshold,
                    max_capacity: ingMaxCapacity > 0 ? ingMaxCapacity : ingStock
                })
            });
            const data = await res.json();
            if (res.ok) {
                setIngredients(prev => [...prev, data.ingredient]);
                setSelectedIngredientId(prev => prev ?? data.ingredient.id);
                setIngName('');
                setIngStock(0);
                setIngThreshold(0);
                setIngMaxCapacity(0);
            } else {
                setIngError(data.error || 'Failed to add ingredient');
            }
        } catch {
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
        } catch {
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

    const handleDeleteOrder = async (id: string, orderNumber: string) => {
        if (!window.confirm(`Are you sure you want to delete order ${orderNumber}? This action cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setCompletedOrders(prev => prev.filter(o => o.id !== id));
                void fetchReports();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete order.');
            }
        } catch (err) {
            console.error('Delete order error:', err);
            alert('Failed to delete order due to a network issue.');
        }
    };

    const handleClearAllHistory = async () => {
        const confirmPhrase = 'clear all history';
        const input = window.prompt(`WARNING: This will permanently delete ALL transactions. This action cannot be undone.\n\nTo confirm, type "${confirmPhrase}":`);
        if (input !== confirmPhrase) {
            if (input !== null) {
                alert('Confirmation text did not match. Action cancelled.');
            }
            return;
        }

        try {
            const res = await fetch('/api/orders', {
                method: 'DELETE'
            });
            if (res.ok) {
                setCompletedOrders([]);
                void fetchReports();
                alert('All sales history has been successfully cleared.');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to clear sales history.');
            }
        } catch (err) {
            console.error('Clear history error:', err);
            alert('Failed to clear history due to a network issue.');
        }
    };

    const formatCurrency = (val: number) => {
        return 'PHP ' + Math.round(val).toLocaleString('en-PH');
    };

    // Calculate percentage stock level for progress bar
    const getStockPercentage = (ing: Ingredient) => {
        const maxLimit = ing.max_capacity || ing.min_threshold * 3 || 1000;
        const pct = Math.min(100, Math.max(0, Math.round((ing.stock / maxLimit) * 100)));
        return pct;
    };

    const getLevelClass = (ing: Ingredient) => {
        if (ing.max_capacity && ing.max_capacity > 0) {
            const ratio = ing.stock / ing.max_capacity;
            if (ratio < 0.05) return 'critical';
            if (ratio < 0.1) return 'low';
            return '';
        }
        if (ing.stock <= ing.min_threshold) {
            if (ing.stock <= ing.min_threshold / 2) return 'critical';
            return 'low';
        }
        return '';
    };

    const comparisonData = React.useMemo(() => {
        if (startDate !== endDate) {
            return null;
        }

        const currentD = new Date(startDate);
        currentD.setDate(currentD.getDate() - 1);
        const prevDateStr = currentD.toISOString().substring(0, 10);

        const currentOrders = completedOrders.filter(o => o.created_at.substring(0, 10) === startDate);
        const prevOrders = completedOrders.filter(o => o.created_at.substring(0, 10) === prevDateStr);

        const currentRevenue = currentOrders.reduce((sum, o) => sum + o.total, 0);
        const prevRevenue = prevOrders.reduce((sum, o) => sum + o.total, 0);

        const currentCount = currentOrders.length;
        const prevCount = prevOrders.length;

        const revenueDiff = currentRevenue - prevRevenue;
        const revenuePct = prevRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : Math.round((revenueDiff / prevRevenue) * 100);

        const countDiff = currentCount - prevCount;
        const countPct = prevCount === 0 ? (currentCount > 0 ? 100 : 0) : Math.round((countDiff / prevCount) * 100);

        const currentAOV = currentCount === 0 ? 0 : Math.round(currentRevenue / currentCount);
        const prevAOV = prevCount === 0 ? 0 : Math.round(prevRevenue / prevCount);
        const aovDiff = currentAOV - prevAOV;
        const aovPct = prevAOV === 0 ? (currentAOV > 0 ? 100 : 0) : Math.round((aovDiff / prevAOV) * 100);

        return {
            prevDateStr,
            prevRevenue,
            prevCount,
            prevAOV,
            revenueDiff,
            revenuePct,
            countDiff,
            countPct,
            currentAOV,
            aovDiff,
            aovPct
        };
    }, [startDate, endDate, completedOrders]);

    const productBreakdown = React.useMemo(() => {
        const filtered = completedOrders.filter(o => {
            const date = o.created_at.substring(0, 10);
            return date >= startDate && date <= endDate;
        });

        const breakdownMap: Record<string, { name: string; qty: number; total: number }> = {};

        filtered.forEach(o => {
            o.items.forEach(item => {
                const prodId = item.product_id;
                if (!breakdownMap[prodId]) {
                    breakdownMap[prodId] = { name: item.name, qty: 0, total: 0 };
                }
                breakdownMap[prodId].qty += item.quantity;
                breakdownMap[prodId].total += item.price * item.quantity;
            });
        });

        return Object.values(breakdownMap).sort((a, b) => b.qty - a.qty);
    }, [startDate, endDate, completedOrders]);

    const filteredOrdersForList = React.useMemo(() => {
        return completedOrders.filter(o => {
            const date = o.created_at.substring(0, 10);
            return date >= startDate && date <= endDate;
        });
    }, [startDate, endDate, completedOrders]);

    return (
        <main className="min-h-screen flex items-center justify-center p-3 lg:p-4 bg-[var(--bg)] font-sans">
            <IdleLockout />
            <div className="w-full max-w-[1280px] min-h-[calc(100vh-24px)] lg:min-h-[820px] bg-[var(--surface)] border border-[var(--border)] rounded-[18px] lg:rounded-[24px] shadow-[var(--shadow)] overflow-hidden">
                {/* Workspace area */}
                <div className="grid grid-rows-[auto_1fr] min-w-0">

                    {/* Header */}
                    <header className="border-b border-[var(--border)] p-4 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <BrandMark compact />
                            <div className="min-w-0">
                                <h1 className="text-3xl font-display font-bold leading-none">Stock and sales</h1>
                                <p className="text-[var(--muted)] text-sm mt-1">Check ingredient levels, supplier orders, and completed register sales.</p>
                            </div>
                        </div>
                        <div className="flex gap-2.5 items-center justify-start lg:justify-end flex-wrap">
                            <span className="min-h-[40px] inline-flex items-center px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                                Shift active
                            </span>
                            <span className="num min-h-[40px] inline-flex items-center gap-2 px-3 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-xs font-bold">
                                {clock}
                            </span>
                            <button
                                type="button"
                                onClick={() => router.push('/pos')}
                                className="btn-secondary btn-pill inline-flex items-center border text-xs transition-all cursor-pointer"
                            >
                                Back to orders
                            </button>
                            <LockButton />
                        </div>
                    </header>

                    {/* Split kiosk layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] min-h-0">
                        {/* Subtabs sidebar */}
                        <div className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] p-3 lg:p-4 flex lg:flex-col gap-2 border-b lg:border-b-0 lg:border-r border-[var(--border)] overflow-x-auto no-scrollbar">
                            {userRole !== 'cashier' && (
                                <button
                                    aria-pressed={activeTab === 'inventory'}
                                    onClick={() => setActiveTab('inventory')}
                                    className={`min-w-max px-4 py-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                                        activeTab === 'inventory' ? 'btn-primary border border-[var(--accent-strong)]' : 'btn-secondary border'
                                    }`}
                                >
                                    Raw ingredients
                                </button>
                            )}
                            {userRole !== 'cashier' && (
                                <button
                                    aria-pressed={activeTab === 'po'}
                                    onClick={() => setActiveTab('po')}
                                    className={`min-w-max px-4 py-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                                        activeTab === 'po' ? 'btn-primary border border-[var(--accent-strong)]' : 'btn-secondary border'
                                    }`}
                                >
                                    Supplier orders
                                </button>
                            )}
                            {userRole !== 'barista' && (
                                <button
                                    aria-pressed={activeTab === 'reports'}
                                    onClick={() => setActiveTab('reports')}
                                    className={`min-w-max px-4 py-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                                        activeTab === 'reports' ? 'btn-primary border border-[var(--accent-strong)]' : 'btn-secondary border'
                                    }`}
                                >
                                    Sales history
                                </button>
                            )}
                            {userRole !== 'cashier' && (
                                <button
                                    aria-pressed={activeTab === 'items'}
                                    onClick={() => setActiveTab('items')}
                                    className={`min-w-max px-4 py-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                                        activeTab === 'items' ? 'btn-primary border border-[var(--accent-strong)]' : 'btn-secondary border'
                                    }`}
                                >
                                    Manage Menu
                                </button>
                            )}
                        </div>

                        {/* Subtab Workspace Content */}
                        <div className="p-4 lg:p-6 overflow-y-auto no-scrollbar">
                            {loading ? (
                                <div role="status" aria-live="polite" className="h-full min-h-[280px] flex flex-col gap-3 justify-center items-center text-[var(--muted)] text-sm font-bold">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                                    Loading stock and sales
                                </div>
                            ) : (
                                <>
                                    {loadError && (
                                        <div role="alert" className="mb-4 rounded-xl border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
                                            {loadError}
                                        </div>
                                    )}
                                    {/* Tab 1: Inventory (Ingredients levels + Recipe links) */}
                                    {activeTab === 'inventory' && userRole !== 'cashier' && (
                                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                                            {/* Ingredients List Table */}
                                            <div className="space-y-6">
                                                <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface)]">
                                                    <table className="inventory-table">
                                                        <thead>
                                                            <tr className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))]">
                                                                <th>Ingredient</th>
                                                                <th>Unit</th>
                                                                <th className="right">On hand</th>
                                                                <th>Level</th>
                                                                <th className="right">Reorder safety</th>
                                                                <th className="right">Adjust</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ingredients.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={6} className="text-center text-[var(--muted)]">
                                                                        No ingredients registered yet. Add the first stock item below.
                                                                    </td>
                                                                </tr>
                                                            ) : ingredients.map(ing => {
                                                                const pct = getStockPercentage(ing);
                                                                const levelClass = getLevelClass(ing);
                                                                const isSelected = selectedIngredientId === ing.id;
                                                                return (
                                                                    <tr
                                                                        key={ing.id}
                                                                        onClick={() => setSelectedIngredientId(ing.id)}
                                                                        className={`hover:bg-[var(--fg-soft)] border-b border-[var(--border)] cursor-pointer ${
                                                                            isSelected ? 'bg-[var(--accent-soft)] font-bold' : ''
                                                                        }`}
                                                                    >
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
                                                                            {userRole === 'barista' ? (
                                                                                <span className="text-[var(--muted)] text-xs font-bold">—</span>
                                                                            ) : adjustingId === ing.id ? (
                                                                                <div className="flex items-center gap-1 justify-end">
                                                                                    <input
                                                                                        aria-label={`Adjustment amount for ${ing.name}`}
                                                                                        type="number"
                                                                                        onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                                                                                        className="w-16 bg-[var(--bg)] border border-[var(--border)] rounded p-1 text-xs text-center font-bold"
                                                                                        placeholder="Qty +/-"
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => handleQuickStockAdjust(ing.id)}
                                                                                        className="btn-primary border px-2.5 py-1.5 rounded text-[10px] transition-all cursor-pointer"
                                                                                    >
                                                                                        Apply
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => { setAdjustingId(null); setAdjustAmount(0); }}
                                                                                        className="btn-secondary border px-2.5 py-1.5 rounded text-[10px] transition-all cursor-pointer"
                                                                                    >
                                                                                        Cancel
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => setAdjustingId(ing.id)}
                                                                                    className="btn-secondary px-2.5 py-1.5 rounded border text-[10px] cursor-pointer transition-all"
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
                                                    {ingError && <p role="alert" className="text-[var(--danger)] text-xs font-semibold">{ingError}</p>}

                                                    <form onSubmit={handleAddIngredient} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                                                        <div className="space-y-1">
                                                            <label htmlFor="ingredient-name" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Name</label>
                                                            <input
                                                                id="ingredient-name"
                                                                type="text"
                                                                value={ingName}
                                                                onChange={(e) => setIngName(e.target.value)}
                                                                required
                                                                disabled={userRole === 'barista'}
                                                                placeholder={userRole === 'barista' ? 'Read-only' : 'e.g. Condensed milk'}
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs disabled:opacity-50"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label htmlFor="ingredient-stock" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Stock</label>
                                                            <input
                                                                id="ingredient-stock"
                                                                type="number"
                                                                value={ingStock || ''}
                                                                onChange={(e) => setIngStock(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                required
                                                                disabled={userRole === 'barista'}
                                                                placeholder="0"
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs disabled:opacity-50"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label htmlFor="ingredient-unit" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Unit</label>
                                                            <select
                                                                id="ingredient-unit"
                                                                value={ingUnit}
                                                                onChange={(e) => setIngUnit(e.target.value as Ingredient['unit'])}
                                                                disabled={userRole === 'barista'}
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs disabled:opacity-50"
                                                            >
                                                                <option value="g">Grams (g)</option>
                                                                <option value="ml">Milliliters (ml)</option>
                                                                <option value="unit">Units (pcs)</option>
                                                                <option value="kg">Kilograms (kg)</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label htmlFor="ingredient-threshold" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Reorder point</label>
                                                            <input
                                                                id="ingredient-threshold"
                                                                type="number"
                                                                value={ingThreshold || ''}
                                                                onChange={(e) => setIngThreshold(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                required
                                                                disabled={userRole === 'barista'}
                                                                placeholder="0"
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs disabled:opacity-50"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label htmlFor="ingredient-max-capacity" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Max capacity</label>
                                                            <input
                                                                id="ingredient-max-capacity"
                                                                type="number"
                                                                value={ingMaxCapacity || ''}
                                                                onChange={(e) => setIngMaxCapacity(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                disabled={userRole === 'barista'}
                                                                placeholder="Optional"
                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs disabled:opacity-50"
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={userRole === 'barista'}
                                                            className="btn-primary py-2.5 border rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {userRole === 'barista' ? 'Read-only access' : 'Add Ingredient'}
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>

                                            {/* Right Column: Recipe links (from prototype) */}
                                                                            <aside className="border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--surface)] flex flex-col justify-between min-h-[480px]">
                                                                                <div className="space-y-4">
                                                                                    <div>
                                                                                        <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-[10px] font-extrabold">Decomposition</p>
                                                                                        <h2 className="text-2xl font-display font-bold text-[var(--fg)]">Recipe links</h2>
                                                                                        <p className="text-[var(--muted)] text-xs mt-1">Tap an ingredient on the left to see which menu recipes depend on it.</p>
                                                                                    </div>

                                                                                    {selectedIngredientId && ingredients.find(i => i.id === selectedIngredientId) ? (() => {
                                                                                        const ing = ingredients.find(i => i.id === selectedIngredientId)!;
                                                                                        const dependentProducts = products.filter(p =>
                                                                                            p.recipe && p.recipe.some(r => r.ingredient_id === ing.id)
                                                                                        );
                                                                                        return (
                                                                                            <div className="space-y-3">
                                                                                                <div className="border border-[var(--border)] rounded-xl p-4 bg-[color-mix(in_oklch,var(--accent)_6%,var(--surface))]">
                                                                                                    <span className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-wider font-extrabold">Selected Stock Item</span>
                                                                                                    <h3 className="font-display font-bold text-base text-[var(--fg)] mt-1">{ing.name}</h3>
                                                                                                    <div className="grid grid-cols-3 gap-1.5 mt-3 text-xs">
                                                                                                        <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)] min-w-0">
                                                                                                            <span className="block text-[8px] text-[var(--muted)] uppercase font-extrabold truncate">Current Stock</span>
                                                                                                            <strong className="num text-xs sm:text-sm text-[var(--fg)] truncate block">{ing.stock} {ing.unit}</strong>
                                                                                                        </div>
                                                                                                        <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)] min-w-0">
                                                                                                            <span className="block text-[8px] text-[var(--muted)] uppercase font-extrabold truncate">Min Level</span>
                                                                                                            <strong className="num text-xs sm:text-sm text-[var(--fg)] truncate block">{ing.min_threshold} {ing.unit}</strong>
                                                                                                        </div>
                                                                                                        <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)] min-w-0">
                                                                                                            <span className="block text-[8px] text-[var(--muted)] uppercase font-extrabold truncate">Max Cap</span>
                                                                                                            <strong className="num text-xs sm:text-sm text-[var(--fg)] truncate block">{ing.max_capacity !== undefined ? `${ing.max_capacity} ${ing.unit}` : 'Not Set'}</strong>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>

                                                                                                <div className="space-y-2">
                                                                                                    <h4 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider font-extrabold px-1">Dependent Menu Recipes ({dependentProducts.length})</h4>
                                                                                                    {dependentProducts.length === 0 ? (
                                                                                                        <p className="text-[var(--muted)] text-xs italic p-3 text-center border border-dashed border-[var(--border)] rounded-xl">No menu recipes currently use {ing.name}.</p>
                                                                                                    ) : (
                                                                                                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                                                                                                            {dependentProducts.map(p => {
                                                                                                                const rItem = p.recipe?.find(r => r.ingredient_id === ing.id);
                                                                                                                return (
                                                                                                                    <div key={p.id} className="border border-[var(--border)] rounded-xl p-3 bg-[var(--surface)] hover:border-[var(--accent)] transition-all flex justify-between items-center">
                                                                                                                        <div className="min-w-0">
                                                                                                                            <strong className="block text-xs text-[var(--fg)] truncate">{p.name}</strong>
                                                                                                                            <span className="text-[9px] text-[var(--muted)] uppercase font-bold">{p.category}</span>
                                                                                                                        </div>
                                                                                                                        <div className="text-right shrink-0">
                                                                                                                            <strong className="num text-xs text-[var(--accent)]">{rItem?.quantity} {ing.unit}</strong>
                                                                                                                            <span className="block text-[9px] text-[var(--muted)]">per unit</span>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                );
                                                                                                            })}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })() : (
                                                                                        <div className="border border-dashed border-[var(--border)] rounded-xl p-8 text-center text-[var(--muted)] text-xs flex flex-col items-center justify-center gap-2">
                                                                                            <span>👉</span>
                                                                                            <span>Tap an ingredient in the table to display raw stock details and linked menu recipes.</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                <button
                                                                                    onClick={() => setActiveTab('po')}
                                                                                    className="btn-primary w-full min-h-[46px] border text-xs rounded-xl transition-all cursor-pointer mt-6"
                                                                                >
                                                                                    Prepare purchase order
                                                                                </button>
                                                                            </aside>
                                        </div>
                                    )}

                                    {/* Tab 2: PO Tracker */}
                                    {activeTab === 'po' && userRole !== 'cashier' && (
                                        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                                            {/* PO Builder Form */}
                                            <div className="border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--surface)] space-y-4">
                                                <h3 className="font-display font-bold text-base text-[var(--fg)]">Create supplier order</h3>
                                                {poError && <p role="alert" className="text-[var(--danger)] text-xs">{poError}</p>}

                                                <form onSubmit={handleCreatePO} className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label htmlFor="supplier-name" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Supplier Name</label>
                                                        <input
                                                            id="supplier-name"
                                                            type="text"
                                                            value={poSupplier}
                                                            onChange={(e) => setPoSupplier(e.target.value)}
                                                            required
                                                            placeholder="Supplier name"
                                                            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs"
                                                        />
                                                    </div>

                                                    <div className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))] p-3.5 rounded-xl border border-[var(--border)] space-y-2 text-xs">
                                                        <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.06em]">Order Item</div>
                                                        <select
                                                            aria-label="Ingredient for supplier order"
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
                                                                aria-label="Order quantity"
                                                                type="number"
                                                                value={selectedIngQty || ''}
                                                                onChange={(e) => setSelectedIngQty(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                placeholder="Quantity"
                                                                className="px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs"
                                                            />
                                                            <input
                                                                aria-label="Cost per unit"
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
                                                            className="btn-secondary w-full py-2 border rounded-lg text-[10px] cursor-pointer transition-all"
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
                                                        className="btn-primary w-full py-3 border rounded-xl text-xs transition-all cursor-pointer"
                                                    >
                                                        Submit Supplier PO
                                                    </button>
                                                </form>
                                            </div>

                                            {/* PO Active Listings */}
                                            <div className="space-y-4">
                                                {purchaseOrders.length === 0 ? (
                                                    <div className="min-h-[220px] border border-[var(--border)] rounded-[var(--radius)] p-6 bg-[var(--surface)] flex flex-col items-center justify-center text-center gap-2">
                                                        <strong className="text-[var(--fg)]">No supplier orders yet</strong>
                                                        <span className="text-sm text-[var(--muted)]">Create a supplier order when stock needs replenishment.</span>
                                                    </div>
                                                ) : purchaseOrders.map(po => (
                                                    <div key={po.id} className="border border-[var(--border)] rounded-[var(--radius)] p-4 bg-[var(--surface)] space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <strong className="text-sm text-[var(--fg)] block">PO ID: {po.id.toUpperCase()}</strong>
                                                                <span className="text-[10px] text-[var(--muted)] mt-0.5 block">Supplier: {po.supplier_name} | Placed: {new Date(po.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                                                po.status === 'received' ? 'bg-[color-mix(in_oklch,var(--ok)_10%,var(--surface))] border-[color-mix(in_oklch,var(--ok)_28%,var(--border))] text-[var(--ok)]' : po.status === 'cancelled' ? 'bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] text-[var(--danger)]' : 'bg-[color-mix(in_oklch,var(--warn)_10%,var(--surface))] border-[color-mix(in_oklch,var(--warn)_28%,var(--border))] text-[color-mix(in_oklch,var(--warn)_72%,var(--fg))]'
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
                                                                        className="btn-danger px-2.5 py-1.5 border rounded-lg text-[10px] cursor-pointer transition-all"
                                                                    >
                                                                        Cancel PO
                                                                    </button>
                                                                    <button
                                                                        onClick={() => updatePOStatus(po.id, 'received')}
                                                                        className="btn-primary px-2.5 py-1.5 border rounded-lg text-[10px] cursor-pointer transition-all"
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

                                    {/* Tab 4: Manage Menu */}
                                    {activeTab === 'items' && userRole !== 'cashier' && (
                                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
                                            {/* Products Selection list */}
                                            <div className="space-y-4">
                                                {/* Search & Categories Bar */}
                                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Search menu products..."
                                                        value={menuSearchQuery}
                                                        onChange={(e) => setMenuSearchQuery(e.target.value)}
                                                        className="min-h-[40px] px-3.5 border border-[var(--border)] bg-[var(--bg)] rounded-xl text-xs font-bold focus:outline-none focus:border-[var(--accent)] w-full"
                                                    />
                                                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                                                        {['All items', 'Hot Coffee', 'Iced Coffee (Classic)', 'Iced Coffee (Premium)', 'Non-Coffee', 'Berries Series', 'Pastries'].map(cat => (
                                                            <button
                                                                key={cat}
                                                                type="button"
                                                                onClick={() => setMenuActiveCategory(cat)}
                                                                className={`min-h-[40px] px-3 border rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                                                                    menuActiveCategory === cat
                                                                        ? 'btn-primary'
                                                                        : 'btn-secondary'
                                                                }`}
                                                            >
                                                                {cat === 'All items' ? 'All' : cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="border border-[var(--border)] rounded-[var(--radius)] overflow-x-auto bg-[var(--surface)]">
                                                    <table className="inventory-table">
                                                        <thead>
                                                            <tr className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))]">
                                                                <th>Item Name</th>
                                                                <th>Category</th>
                                                                <th className="right">Base Price</th>
                                                                <th>Stock Tracked</th>
                                                                <th className="right">Stock</th>
                                                                <th>Recipe Ingredients</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {products.filter(p => {
                                                                const matchesSearch = p.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                                                                                      p.category.toLowerCase().includes(menuSearchQuery.toLowerCase());
                                                                const matchesCategory = menuActiveCategory === 'All items' || p.category === menuActiveCategory;
                                                                return matchesSearch && matchesCategory;
                                                            }).length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={6} className="text-center text-[var(--muted)] py-6">
                                                                        No menu items match your search or filter.
                                                                    </td>
                                                                </tr>
                                                            ) : products.filter(p => {
                                                                const matchesSearch = p.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                                                                                      p.category.toLowerCase().includes(menuSearchQuery.toLowerCase());
                                                                const matchesCategory = menuActiveCategory === 'All items' || p.category === menuActiveCategory;
                                                                return matchesSearch && matchesCategory;
                                                            }).map(p => {
                                                                const isSelected = selectedProductId === p.id;
                                                                return (
                                                                    <tr
                                                                        key={p.id}
                                                                        onClick={() => {
                                                                            setSelectedProductId(p.id);
                                                                            setEditName(p.name);
                                                                            setEditPrice(p.price);
                                                                            setEditTrackStock(p.track_stock);
                                                                            setEditStock(p.stock || 0);
                                                                            setEditRecipe(p.recipe || []);
                                                                            setEditError('');
                                                                            setEditSuccess('');
                                                                        }}
                                                                        className={`hover:bg-[var(--fg-soft)] border-b border-[var(--border)] cursor-pointer ${
                                                                            isSelected ? 'bg-[var(--accent-soft)] font-bold' : ''
                                                                        }`}
                                                                    >
                                                                        <td>
                                                                            <strong className="block text-[var(--fg)]">{p.name}</strong>
                                                                            {p.sku && <span className="text-[9px] text-[var(--muted)] font-mono uppercase font-bold">{p.sku}</span>}
                                                                        </td>
                                                                        <td>
                                                                            <span className="inline-block border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">{p.category}</span>
                                                                        </td>
                                                                        <td className="right num font-extrabold text-[var(--fg)]">
                                                                            {formatCurrency(p.price)}
                                                                        </td>
                                                                        <td>
                                                                            {p.track_stock ? (
                                                                                <span className="text-[var(--ok)] text-[10px] font-bold">Yes</span>
                                                                            ) : (
                                                                                <span className="text-[var(--muted)] text-[10px] font-bold">No</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="right num font-bold text-[var(--fg)]">
                                                                            {p.track_stock ? (p.stock ?? 0) : '—'}
                                                                        </td>
                                                                        <td className="text-[10px] max-w-[200px] truncate text-[var(--muted)] font-medium">
                                                                            {p.recipe && p.recipe.length > 0 ? (
                                                                                p.recipe.map(r => {
                                                                                    const ing = ingredients.find(i => i.id === r.ingredient_id);
                                                                                    return `${ing?.name || 'ing'}: ${r.quantity}${ing?.unit || 'g'}`;
                                                                                }).join(', ')
                                                                            ) : (
                                                                                <em className="text-[var(--muted)]/60">No recipe linked</em>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Right Column: Edit product details */}
                                            <div className={selectedProductId ? 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 xl:relative xl:inset-auto xl:bg-transparent xl:backdrop-blur-none xl:z-0 xl:p-0 xl:block' : 'hidden xl:block'}>
                                                <aside className="bg-[var(--surface)] rounded-[20px] w-full max-w-lg border border-[var(--border)] shadow-[var(--shadow)] overflow-y-auto max-h-[90vh] xl:max-h-none xl:overflow-visible xl:rounded-[var(--radius)] xl:max-w-none xl:shadow-none h-full flex flex-col justify-between p-6 no-scrollbar">
                                                    {selectedProductId && products.find(p => p.id === selectedProductId) ? (() => {
                                                        const prod = products.find(p => p.id === selectedProductId)!;
                                                        return (
                                                            <form onSubmit={async (e) => {
                                                                e.preventDefault();
                                                                setEditError('');
                                                                setEditSuccess('');
                                                                try {
                                                                    const res = await fetch(`/api/products/${selectedProductId}`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            name: editName,
                                                                            price: editPrice,
                                                                            track_stock: editTrackStock,
                                                                            stock: editTrackStock ? editStock : null,
                                                                            recipe: editRecipe
                                                                        })
                                                                    });
                                                                    const data = await res.json();
                                                                    if (res.ok && data.success) {
                                                                        setEditSuccess('Changes saved successfully!');
                                                                        setProducts(prev => prev.map(p => p.id === selectedProductId ? data.product : p));
                                                                    } else {
                                                                        setEditError(data.error || 'Failed to update product.');
                                                                    }
                                                                } catch {
                                                                    setEditError('Network error trying to update product.');
                                                                }
                                                            }} className="space-y-4 h-full flex flex-col justify-between">
                                                                <div className="space-y-4">
                                                                    <div className="flex justify-between items-start gap-4">
                                                                        <div>
                                                                            <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-[10px] font-extrabold">Product Editor</p>
                                                                            <h2 className="text-2xl font-display font-bold text-[var(--fg)] mt-0.5">{prod.name}</h2>
                                                                            <p className="text-[var(--muted)] text-xs mt-1">Configure item properties, stock tracking, and raw ingredient decomposition.</p>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedProductId(null)}
                                                                            className="btn-secondary w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer text-xs shrink-0"
                                                                            aria-label="Close editor"
                                                                        >
                                                                            x
                                                                        </button>
                                                                    </div>

                                                                    {editSuccess && (
                                                                        <div role="alert" className="p-3 bg-[color-mix(in_oklch,var(--ok)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--ok)_24%,var(--border))] rounded-xl text-xs text-[var(--ok)] font-semibold text-center">
                                                                            {editSuccess}
                                                                        </div>
                                                                    )}
                                                                    {editError && (
                                                                        <div role="alert" className="p-3 bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] rounded-xl text-xs text-[var(--danger)] font-semibold text-center">
                                                                            {editError}
                                                                        </div>
                                                                    )}

                                                                    <div className="space-y-3">
                                                                        <div className="space-y-1">
                                                                            <label htmlFor="edit-name" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Display Name</label>
                                                                            <input
                                                                                id="edit-name"
                                                                                type="text"
                                                                                value={editName}
                                                                                onChange={(e) => setEditName(e.target.value)}
                                                                                required
                                                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-bold"
                                                                            />
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div className="space-y-1">
                                                                                <label htmlFor="edit-price" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Base Price (PHP)</label>
                                                                                <input
                                                                                    id="edit-price"
                                                                                    type="number"
                                                                                    value={editPrice || ''}
                                                                                    onChange={(e) => setEditPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                                    required
                                                                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-bold"
                                                                                />
                                                                            </div>

                                                                            <div className="space-y-1">
                                                                                <label htmlFor="edit-stock" className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Stock count</label>
                                                                                <input
                                                                                    id="edit-stock"
                                                                                    type="number"
                                                                                    disabled={!editTrackStock}
                                                                                    value={editTrackStock ? editStock : ''}
                                                                                    onChange={(e) => setEditStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                                                    placeholder="N/A"
                                                                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-bold disabled:opacity-40"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <label className="flex items-center gap-2 py-1 px-1 cursor-pointer select-none">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={editTrackStock}
                                                                                onChange={(e) => {
                                                                                    setEditTrackStock(e.target.checked);
                                                                                    if (!e.target.checked) setEditStock(0);
                                                                                }}
                                                                                className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                                                                            />
                                                                            <span className="text-[11px] font-bold text-[var(--fg)]">Track finished stock directly (e.g. pastries)</span>
                                                                        </label>
                                                                    </div>

                                                                    {/* Recipe Editor section */}
                                                                    <div className="space-y-2.5 border-t border-[var(--border)] pt-4">
                                                                        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.06em]">Recipe Decomposition</span>

                                                                        {/* Ingredients List */}
                                                                        {editRecipe.length === 0 ? (
                                                                            <p className="text-[var(--muted)] text-[11px] italic p-3 text-center border border-dashed border-[var(--border)] rounded-xl bg-[var(--bg)]">No raw stock ingredients linked to this product.</p>
                                                                        ) : (
                                                                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                                                                                {editRecipe.map((recipeItem, idx) => {
                                                                                    const ing = ingredients.find(i => i.id === recipeItem.ingredient_id);
                                                                                    return (
                                                                                        <div key={idx} className="flex justify-between items-center text-xs bg-[var(--bg)] px-2.5 py-2 rounded-xl border border-[var(--border)]">
                                                                                            <span>{ing?.name || 'Unknown'} - <strong className="num text-[var(--fg)]">{recipeItem.quantity} {ing?.unit || 'g'}</strong></span>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setEditRecipe(prev => prev.filter(r => r.ingredient_id !== recipeItem.ingredient_id))}
                                                                                                className="text-[var(--danger)] hover:text-red-700 font-extrabold cursor-pointer text-xs"
                                                                                            >
                                                                                                Remove
                                                                                            </button>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}

                                                                        {/* Add ingredient Row */}
                                                                        <div className="bg-[color-mix(in_oklch,var(--fg)_3%,var(--surface))] p-3 rounded-xl border border-[var(--border)] space-y-2 text-xs">
                                                                            <div className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.06em]">Add Ingredient Item</div>
                                                                            <select
                                                                                aria-label="Add ingredient to recipe"
                                                                                value={recipeIngId}
                                                                                onChange={(e) => setRecipeIngId(e.target.value)}
                                                                                className="w-full px-2 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs"
                                                                            >
                                                                                <option value="">-- Select Ingredient --</option>
                                                                                {ingredients.map(i => (
                                                                                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                                                                ))}
                                                                            </select>
                                                                            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                                                                <input
                                                                                    aria-label="Recipe ingredient quantity"
                                                                                    type="number"
                                                                                    value={recipeIngQty || ''}
                                                                                    onChange={(e) => setRecipeIngQty(Math.max(0, parseFloat(e.target.value) || 0))}
                                                                                    placeholder="Quantity (e.g. 18)"
                                                                                    className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (!recipeIngId || recipeIngQty <= 0) return;
                                                                                        if (editRecipe.some(r => r.ingredient_id === recipeIngId)) {
                                                                                            setEditError('Ingredient already added to recipe.');
                                                                                            return;
                                                                                        }
                                                                                        setEditRecipe([...editRecipe, { ingredient_id: recipeIngId, quantity: recipeIngQty }]);
                                                                                        setRecipeIngId('');
                                                                                        setRecipeIngQty(0);
                                                                                        setEditError('');
                                                                                    }}
                                                                                    className="btn-secondary py-1.5 px-3 border rounded-lg text-[10px] cursor-pointer transition-all"
                                                                                >
                                                                                    + Add
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    type="submit"
                                                                    className="btn-primary w-full min-h-[46px] border text-xs rounded-xl transition-all cursor-pointer mt-6"
                                                                >
                                                                    Save Product Details
                                                                </button>
                                                            </form>
                                                        );
                                                    })() : (
                                                        <div className="border border-dashed border-[var(--border)] rounded-xl p-8 text-center text-[var(--muted)] text-xs flex flex-col items-center justify-center gap-2 h-full my-auto">
                                                            <span>📋</span>
                                                            <span>Select a product from the list to modify its details, stock level, or recipe ingredients.</span>
                                                        </div>
                                                    )}
                                                </aside>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 3: Sales Reports */}
                                    {activeTab === 'reports' && userRole !== 'barista' && (
                                        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6 items-start">
                                            {/* Left Side Panel: Past Days Selection */}
                                            <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-4 space-y-3 shrink-0">
                                                <div>
                                                    <h4 className="text-[11px] font-mono text-[var(--accent)] uppercase tracking-wider font-extrabold">Day Selector</h4>
                                                    <p className="text-[10px] text-[var(--muted)] mt-0.5">Tap a day to view its summary instantly.</p>
                                                </div>
                                                <div className="flex flex-col gap-1.5 max-h-[440px] overflow-y-auto no-scrollbar pr-0.5">
                                                    {(() => {
                                                        const days = [];
                                                        for (let i = 0; i < 7; i++) {
                                                            const d = new Date();
                                                            d.setDate(d.getDate() - i);
                                                            days.push(d.toISOString().substring(0, 10));
                                                        }
                                                        return days.map((dateStr, idx) => {
                                                            const dayOrders = completedOrders.filter(o => o.created_at.substring(0, 10) === dateStr);
                                                            const dayTotal = dayOrders.reduce((sum, o) => sum + o.total, 0);
                                                            const isSelected = startDate === dateStr && endDate === dateStr;

                                                            const dateObj = new Date(dateStr);
                                                            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                                            const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                                            let label = `${weekday}, ${monthDay}`;
                                                            if (idx === 0) label = `Today (${weekday})`;
                                                            if (idx === 1) label = `Yesterday (${weekday})`;

                                                            return (
                                                                <button
                                                                    key={dateStr}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setStartDate(dateStr);
                                                                        setEndDate(dateStr);
                                                                    }}
                                                                    className={`w-full p-2.5 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer select-none ${
                                                                        isSelected
                                                                            ? 'btn-primary font-bold'
                                                                            : 'btn-secondary'
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0">
                                                                        <span className={`block text-xs ${isSelected ? 'text-white' : 'text-[var(--fg)] font-semibold'}`}>{label}</span>
                                                                        <span className={`text-[9px] ${isSelected ? 'text-white/80' : 'text-[var(--muted)] font-mono'}`}>{dayOrders.length} order{dayOrders.length !== 1 ? 's' : ''}</span>
                                                                    </div>
                                                                    <strong className="text-xs num shrink-0">{formatCurrency(dayTotal)}</strong>
                                                                </button>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                                {userRole === 'admin' && (
                                                    <button
                                                        type="button"
                                                        onClick={handleClearAllHistory}
                                                        className="w-full btn-danger btn-pill py-2 border text-[11px] font-bold cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-2"
                                                    >
                                                        Clear All History
                                                    </button>
                                                )}
                                            </div>

                                            {/* Right Panel: Day Sales & Analytics Breakdown */}
                                            <div className="space-y-5">
                                                {/* Header & Date Range Selectors */}
                                                <div className="flex flex-wrap gap-4 items-center justify-between border border-[var(--border)] p-4 rounded-2xl bg-[var(--surface)]">
                                                    <div>
                                                        <h3 className="font-display font-bold text-sm text-[var(--fg)]">
                                                            {startDate === endDate ? (
                                                                <>Sales summary for {new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</>
                                                            ) : (
                                                                <>Sales summary: {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                                                            )}
                                                        </h3>
                                                        <p className="text-[10px] text-[var(--muted)] mt-0.5">Detailed summary and comparative sales metrics.</p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                                        {/* Date Range Inputs */}
                                                        <div className="flex gap-1.5 items-center">
                                                            <input
                                                                aria-label="Sales history start date"
                                                                type="date"
                                                                value={startDate}
                                                                onChange={(e) => setStartDate(e.target.value)}
                                                                className="bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl font-bold"
                                                            />
                                                            <span className="text-[var(--muted)]">to</span>
                                                            <input
                                                                aria-label="Sales history end date"
                                                                type="date"
                                                                value={endDate}
                                                                onChange={(e) => setEndDate(e.target.value)}
                                                                className="bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl font-bold"
                                                            />
                                                        </div>

                                                        {/* Toggle for Analytics */}
                                                        {startDate === endDate && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowComparison(prev => !prev)}
                                                                className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold transition-all cursor-pointer ${
                                                                    showComparison
                                                                        ? 'btn-primary'
                                                                        : 'btn-secondary'
                                                                }`}
                                                            >
                                                                {showComparison ? 'Analytics On' : 'Show Analytics'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Comparison Analytics pane if enabled */}
                                                {showComparison && startDate === endDate && comparisonData && (
                                                    <div className="border border-[var(--border)] rounded-2xl bg-[color-mix(in_oklch,var(--accent)_6%,var(--surface))] p-4 space-y-4">
                                                        <div>
                                                            <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider font-extrabold">Comparative Analytics</h4>
                                                            <p className="text-[10px] text-[var(--muted)] mt-0.5">Comparing active day against yesterday ({new Date(comparisonData.prevDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}).</p>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            <div className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)] flex flex-col justify-between min-h-[90px]">
                                                                <span className="text-[9px] text-[var(--muted)] font-mono uppercase tracking-wider font-extrabold">Revenue comparison</span>
                                                                <div className="flex items-baseline justify-between mt-2">
                                                                    <strong className="text-lg num font-black text-[var(--fg)]">{formatCurrency(salesSummary.totalSales)}</strong>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${comparisonData.revenueDiff >= 0 ? 'bg-[color-mix(in_oklch,var(--ok)_12%,var(--surface))] text-[var(--ok)]' : 'bg-[color-mix(in_oklch,var(--danger)_12%,var(--surface))] text-[var(--danger)]'}`}>
                                                                        {comparisonData.revenueDiff >= 0 ? '▲' : '▼'} {Math.abs(comparisonData.revenuePct)}%
                                                                    </span>
                                                                </div>
                                                                <span className="text-[8.5px] text-[var(--muted)] mt-1 font-medium">Prev Day: {formatCurrency(comparisonData.prevRevenue)}</span>
                                                            </div>

                                                            <div className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)] flex flex-col justify-between min-h-[90px]">
                                                                <span className="text-[9px] text-[var(--muted)] font-mono uppercase tracking-wider font-extrabold">Order volume change</span>
                                                                <div className="flex items-baseline justify-between mt-2">
                                                                    <strong className="text-lg num font-black text-[var(--fg)]">{salesSummary.totalOrders} orders</strong>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${comparisonData.countDiff >= 0 ? 'bg-[color-mix(in_oklch,var(--ok)_12%,var(--surface))] text-[var(--ok)]' : 'bg-[color-mix(in_oklch,var(--danger)_12%,var(--surface))] text-[var(--danger)]'}`}>
                                                                        {comparisonData.countDiff >= 0 ? '▲' : '▼'} {Math.abs(comparisonData.countPct)}%
                                                                    </span>
                                                                </div>
                                                                <span className="text-[8.5px] text-[var(--muted)] mt-1 font-medium">Prev Day: {comparisonData.prevCount} orders</span>
                                                            </div>

                                                            <div className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)] flex flex-col justify-between min-h-[90px]">
                                                                <span className="text-[9px] text-[var(--muted)] font-mono uppercase tracking-wider font-extrabold">Avg Order Value (AOV)</span>
                                                                <div className="flex items-baseline justify-between mt-2">
                                                                    <strong className="text-lg num font-black text-[var(--fg)]">{formatCurrency(comparisonData.currentAOV)}</strong>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${comparisonData.aovDiff >= 0 ? 'bg-[color-mix(in_oklch,var(--ok)_12%,var(--surface))] text-[var(--ok)]' : 'bg-[color-mix(in_oklch,var(--danger)_12%,var(--surface))] text-[var(--danger)]'}`}>
                                                                        {comparisonData.aovDiff >= 0 ? '▲' : '▼'} {Math.abs(comparisonData.aovPct)}%
                                                                    </span>
                                                                </div>
                                                                <span className="text-[8.5px] text-[var(--muted)] mt-1 font-medium">Prev Day AOV: {formatCurrency(comparisonData.prevAOV)}</span>
                                                            </div>
                                                        </div>
                                                        {/* Comparison visual progress indicator */}
                                                        <div className="bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)] space-y-2">
                                                            <span className="text-[9px] text-[var(--muted)] font-mono uppercase tracking-wider font-extrabold">Sales Ratio Visual</span>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-[10px] text-[var(--muted)] font-bold">
                                                                    <span>Prev Day Ratio</span>
                                                                    <span className="num">{formatCurrency(comparisonData.prevRevenue)}</span>
                                                                </div>
                                                                <div className="level">
                                                                    <span style={{ width: `${Math.min(100, comparisonData.prevRevenue === 0 ? 0 : Math.round((comparisonData.prevRevenue / Math.max(salesSummary.totalSales, comparisonData.prevRevenue)) * 100))}%` }}></span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-[10px] text-[var(--muted)] font-bold">
                                                                    <span>Active Day Ratio</span>
                                                                    <span className="num">{formatCurrency(salesSummary.totalSales)}</span>
                                                                </div>
                                                                <div className="level">
                                                                    <span className="!bg-[var(--accent)]" style={{ width: `${Math.min(100, salesSummary.totalSales === 0 ? 0 : Math.round((salesSummary.totalSales / Math.max(salesSummary.totalSales, comparisonData.prevRevenue)) * 100))}%` }}></span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Metrics blocks */}
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div className="metric">
                                                        <span>Gross Revenue</span>
                                                        <strong className="num text-[var(--accent)]">{formatCurrency(salesSummary.totalSales)}</strong>
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
                                                        <strong className="num text-[var(--danger)]">{formatCurrency(salesSummary.discountsGiven)}</strong>
                                                    </div>
                                                </div>

                                                {/* Day sales breakdown table */}
                                                <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface)] space-y-3 p-4">
                                                    <div>
                                                        <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider font-extrabold">Product Sales Breakdown</h4>
                                                        <p className="text-[10px] text-[var(--muted)] mt-0.5">Quantities and totals sold per menu item.</p>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="inventory-table !text-[11px]">
                                                            <thead>
                                                                <tr className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))]">
                                                                    <th>Product Name</th>
                                                                    <th className="right">Quantity Sold</th>
                                                                    <th className="right">Total Sales</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {productBreakdown.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={3} className="text-center text-[var(--muted)] py-4 italic">
                                                                            No products sold in this period.
                                                                        </td>
                                                                    </tr>
                                                                ) : productBreakdown.map((item, idx) => (
                                                                    <tr key={idx} className="hover:bg-[var(--fg-soft)] border-b border-[var(--border)]">
                                                                        <td>
                                                                            <strong>{item.name}</strong>
                                                                        </td>
                                                                        <td className="right num font-extrabold text-[var(--fg)]">
                                                                            {item.qty}
                                                                        </td>
                                                                        <td className="right num font-black text-[var(--accent)]">
                                                                            {formatCurrency(item.total)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* Transaction History log */}
                                                <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface)] space-y-3 p-4 mt-4">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider font-extrabold">Transaction History</h4>
                                                            <p className="text-[10px] text-[var(--muted)] mt-0.5">Individual orders processed during this period.</p>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold bg-[var(--bg)] px-2 py-0.5 border border-[var(--border)] rounded-full text-[var(--muted)]">
                                                            {filteredOrdersForList.length} order{filteredOrdersForList.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
                                                        <table className="inventory-table !text-[11px]">
                                                            <thead>
                                                                <tr className="bg-[color-mix(in_oklch,var(--fg)_4%,var(--surface))]">
                                                                    <th>Order #</th>
                                                                    <th>Time</th>
                                                                    <th>Dining</th>
                                                                    <th>Payment</th>
                                                                    <th className="right">Amount</th>
                                                                    {userRole === 'admin' && <th className="right">Action</th>}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredOrdersForList.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={userRole === 'admin' ? 6 : 5} className="text-center text-[var(--muted)] py-4 italic">
                                                                            No transactions processed in this period.
                                                                        </td>
                                                                    </tr>
                                                                ) : (
                                                                    filteredOrdersForList.map((order) => (
                                                                        <tr key={order.id} className="hover:bg-[var(--fg-soft)] border-b border-[var(--border)]">
                                                                            <td>
                                                                                <strong>{order.order_number}</strong>
                                                                            </td>
                                                                            <td>
                                                                                {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                                                            </td>
                                                                            <td className="capitalize">{order.dining_option}</td>
                                                                            <td className="uppercase">{order.payment_method}</td>
                                                                            <td className="right num font-black text-[var(--accent)]">
                                                                                {formatCurrency(order.total)}
                                                                            </td>
                                                                            {userRole === 'admin' && (
                                                                                <td className="right">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleDeleteOrder(order.id, order.order_number)}
                                                                                        className="text-[var(--danger)] hover:text-red-700 font-extrabold cursor-pointer text-[10px]"
                                                                                    >
                                                                                        Delete
                                                                                    </button>
                                                                                </td>
                                                                            )}
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
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
