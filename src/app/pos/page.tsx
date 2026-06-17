'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarRail from '@/components/SidebarRail';
import { Product, Ingredient } from '@/db/schema';

interface CartItem {
    id: string; // unique item instance ID in cart
    product: Product;
    quantity: number;
    customizations: { name: string; price_impact: number }[];
    notes: string;
    finalPricePerUnit: number;
}

export default function POSPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [categories, setCategories] = useState<string[]>(['All items', 'Coffee', 'Tea', 'Pastry', 'Cold bar']);
    const [activeCategory, setActiveCategory] = useState<string>('All items');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [clock, setClock] = useState<string>('08:42');
    
    // Cart and order details
    const [cart, setCart] = useState<CartItem[]>([]);
    const [diningOption, setDiningOption] = useState<'dine-in' | 'takeout' | 'delivery'>('takeout');
    const [discountType, setDiscountType] = useState<'none' | 'flat' | 'percent'>('none');
    const [discountValue, setDiscountValue] = useState<number>(0);

    // Dialog/Modal States
    const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
    const [customSize, setCustomSize] = useState<string>('Medium');
    const [customMilk, setCustomMilk] = useState<string>('Whole Milk');
    const [customSyrups, setCustomSyrups] = useState<string[]>([]);
    const [customShots, setCustomShots] = useState<number>(0);
    const [itemNotes, setItemNotes] = useState<string>('');

    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr'>('cash');
    const [cashReceived, setCashReceived] = useState<number>(0);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    
    // Receipt Modal States
    const [completedOrder, setCompletedOrder] = useState<any | null>(null);

    // Sync clock
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setClock(now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false }));
        };
        tick();
        const interval = setInterval(tick, 10000);
        return () => clearInterval(interval);
    }, []);

    // Fetch user session, products, and ingredients
    useEffect(() => {
        const loadSessionAndData = async () => {
            try {
                const sessionRes = await fetch('/api/auth/session');
                const sessionData = await sessionRes.json();
                if (sessionRes.ok && sessionData.authenticated) {
                    setUser(sessionData.user);
                } else {
                    router.push('/login');
                    return;
                }

                const productsRes = await fetch('/api/products');
                const productsData = await productsRes.json();
                if (productsRes.ok) {
                    setProducts(productsData);
                }

                const ingRes = await fetch('/api/ingredients');
                if (ingRes.ok) {
                    const ingData = await ingRes.json();
                    setIngredients(ingData);
                }
            } catch (err) {
                console.error('Failed to load page data:', err);
            }
        };
        loadSessionAndData();
    }, [router]);

    // Cart calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.finalPricePerUnit * item.quantity), 0);
    
    let discountAmount = 0;
    if (discountType === 'flat') {
        discountAmount = discountValue;
    } else if (discountType === 'percent') {
        discountAmount = (subtotal * discountValue) / 100;
    }
    discountAmount = Math.min(subtotal, Math.max(0, discountAmount));
    
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    // Add standard 5% service fee matching prototype formula
    const serviceFee = subtotal ? Math.round(subtotal * 0.05) : 0;
    const total = taxableAmount + serviceFee;

    // Handle product tap
    const handleProductClick = (product: Product) => {
        const isDrink = ['Espresso / Hot Coffee', 'Cold Brew / Iced Coffee', 'Non-Coffee', 'Frappes'].includes(product.category);
        if (isDrink) {
            setCustomizingProduct(product);
            setCustomSize('Medium');
            setCustomMilk('Whole Milk');
            setCustomSyrups([]);
            setCustomShots(0);
            setItemNotes('');
        } else {
            addToCartDirectly(product);
        }
    };

    const addToCartDirectly = (product: Product) => {
        const existingIndex = cart.findIndex(item => item.product.id === product.id && item.customizations.length === 0);
        if (existingIndex > -1) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += 1;
            setCart(newCart);
        } else {
            setCart([...cart, {
                id: `c-item-${Date.now()}`,
                product,
                quantity: 1,
                customizations: [],
                notes: '',
                finalPricePerUnit: product.price
            }]);
        }
    };

    const handleAddCustomized = () => {
        if (!customizingProduct) return;

        const customizations: { name: string; price_impact: number }[] = [];
        let priceImpact = 0;

        if (customSize === 'Small') {
            customizations.push({ name: 'Small', price_impact: -20 });
            priceImpact -= 20;
        } else if (customSize === 'Large') {
            customizations.push({ name: 'Large', price_impact: 25 });
            priceImpact += 25;
        } else {
            customizations.push({ name: 'Medium', price_impact: 0 });
        }

        if (customMilk !== 'Whole Milk') {
            customizations.push({ name: `${customMilk}`, price_impact: 35 });
            priceImpact += 35;
        }

        customSyrups.forEach(syrup => {
            customizations.push({ name: `${syrup}`, price_impact: 20 });
            priceImpact += 20;
        });

        if (customShots > 0) {
            customizations.push({ name: `+${customShots} Shot`, price_impact: 30 * customShots });
            priceImpact += 30 * customShots;
        }

        const finalPricePerUnit = Math.max(0, customizingProduct.price + priceImpact);

        setCart([...cart, {
            id: `c-item-${Date.now()}`,
            product: customizingProduct,
            quantity: 1,
            customizations,
            notes: itemNotes,
            finalPricePerUnit
        }]);

        setCustomizingProduct(null);
    };

    const updateQuantity = (id: string, delta: number) => {
        const itemIndex = cart.findIndex(item => item.id === id);
        if (itemIndex > -1) {
            const newCart = [...cart];
            newCart[itemIndex].quantity += delta;
            if (newCart[itemIndex].quantity <= 0) {
                newCart.splice(itemIndex, 1);
            }
            setCart(newCart);
        }
    };

    const removeCartItem = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleQuickCash = (val: string) => {
        if (val === 'clear') {
            setCashReceived(0);
        } else if (val === 'exact') {
            setCashReceived(total);
        } else {
            const cashVal = parseFloat(val);
            setCashReceived(prev => prev + cashVal);
        }
    };

    const changeDue = cashReceived - total;

    const handleCheckoutSubmit = async () => {
        if (cart.length === 0) return;
        if (cashReceived < total && paymentMethod === 'cash') {
            setErrorMessage('Cash received is less than total amount due.');
            return;
        }

        setIsSubmittingOrder(true);
        setErrorMessage('');

        const orderPayload = {
            items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                customizations: item.customizations,
                notes: item.notes || undefined
            })),
            dining_option: diningOption,
            payment_method: paymentMethod,
            discount: discountAmount,
            payment_details: paymentMethod === 'cash' ? {
                amount_tendered: cashReceived,
                change_returned: Math.max(0, changeDue)
            } : undefined
        };

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });
            const data = await res.json();
            
            if (res.ok) {
                setCompletedOrder(data.order);
                setCart([]);
                setCashReceived(0);
            } else {
                setErrorMessage(data.error || 'Failed to complete order.');
            }
        } catch (err) {
            setErrorMessage('Network connection issues.');
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    // Helper to print currency
    const formatCurrency = (val: number) => {
        return 'PHP ' + Math.round(val).toLocaleString('en-PH');
    };

    // Get recipe description
    const getRecipeDescription = (product: Product) => {
        if (!product.recipe || product.recipe.length === 0) {
            return product.sku || 'Ready Item';
        }
        return product.recipe.map(r => {
            const ing = ingredients.find(i => i.id === r.ingredient_id);
            return `${r.quantity}${ing?.unit || 'g'} ${ing?.name || 'ing'}`;
        }).join(' - ');
    };

    // Get stock levels description
    const getStockDescription = (product: Product) => {
        if (product.track_stock) {
            return `Tray ${product.stock || 0} pcs`;
        }
        if (product.recipe && product.recipe.length > 0) {
            // Check the limiting ingredient
            const limits = product.recipe.map(r => {
                const ing = ingredients.find(i => i.id === r.ingredient_id);
                if (!ing) return '';
                const batches = Math.floor(ing.stock / r.quantity);
                return `${ing.name.split(' ')[0]} ${batches}`;
            }).filter(Boolean);
            return limits[0] ? `${limits[0]} items` : 'Stock OK';
        }
        return 'Available';
    };

    // Filter products
    const filteredProducts = products.filter(p => {
        let categoryMatch = false;
        if (activeCategory === 'All items') {
            categoryMatch = true;
        } else if (activeCategory === 'Coffee') {
            categoryMatch = p.category.includes('Coffee');
        } else if (activeCategory === 'Tea') {
            categoryMatch = p.category.includes('Tea') || p.category.includes('Matcha') || p.category.includes('Non-Coffee');
        } else if (activeCategory === 'Pastry') {
            categoryMatch = p.category.includes('Pastries') || p.category.includes('Bakery');
        } else if (activeCategory === 'Cold bar') {
            categoryMatch = p.category.includes('Cold Brew') || p.category.includes('Frappes');
        }
        
        const searchMatch = !searchQuery || 
                            p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            getRecipeDescription(p).toLowerCase().includes(searchQuery.toLowerCase());
        
        return categoryMatch && searchMatch;
    });

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--bg)] to-[color-mix(in_oklch,var(--surface)_82%,var(--accent-soft))] font-sans">
            <div className="w-full max-w-[1180px] min-h-[820px] bg-[var(--surface)] border border-[var(--border)] rounded-[34px] shadow-[var(--shadow)] overflow-hidden grid grid-cols-[112px_1fr]">
                {/* Left Navigation Rail */}
                <SidebarRail active="pos" userRole={user?.role} />

                {/* Right Workspace area */}
                <div className="grid grid-rows-[86px_1fr] min-width-0">
                    
                    {/* Header */}
                    <header className="border-b border-[var(--border)] p-6.5 flex items-center justify-between gap-[18px]">
                        <div>
                            <h1 className="text-3xl font-display font-bold leading-none">Order-taking</h1>
                            <p className="text-[var(--muted)] text-sm mt-1">Touch-first menu grid with instant cash calculator and auto-change.</p>
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

                    {/* POS Split view */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] min-height-0">
                        {/* Menu Catalog Grid */}
                        <div className="p-5 flex flex-col gap-4 overflow-hidden min-width-0">
                            {/* Categories Row */}
                            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar select-none">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`min-h-[54px] min-w-[126px] border border-[var(--border)] rounded-2xl bg-[var(--surface)] text-[var(--muted)] font-extrabold text-xs transition-all cursor-pointer ${
                                            activeCategory === cat ? 'text-[var(--fg)] border-[color-mix(in_oklch,var(--accent)_30%,var(--border))] bg-[var(--accent-soft)] shadow-sm' : 'hover:text-[var(--fg)]'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Search and clears */}
                            <div className="grid grid-cols-[1fr_148px] gap-3">
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search menu or ingredient"
                                    className="min-h-[58px] border border-[var(--border)] rounded-2xl p-4.5 bg-[var(--surface)] text-[var(--fg)] font-bold focus:outline-none focus:border-[var(--accent)] text-sm"
                                />
                                <button
                                    onClick={() => { setCart([]); setCashReceived(0); }}
                                    className="min-h-[58px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] font-extrabold text-sm transition-all hover:bg-[var(--fg-soft)] cursor-pointer"
                                >
                                    Clear order
                                </button>
                            </div>

                            {/* Menu cards */}
                            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 align-content-start">
                                {filteredProducts.map(product => {
                                    const outOfStock = product.track_stock && (product.stock || 0) <= 0;
                                    return (
                                        <button
                                            key={product.id}
                                            disabled={outOfStock}
                                            onClick={() => handleProductClick(product)}
                                            className={`min-h-[150px] border border-[var(--border)] rounded-[20px] bg-[var(--surface)] p-4 flex flex-col justify-between text-left transition-all active:translate-y-[1px] ${
                                                outOfStock ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[color-mix(in_oklch,var(--bg)_40%,var(--surface))] cursor-pointer'
                                            }`}
                                        >
                                            <div className="space-y-1">
                                                <strong className="block text-lg font-display text-[var(--fg)]">{product.name}</strong>
                                                <small className="text-[var(--muted)] text-xs block mt-1 leading-tight line-clamp-2">{getRecipeDescription(product)}</small>
                                            </div>
                                            <div className="flex justify-between items-center mt-3">
                                                <span className="text-[var(--accent)] font-black num text-base">{formatCurrency(product.price)}</span>
                                                <em className="border border-[var(--border)] rounded-full px-2 py-1 text-[var(--muted)] text-[10px] font-extrabold not-italic bg-[var(--bg)]">
                                                    {getStockDescription(product)}
                                                </em>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Cart Sidebar */}
                        <aside className="border-l border-[var(--border)] bg-[color-mix(in_oklch,var(--bg)_52%,var(--surface))] grid grid-rows-[auto_1fr_auto] min-height-0">
                            {/* Cart Header */}
                            <div className="p-4.5 border-b border-[var(--border)] flex justify-between items-center">
                                <div>
                                    <p className="font-mono text-[var(--accent)] uppercase tracking-wider text-[10px] font-extrabold">Register Active</p>
                                    <h2 className="text-2xl font-display font-bold text-[var(--fg)]">Current order</h2>
                                </div>
                            </div>

                            {/* Cart Item Rows */}
                            <div className="overflow-y-auto p-4.5 space-y-3.5 no-scrollbar">
                                {cart.length === 0 ? (
                                    <p className="text-[var(--muted)] py-4.5 text-center text-xs">Tap menu items to build the order.</p>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 border-b border-[var(--border)] items-center">
                                            <div>
                                                <strong className="block text-sm text-[var(--fg)]">{item.product.name}</strong>
                                                <small className="text-[var(--muted)] text-[10px] leading-tight block mt-0.5">
                                                    {item.customizations.length > 0 ? item.customizations.map(c => c.name).join(', ') : getRecipeDescription(item.product)}
                                                </small>
                                                {item.notes && <div className="text-[9px] text-[var(--accent)] italic">"{item.notes}"</div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="w-11 h-11 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] text-lg font-black text-[var(--fg)] flex items-center justify-center cursor-pointer hover:bg-[var(--fg-soft)]"
                                                >
                                                    -
                                                </button>
                                                <span className="num text-xs font-bold w-6 text-center">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="w-11 h-11 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] text-lg font-black text-[var(--fg)] flex items-center justify-center cursor-pointer hover:bg-[var(--fg-soft)]"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Cart Totals & Checkout Panel */}
                            <div className="border-t border-[var(--border)] p-4.5 bg-[var(--surface)] space-y-4">
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between text-[var(--muted)]">
                                        <span>Subtotal</span>
                                        <strong className="num text-xs font-bold text-[var(--fg)]">{formatCurrency(subtotal)}</strong>
                                    </div>
                                    <div className="flex justify-between text-[var(--muted)]">
                                        <span>Service (5%)</span>
                                        <strong className="num text-xs font-bold text-[var(--fg)]">{formatCurrency(serviceFee)}</strong>
                                    </div>
                                    <div className="flex justify-between grand text-lg font-black text-[var(--fg)] pt-1 border-t border-[var(--border)] border-dashed">
                                        <span>Total</span>
                                        <strong className="num text-lg font-black">{formatCurrency(total)}</strong>
                                    </div>
                                </div>

                                {/* Errors if any */}
                                {errorMessage && (
                                    <div className="text-red-600 text-[10px] font-semibold bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-center">
                                        {errorMessage}
                                    </div>
                                )}

                                {/* Cash flow selectors */}
                                <div className="space-y-3.5 border-t border-[var(--border)] pt-3.5">
                                    <div className="min-h-[58px] border border-[var(--border)] rounded-2xl flex items-center justify-between px-3.5 bg-[var(--surface)]">
                                        <span className="text-xs text-[var(--muted)] font-bold">Cash received</span>
                                        <strong className="num text-xl font-bold">{formatCurrency(cashReceived)}</strong>
                                    </div>

                                    {/* Numeric cash buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {['100', '200', '500', '1000'].map(val => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => handleQuickCash(val)}
                                                className="min-h-[54px] border border-[var(--border)] rounded-[15px] bg-[var(--surface)] text-[var(--fg)] font-black text-xs cursor-pointer hover:bg-[var(--fg-soft)]"
                                            >
                                                {val}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => handleQuickCash('exact')}
                                            className="min-h-[54px] border border-[var(--border)] rounded-[15px] bg-[var(--surface)] text-[var(--fg)] font-black text-xs cursor-pointer hover:bg-[var(--fg-soft)]"
                                        >
                                            Exact
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleQuickCash('clear')}
                                            className="min-h-[54px] border border-[var(--border)] rounded-[15px] bg-[var(--surface)] text-[var(--fg)] font-black text-xs cursor-pointer hover:bg-[var(--fg-soft)]"
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    {/* Change readout */}
                                    <div className="min-h-[58px] border border-[var(--border)] rounded-2xl flex items-center justify-between px-3.5 bg-[var(--surface)]">
                                        <span className="text-xs text-[var(--muted)] font-bold">Change</span>
                                        <strong className={`num text-xl font-bold ${changeDue >= 0 && total > 0 ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>
                                            {changeDue >= 0 && total > 0 ? formatCurrency(changeDue) : `${formatCurrency(Math.abs(changeDue))} short`}
                                        </strong>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCheckoutSubmit}
                                    disabled={cart.length === 0 || isSubmittingOrder || (paymentMethod === 'cash' && cashReceived < total)}
                                    className="w-full min-h-[58px] rounded-2xl border border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)] text-sm font-extrabold hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    {isSubmittingOrder ? 'Processing...' : 'Send to barista queue'}
                                </button>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>

            {/* Customization Modal */}
            {customizingProduct && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg border border-[var(--border)] shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
                            <div>
                                <h3 className="font-display font-bold text-lg text-[var(--fg)]">{customizingProduct.name}</h3>
                                <p className="text-[10px] text-[var(--muted)]">Customize drink options and pricing impacts</p>
                            </div>
                            <button
                                onClick={() => setCustomizingProduct(null)}
                                className="w-8 h-8 rounded-full bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--fg)] transition-all flex items-center justify-center cursor-pointer font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] no-scrollbar">
                            {/* Size Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--fg)]/80">Select Size</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { name: 'Small', label: 'Small (8oz)', price: '-₱20.00' },
                                        { name: 'Medium', label: 'Medium (12oz)', price: 'Base' },
                                        { name: 'Large', label: 'Large (16oz)', price: '+₱25.00' }
                                    ].map((s) => (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => setCustomSize(s.name)}
                                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col gap-0.5 ${
                                                customSize === s.name
                                                    ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                                                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                                            }`}
                                        >
                                            <span className="text-xs font-bold">{s.label}</span>
                                            <span className="text-[9px] opacity-75">{s.price}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Milk Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--fg)]/80">Milk Choice</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { name: 'Whole Milk', price: 'Base' },
                                        { name: 'Oat Milk', price: '+₱35.00' },
                                        { name: 'Almond Milk', price: '+₱35.00' }
                                    ].map((m) => (
                                        <button
                                            key={m.name}
                                            type="button"
                                            onClick={() => setCustomMilk(m.name)}
                                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col gap-0.5 ${
                                                customMilk === m.name
                                                    ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                                                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                                            }`}
                                        >
                                            <span className="text-xs font-bold">{m.name}</span>
                                            <span className="text-[9px] opacity-75">{m.price}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Extra Espresso Shots */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--fg)]/80 flex justify-between">
                                    <span>Extra Espresso Shots</span>
                                    <span className="text-[10px] text-[var(--accent)] font-bold">+₱30.00 per shot</span>
                                </label>
                                <div className="flex items-center gap-3 bg-[var(--bg)] p-3 rounded-xl justify-between border border-[var(--border)]">
                                    <span className="text-xs font-bold text-[var(--fg)]">Add Espresso Shots</span>
                                    <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setCustomShots(prev => Math.max(0, prev - 1))}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--fg-soft)] rounded text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer font-bold text-sm"
                                        >
                                            -
                                        </button>
                                        <span className="text-sm font-bold w-6 text-center text-[var(--fg)]">{customShots}</span>
                                        <button
                                            type="button"
                                            onClick={() => setCustomShots(prev => Math.min(4, prev + 1))}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--fg-soft)] rounded text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer font-bold text-sm"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Order Notes */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[var(--fg)]/80" htmlFor="notes">Order Notes / Custom Requests</label>
                                <input
                                    type="text"
                                    id="notes"
                                    value={itemNotes}
                                    onChange={(e) => setItemNotes(e.target.value)}
                                    placeholder="e.g. Extra hot, Less ice, No foam"
                                    className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-all text-xs"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--border)] bg-[var(--bg)] flex gap-3">
                            <button
                                type="button"
                                onClick={() => setCustomizingProduct(null)}
                                className="flex-1 py-3 bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--fg-soft)] text-[var(--muted)] font-semibold rounded-xl text-xs transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddCustomized}
                                className="flex-1 py-3 bg-[var(--accent)] hover:opacity-90 text-[var(--surface)] font-bold rounded-xl text-xs transition-all cursor-pointer"
                            >
                                Add to Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal (Printable) */}
            {completedOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white text-black p-6 rounded-3xl w-full max-w-sm border shadow-2xl flex flex-col justify-between relative">
                        <button
                            onClick={() => setCompletedOrder(null)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 text-black/50 hover:text-black transition-all flex items-center justify-center cursor-pointer no-print font-bold"
                        >
                            ✕
                        </button>

                        {/* Printable Area */}
                        <div id="receipt-print-area" className="space-y-4 font-mono text-xs">
                            <div className="text-center space-y-1">
                                <h2 className="font-display font-bold text-lg leading-tight uppercase">TALA TABLE COFFEE</h2>
                                <p className="text-[10px] text-zinc-500">123 Brew Road, Metro Manila</p>
                            </div>

                            <div className="border-t border-b border-black border-dashed py-2 space-y-1 text-[10px]">
                                <div className="flex justify-between">
                                    <span>Date: {new Date(completedOrder.created_at).toLocaleDateString()}</span>
                                    <span>Time: {new Date(completedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Order Ref: {completedOrder.order_number}</span>
                                    <span className="capitalize">Mode: {completedOrder.dining_option}</span>
                                </div>
                                <div>Cashier ID: {completedOrder.created_by}</div>
                            </div>

                            <table className="w-full border-collapse text-[10px]">
                                <thead>
                                    <tr className="border-b border-black font-bold text-left">
                                        <th className="pb-1">Item</th>
                                        <th className="pb-1 text-center">Qty</th>
                                        <th className="pb-1 text-right">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedOrder.items.map((item: any, i: number) => (
                                        <tr key={i} className="align-top">
                                            <td className="py-1">
                                                <div>{item.name}</div>
                                                {item.customizations?.length > 0 && (
                                                    <div className="text-[8px] text-zinc-500 leading-tight">
                                                        {item.customizations.map((c: any) => c.name).join(', ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-1 text-center">{item.quantity}</td>
                                            <td className="py-1 text-right">{formatCurrency(item.price * item.quantity)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="border-t border-black border-dashed pt-2 space-y-1 text-[10px]">
                                <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(completedOrder.subtotal)}</span>
                                </div>
                                {completedOrder.discount > 0 && (
                                    <div className="flex justify-between text-zinc-600">
                                        <span>Discount Given</span>
                                        <span>-{formatCurrency(completedOrder.discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                                    <span>TOTAL</span>
                                    <span>{formatCurrency(completedOrder.total)}</span>
                                </div>
                            </div>

                            {completedOrder.payment_method === 'cash' && completedOrder.payment_details && (
                                <div className="space-y-1 text-[10px] border-t border-dashed border-zinc-300 pt-2 text-zinc-600">
                                    <div className="flex justify-between">
                                        <span>Amount Tendered</span>
                                        <span>{formatCurrency(completedOrder.payment_details.amount_tendered)}</span>
                                    </div>
                                    <div className="flex justify-between text-black font-bold">
                                        <span>Change Returned</span>
                                        <span>{formatCurrency(completedOrder.payment_details.change_returned)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="text-center pt-4 border-t border-black border-dashed space-y-1 text-[9px] text-zinc-500">
                                <p className="font-semibold">Thank you for supporting local business!</p>
                                <p>Follow us on Instagram @TalaTableCoffee</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-6 no-print">
                            <button
                                onClick={() => window.print()}
                                className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                                </svg>
                                Print Receipt
                            </button>
                            <button
                                onClick={() => setCompletedOrder(null)}
                                className="flex-1 py-3 bg-[var(--accent)] hover:opacity-90 text-[var(--surface)] font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer text-center"
                            >
                                New Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #receipt-print-area, #receipt-print-area * {
                        visibility: visible;
                    }
                    #receipt-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </main>
    );
}
