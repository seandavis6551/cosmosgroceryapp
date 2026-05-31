import { useState, useContext } from 'react';
import { CartContext } from './App';

// ─── Icons ────────────────────────────────────────────────────────────────────

const ArrowLeft = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="m19 12H5M12 5l-7 7 7 7" />
  </svg>
);
const Check = () => (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
    <path d="m5 13 4 4L19 7" />
  </svg>
);

// ─── Data ─────────────────────────────────────────────────────────────────────

export const DELIVERY_SLOTS = [
  {
    id: 'morning',
    label: 'Morning',
    window: '8:00 – 12:00',
    period: 'AM',
    icon: '🌅',
    bg: 'from-orange-50 to-amber-100',
    border: 'border-amber-200',
    activeBg: 'from-amber-50 to-orange-50',
    eta: 'Arrives before noon',
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    window: '12:00 – 5:00',
    period: 'PM',
    icon: '☀️',
    bg: 'from-yellow-50 to-yellow-100',
    border: 'border-yellow-200',
    activeBg: 'from-yellow-50 to-amber-50',
    eta: 'Arrives this afternoon',
  },
  {
    id: 'evening',
    label: 'Evening',
    window: '5:00 – 9:00',
    period: 'PM',
    icon: '🌙',
    bg: 'from-indigo-50 to-purple-50',
    border: 'border-indigo-200',
    activeBg: 'from-indigo-50 to-purple-50',
    eta: 'Arrives this evening',
  },
];

const DELIVERY_PREFS = [
  { id: 'door',  label: 'Leave at door', icon: '🚪' },
  { id: 'ring',  label: 'Ring bell',     icon: '🔔' },
  { id: 'call',  label: 'Call on arrival', icon: '📞' },
  { id: 'knock', label: 'Knock',         icon: '✊' },
  { id: 'quiet', label: 'Keep quiet',    icon: '🤫' },
  { id: 'gate',  label: 'Gate code',     icon: '🔐' },
];

const DISTRICTS = [
  'Scarborough', 'Crown Point', 'Bon Accord', 'Canaan', 'Buccoo',
  'Mount Pleasant', 'Signal Hill', 'Bacolet', 'Roxborough',
  'Speyside', 'Charlotteville', 'Moriah', 'Plymouth',
];

const TIP_OPTIONS = [
  { id: 'none',    label: 'No tip',  pct: 0    },
  { id: 'ten',     label: '10%',     pct: 0.10 },
  { id: 'fifteen', label: '15%',     pct: 0.15 },
  { id: 'twenty',  label: '20%',     pct: 0.20 },
  { id: 'custom',  label: 'Custom',  pct: null },
];

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ number, title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="px-4 sm:px-5 pt-5 pb-5 flex items-start gap-3 sm:gap-4">
        <div className="shrink-0 w-8 h-8 rounded-full bg-teal-500 text-white font-bold text-xs
                        flex items-center justify-center shadow-sm shadow-teal-200 mt-0.5">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-base" style={{ fontFamily: 'Fraunces, serif' }}>
            {title}
          </h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 mb-4">{subtitle}</p>}
          {!subtitle && <div className="mt-3" />}
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── 1. Delivery Address ──────────────────────────────────────────────────────

function DeliveryAddress({ address, setAddress, district, setDistrict, landmark, setLandmark }) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="House / apartment number and street..."
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm
                   text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                   focus:ring-teal-400 focus:border-transparent focus:bg-white transition-all"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                       text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400
                       focus:border-transparent transition-all cursor-pointer"
          >
            <option value="">Select district...</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
        </div>
        <input
          type="text"
          placeholder="Landmark (optional)"
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm
                     text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                     focus:ring-teal-400 focus:border-transparent transition-all"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 rounded-xl px-3 py-2.5">
        <span>📍</span>
        <span>We deliver island-wide across Tobago — free on orders over $35</span>
      </div>
    </div>
  );
}

