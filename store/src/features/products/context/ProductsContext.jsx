import { useEffect, useState } from "react";
import { ProductsContext } from "./ProductsContextValue";

const PRODUCTS_STORAGE_KEY = "ecommerce.products.v1";
const NEXT_ID_STORAGE_KEY = "ecommerce.products.nextId.v1";

const readStorage = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures in private/incognito modes.
  }
};

export const ProductsProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [nextId, setNextId] = useState(1000);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setIsLoading(true);
      setIsError(false);
      try {
        const stored = readStorage(PRODUCTS_STORAGE_KEY, null);
        if (Array.isArray(stored) && stored.length) {
          if (!active) return;
          setProducts(stored);
          const maxId = stored.reduce(
            (max, p) => Math.max(max, Number(p?.id) || 0),
            0
          );
          const storedNextId = readStorage(NEXT_ID_STORAGE_KEY, maxId + 1);
          setNextId(Math.max(storedNextId, maxId + 1));
          setIsLoading(false);
          return;
        }

        const response = await fetch("/products.json");
        const data = await response.json();
        const safeProducts = Array.isArray(data) ? data : [];
        if (!active) return;
        setProducts(safeProducts);
        writeStorage(PRODUCTS_STORAGE_KEY, safeProducts);

        const maxId = safeProducts.reduce(
          (max, p) => Math.max(max, Number(p?.id) || 0),
          0
        );
        const initialNext = maxId + 1;
        setNextId(initialNext);
        writeStorage(NEXT_ID_STORAGE_KEY, initialNext);
      } catch {
        if (!active) return;
        setIsError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  const persistAndSetProducts = (updater) => {
    setProducts((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeStorage(PRODUCTS_STORAGE_KEY, next);
      return next;
    });
  };

  const addProduct = (payload) => {
    const id = nextId;
    const price = Number(payload?.price) || 0;
    const discountPercent = Number(payload?.discountPercent) || 0;
    const stock = Number(payload?.stock) || 0;
    const inStock =
      typeof payload?.inStock === "boolean"
        ? payload.inStock
        : stock > 0;

    const nextProduct = {
      id,
      title: payload?.title || "Untitled product",
      price,
      category: payload?.category || "General",
      rating: Number(payload?.rating) || 4.5,
      image: payload?.image || "/images/skincare-bottles.jpg",
      stock,
      inStock,
      discountPercent,
      sku: payload?.sku || `SKU-${id}`,
    };

    persistAndSetProducts((prev) => [nextProduct, ...prev]);
    const newNextId = id + 1;
    setNextId(newNextId);
    writeStorage(NEXT_ID_STORAGE_KEY, newNextId);
    return nextProduct;
  };

  const updateProduct = (id, updates) => {
    const targetId = Number(id);
    persistAndSetProducts((prev) =>
      prev.map((item) => {
        if (Number(item?.id) !== targetId) return item;
        const merged = { ...item, ...updates };

        if (updates?.price != null) {
          merged.price = Number(updates.price) || 0;
        }
        if (updates?.stock != null) {
          merged.stock = Number(updates.stock) || 0;
        }
        if (updates?.discountPercent != null) {
          merged.discountPercent = Math.max(
            0,
            Math.min(95, Number(updates.discountPercent) || 0)
          );
        }
        if (updates?.inStock == null && updates?.stock != null) {
          merged.inStock = (Number(updates.stock) || 0) > 0;
        }

        return merged;
      })
    );
  };

  const deleteProduct = (id) => {
    const targetId = Number(id);
    persistAndSetProducts((prev) =>
      prev.filter((item) => Number(item?.id) !== targetId)
    );
  };

  const toggleProductStock = (id) => {
    const targetId = Number(id);
    persistAndSetProducts((prev) =>
      prev.map((item) => {
        if (Number(item?.id) !== targetId) return item;
        const nextInStock = !(item?.inStock ?? true);
        return {
          ...item,
          inStock: nextInStock,
          stock: nextInStock ? Math.max(Number(item?.stock) || 1, 1) : 0,
        };
      })
    );
  };

  const applyDiscount = (id, discountPercent) => {
    updateProduct(id, { discountPercent });
  };

  const searchProducts = (query) => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((item) => {
      const text = `${item?.title || item?.name || ""} ${item?.category || ""} ${item?.sku || ""}`.toLowerCase();
      return text.includes(q);
    });
  };

  const value = {
    products,
    isLoading,
    isError,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,
    applyDiscount,
    searchProducts,
  };

  return (
    <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
  );
};
