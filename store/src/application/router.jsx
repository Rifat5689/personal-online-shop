import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/layouts";
import { HomePage, ProductDetailsPage, CategoryPage } from "@/features/products";
import { DashboardPage } from "@/features/dashboard";
import { BillingPage } from "@/features/billing";
import { AdminPanelPage } from "@/features/admin";

/**
 * Application route definitions.
 * All page routes are nested under the main Layout.
 */
const router = createBrowserRouter([
  {
    path: "/admin",
    element: <AdminPanelPage />,
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "productDetails/:id", element: <ProductDetailsPage /> },
      { path: "category/:category", element: <CategoryPage /> },
      { path: "billing", element: <BillingPage /> },
    ],
  },
]);

export default router;
