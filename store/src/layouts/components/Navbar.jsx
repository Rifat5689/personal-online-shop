import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import {
  TbLayoutDashboard,
  TbMenu2,
  TbSearch,
  TbShoppingCart,
  TbUserCircle,
} from "react-icons/tb";
import { CartContext } from "@/features/cart/context/CartContextValue";
import { SearchSuggestions } from "@/features/search";

const Navbar = ({
  showSearch = true,
  showMobileActions = true,
  showMenuButton = true,
  onCartOpen,
  searchValue = "",
  onSearchChange,
  suggestions = [],
  onSuggestionSelect,
}) => {
  const { itemCount = 0 } = useContext(CartContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopFocus, setDesktopFocus] = useState(false);
  const [mobileFocus, setMobileFocus] = useState(false);

  return (
    <>
      {/* NAV BAR */}
      <nav className="bg-gradient-to-r from-[#fff6f9] via-[#fef1f7] to-[#fdf0f5] text-[#2a1b2e] shadow-sm border-b border-[#e9c7d8]">
        <div className="mx-auto max-w-7xl px-4 py-3 md:py-4">
          {/* Top Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Hamburger + Logo */}
            <div className="flex min-w-0 items-center gap-2 md:gap-4">
              {showMenuButton && (
                <button
                  type="button"
                  aria-label="Open dashboard menu"
                  onClick={() => setDrawerOpen(true)}
                  className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/70 text-[#c04b78] hover:bg-white"
                >
                  <TbMenu2 className="h-6 w-6" aria-hidden="true" />
                </button>
              )}
              <Link to="/" className="flex min-w-0 items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#f0cfe0]">
                  <span className="text-base font-bold text-[#c04b78]">O</span>
                </div>
                <h2 className="truncate text-lg font-bold tracking-[0.06em] text-[#3b243f] md:text-2xl">
                  Origins<span className="text-[#c04b78]">Bd</span>
                </h2>
              </Link>
            </div>

            {/* Center: Desktop Search */}
            {showSearch && (
              <div className="hidden md:flex flex-1 items-center justify-center px-6">
                <div className="relative w-full max-w-xl">
                  <div className="flex w-full items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[#2a1b2e] shadow-sm ring-1 ring-[#f0cfe0]">
                    <TbSearch className="h-5 w-5 text-[#c04b78]" aria-hidden="true" />
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(e) => onSearchChange?.(e.target.value)}
                      onFocus={() => setDesktopFocus(true)}
                      onBlur={() => setDesktopFocus(false)}
                      placeholder="Search products..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-[#c04b78]/60"
                      aria-label="Search products"
                    />
                  </div>
                  <SearchSuggestions
                    isOpen={desktopFocus && !!searchValue.trim()}
                    suggestions={suggestions}
                    onSelect={onSuggestionSelect}
                  />
                </div>
              </div>
            )}

            {/* Right: Desktop Links */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link to="/dashboard" className="inline-flex items-center gap-2 hover:text-[#c04b78]">
                <TbLayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Dashboard
              </Link>
              <button type="button" className="hover:text-[#c04b78]">
                Help &amp; Support
              </button>
              <button
                type="button"
                onClick={onCartOpen}
                className="inline-flex items-center gap-2 hover:text-[#c04b78]"
              >
                <span className="relative">
                  <TbShoppingCart className="h-4 w-4" aria-hidden="true" />
                  {itemCount > 0 && (
                    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#c04b78] px-1 text-[10px] font-semibold text-white">
                      {itemCount}
                    </span>
                  )}
                </span>
                Cart
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-[#c04b78] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b3416e]"
              >
                <TbUserCircle className="h-4 w-4" aria-hidden="true" />
                Sign In
              </button>
            </div>

            {/* Right: Mobile Actions */}
            {showMobileActions && (
              <div className="md:hidden flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-[#c04b78] shadow-sm ring-1 ring-[#f0cfe0]"
                >
                  <TbUserCircle className="h-4 w-4" aria-hidden="true" />
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={onCartOpen}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#c04b78] shadow-sm ring-1 ring-[#f0cfe0]"
                >
                  <TbShoppingCart className="h-5 w-5" aria-hidden="true" />
                  {itemCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#c04b78] px-1 text-[10px] font-semibold text-white">
                      {itemCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Mobile Search */}
          {showSearch && (
            <div className="md:hidden mt-3">
              <div className="relative">
                <div className="flex items-stretch overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#f0cfe0]">
                  <div className="flex items-center justify-center bg-[#fdf2f7] px-3 text-[#c04b78]">
                        <TbSearch className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    onFocus={() => setMobileFocus(true)}
                    onBlur={() => setMobileFocus(false)}
                    placeholder="Search products"
                    className="flex-1 px-3 py-2 text-sm text-[#2a1b2e] outline-none"
                    aria-label="Search products"
                  />
                  <button
                    type="button"
                    className="shrink-0 bg-[#c04b78] px-3 text-xs font-semibold text-white"
                  >
                    Search
                  </button>
                </div>
                <SearchSuggestions
                  isOpen={mobileFocus && !!searchValue.trim()}
                  suggestions={suggestions}
                  onSelect={onSuggestionSelect}
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* MOBILE DRAWER MENU */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-500 ${
          drawerOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={`fixed left-0 top-0 z-[70] h-full w-[80%] max-w-sm bg-white shadow-2xl transition-transform duration-500 ease-out ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#f0cfe0] bg-[#fff5fa] px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c04b78]">
                  Menu
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#f0cfe0]">
                    <span className="text-base font-bold text-[#c04b78]">O</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-[0.06em] text-[#3b243f]">
                      Origins<span className="text-[#c04b78]">Bd</span>
                    </h2>
                    <p className="text-xs text-[#6e3d57]">Beauty essentials hub</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md border border-[#f0cfe0] bg-white px-3 py-1 text-xs font-semibold text-[#6e3d57] hover:bg-[#fdf2f7]"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <Link
              to="/"
              onClick={() => setDrawerOpen(false)}
              className="block text-sm font-semibold text-[#2a1b2e] hover:text-[#c04b78]"
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-2 text-sm font-semibold text-[#2a1b2e] hover:text-[#c04b78]"
            >
              <TbLayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-semibold text-[#2a1b2e] hover:text-[#c04b78]"
            >
              Help &amp; Support
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onCartOpen?.();
              }}
              className="flex items-center gap-2 text-sm font-semibold text-[#2a1b2e] hover:text-[#c04b78]"
            >
              Cart
            </button>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-semibold text-[#2a1b2e] hover:text-[#c04b78]"
            >
              Login
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
