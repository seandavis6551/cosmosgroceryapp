import { useState, useContext, useEffect } from 'react';
import { CartContext } from './App';

const ORDER_STEPS = [
  { id: 'placed',    label: 'Order received',    icon: '✅', sub: 'We got it!'                        },
  { id: 'assigned',  label: 'Shopper assigned',   icon: '🧑‍🛒', sub: 'Someone is on their way to the store' },
  { id: 'picking',   label: 'Picking your items', icon: '🛒', sub: 'Selecting the freshest products'  },
  { id: 'delivery',  label: 'Out for delivery',   icon: '🛵', sub: 'Your order is on the road'        },
  { id: 'delivered', label: 'Delivered!',         icon: '🏡', sub: 'Enjoy!'                           },
];

export default function OrderConfirmation({ orderDetails, onContinue }) {
  const { cart, clearCart } = useContext(CartContext);
  const items = Object.values(cart);

  const [orderNum]     = useState(() => `CR-${Math.floor(1000 + Math.random() * 9000)}`);
  const [activeStep,   setActiveStep]   = useState(0);
  const [animateIn,    setAnimateIn]    = useState(false);

  useEffect(() => {
    setAnimateIn(true);
    // Simulate shopper being assigned after 2s
    const t = setTimeout(() => setActiveStep(1), 2000);
    return () => clearTimeout(t);
  }, []);

  const handleContinue = () => {
    clearCart();
    onContinue();
  };

  const slot = orderDetails?.slot;
  const day  = orderDetails?.deliveryDay || 'Today';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-10 px-4 pb-16"
      style={{ backgroundColor: '#F7F6F3' }}
    >
      {/* Celebration header */}
      <div
        className={`text-center mb-8 transition-all duration-700 ${
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="text-8xl mb-4 inline-block animate-bounce">🎉</div>
        <h1
          className="text-3xl md:text-4xl font-bold text-slate-900 mb-2"
          style={{ fontFamily: 'Fraunces, serif' }}
        >
          Order placed!
        </h1>
        <p className="text-slate-500 text-sm max-w-xs mx-auto">
          Your CosmosREV groceries are on their way to you. We'll keep you posted every step.
        </p>
        <div className="inline-flex items-center gap-2 mt-4 bg-white border border-slate-200
                        rounded-full px-5 py-2.5 shadow-sm">
          <span className="text-xs text-slate-500">Order</span>
          <span className="font-bold text-slate-900 font-mono text-base">{orderNum}</span>
        </div>
      </div>

      {/* Delivery window */}
      {slot && (
        <div
          className={`w-full max-w-lg mb-4 transition-all duration-700 delay-100 ${
            animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="bg-teal-500 rounded-2xl px-5 py-4 flex items-center gap-4 text-white shadow-lg shadow-teal-200">
            <div className="text-4xl">{slot.icon}</div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-teal-100 mb-0.5">
                Estimated delivery
              </div>
              <div className="font-bold text-lg" style={{ fontFamily: 'Fraunces, serif' }}>
                {day} · {slot.label}
              </div>
              <div className="text-teal-100 text-sm">
                {slot.window} {slot.period}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order progress timeline */}
      <div
        className={`w-full max-w-lg mb-4 transition-all duration-700 delay-150 ${
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3
            className="font-bold text-slate-900 mb-5 text-base"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            Order Status
          </h3>

          <div>
            {ORDER_STEPS.map((step, i) => {
              const done   = i < activeStep;
              const active = i === activeStep;
              const future = i > activeStep;

              return (
                <div key={step.id} className="flex items-start gap-4">
                  {/* Icon + connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-xl
                        transition-all duration-500
                        ${done   ? 'bg-teal-500 shadow-md shadow-teal-200' : ''}
                        ${active ? 'bg-orange-500 shadow-md shadow-orange-200 ring-4 ring-orange-100' : ''}
                        ${future ? 'bg-slate-100' : ''}`}
                    >
                      <span className={future ? 'opacity-40' : ''}>{step.icon}</span>
                    </div>
                    {i < ORDER_STEPS.length - 1 && (
                      <div
                        className={`w-0.5 my-1 transition-all duration-700 ${
                          done ? 'h-8 bg-teal-300' : 'h-8 bg-slate-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className="pt-2.5 pb-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          done   ? 'text-teal-700' :
                          active ? 'text-orange-600' :
                                   'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                      {active && (
                        <span className="text-[10px] font-bold bg-orange-100 text-orange-600
                                         px-2 py-0.5 rounded-full animate-pulse">
                          Live
                        </span>
                      )}
                      {done && (
                        <span className="text-[10px] font-bold bg-teal-100 text-teal-600
                                         px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 ${future ? 'text-slate-300' : 'text-slate-400'}`}>
                      {step.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Items summary */}
      {items.length > 0 && (
        <div
          className={`w-full max-w-lg mb-6 transition-all duration-700 delay-200 ${
            animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">What you ordered</h3>
            <div className="flex flex-wrap gap-2">
              {items.map(({ product, qty }) => (
                <div
                  key={product.id}
                  className="flex items-center gap-2 bg-slate-50 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <span>{product.emoji}</span>
                  <span>{product.name}</span>
                  {qty > 1 && <span className="text-slate-400">×{qty}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div
        className={`w-full max-w-lg flex gap-3 transition-all duration-700 delay-300 ${
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <button
          className="flex-1 py-3.5 rounded-full border-2 border-slate-200 text-sm font-semibold
                     text-slate-600 hover:border-teal-400 hover:text-teal-600 transition-all"
        >
          📍 Track Order
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-3.5 rounded-full bg-teal-500 hover:bg-teal-600 text-white text-sm
                     font-bold transition-all shadow-md shadow-teal-200 active:scale-95"
        >
          Keep Shopping →
        </button>
      </div>
    </div>
  );
}
