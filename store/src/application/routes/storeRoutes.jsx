import React from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { BeautyStoreLayout as StoreLayout } from "../../layouts/BeautyStoreLayout";
import Home from "../../pages/store/Home/BeautyHome";
import Products from "../../pages/store/Products/Products";
import ProductDetails from "../../pages/store/ProductDetails/ProfessionalProductDetails";
// May use later: storefront category overview. Admin category management remains active.
// import Categories from "../../pages/store/Categories/Categories";
import Cart from "../../pages/store/Cart/Cart";
import Checkout from "../../pages/store/Checkout/Checkout";
import Orders, {
  OrderDetails,
  OrderSuccess,
} from "../../pages/store/Orders/Orders";
import Account from "../../pages/store/Account/Account";
import CustomerAuthPage from "../../pages/store/Auth/CustomerAuthPage";
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
