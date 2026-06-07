import { useState, useContext, createContext, useEffect } from 'react';
import CheckoutPage from './CheckoutPage';
import OrderConfirmation from './OrderConfirmation';

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || 'http://localhost:7071/api';

function getCategoryIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('fruit') || n.includes('veg')) return '🥦';
  if (n.includes('dairy') || n.includes('milk')) return '🥛';
  if (n.includes('meat') || n.includes('seafood') || n.includes('fish') || n.includes('poultry')) return '🥩';
  if (n.includes('bakery') || n.includes('bread')) return '🍞';
  if (n.includes('snack') || n.includes('chip')) return '🍿';
  if (n.includes('beverage') || n.includes('drink') || n.includes('juice') || n.includes('water')) return '🧃';
  if (n.includes('frozen')) return '🧊';
  if (n.includes('household') || n.includes('clean')) return '🧹';
  if (n.includes('personal') || n.includes('care') || n.includes('hygiene')) return '🧴';
  if (n.includes('spice') || n.includes('condiment') || n.includes('sauce')) return '🧂';
  if (n.includes('rice') || n.includes('grain') || n.includes('cereal') || n.includes('pasta')) return '🌾';
  if (n.includes('canned') || n.includes('tin')) return '🥫';
  return '🛒';
}

// ─── Cart Context ──────────────────────────────────────────────────────────────

export const CartContext = createContext(null);

function CartProvider({ children }) {
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);

  const addItem = (product) =>
    setCart((prev) => {
      const currentQty = prev[product.id]?.qty || 0
      const maxQty = product.quantityOnHand ?? Infinity
      if (currentQty >= maxQty) return prev
      return { ...prev, [product.id]: { product, qty: currentQty + 1 } }
    });

  const removeItem = (product) =>
    setCart((prev) => {
      const next = { ...prev };
      if (next[product.id]?.qty > 1) {
        next[product.id] = { ...next[product.id], qty: next[product.id].qty - 1 };
      } else {
        delete next[product.id];
      }
      return next;
    });

  const clearCart = () => setCart({});

  const totalItems = Object.values(cart).reduce((s, i) => s + i.qty, 0);
  const subtotal   = Object.values(cart).reduce((s, i) => s + i.qty * i.product.price, 0);

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, totalItems, subtotal, cartOpen, setCartOpen, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