// ─── 2. Time Slot Picker ──────────────────────────────────────────────────────

function TimeSlotPicker({ selected, setSelected, deliveryDay, setDeliveryDay }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['Today', 'Tomorrow'].map((day) => (
          <button
            key={day}
            onClick={() => setDeliveryDay(day)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border-2 transition-all
              ${deliveryDay === day
                ? 'bg-teal-500 text-white border-teal-500 shadow-sm shadow-teal-200'
                : 'bg-white border-slate-200 text-slate-500 hover:border-teal-300'}`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {DELIVERY_SLOTS.map((slot) => {
          const active = selected === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => setSelected(slot.id)}
              className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 text-left border-2 transition-all bg-gradient-to-br
                ${active
                  ? `border-teal-500 shadow-md shadow-teal-100 ${slot.activeBg}`
                  : `${slot.border} hover:border-teal-300 ${slot.bg}`}`}
            >
              <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{slot.icon}</div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">{slot.label}</div>
              <div className="hidden sm:block text-[11px] text-slate-500 mt-0.5 leading-tight">
                {slot.window}<br />
                <span className="font-medium">{slot.period}</span>
              </div>
              <div className="sm:hidden text-[10px] text-slate-400 mt-0.5 leading-tight">
                {slot.period}
              </div>
              {active && (
                <div className="absolute top-2 right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-teal-500
                                flex items-center justify-center text-white shadow-sm">
                  <Check />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 rounded-xl px-3 py-2.5">
          <span>🚚</span>
          <span>{DELIVERY_SLOTS.find((s) => s.id === selected)?.eta}</span>
        </div>
      )}
    </div>
  );
}

// ─── 3. Delivery Preferences ──────────────────────────────────────────────────

function DeliveryPrefs({ selected, setSelected, note, setNote }) {
  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DELIVERY_PREFS.map((pref) => {
          const active = selected.includes(pref.id);
          return (
            <button
              key={pref.id}
              onClick={() => toggle(pref.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium
                          border-2 transition-all select-none
                ${active
                  ? 'bg-teal-500 text-white border-teal-500 shadow-sm shadow-teal-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}
            >
              <span>{pref.icon}</span>
              {pref.label}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        placeholder="Any other notes for your driver..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-sm
                   text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                   focus:ring-teal-400 focus:border-transparent transition-all"
      />
    </div>
  );
}

// ─── 4. Payment Method ────────────────────────────────────────────────────────

function PaymentMethod({ method, setMethod, cardNumber, setCardNumber, expiry, setExpiry, cvv, setCvv, cardName, setCardName }) {
  const formatCard = (v) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const displayNum = cardNumber || '•••• •••• •••• ••••';

  return (
    <div className="space-y-4">
      {/* Method tabs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'card', icon: '💳', label: 'Card' },
          { id: 'linx', icon: '🏦', label: 'LINX' },
          { id: 'cash', icon: '💵', label: 'Cash' },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all flex flex-col items-center gap-1
              ${method === m.id
                ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm shadow-teal-100'
                : 'border-slate-200 bg-white text-slate-500 hover:border-teal-200'}`}
          >
            <span className="text-xl">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {method === 'card' && (
        <div className="space-y-3">
          {/* Live card preview */}
          <div className="relative w-full mx-auto rounded-2xl overflow-hidden select-none"
               style={{ maxWidth: 320, aspectRatio: '1.586 / 1',
                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #134e4a 100%)',
                        boxShadow: '0 20px 40px rgba(13,148,136,0.35)' }}>
            {/* Dot pattern */}
            <div className="absolute inset-0 opacity-20"
                 style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
            {/* Circles */}
            <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full"
                 style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="absolute -right-4 -bottom-16 w-36 h-36 rounded-full"
                 style={{ background: 'rgba(255,255,255,0.05)' }} />

            <div className="relative p-5 h-full flex flex-col justify-between">
              {/* Chip + logo row */}
              <div className="flex items-start justify-between">
                <div className="w-10 h-7 rounded-md shadow-sm"
                     style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }} />
                <div className="text-white/70 text-xs font-bold tracking-widest uppercase">CosmosREV</div>
              </div>

              {/* Card number */}
              <div className="font-mono text-white tracking-widest text-sm drop-shadow">
                {displayNum}
              </div>

              {/* Bottom row */}
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-white/50 text-[9px] uppercase tracking-widest mb-0.5">Card Holder</div>
                  <div className="text-white text-xs font-semibold uppercase tracking-wide truncate max-w-[130px]">
                    {cardName || 'Your Name'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/50 text-[9px] uppercase tracking-widest mb-0.5">Expires</div>
                  <div className="text-white text-xs font-semibold font-mono">{expiry || 'MM/YY'}</div>
                </div>
                <div className="text-white opacity-80" style={{ fontSize: 28, letterSpacing: -4, lineHeight: 1 }}>●●</div>
              </div>
            </div>
          </div>

          {/* Input fields */}
          <input
            type="text"
            placeholder="Name on card"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm
                       text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                       focus:ring-teal-400 focus:border-transparent transition-all"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Card number"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCard(e.target.value))}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono
                       tracking-widest text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                       focus:ring-teal-400 focus:border-transparent transition-all"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM / YY"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono
                         text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                         focus:ring-teal-400 focus:border-transparent transition-all"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="CVV"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono
                         text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2
                         focus:ring-teal-400 focus:border-transparent transition-all"
            />
          </div>
        </div>
      )}

      {method === 'linx' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 leading-relaxed">
          🏦 <strong>LINX payment.</strong> Our driver will bring a wireless POS terminal on delivery.
        </div>
      )}
      {method === 'cash' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
          💵 <strong>Cash on delivery.</strong> Please have exact change ready — our drivers carry limited change.
        </div>
      )}
    </div>
  );
}

