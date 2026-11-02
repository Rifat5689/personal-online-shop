import React, { lazy } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { BeautyStoreLayout as StoreLayout } from "../../layouts/BeautyStoreLayout";
import Home from "../../pages/store/Home/BeautyHome";
const Products = lazy(() => import("../../pages/store/Products/Products"));
const ProductDetails = lazy(() => import("../../pages/store/ProductDetails/ProfessionalProductDetails"));
// May use later: storefront category overview. Admin category management remains active.
// import Categories from "../../pages/store/Categories/Categories";
const Cart = lazy(() => import("../../pages/store/Cart/Cart"));
const Checkout = lazy(() => import("../../pages/store/Checkout/Checkout"));
const Orders = lazy(() => import("../../pages/store/Orders/Orders").then(module => ({ default: module.default })));
const OrderDetails = lazy(() => import("../../pages/store/Orders/Orders").then(module => ({ default: module.OrderDetails })));
const OrderSuccess = lazy(() => import("../../pages/store/Orders/Orders").then(module => ({ default: module.OrderSuccess })));
const Account = lazy(() => import("../../pages/store/Account/Account"));
const CustomerAuthPage = lazy(() => import("../../pages/store/Auth/CustomerAuthPage"));
const PrivacyPolicyPage = lazy(() => import("../../pages/store/PrivacyPolicy/PrivacyPolicyPage"));
export default function StoreRoutes() {
  const { pathname } = useLocation();
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route
          path="products/:productSlug"
          element={<ProductDetails key={pathname} />}
        />
        {/* May use later: <Route path="categories" element={<Categories />} /> */}
        <Route path="categories/:categorySlug" element={<Products />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order-success" element={<OrderSuccess />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetails />} />
        {/* May use later: <Route path="wishlist" element={<Wishlist />} /> */}
        <Route path="account" element={<Account />} />
        <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="login" element={<CustomerAuthPage defaultMode="signin" />} />
        <Route path="signin" element={<CustomerAuthPage defaultMode="signin" />} />
        <Route path="signup" element={<CustomerAuthPage defaultMode="signup" />} />
        <Route path="register" element={<CustomerAuthPage defaultMode="signup" />} />
        <Route

          path="*"
          element={
            <div className="state-card">
              <h1>Page not found</h1>
              <Link to="..">Back to Store</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