// ─── Icons (inline SVG helpers) ───────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const LocationIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const BagIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const ChevronDown = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav({ searchQuery, setSearchQuery }) {
  const { totalItems, subtotal, setCartOpen } = useContext(CartContext);

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 h-[68px] flex items-center gap-3 md:gap-5">

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <img
            src="/cosmos-rev-logo.png"
            alt="CosmosREV"
            className="h-12 w-auto"
          />
          <div className="hidden sm:flex flex-col leading-tight">
            <span
              className="text-lg font-extrabold tracking-tight"
              style={{ fontFamily: 'Fraunces, serif', color: '#0d9488' }}
            >
              CosmosREV
            </span>
            <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400">
              Tobago's Online Grocery
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm
                       text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                       focus:ring-teal-400 focus:border-transparent focus:bg-white transition-all"
          />
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-slate-200
                             text-sm text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
            <LocationIcon />
            <span>Deliver to Home</span>
          </button>

          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 transition-colors"
          >
            <span className="relative">
              <BagIcon />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-teal-500
                                 text-white text-[10px] font-bold flex items-center justify-center px-1
                                 shadow-sm shadow-teal-300">
                  {totalItems}
                </span>
              )}
            </span>
            {totalItems > 0 && (
              <span className="text-sm font-bold text-teal-700">
                ${subtotal.toFixed(2)}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── Category Sidebar (desktop) ───────────────────────────────────────────────

function DesktopSidebar({ categories, selected, setSelected }) {
  return (
    <aside className="hidden lg:block w-52 shrink-0">
      <div className="sticky top-20 space-y-0.5 pr-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelected(cat.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
              ${selected === cat.id
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
          >
            <span className="text-base">{cat.icon}</span>
            <span className="flex-1 text-left">{cat.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

// ─── Mobile Category Strip ────────────────────────────────────────────────────

function MobileCategoryStrip({ categories, selected, setSelected }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => setSelected(cat.id)}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                      transition-all whitespace-nowrap
            ${selected === cat.id
              ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300'
            }`}
        >
          <span className="text-sm">{cat.icon}</span>
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-400
                    -mx-4 md:mx-0 md:rounded-2xl px-6 py-7 md:p-10 mb-0 md:mb-7">

      <div className="relative">
        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white
                        text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Free delivery on your first order
        </div>

        <h1
          className="text-2xl md:text-4xl font-bold text-white mb-1.5 leading-tight"
          style={{ fontFamily: 'Fraunces, serif' }}
        >
          Tobago's own<br />online grocery store.
        </h1>
        <p className="text-teal-100 text-xs md:text-sm mb-5 max-w-xs">
          Everything you need, stocked and ready. From our shelves to your door.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-full text-sm
                             hover:shadow-xl hover:shadow-orange-700/30 transition-all active:scale-95">
            Shop Now →
          </button>

          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25
                          text-white text-xs font-bold px-3 py-2.5 rounded-full whitespace-nowrap">
            <span className="text-sm">📍</span>
            Live order tracking
            <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              New
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Deals Carousel ───────────────────────────────────────────────────────────

function DealsCarousel({ products }) {
  const { addItem, cart } = useContext(CartContext);
  const deals = products.filter((p) => p.onSale && p.inStock);

  if (!deals.length) return null;

  return (
    <section className="mb-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>
          Today's Deals 🔥
        </h2>
        <button className="text-sm text-teal-600 font-medium hover:underline">See all</button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {deals.map((product) => {
          const discount = Math.round((1 - product.price / product.originalPrice) * 100);
          const qty = cart[product.id]?.qty || 0;

          return (
            <div
              key={product.id}
              className="shrink-0 w-44 bg-white rounded-2xl border border-slate-100 shadow-sm
                         hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
            >
              <div className={`h-28 bg-gradient-to-br ${product.color} flex items-center justify-center relative`}>
                <span className="text-5xl">{product.emoji}</span>
                <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold
                                px-2 py-0.5 rounded-full shadow-sm">
                  -{discount}% OFF
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-slate-800 leading-tight mb-0.5 truncate">
                  {product.name}
                </p>
                <p className="text-[11px] text-slate-400 mb-2.5">{product.unit}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-teal-600 font-bold text-sm">${product.price.toFixed(2)}</span>
                    <span className="text-slate-400 text-[11px] line-through ml-1">
                      ${product.originalPrice?.toFixed(2)}
                    </span>
                  </div>
                  {qty === 0 ? (
                    <button
                      onClick={() => addItem(product)}
                      className="w-7 h-7 rounded-full bg-teal-500 text-white flex items-center justify-center
                                 hover:bg-teal-600 transition-colors text-xl font-light leading-none"
                    >
                      +
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                      ×{qty}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product }) {
  const { addItem, removeItem, cart } = useContext(CartContext);
  const qty = cart[product.id]?.qty || 0;
  const discount = product.onSale
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm
                  hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden
                  ${!product.inStock ? 'opacity-60' : ''}`}
    >
      {/* Image area */}
      <div className="h-36 relative overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-2" />
        ) : (
          <div className="h-full bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
            <span className="text-6xl">🛒</span>
          </div>
        )}

        {product.onSale && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold
                          px-2 py-0.5 rounded-full shadow-sm">
            -{discount}% OFF
          </div>
        )}

        {product.inStock && product.quantityOnHand !== null && product.quantityOnHand <= 5 && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold
                          px-2 py-0.5 rounded-full shadow-sm">
            Only {product.quantityOnHand} left
          </div>
        )}

        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5
                             rounded-full border border-slate-200 shadow-sm">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-800 leading-tight mb-0.5">{product.name}</p>
        <p className="text-xs text-slate-400 mb-3">{product.unit}</p>

        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-teal-600 font-bold text-base">${product.price.toFixed(2)}</div>
            {product.onSale && (
              <div className="text-slate-400 text-xs line-through">${product.originalPrice?.toFixed(2)}</div>
            )}
          </div>

          {product.inStock && (
            qty === 0 ? (
              <button
                onClick={() => addItem(product)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs sm:text-sm font-semibold
                           rounded-full transition-all active:scale-95 shadow-sm shadow-teal-200"
              >
                Add
              </button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2 bg-teal-50 border border-teal-100 rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1">
                <button
                  onClick={() => removeItem(product)}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-teal-500 text-white flex items-center justify-center
                             text-base font-light hover:bg-teal-600 transition-colors leading-none"
                >
                  −
                </button>
                <span className="text-xs sm:text-sm font-bold text-teal-700 min-w-[14px] text-center">{qty}</span>
                <button
                  onClick={() => addItem(product)}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-teal-500 text-white flex items-center justify-center
                             text-base font-light hover:bg-teal-600 transition-colors leading-none"
                >
                  +
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Product Grid ─────────────────────────────────────────────────────────────

function ProductGrid({ products, categories, selected, searchQuery }) {
  const filtered = products.filter((p) => {
    const inCategory = selected === 'all' || p.categoryId === selected;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return inCategory && matchesSearch;
  });

  const cat = categories.find((c) => c.id === selected);
  const heading = searchQuery ? `Results for "${searchQuery}"` : cat?.name || 'All Items';

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>
          {heading}
        </h2>
        <p className="text-sm text-slate-400">{filtered.length} items</p>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🔍</p>
          <p className="font-semibold text-slate-700 mb-1">No products found</p>
          <p className="text-slate-400 text-sm">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ onCheckout }) {
  const { cart, addItem, removeItem, totalItems, subtotal, cartOpen, setCartOpen } = useContext(CartContext);
  const items = Object.values(cart);

  const deliveryFee  = subtotal >= 35 ? 0 : 3.99;
  const serviceFee   = subtotal > 0 ? subtotal * 0.05 : 0;
  const total        = subtotal + deliveryFee + serviceFee;
  const toFreeDelivery = Math.max(0, 35 - subtotal);

  return (
    <>
      {/* Backdrop */}
      {cartOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setCartOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white z-50 shadow-2xl
                    flex flex-col transition-transform duration-300 ease-out
                    ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Fraunces, serif' }}>
              Your Cart
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3">
              <div className="text-7xl">🛒</div>
              <p className="font-semibold text-slate-700">Your cart is empty</p>
              <p className="text-sm text-slate-400 max-w-[200px]">
                Add fresh products to get started on your order.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Free delivery progress */}
              {toFreeDelivery > 0 && (
                <div className="bg-teal-50 rounded-xl p-3 text-xs text-teal-700 mb-2">
                  Add <strong>${toFreeDelivery.toFixed(2)}</strong> more for free delivery 🚀
                  <div className="w-full bg-teal-100 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-teal-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (subtotal / 35) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {items.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${product.color}
                                flex items-center justify-center text-2xl shrink-0`}
                  >
                    {product.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                    <p className="text-xs text-slate-400">{product.unit}</p>
                    <p className="text-sm font-bold text-teal-600 mt-0.5">
                      ${(product.price * qty).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full px-2 py-1 shrink-0">
                    <button
                      onClick={() => removeItem(product)}
                      className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600
                                 flex items-center justify-center text-lg font-light
                                 hover:border-teal-400 hover:text-teal-600 transition-colors leading-none"
                    >
                      −
                    </button>
                    <span className="text-sm font-bold text-slate-700 min-w-[16px] text-center">{qty}</span>
                    <button
                      onClick={() => addItem(product)}
                      disabled={product.quantityOnHand !== null && qty >= product.quantityOnHand}
                      className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center
                                 text-lg font-light hover:bg-teal-600 transition-colors leading-none
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-slate-100 space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="text-slate-800 font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery fee</span>
                <span>
                  {deliveryFee === 0
                    ? <span className="text-teal-600 font-semibold">Free 🎉</span>
                    : <span className="text-slate-800 font-medium">${deliveryFee.toFixed(2)}</span>
                  }
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Service fee (5%)</span>
                <span className="text-slate-800 font-medium">${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100 text-base">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => { setCartOpen(false); onCheckout(); }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-full
                         transition-all active:scale-95 shadow-lg shadow-orange-200 text-sm">
              Go to Checkout →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery]           = useState('');
  const [page, setPage]                         = useState('shop');
  const [orderDetails, setOrderDetails]         = useState(null);

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${FUNCTIONS_URL}/getProducts`).then((r) => r.json()),
      fetch(`${FUNCTIONS_URL}/getCategories`).then((r) => r.json()),
    ])
      .then(([prods, cats]) => {
        setProducts(prods);
        const mapped = cats.map((c) => ({ ...c, icon: getCategoryIcon(c.name) }));
        setCategories([{ id: 'all', name: 'All Items', icon: '🛒' }, ...mapped]);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, []);

  return (
    <CartProvider>
      {page === 'checkout' && (
        <CheckoutPage
          onBack={() => setPage('shop')}
          onSuccess={(details) => { setOrderDetails(details); setPage('confirmation'); }}
        />
      )}

      {page === 'confirmation' && (
        <OrderConfirmation
          orderDetails={orderDetails}
          onContinue={() => setPage('shop')}
        />
      )}

      {page === 'shop' && (
        <div className="min-h-screen font-sans" style={{ backgroundColor: '#F7F6F3' }}>
          <TopNav searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

          <main className="max-w-screen-xl mx-auto">
            <div className="px-4 pt-4 md:pt-6">
              <HeroBanner />
            </div>

            <div className="px-4 py-3 border-b border-slate-100 bg-white mt-0">
              <MobileCategoryStrip
                categories={categories}
                selected={selectedCategory}
                setSelected={setSelectedCategory}
              />
            </div>

            {dataLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="flex gap-6 px-4 mt-6">
                <DesktopSidebar
                  categories={categories}
                  selected={selectedCategory}
                  setSelected={setSelectedCategory}
                />
                <div className="flex-1 min-w-0">
                  <DealsCarousel products={products} />
                  <ProductGrid
                    products={products}
                    categories={categories}
                    selected={selectedCategory}
                    searchQuery={searchQuery}
                  />
                </div>
              </div>
            )}
          </main>

          <CartDrawer onCheckout={() => setPage('checkout')} />
        </div>
      )}
    </CartProvider>
  );
}