// ─── 5. Tip Selector ──────────────────────────────────────────────────────────

function TipSelector({ subtotal, tipId, setTipId, customTip, setCustomTip }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl p-3.5">
        <div className="text-4xl">🛵</div>
        <div>
          <div className="text-sm font-semibold text-slate-800">Show your driver some love</div>
          <div className="text-xs text-slate-500 mt-0.5">100% of tips go directly to your delivery driver</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {TIP_OPTIONS.map((t) => {
          const active = tipId === t.id;
          const amount = t.pct !== null ? (subtotal * t.pct).toFixed(2) : null;
          return (
            <button
              key={t.id}
              onClick={() => setTipId(t.id)}
              className={`py-2.5 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all
                ${active
                  ? 'border-teal-500 bg-teal-500 text-white shadow-sm shadow-teal-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}
            >
              <div>{t.label}</div>
              {amount !== null && (
                <div className={`text-[10px] font-normal ${active ? 'text-teal-100' : 'text-slate-400'}`}>
                  ${amount}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {tipId === 'custom' && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <span className="text-slate-500 font-semibold">$</span>
          <input
            type="number"
            min="0"
            step="0.50"
            value={customTip}
            onChange={(e) => setCustomTip(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400
                       focus:outline-none font-mono"
          />
        </div>
      )}
    </div>
  );
}

// ─── Order Receipt (right sidebar) ────────────────────────────────────────────

function OrderReceipt({ selectedSlot, deliveryDay, tipId, customTip, onPlaceOrder, placing }) {
  const { cart, subtotal } = useContext(CartContext);
  const items = Object.values(cart);

  const tipOpt    = TIP_OPTIONS.find((t) => t.id === tipId);
  const tipAmount = tipId === 'custom'
    ? parseFloat(customTip || 0)
    : (tipOpt?.pct || 0) * subtotal;

  const deliveryFee = subtotal >= 35 ? 0 : 3.99;
  const serviceFee  = +(subtotal * 0.05).toFixed(2);
  const total       = +(subtotal + deliveryFee + serviceFee + tipAmount).toFixed(2);

  const slotInfo = DELIVERY_SLOTS.find((s) => s.id === selectedSlot);
  const today    = new Date().toLocaleDateString('en-TT', { weekday: 'short', month: 'short', day: 'numeric' });

  const ctaLabel = slotInfo
    ? `Order now — get it ${deliveryDay === 'Today' ? 'today' : 'tomorrow'} ${slotInfo.icon}`
    : 'Place Order →';

  return (
    <div className="sticky top-24">
      {/* Receipt card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/70 overflow-hidden border border-slate-100">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-4 text-white">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-200 mb-0.5">CosmosREV</div>
          <div className="font-bold text-xl leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
            Your Order
          </div>
          <div className="text-xs text-teal-100 mt-1 flex items-center gap-2">
            <span>📅 {today}</span>
            {slotInfo && (
              <span className="bg-white/20 rounded-full px-2 py-0.5">
                {slotInfo.icon} {slotInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Receipt body */}
        <div className="px-5 py-4">
          {/* Items */}
          <div className="space-y-2 mb-4" style={{ fontFamily: 'ui-monospace, "Cascadia Code", monospace', fontSize: 12 }}>
            {items.map(({ product, qty }) => (
              <div key={product.id} className="flex justify-between gap-1.5 items-baseline">
                <span className="text-slate-600 truncate flex-1 min-w-0">
                  {product.emoji} {product.name}
                </span>
                <span className="text-slate-400 shrink-0">×{qty}</span>
                <span className="text-slate-800 font-semibold shrink-0 tabular-nums">
                  ${(product.price * qty).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Dashed divider */}
          <div className="border-t border-dashed border-slate-200 mb-3" />

          {/* Fees */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Delivery</span>
              {deliveryFee === 0
                ? <span className="text-teal-600 font-semibold">FREE 🎉</span>
                : <span className="tabular-nums">${deliveryFee.toFixed(2)}</span>}
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Service (5%)</span>
              <span className="tabular-nums">${serviceFee.toFixed(2)}</span>
            </div>
            {tipAmount > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Driver tip 🛵</span>
                <span className="tabular-nums">${tipAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="border-t-2 border-slate-800 mt-3 pt-3 flex justify-between items-baseline">
            <span className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">Total</span>
            <span className="font-extrabold text-slate-900 text-xl tabular-nums">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Perforated tear line */}
        <div className="h-4 bg-slate-50"
             style={{
               backgroundImage: 'radial-gradient(circle at 50% 0%, white 5px, #f8fafc 5px)',
               backgroundSize: '14px 10px',
               backgroundRepeat: 'repeat-x',
             }} />

        {/* CTA */}
        <div className="px-5 pb-5 bg-slate-50">
          <button
            onClick={onPlaceOrder}
            disabled={placing || items.length === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-full
                       transition-all active:scale-95 shadow-lg shadow-orange-200/60 text-sm
                       disabled:opacity-50 disabled:cursor-not-allowed leading-tight"
          >
            {placing ? '✨ Placing your order...' : ctaLabel}
          </button>
          <p className="text-center text-[11px] text-slate-400 mt-3 flex items-center justify-center gap-1">
            <span>🔒</span> Secured checkout
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout Page ────────────────────────────────────────────────────────────

export default function CheckoutPage({ onBack, onSuccess }) {
  const { subtotal } = useContext(CartContext);

  const [address,       setAddress]       = useState('');
  const [district,      setDistrict]      = useState('');
  const [landmark,      setLandmark]      = useState('');
  const [deliveryDay,   setDeliveryDay]   = useState('Today');
  const [timeSlot,      setTimeSlot]      = useState('afternoon');
  const [delivPrefs,    setDelivPrefs]    = useState(['door']);
  const [delivNote,     setDelivNote]     = useState('');
  const [payMethod,     setPayMethod]     = useState('card');
  const [cardNumber,    setCardNumber]    = useState('');
  const [expiry,        setExpiry]        = useState('');
  const [cvv,           setCvv]           = useState('');
  const [cardName,      setCardName]      = useState('');
  const [tipId,         setTipId]         = useState('fifteen');
  const [customTip,     setCustomTip]     = useState('');
  const [placing,       setPlacing]       = useState(false);

  const handlePlaceOrder = () => {
    setPlacing(true);
    const slotInfo = DELIVERY_SLOTS.find((s) => s.id === timeSlot);
    setTimeout(() => {
      setPlacing(false);
      onSuccess({ slot: slotInfo, deliveryDay });
    }, 1800);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F6F3' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-[68px] flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900
                       transition-colors rounded-full px-3 py-1.5 hover:bg-slate-50"
          >
            <ArrowLeft />
            Back
          </button>
          <div className="flex-1 text-center">
            <span className="font-bold text-slate-900 text-base" style={{ fontFamily: 'Fraunces, serif' }}>
              Checkout
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span>🔒</span> Secure
          </div>
        </div>
      </nav>

      {/* Layout */}
      <div className="max-w-screen-xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-10">
        <div className="flex gap-8 items-start">

          {/* Left: Form */}
          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4 pb-24 lg:pb-0">
            <Section number="1" title="Deliver to" subtitle="Where should we bring your groceries?">
              <DeliveryAddress
                address={address} setAddress={setAddress}
                district={district} setDistrict={setDistrict}
                landmark={landmark} setLandmark={setLandmark}
              />
            </Section>

            <Section number="2" title="When should we arrive?" subtitle="Choose a delivery window">
              <TimeSlotPicker
                selected={timeSlot} setSelected={setTimeSlot}
                deliveryDay={deliveryDay} setDeliveryDay={setDeliveryDay}
              />
            </Section>

            <Section number="3" title="Delivery preferences" subtitle="How should your driver handle the drop-off?">
              <DeliveryPrefs
                selected={delivPrefs} setSelected={setDelivPrefs}
                note={delivNote} setNote={setDelivNote}
              />
            </Section>

            <Section number="4" title="Payment" subtitle="Choose how you'd like to pay">
              <PaymentMethod
                method={payMethod} setMethod={setPayMethod}
                cardNumber={cardNumber} setCardNumber={setCardNumber}
                expiry={expiry} setExpiry={setExpiry}
                cvv={cvv} setCvv={setCvv}
                cardName={cardName} setCardName={setCardName}
              />
            </Section>

            <Section number="5" title="Tip your driver" subtitle="Totally optional, always appreciated">
              <TipSelector
                subtotal={subtotal}
                tipId={tipId} setTipId={setTipId}
                customTip={customTip} setCustomTip={setCustomTip}
              />
            </Section>
          </div>

          {/* Right: Receipt — desktop only */}
          <div className="hidden lg:block w-80 xl:w-[340px] shrink-0">
            <OrderReceipt
              selectedSlot={timeSlot}
              deliveryDay={deliveryDay}
              tipId={tipId}
              customTip={customTip}
              onPlaceOrder={handlePlaceOrder}
              placing={placing}
            />
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 z-30 shadow-2xl">
        <button
          onClick={handlePlaceOrder}
          disabled={placing}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-full
                     transition-all active:scale-95 shadow-lg shadow-orange-200 text-sm
                     disabled:opacity-50"
        >
          {placing
            ? '✨ Placing your order...'
            : DELIVERY_SLOTS.find((s) => s.id === timeSlot)
              ? `Order — ${deliveryDay} ${DELIVERY_SLOTS.find((s) => s.id === timeSlot)?.label} 🛵`
              : 'Place Order →'}
        </button>
      </div>
    </div>
  );
}
