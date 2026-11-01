import { useContext, useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TbTrash } from "react-icons/tb";
import { CartContext } from "../context/CartContextValue";

const CartSidebar = ({ isOpen = false, onClose }) => {
  const {
    items = [],
    removeItem,
    updateQuantity,
    shippingZone: zone,
    setShippingZone,
  } = useContext(CartContext);

  const [spinnerVisible, setSpinnerVisible] = useState(false);
  const navigate = useNavigate();

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const p = Number(item?.price ?? 0);
        const q = Number(item?.quantity ?? item?.qty ?? 1);
        return sum + p * q;
      }, 0),
    [items]
  );

  const shipping = zone === "inside" ? 70 : 130;
  const total = subtotal + (items.length ? shipping : 0);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const handleCheckout = () => {
    if (items.length) {
      onClose?.();
      navigate("/billing", { state: { fromCart: true } });
    }
  };

  const triggerSpinner = () => {
    setSpinnerVisible(true);
    setTimeout(() => setSpinnerVisible(false), 1000);
  };

  const getKey = (item) => item?.id ?? item?.title ?? item?.name;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-60 bg-black/40 transition-opacity duration-500 ${
            isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      />
      {/* Sidebar */}
      <aside
        className={`fixed right-0 top-0 z-70 h-full w-full bg-white shadow-2xl transition-transform duration-500 ease-out md:w-140 ${
            isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Spinner overlay */}
          {spinnerVisible && (
            <div className="absolute inset-0 z-80 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#f0cfe0] bg-white/80 shadow-lg">
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#c04b78]/30 border-t-[#c04b78]" />
              </span>
            </div>
          )}

          {/* Header */}
          <div className="border-b border-[#f0cfe0] bg-[#fff5fa] px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c04b78]">
                  Shopping Cart
                </p>
                <h2 className="text-lg font-bold text-[#2a1b2e]">
                  Review &amp; checkout
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[1px] border border-[#f0cfe0] bg-white px-3 py-1 text-xs font-semibold text-[#6e3d57] hover:bg-[#fdf2f7]"
              >
                Close
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#6e3d57]">
              <span className="flex h-6 w-6 items-center justify-center bg-[#c04b78] text-white">
                1
              </span>
              <span className="h-px flex-1 bg-[#f0cfe0]" />
              <span className="flex h-6 w-6 items-center justify-center bg-[#f0cfe0] text-[#6e3d57]">
                2
              </span>
              <span className="h-px flex-1 bg-[#f0cfe0]" />
              <span className="flex h-6 w-6 items-center justify-center bg-[#f0cfe0] text-[#6e3d57]">
                3
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.length === 0 ? (
              <div className="rounded-[1px] border border-dashed border-[#f0cfe0] bg-[#fff7fb] p-5 text-center">
                <p className="text-sm font-semibold text-[#2a1b2e]">
                  Your cart is empty
                </p>
                <p className="mt-2 text-xs text-[#6e3d57]">
                  Add something you love and it will show up here.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 rounded-[1px] bg-[#c04b78] px-5 py-2 text-xs font-semibold text-white hover:bg-[#b3416e]"
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <div className="space-y-3 md:grid md:grid-cols-[1.3fr_0.9fr] md:items-start md:gap-4 md:space-y-0">
                {/* Items */}
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const name = item?.title || item?.name || "Product";
                    const price = Number(item?.price ?? 0);
                    const qty = Number(item?.quantity ?? item?.qty ?? 1);
                    const img = item?.image || item?.thumbnail || "/react.svg";
                    const key = getKey(item) ?? idx;

                    return (
                      <div
                        key={key}
                        className="flex gap-3 rounded-[1px] border-b border-[#e5e7eb] bg-white p-3"
                      >
                        <img
                          src={img}
                          alt={name}
                          className="h-16 w-16 object-cover sm:h-20 sm:w-20"
                          loading="lazy"
                        />
                        <div className="flex flex-1 flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[#2a1b2e] line-clamp-2">
                                {name}
                              </p>
                              <p className="mt-1 text-sm font-bold text-[#c04b78]">
                                ৳ {price.toLocaleString("en-BD")}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded-[1px] p-1 text-[#c04b78]/60 hover:text-[#c04b78]"
                              aria-label="Remove item"
                              onClick={() => removeItem?.(key)}
                            >
                              <TbTrash className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#6e3d57]">
                              Quantity
                            </span>
                            <div className="inline-flex items-center gap-2 rounded-[1px] border border-[#f0cfe0] px-2 py-1 text-xs font-semibold text-[#2a1b2e]">
                              <button
                                type="button"
                                className="h-6 w-6 rounded-[1px] bg-[#fdf2f7] text-[#c04b78]"
                                aria-label="Decrease quantity"
                                onClick={() =>
                                  updateQuantity?.(key, qty - 1)
                                }
                              >
                                -
                              </button>
                              <span className="min-w-4 text-center">
                                {qty}
                              </span>
                              <button
                                type="button"
                                className="h-6 w-6 rounded-[1px] bg-[#fdf2f7] text-[#c04b78]"
                                aria-label="Increase quantity"
                                onClick={() =>
                                  updateQuantity?.(key, qty + 1)
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#6e3d57]">
                            <span>Subtotal</span>
                            <span className="font-semibold text-[#2a1b2e]">
                              ৳ {(price * qty).toLocaleString("en-BD")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="space-y-3">
                  <div className="rounded-[1px] border border-[#f0cfe0] bg-[#fff7fb] p-4 text-sm">
                    <div className="flex items-center justify-between text-[#2a1b2e]">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        ৳ {subtotal.toLocaleString("en-BD")}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6e3d57]">
                        Shipping
                      </p>
                      <label className="flex items-center justify-between gap-2 text-xs text-[#2a1b2e]">
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="shipping"
                            value="outside"
                            checked={zone === "outside"}
                            onChange={() => {
                              setShippingZone("outside");
                              triggerSpinner();
                            }}
                            className="accent-[#c04b78]"
                          />
                          Outside Dhaka
                        </span>
                        <span className="font-semibold">৳ 130</span>
                      </label>
                      <label className="flex items-center justify-between gap-2 text-xs text-[#2a1b2e]">
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="shipping"
                            value="inside"
                            checked={zone === "inside"}
                            onChange={() => {
                              setShippingZone("inside");
                              triggerSpinner();
                            }}
                            className="accent-[#c04b78]"
                          />
                          Inside Dhaka
                        </span>
                        <span className="font-semibold">৳ 70</span>
                      </label>
                    </div>
                    <div className="mt-3 rounded-xs border border-[#f0cfe0] bg-white px-3 py-2 text-xs text-[#6e3d57]">
                      Delivery note: ships within 2-4 business days.
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#f0cfe0] pt-3 text-[#2a1b2e]">
                      <span className="font-semibold">Total</span>
                      <span className="text-base font-bold text-[#c04b78]">
                        ৳ {total.toLocaleString("en-BD")}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xs border border-[#f0cfe0] bg-white px-3 py-2 text-xs text-[#6e3d57]">
                    Need help? Chat with support or call 01340275689.
                  </div>
                  <div className="rounded-xs border border-[#f0cfe0] bg-white px-3 py-2 text-xs text-[#6e3d57]">
                    Payment methods: Cash, bKash, Nagad.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#f0cfe0] bg-white px-4 py-4 md:px-6">
            <div className="mx-auto flex max-w-md justify-center">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={!items.length}
                className="w-full rounded-[3px] bg-[#c04b78] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#c04b78]/30 hover:bg-[#b3416e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default CartSidebar;
