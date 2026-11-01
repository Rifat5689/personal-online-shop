import { useState, useEffect, useMemo } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useProducts } from "@/features/products/hooks/useProducts";
import Navbar from "./Navbar";
import { FloatingSearchBar } from "@/features/search";
import { CartSidebar } from "@/features/cart";

const Layout = () => {
  const location = useLocation();

  const isBilling = location.pathname.startsWith("/billing");
  const isCategory = location.pathname.startsWith("/category") || isBilling;
  const isCategoryOnly = location.pathname.startsWith("/category");
  const hideBottomNav =
    location.pathname.startsWith("/productDetails") ||
    isCategoryOnly ||
    isBilling;

  const [cartOpen, setCartOpen] = useState(false);
  const [scrolledPast, setScrolledPast] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const { products } = useProducts();
  const query = searchValue.trim().toLowerCase();

  const suggestions = useMemo(
    () =>
      query
        ? products
            .filter((p) =>
              (p?.title || p?.name || "").toLowerCase().includes(query)
            )
            .slice(0, 8)
            .map((p, i) => ({
              id: p?.id ?? `${p?.title ?? p?.name ?? "item"}-${i}`,
              name: p?.title || p?.name || "Untitled",
            }))
        : [],
    [products, query]
  );

  const handleSuggestionSelect = (suggestion) => {
    setSearchValue(suggestion.name);
    if (location.pathname === "/") {
      const el =
        document.getElementById("all-products-heading") ||
        document.getElementById("product-grid-top") ||
        document.getElementById("products");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Track scroll position
  useEffect(() => {
    const handler = () => setScrolledPast(window.scrollY > 80);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Keep route transitions simple and deterministic for lint safety.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className={`pb-16 ${isCategoryOnly ? "pt-16" : ""}`}>
      {/* Navbar */}
      {!isBilling &&
        (isCategoryOnly ? (
          <div className="fixed inset-x-0 top-0 z-50">
            <Navbar
              showSearch={false}
              showMobileActions
              showMenuButton
              onCartOpen={() => setCartOpen(true)}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              suggestions={suggestions}
              onSuggestionSelect={handleSuggestionSelect}
            />
          </div>
        ) : (
          <Navbar
            showSearch={!isCategory && !cartOpen}
            onCartOpen={() => setCartOpen(true)}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            suggestions={suggestions}
            onSuggestionSelect={handleSuggestionSelect}
          />
        ))}

      {/* Floating search bar (homepage only, appears on scroll) */}
      {!isCategory && !cartOpen && (
        <FloatingSearchBar
          isVisible={scrolledPast}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          suggestions={suggestions}
          onSuggestionSelect={handleSuggestionSelect}
        />
      )}

      {/* Bottom sticky navbar (homepage only, appears on scroll) */}
      {!hideBottomNav && !cartOpen && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${
            scrolledPast ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <Navbar
            showSearch={false}
            showMobileActions
            showMenuButton={false}
            onCartOpen={() => setCartOpen(true)}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            suggestions={suggestions}
            onSuggestionSelect={handleSuggestionSelect}
          />
        </div>
      )}

      {/* Cart Sidebar */}
      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Page Content */}
      <Outlet context={{ searchQuery: searchValue, setSearchQuery: setSearchValue }} />
    </div>
  );
};

export default Layout;
