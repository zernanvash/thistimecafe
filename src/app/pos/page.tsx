'use strict';
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LockButton from '@/components/LockButton';
import BrandMark from '@/components/BrandMark';
import IdleLockout from '@/components/IdleLockout';
import { Product, Ingredient, Order } from '@/db/schema';

interface CartItem {
    id: string; // unique item instance ID in cart
    product: Product;
    quantity: number;
    customizations: { name: string; price_impact: number }[];
    notes: string;
    finalPricePerUnit: number;
}

const CATEGORY_MAP = [
    { id: 'All items', label: 'All', icon: '📋' },
    { id: 'Hot Coffee', label: 'Hot', icon: '☕' },
    { id: 'Iced Coffee (Classic)', label: 'Iced Classic', icon: '🧊' },
    { id: 'Iced Coffee (Premium)', label: 'Iced Premium', icon: '✨' },
    { id: 'Non-Coffee', label: 'Non-Coffee', icon: '🍵' },
    { id: 'Berries Series', label: 'Berries', icon: '🍓' },
    { id: 'Pastries', label: 'Pastries', icon: '🥐' }
];

export default function POSPage() {
    const router = useRouter();
    const cartItemSeq = useRef(0);
    const [products, setProducts] = useState<Product[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('All items');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [clock, setClock] = useState<string>('08:42');
    const [activeTab, setActiveTab] = useState<'menu' | 'cart'>('menu');

    // Cart and order details
    const [cart, setCart] = useState<CartItem[]>([]);
    const [diningOption, setDiningOption] = useState<'dine-in' | 'takeout' | 'delivery'>('takeout');

    const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
    // Dialog/Modal States
    const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
    const [customSize, setCustomSize] = useState<string>('Medium');
    const [customSyrups, setCustomSyrups] = useState<string[]>([]);
    const [customShots, setCustomShots] = useState<number>(0);
    const [customCream, setCustomCream] = useState<boolean>(false);
    const [itemNotes, setItemNotes] = useState<string>('');
    const [discountPercent, setDiscountPercent] = useState<number>(0);

    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr'>('cash');
    const [cashReceived, setCashReceived] = useState<number>(0);
    const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
    const [catalogError, setCatalogError] = useState<string>('');
    const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Sale confirmation state
    const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

    const createCartItemId = () => {
        cartItemSeq.current += 1;
        return `c-item-${cartItemSeq.current}`;
    };

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
                } else {
                    setCatalogError(productsData.error || 'Menu could not be loaded.');
                }

                const ingRes = await fetch('/api/ingredients');
                if (ingRes.ok) {
                    const ingData = await ingRes.json();
                    setIngredients(ingData);
                }
            } catch (err) {
                console.error('Failed to load page data:', err);
                setCatalogError('Connection issue while loading the register menu.');
            } finally {
                setIsCatalogLoading(false);
            }
        };
        loadSessionAndData();
    }, [router]);

    // Cart calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.finalPricePerUnit * item.quantity), 0);

    const discountAmount = Math.round(subtotal * (discountPercent / 100));

    const total = Math.max(0, subtotal - discountAmount);
    // 8% Standard Tax breakdown matching store configuration
    const tax = Math.round(total * 0.08 * 100) / 100;

    // Handle product tap
    const handleProductClick = (product: Product) => {
        setCustomizingProduct(product);
        if (product.category === 'Pastries') {
            setCustomSize('Single');
        } else if (product.category === 'Hot Coffee') {
            setCustomSize('8oz');
        } else {
            setCustomSize('16oz');
        }
        setCustomSyrups([]);
        setCustomShots(0);
        setCustomCream(false);
        setItemNotes('');
    };

    const handleAddCustomized = () => {
        if (!customizingProduct) return;

        const customizations: { name: string; price_impact: number }[] = [];
        let priceImpact = 0;

        if (customizingProduct.category === 'Pastries') {
            if (customSize === 'Pack of 6') {
                const diff = customizingProduct.name.includes('Classic') ? 105 : 115;
                customizations.push({ name: 'Pack of 6', price_impact: diff });
                priceImpact = diff;
            } else {
                customizations.push({ name: 'Single Piece', price_impact: 0 });
            }
        } else if (customizingProduct.category === 'Hot Coffee') {
            customizations.push({ name: '8oz', price_impact: 0 });
        } else {
            // Iced Coffee, Non-Coffee, Berries Series
            if (customSize === '22oz') {
                let diff = 20;
                const name = customizingProduct.name;
                if (name.includes('Mocha Latte\'') && customizingProduct.category.includes('Classic')) {
                    diff = 30;
                } else if (name.includes('Seasalt Latte\'') && customizingProduct.category.includes('Classic')) {
                    diff = 30;
                } else if (name.includes('Milo Matcha')) {
                    diff = 30;
                } else if (name.includes('Cookies & Cream Cloud')) {
                    diff = 10;
                } else if (name.includes('Blueberry Cloud')) {
                    diff = 10;
                }
                customizations.push({ name: '22oz', price_impact: diff });
                priceImpact = diff;
            } else {
                customizations.push({ name: '16oz', price_impact: 0 });
            }
        }

        if (customizingProduct.category !== 'Pastries') {
            customSyrups.forEach(syrup => {
                customizations.push({ name: syrup, price_impact: 15 });
                priceImpact += 15;
            });

            if (customShots > 0) {
                customizations.push({ name: `+${customShots} Shot`, price_impact: 39 * customShots });
                priceImpact += 39 * customShots;
            }

            if (customCream) {
                customizations.push({ name: 'Extra Cream', price_impact: 29 });
                priceImpact += 29;
            }
        }

        const finalPricePerUnit = Math.max(0, customizingProduct.price + priceImpact);

        setCart([...cart, {
            id: createCartItemId(),
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

    const handleKeypadInput = (key: string) => {
        if (key === 'C') {
            setCashReceived(0);
        } else if (key === '⌫') {
            setCashReceived(prev => {
                const str = prev.toString();
                if (str.length <= 1) return 0;
                return parseFloat(str.slice(0, -1)) || 0;
            });
        } else {
            setCashReceived(prev => {
                if (prev === 0) {
                    return parseFloat(key) || 0;
                }
                const str = prev.toString() + key;
                return parseFloat(str) || 0;
            });
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
                setDiscountPercent(0);
            } else {
                setErrorMessage(data.error || 'Failed to complete order.');
            }
        } catch {
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
        } else {
            categoryMatch = p.category === activeCategory;
        }

        const searchMatch = !searchQuery ||
                            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            getRecipeDescription(p).toLowerCase().includes(searchQuery.toLowerCase());

        return categoryMatch && searchMatch;
    });

    return (
        <main className="h-screen max-h-screen overflow-hidden flex items-center justify-center p-0 lg:p-2 bg-[var(--bg)] font-sans">
            <IdleLockout />
            <div className="w-full max-w-[1280px] h-full lg:h-[calc(100vh-16px)] bg-[var(--surface)] border-0 lg:border border-[var(--border)] rounded-none lg:rounded-[24px] shadow-[var(--shadow)] overflow-hidden flex flex-col">
                {/* Workspace area */}
                <div className="flex-1 grid grid-rows-[auto_1fr] min-h-0">

                    {/* Header */}
                    <header className="border-b border-[var(--border)] py-2 px-2.5 sm:py-3.5 sm:px-5 flex flex-row items-center justify-between gap-1 sm:gap-2.5">
                        <div className="flex items-center gap-1 sm:gap-2.5 min-w-0">
                            <BrandMark compact />
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-2xl font-display font-bold leading-none">Register</h1>
                                <p className="hidden sm:block text-[var(--muted)] text-xs mt-1">Build the order, take payment, and give change from one screen.</p>
                            </div>
                        </div>
                        <div className="flex gap-1 sm:gap-2 items-center justify-end">
                            <span className="hidden md:inline-flex min-h-[36px] items-center px-2.5 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-[11px] font-bold">
                                Shift active
                            </span>
                            <span className="num min-h-[36px] hidden sm:inline-flex items-center gap-1.5 px-2.5 border border-[var(--border)] rounded-full text-[var(--muted)] bg-[var(--surface)] text-[11px] font-bold">
                                {clock}
                            </span>
                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className="btn-secondary btn-pill inline-flex items-center border text-[11px] transition-all cursor-pointer px-1.5 sm:px-2.5 min-h-[36px]"
                                aria-label="Home"
                            >
                                <span>🏠</span>
                                <span className="hidden sm:inline ml-1">Home</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/admin/inventory')}
                                className="btn-secondary btn-pill inline-flex items-center border text-[11px] transition-all cursor-pointer px-1.5 sm:px-2.5 min-h-[36px]"
                                aria-label="Inventory"
                            >
                                <span>📦</span>
                                <span className="hidden sm:inline ml-1">Inventory</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/admin/inventory?tab=reports')}
                                className="btn-secondary btn-pill inline-flex items-center border text-[11px] transition-all cursor-pointer px-1.5 sm:px-2.5 min-h-[36px]"
                                aria-label="Sales history"
                            >
                                <span>📊</span>
                                <span className="hidden sm:inline ml-1">History</span>
                            </button>
                            <LockButton />
                        </div>
                    </header>

                    {/* POS Split view */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] lg:grid-cols-[80px_1fr_360px] min-h-0">
                        {/* Left Category Sidebar (hidden on mobile, vertical on lg+) */}
                        <div className="hidden lg:flex lg:flex-col gap-2.5 border-r border-[var(--border)] p-1.5 bg-[color-mix(in_oklch,var(--bg)_20%,var(--surface))] overflow-y-auto no-scrollbar select-none">
                            {CATEGORY_MAP.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full aspect-square border rounded-xl flex flex-col items-center justify-center p-1 text-center transition-all cursor-pointer leading-tight select-none ${
                                        activeCategory === cat.id
                                            ? 'btn-primary'
                                            : 'btn-secondary'
                                    }`}
                                >
                                    <span className="text-lg mb-0.5">{cat.icon}</span>
                                    <span className="text-[10px] leading-tight tracking-tight break-words">{cat.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Menu Catalog Grid */}
                        <div className={`p-3 lg:p-4 flex flex-col gap-3 overflow-hidden min-w-0 ${activeTab === 'menu' ? 'flex' : 'hidden md:flex'}`}>
                            {/* Categories Row (horizontal on mobile/tablet, hidden on lg+) */}
                            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
                                {CATEGORY_MAP.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.id)}
                                        className={`min-h-[40px] px-3.5 border rounded-xl bg-[var(--surface)] text-[var(--muted)] font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                                            activeCategory === cat.id
                                                ? 'btn-primary'
                                                : 'btn-secondary'
                                        }`}
                                    >
                                        <span>{cat.icon}</span>
                                        <span>{cat.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Search and clears */}
                            <div className="grid grid-cols-[1fr_120px] gap-2.5">
                                <input
                                    type="search"
                                    aria-label="Search menu or ingredient"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search menu or ingredient"
                                    className="min-h-[44px] border border-[var(--border)] rounded-2xl px-4 bg-[var(--surface)] text-[var(--fg)] font-bold focus:outline-none focus:border-[var(--accent)] text-xs"
                                />
                                <button
                                    onClick={() => { setCart([]); setCashReceived(0); }}
                                    className="btn-secondary min-h-[44px] rounded-2xl border text-xs transition-all cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Menu cards */}
                            <div className={`flex-1 overflow-y-auto pr-0.5 no-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 align-content-start ${cart.length > 0 ? 'pb-20 md:pb-4' : 'pb-4'}`}>
                                {isCatalogLoading ? (
                                    <div role="status" aria-live="polite" className="md:col-span-2 lg:col-span-2 xl:col-span-3 min-h-[180px] border border-[var(--border)] rounded-[20px] bg-[var(--surface)] flex flex-col items-center justify-center gap-2.5 text-[var(--muted)] text-xs font-bold">
                                        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[var(--accent)]"></div>
                                        Loading menu items
                                    </div>
                                ) : catalogError ? (
                                    <div role="alert" className="md:col-span-2 lg:col-span-2 xl:col-span-3 min-h-[180px] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] rounded-[20px] bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] flex flex-col items-center justify-center gap-1.5 text-center p-4">
                                        <strong className="text-[var(--danger)] text-sm">Menu unavailable</strong>
                                        <span className="text-[var(--muted)] text-xs">{catalogError}</span>
                                    </div>
                                ) : filteredProducts.length === 0 ? (
                                    <div className="md:col-span-2 lg:col-span-2 xl:col-span-3 min-h-[180px] border border-[var(--border)] rounded-[20px] bg-[var(--surface)] flex flex-col items-center justify-center gap-1.5 text-center p-4">
                                        <strong className="text-[var(--fg)] text-sm">No menu items found</strong>
                                        <span className="text-[var(--muted)] text-xs">Try another category or clear the search field.</span>
                                    </div>
                                ) : filteredProducts.map(product => {
                                    const outOfStock = product.track_stock && (product.stock || 0) <= 0;
                                    const isLowSupply = !outOfStock && Boolean(
                                        product.recipe?.some(r => {
                                            const ing = ingredients.find(i => i.id === r.ingredient_id);
                                            if (!ing) return false;
                                            if (ing.max_capacity && ing.max_capacity > 0) {
                                                return (ing.stock / ing.max_capacity) < 0.1;
                                            }
                                            return ing.stock <= ing.min_threshold;
                                        })
                                    );
                                    return (
                                        <button
                                            key={product.id}
                                            disabled={outOfStock}
                                            onClick={() => handleProductClick(product)}
                                            className={`h-[114px] border rounded-[18px] bg-[var(--surface)] p-3 flex flex-col justify-between text-left transition-all active:translate-y-[1px] ${
                                                outOfStock
                                                    ? 'opacity-30 cursor-not-allowed border-[var(--border)]'
                                                    : isLowSupply
                                                        ? 'border-[var(--danger)] shadow-[0_0_6px_color-mix(in_oklch,var(--danger)_15%,transparent)] btn-tile cursor-pointer'
                                                        : 'border-[var(--border)] btn-tile cursor-pointer'
                                            }`}
                                        >
                                            <div className="space-y-0.5 overflow-hidden">
                                                <strong className="block text-sm font-bold text-[var(--fg)] leading-tight line-clamp-2">{product.name}</strong>
                                                <small className="text-[var(--muted)] text-[10px] block leading-tight line-clamp-2">{getRecipeDescription(product)}</small>
                                            </div>
                                            <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-[var(--border)] border-dashed w-full min-w-0">
                                                <span className="text-[var(--accent)] font-black num text-sm truncate">{formatCurrency(product.price)}</span>
                                                <em className={`border rounded-full px-1.5 py-0.5 text-[9px] font-bold not-italic truncate max-w-[50%] ${
                                                    isLowSupply
                                                        ? 'border-[color-mix(in_oklch,var(--danger)_30%,var(--border))] text-[var(--danger)] bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] font-extrabold'
                                                        : 'border-[var(--border)] text-[var(--muted)] bg-[var(--bg)]'
                                                }`}>
                                                    {isLowSupply ? '⚠️ Low Supply' : getStockDescription(product)}
                                                </em>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Cart Sidebar */}
                        <aside className={`border-t md:border-t-0 md:border-l border-[var(--border)] bg-[color-mix(in_oklch,var(--bg)_52%,var(--surface))] flex flex-col md:grid md:grid-rows-[auto_minmax(120px,1fr)_auto] overflow-y-auto md:overflow-hidden min-h-0 ${activeTab === 'cart' ? 'flex md:grid' : 'hidden md:grid'}`}>
                            {/* Cart Header */}
                            <div className="p-3.5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface)]">
                                <div>
                                    <p className="font-mono text-[var(--accent)] uppercase tracking-[0.08em] text-[9px] font-extrabold">Current sale</p>
                                    <h2 className="text-xl font-display font-bold text-[var(--fg)]">Current order</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('menu')}
                                    className="md:hidden btn-secondary btn-pill px-3 py-1.5 border text-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>←</span>
                                    <span>Menu</span>
                                </button>
                            </div>

                            {/* Cart Item Rows */}
                            <div className="p-3.5 space-y-2.5 no-scrollbar md:overflow-y-auto flex-none md:flex-1">
                                {cart.length === 0 ? (
                                    <p className="text-[var(--muted)] py-4.5 text-center text-xs">Tap menu items to build the order.</p>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-2.5 py-2.5 border-b border-[var(--border)] items-center">
                                            <div className="min-w-0">
                                                <strong className="block text-xs font-bold text-[var(--fg)] truncate">{item.product.name}</strong>
                                                <small className="text-[var(--muted)] text-[9px] leading-tight block mt-0.5 truncate">
                                                    {item.customizations.length > 0 ? item.customizations.map(c => c.name).join(', ') : getRecipeDescription(item.product)}
                                                </small>
                                                {item.notes && <div className="text-[9px] text-[var(--accent)] italic truncate">&quot;{item.notes}&quot;</div>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="btn-key w-9 h-9 rounded-xl border text-base flex items-center justify-center cursor-pointer"
                                                >
                                                    -
                                                </button>
                                                <span className="num text-xs font-bold w-5 text-center">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="btn-key w-9 h-9 rounded-xl border text-base flex items-center justify-center cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Cart Totals & Checkout Panel */}
                            <div className="border-t border-[var(--border)] p-2.5 bg-[var(--surface)] space-y-2">
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between text-[var(--muted)] text-[10px]">
                                        <span>Subtotal</span>
                                        <strong className="num text-[10px] font-bold text-[var(--fg)]">{formatCurrency(subtotal)}</strong>
                                    </div>
                                    {discountPercent > 0 && (
                                        <div className="flex justify-between text-[var(--danger)] text-[10px]">
                                            <span>Discount ({discountPercent}%)</span>
                                            <strong className="num text-[10px] font-bold text-[var(--danger)]">-{formatCurrency(discountAmount)}</strong>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-[var(--muted)] text-[10px]">
                                        <span>VAT Tax (8%)</span>
                                        <strong className="num text-[10px] font-bold text-[var(--fg)]">{formatCurrency(tax)}</strong>
                                    </div>
                                    <div className="flex justify-between grand text-sm font-black text-[var(--fg)] pt-1 border-t border-[var(--border)] border-dashed">
                                        <span>Total</span>
                                        <strong className="num text-sm font-black">{formatCurrency(total)}</strong>
                                    </div>
                                </div>

                                {user && user.role !== 'barista' && (
                                    <div className="flex items-center justify-between gap-2">
                                        <label htmlFor="discount-select" className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-[0.06em] shrink-0">Discount</label>
                                        <select
                                            id="discount-select"
                                            value={discountPercent}
                                            onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10))}
                                            className="px-2 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-[8px] text-[10px] font-bold text-[var(--fg)] cursor-pointer focus:outline-none focus:border-[var(--accent)]"
                                        >
                                            <option value="0">No Discount</option>
                                            <option value="10">10% Off</option>
                                            <option value="20">20% Off</option>
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-1" aria-label="Dining option">
                                    {(['dine-in', 'takeout', 'delivery'] as const).map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            aria-pressed={diningOption === option}
                                            onClick={() => setDiningOption(option)}
                                            className={`min-h-[30px] rounded-[8px] border text-[9px] font-black capitalize transition-all cursor-pointer ${
                                                diningOption === option
                                                    ? 'btn-segment'
                                                    : 'btn-secondary'
                                            }`}
                                        >
                                            {option.replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>

                                <div className={`grid grid-cols-2 gap-1 ${user?.role === 'barista' ? 'opacity-40 pointer-events-none' : ''}`} aria-label="Payment method">
                                    {([
                                        ['cash', 'Cash'],
                                        ['qr', 'QR']
                                    ] as const).map(([method, label]) => (
                                        <button
                                            key={method}
                                            type="button"
                                            aria-pressed={paymentMethod === method}
                                            onClick={() => {
                                                setPaymentMethod(method);
                                                setErrorMessage('');
                                            }}
                                            className={`min-h-[30px] rounded-[8px] border text-[9px] font-black transition-all cursor-pointer ${
                                                paymentMethod === method
                                                    ? 'btn-segment'
                                                    : 'btn-secondary'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Errors if any */}
                                {errorMessage && (
                                    <div role="alert" className="text-[var(--danger)] text-[9px] font-semibold bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] px-3 py-1 rounded-xl text-center">
                                        {errorMessage}
                                    </div>
                                )}

                                {/* Cash flow selectors */}
                                {paymentMethod === 'cash' ? (
                                <div className="space-y-1.5 border-t border-[var(--border)] pt-1.5">
                                    <div className="min-h-[36px] border border-[var(--border)] rounded-lg flex items-center justify-between px-2.5 bg-[var(--surface)] focus-within:border-[var(--accent)] transition-all">
                                        <label htmlFor="cash-received" className="text-[10px] text-[var(--muted)] font-bold">Cash received</label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[9px] text-[var(--muted)] font-bold">PHP</span>
                                            <input
                                                id="cash-received"
                                                type="number"
                                                value={cashReceived === 0 ? '' : cashReceived}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    setCashReceived(isNaN(val) ? 0 : val);
                                                }}
                                                placeholder="0"
                                                className="num text-base font-bold bg-transparent text-right outline-none w-20 text-[var(--fg)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>

                                    {/* 3-column manual numeric keypad */}
                                    <div className="grid grid-cols-3 gap-1">
                                        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(num => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => handleKeypadInput(num)}
                                                className="btn-key min-h-[32px] border rounded-[8px] text-xs cursor-pointer transition-all flex items-center justify-center"
                                            >
                                                {num}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => handleKeypadInput('C')}
                                            className="btn-danger min-h-[32px] border rounded-[8px] text-xs cursor-pointer transition-all flex items-center justify-center"
                                        >
                                            C
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleKeypadInput('0')}
                                            className="btn-key min-h-[32px] border rounded-[8px] text-xs cursor-pointer transition-all flex items-center justify-center"
                                        >
                                            0
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleKeypadInput('⌫')}
                                            aria-label="Delete last cash digit"
                                            className="btn-key min-h-[32px] border rounded-[8px] text-xs cursor-pointer transition-all flex items-center justify-center"
                                        >
                                            Back
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCashReceived(total)}
                                        className="btn-primary w-full min-h-[34px] border rounded-[8px] text-[10px] cursor-pointer transition-all flex items-center justify-center"
                                    >
                                        Exact Amount ({formatCurrency(total)})
                                    </button>

                                    {/* Change readout */}
                                    <div className="min-h-[36px] border border-[var(--border)] rounded-lg flex items-center justify-between px-2.5 bg-[var(--surface)]">
                                        <span className="text-[10px] text-[var(--muted)] font-bold">Change</span>
                                        <strong className={`num text-base font-bold ${changeDue >= 0 && total > 0 ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>
                                            {changeDue >= 0 && total > 0 ? formatCurrency(changeDue) : `${formatCurrency(Math.abs(changeDue))} short`}
                                        </strong>
                                    </div>
                                </div>
                                ) : (
                                    <div className="min-h-[36px] border border-[var(--border)] rounded-lg flex items-center justify-between px-2.5 bg-[var(--surface)]">
                                        <span className="text-[10px] text-[var(--muted)] font-bold">QR payment</span>
                                        <strong className="text-xs text-[var(--fg)]">Confirm on terminal</strong>
                                    </div>
                                )}

                                {user && user.role === 'barista' && (
                                    <div role="alert" className="text-[var(--danger)] text-[9px] font-semibold bg-[color-mix(in_oklch,var(--danger)_8%,var(--surface))] border border-[color-mix(in_oklch,var(--danger)_24%,var(--border))] px-3 py-1 rounded-xl text-center">
                                        Barista role is locked from cash register and payment actions.
                                    </div>
                                )}

                                <button
                                    onClick={handleCheckoutSubmit}
                                    disabled={cart.length === 0 || isSubmittingOrder || user?.role === 'barista' || (paymentMethod === 'cash' && cashReceived < total)}
                                    className="btn-primary w-full min-h-[46px] rounded-xl border text-xs disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    {user?.role === 'barista' ? 'Checkout Locked' : isSubmittingOrder ? 'Processing...' : 'Complete sale'}
                                </button>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Cart Bar for Mobile */}
            {cart.length > 0 && activeTab === 'menu' && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] p-3 z-45 flex items-center justify-between shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider">Current Order</span>
                        <span className="text-xs font-bold text-[var(--fg)]">
                            {cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'} • <span className="text-[var(--accent)] font-black num">{formatCurrency(total)}</span>
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setActiveTab('cart')}
                        className="btn-primary btn-pill px-4 py-2 border text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                        <span>View Order</span>
                        <span>🛒</span>
                    </button>
                </div>
            )}

            {/* Customization Modal */}
            {customizingProduct && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="customize-title" className="bg-[var(--surface)] rounded-[20px] w-full max-w-lg border border-[var(--border)] shadow-[var(--shadow)] overflow-hidden">
                        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
                            <div>
                                <h3 id="customize-title" className="font-display font-bold text-lg text-[var(--fg)]">{customizingProduct.name}</h3>
                                <p className="text-[10px] text-[var(--muted)]">Choose size, milk, extras, and notes</p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close customization"
                                onClick={() => setCustomizingProduct(null)}
                                className="btn-secondary w-8 h-8 rounded-full border transition-all flex items-center justify-center cursor-pointer text-xs"
                            >
                                x
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] no-scrollbar">
                            {/* Size Selection */}
                            {customizingProduct.category === 'Pastries' ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-[var(--fg)]/80">Select Option</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { name: 'Single', label: 'Single Piece', price: 'Base' },
                                            { name: 'Pack of 6', label: 'Pack of 6', price: customizingProduct.name.includes('Classic') ? '+₱105.00' : '+₱115.00' }
                                        ].map((s) => (
                                            <button
                                                key={s.name}
                                                type="button"
                                                onClick={() => setCustomSize(s.name)}
                                                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col gap-0.5 ${
                                                        customSize === s.name
                                                        ? 'btn-primary'
                                                        : 'btn-secondary'
                                                }`}
                                            >
                                                <span className="text-xs font-bold">{s.label}</span>
                                                <span className="text-[9px] opacity-75">{s.price}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : customizingProduct.category === 'Hot Coffee' ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-[var(--fg)]/80">Select Size</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { name: '8oz', label: 'Hot (8oz)', price: 'Base' }
                                        ].map((s) => (
                                            <button
                                                key={s.name}
                                                type="button"
                                                disabled
                                                className="btn-primary p-3 rounded-xl border text-center flex flex-col gap-0.5 disabled:opacity-80"
                                            >
                                                <span className="text-xs font-bold">{s.label}</span>
                                                <span className="text-[9px] opacity-75">{s.price}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-[var(--fg)]/80">Select Size</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { name: '16oz', label: 'Iced (16oz)', price: 'Base' },
                                            { name: '22oz', label: 'Iced (22oz)', price: (customizingProduct.name.includes('Mocha Latte\'') && customizingProduct.category.includes('Classic')) || (customizingProduct.name.includes('Seasalt Latte\'') && customizingProduct.category.includes('Classic')) || customizingProduct.name.includes('Milo Matcha') ? '+₱30.00' : customizingProduct.name.includes('Cookies & Cream Cloud') || customizingProduct.name.includes('Blueberry Cloud') ? '+₱10.00' : '+₱20.00' }
                                        ].map((s) => (
                                            <button
                                                key={s.name}
                                                type="button"
                                                onClick={() => setCustomSize(s.name)}
                                                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col gap-0.5 ${
                                                        customSize === s.name
                                                        ? 'btn-primary'
                                                        : 'btn-secondary'
                                                }`}
                                            >
                                                <span className="text-xs font-bold">{s.label}</span>
                                                <span className="text-[9px] opacity-75">{s.price}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {customizingProduct.category !== 'Pastries' && (
                                <>
                                    {/* Extra Espresso Shots */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-[var(--fg)]/80 flex justify-between">
                                            <span>Extra Espresso Shots</span>
                                            <span className="text-[10px] text-[var(--accent)] font-bold">+₱39.00 per shot</span>
                                        </label>
                                        <div className="flex items-center gap-3 bg-[var(--bg)] p-3 rounded-xl justify-between border border-[var(--border)]">
                                            <span className="text-xs font-bold text-[var(--fg)]">Add Espresso Shots</span>
                                            <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => setCustomShots(prev => Math.max(0, prev - 1))}
                                                    className="btn-key w-8 h-8 border flex items-center justify-center rounded cursor-pointer text-sm"
                                                >
                                                    -
                                                </button>
                                                <span className="text-sm font-bold w-6 text-center text-[var(--fg)]">{customShots}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCustomShots(prev => Math.min(4, prev + 1))}
                                                    className="btn-key w-8 h-8 border flex items-center justify-center rounded cursor-pointer text-sm"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Syrups & Sauces Selection */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-[var(--fg)]/80">Syrups & Sauces (+₱15.00 each)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Caramel Sauce', 'Chocolate Sauce'].map((syrup) => {
                                                const isSelected = customSyrups.includes(syrup);
                                                return (
                                                    <button
                                                        key={syrup}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setCustomSyrups(prev => prev.filter(s => s !== syrup));
                                                            } else {
                                                                setCustomSyrups(prev => [...prev, syrup]);
                                                            }
                                                        }}
                                                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col gap-0.5 ${
                                                            isSelected
                                                                ? 'btn-primary'
                                                                : 'btn-secondary'
                                                        }`}
                                                    >
                                                        <span className="text-xs font-bold">{syrup}</span>
                                                        <span className="text-[9px] opacity-75">+₱15.00</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Extra Cream Choice */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-[var(--fg)]/80 flex justify-between">
                                            <span>Extra Cream</span>
                                            <span className="text-[10px] text-[var(--accent)] font-bold">+₱29.00</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setCustomCream(prev => !prev)}
                                            className={`w-full p-3 rounded-xl border text-center transition-all cursor-pointer flex justify-between items-center ${
                                                customCream
                                                    ? 'btn-primary font-bold'
                                                    : 'btn-secondary'
                                            }`}
                                        >
                                            <span className="text-xs text-[var(--fg)]">Add Extra Cream</span>
                                            <span className="text-xs">{customCream ? 'Selected' : 'None'}</span>
                                        </button>
                                    </div>
                                </>
                            )}

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
                                className="btn-secondary flex-1 py-3 border rounded-xl text-xs transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddCustomized}
                                className="btn-primary flex-1 py-3 border rounded-xl text-xs transition-all cursor-pointer"
                            >
                                Add to Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sale Confirmation Modal */}
            {completedOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="sale-complete-title" className="bg-[var(--surface)] text-[var(--fg)] p-6 rounded-[20px] w-full max-w-sm border border-[var(--border)] shadow-[var(--shadow)] flex flex-col justify-between relative">
                        <button
                            type="button"
                            onClick={() => setCompletedOrder(null)}
                            className="btn-secondary absolute top-4 right-4 min-h-8 px-3 rounded-full border transition-all flex items-center justify-center cursor-pointer text-xs"
                        >
                            Close
                        </button>

                        <div className="space-y-5">
                            <div className="text-center space-y-2">
                                <div className="mx-auto w-14 h-14 rounded-2xl bg-[color-mix(in_oklch,var(--ok)_14%,var(--surface))] text-[var(--ok)] border border-[color-mix(in_oklch,var(--ok)_28%,var(--border))] flex items-center justify-center">
                                    <svg className="w-8 h-8 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <h2 id="sale-complete-title" className="font-display font-bold text-2xl leading-tight">Sale completed</h2>
                                <p className="text-xs text-[var(--muted)]">
                                    {completedOrder.order_number} was recorded in sales history.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Items sold</span>
                                    <strong className="num">{completedOrder.items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Payment</span>
                                    <strong className="capitalize">{completedOrder.payment_method}</strong>
                                </div>
                                {completedOrder.payment_method === 'cash' && completedOrder.payment_details && (
                                    <div className="flex justify-between">
                                        <span className="text-[var(--muted)]">Change given</span>
                                        <strong className="num">{formatCurrency(completedOrder.payment_details.change_returned ?? 0)}</strong>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-[var(--border)] pt-3">
                                    <span className="text-[var(--muted)]">Sale total</span>
                                    <strong className="num text-lg">{formatCurrency(completedOrder.total)}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => router.push('/admin/inventory?tab=reports')}
                                className="btn-secondary flex-1 py-3 border rounded-xl text-xs transition-all cursor-pointer text-center"
                            >
                                Sales history
                            </button>
                            <button
                                onClick={() => setCompletedOrder(null)}
                                className="btn-primary flex-1 py-3 border rounded-xl text-xs transition-all cursor-pointer text-center"
                            >
                                New Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
