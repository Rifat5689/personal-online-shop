import { useContext, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { CartContext } from "@/features/cart/context/CartContextValue";

const BillingPage = () => {
  const { items: cartItems = [], shippingZone: cartZone } =
    useContext(CartContext);
  const location = useLocation();
  const fromCart = location.state?.fromCart ?? false;
  const directItem = location.state?.directItem ?? null;

  const [zone, setZone] = useState("outside");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [spinnerVisible, setSpinnerVisible] = useState(false);

  const items = useMemo(
    () => (fromCart ? cartItems : directItem ? [directItem] : cartItems),
    [fromCart, directItem, cartItems]
  );

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const p = Number(item?.price ?? 0);
        const q = Number(item?.quantity ?? item?.qty ?? 1);
        return sum + p * q;
      }, 0),
    [items]
  );

  const activeZone = fromCart ? cartZone : zone;
  const shipping = items.length ? (activeZone === "inside" ? 70 : 130) : 0;
  const total = subtotal + shipping;

  const isMobile = paymentMethod === "bkash" || paymentMethod === "nagad";

  const triggerSpinner = () => {
    setSpinnerVisible(true);
    setTimeout(() => setSpinnerVisible(false), 1000);
  };

  return (
    <section className="bg-[#f7f5fb] pb-16 pt-6">
      <div className="mx-auto max-w-4xl px-4">
        {/* Full-screen Spinner */}
        {spinnerVisible && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#f0cfe0] bg-white/80 shadow-lg">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#c04b78]/30 border-t-[#c04b78]" />
            </span>
          </div>
        )}

        <h1 className="text-2xl font-semibold text-[#2a1b2e]">
          Billing &amp; Shipping
        </h1>

        <form className="mt-6 space-y-5">
          {/* Name / Phone / Address */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-[#2a1b2e]">
              আপনার নাম <span className="text-red-500">*</span>
              <input
                type="text"
                placeholder="আপনার নাম"
                className="mt-2 w-full rounded-xl border border-[#f0cfe0] bg-white px-4 py-3 text-sm text-[#2a1b2e] focus:border-[#c04b78] focus:outline-none"
              />
            </label>
            <label className="block text-sm font-semibold text-[#2a1b2e]">
              মোবাইল নাম্বার <span className="text-red-500">*</span>
              <input
                type="tel"
                placeholder="আপনার মোবাইল নাম্বার"
                className="mt-2 w-full rounded-xl border border-[#f0cfe0] bg-white px-4 py-3 text-sm text-[#2a1b2e] focus:border-[#c04b78] focus:outline-none"
              />
            </label>
            <label className="block text-sm font-semibold text-[#2a1b2e]">
              আপনার ঠিকানা <span className="text-red-500">*</span>
              <input
                type="text"
                placeholder="বাসা, রোড, থানা, জেলা....."
                className="mt-2 w-full rounded-xl border border-[#f0cfe0] bg-white px-4 py-3 text-sm text-[#2a1b2e] focus:border-[#c04b78] focus:outline-none"
              />
            </label>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[#2a1b2e]">
              পেমেন্ট মেথড
            </h2>
            {[
              { value: "cod", label: "ক্যাশ অন ডেলিভারি" },
              { value: "bkash", label: "বিকাশ" },
              { value: "nagad", label: "নগদ" },
            ].map((method) => (
              <label
                key={method.value}
                className="flex items-center gap-2 text-sm text-[#2a1b2e]"
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.value}
                  checked={paymentMethod === method.value}
                  onChange={() => {
                    setPaymentMethod(method.value);
                    triggerSpinner();
                  }}
                  className="sr-only"
                />
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#c04b78]">
                  <span
                    className={`h-2 w-2 rounded-full bg-[#c04b78] ${
                      paymentMethod === method.value
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                </span>
                {method.label}
              </label>
            ))}
          </div>

          {/* Mobile Payment Fields */}
          {isMobile && (
            <div className="space-y-3 rounded-2xl border border-[#f0cfe0] bg-[#fff0f6] p-4">
              <p className="text-sm font-semibold text-[#2a1b2e]">
                {paymentMethod === "bkash" ? "বিকাশ" : "নগদ"} পেমেন্ট
              </p>
              <p className="text-xs text-[#6e3d57]">
                Send ৳ {total.toLocaleString("en-BD")} to{" "}
                <span className="font-semibold text-[#c04b78]">
                  01340275689
                </span>{" "}
                ({paymentMethod === "bkash" ? "bKash" : "Nagad"} Personal)
              </p>
              <label className="block text-sm font-semibold text-[#2a1b2e]">
                Transaction ID <span className="text-red-500">*</span>
                <input
                  type="text"
                  placeholder="Enter transaction ID"
                  className="mt-2 w-full rounded-xl border border-[#f0cfe0] bg-white px-4 py-3 text-sm text-[#2a1b2e] focus:border-[#c04b78] focus:outline-none"
                />
              </label>
            </div>
          )}

          {/* Order Summary */}
          <div className="rounded-2xl border border-[#f0cfe0] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#2a1b2e]">
              Order summary
            </h2>
            <div className="mt-4 space-y-3">
              {items.map((item, idx) => {
                const name = item?.title || item?.name || "Product";
                const price = Number(item?.price ?? 0);
                const qty = Number(item?.quantity ?? item?.qty ?? 1);
                const img = item?.image || item?.thumbnail || "/react.svg";
                const key = item?.id ?? item?.title ?? item?.name ?? idx;

                return (
                  <div
                    key={key}
                    className="flex gap-3 border-b border-[#f0cfe0] pb-3 last:border-b-0 last:pb-0"
                  >
                    <img
                      src={img}
                      alt={name}
                      className="h-12 w-12 rounded-md border border-[#f0cfe0] object-cover"
                      loading="lazy"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#2a1b2e] line-clamp-2">
                        {name}
                      </p>
                      <p className="mt-1 text-xs text-[#6e3d57]">× {qty}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#2a1b2e]">
                      ৳ {(price * qty).toLocaleString("en-BD")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="mt-5 rounded-md border border-[#f0cfe0] bg-[#faf9fc] p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">
                  ৳ {subtotal.toLocaleString("en-BD")}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#2a1b2e]">
                  Shipping
                </p>
                {fromCart ? (
                  <div className="mt-2 flex items-center justify-between text-sm text-[#2a1b2e]">
                    <span>
                      {activeZone === "inside"
                        ? "Inside Dhaka"
                        : "Outside Dhaka"}
                    </span>
                    <span className="font-semibold">
                      ৳ {shipping.toLocaleString("en-BD")}
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-[#2a1b2e]">
                    <label className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shipping"
                          value="outside"
                          checked={zone === "outside"}
                          onChange={() => {
                            setZone("outside");
                            triggerSpinner();
                          }}
                          className="sr-only"
                        />
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#c04b78]">
                          <span
                            className={`h-2 w-2 rounded-full bg-[#c04b78] ${
                              zone === "outside" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </span>
                        Outside Dhaka
                      </span>
                      <span className="font-semibold">৳ 130</span>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shipping"
                          value="inside"
                          checked={zone === "inside"}
                          onChange={() => {
                            setZone("inside");
                            triggerSpinner();
                          }}
                          className="sr-only"
                        />
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#c04b78]">
                          <span
                            className={`h-2 w-2 rounded-full bg-[#c04b78] ${
                              zone === "inside" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </span>
                        Inside Dhaka
                      </span>
                      <span className="font-semibold">৳ 70</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#f0cfe0] pt-4 font-semibold text-[#2a1b2e]">
                <span>Total</span>
                <span className="text-base text-[#c04b78]">
                  ৳ {total.toLocaleString("en-BD")}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-[#c04b78] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b3416e] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={items.length === 0}
          >
            Place order
          </button>
        </form>
      </div>
    </section>
  );
};

export default BillingPage;
