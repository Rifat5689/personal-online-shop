export const PROJECT_OVERVIEW = {
  title: "Ecommerce Project Overview",
  summary:
    "A Vite + React ecommerce prototype with a local-first product catalog, context-driven cart state, route-based pages, and a separate admin console.",
  entryPoints: [
    {
      file: "src/main.jsx",
      role: "Application bootstrap",
      details: [
        "Mounts the app into the root DOM node.",
        "Wraps the UI with AppProviders and RouterProvider.",
        "Imports the global stylesheet.",
      ],
    },
    {
      file: "src/application/providers.jsx",
      role: "Global provider tree",
      details: [
        "Creates the React Query client.",
        "Provides products, auth, and cart contexts to the entire app.",
        "Defines the shared state foundation used by all feature pages.",
      ],
    },
    {
      file: "src/application/router.jsx",
      role: "Route definitions",
      details: [
        "Defines the admin route and the main app route tree.",
        "Places the home, category, details, dashboard, and billing pages under the main layout.",
        "Keeps the admin console separate from the normal storefront shell.",
      ],
    },
  ],
  layoutLayer: {
    files: ["src/layouts/components/Layout.jsx", "src/layouts/components/Navbar.jsx"],
    responsibilities: [
      "Layout owns route-specific chrome, scroll behavior, cart sidebar state, and search state.",
      "Navbar renders the brand, search UI, cart badge, desktop links, and mobile drawer.",
      "Layout passes search state to children through Outlet context so product pages can reuse it.",
    ],
  },
  featureModules: [
    {
      feature: "products",
      files: [
        "src/features/products/context/ProductsContext.jsx",
        "src/features/products/hooks/useProducts.js",
        "src/features/products/services/productApi.js",
        "src/features/products/components/ProductCard.jsx",
        "src/features/products/components/PaginatedProducts.jsx",
        "src/features/products/pages/HomePage.jsx",
        "src/features/products/pages/CategoryPage.jsx",
        "src/features/products/pages/ProductDetailsPage.jsx",
      ],
      details: [
        "ProductsContext loads the catalog from localStorage first, then falls back to public/products.json.",
        "The context exposes CRUD, stock, discount, and search helpers.",
        "HomePage shows the hero banners, category shortcuts, and paginated catalog.",
        "CategoryPage filters products by route category and shared search text.",
        "ProductDetailsPage resolves a single product by id, shows details, and provides add-to-cart and buy-now actions.",
      ],
    },
    {
      feature: "cart",
      files: [
        "src/features/cart/context/CartContext.jsx",
        "src/features/cart/hooks/useCart.js",
        "src/features/cart/components/CartSidebar.jsx",
      ],
      details: [
        "CartContext stores cart items and the shipping zone.",
        "Cart state is persisted to localStorage so it survives refreshes.",
        "CartSidebar handles quantity updates, item removal, shipping choice, and checkout navigation.",
      ],
    },
    {
      feature: "billing",
      files: ["src/features/billing/pages/BillingPage.jsx"],
      details: [
        "BillingPage acts as the checkout screen.",
        "It can consume either the active cart or a direct product passed through route state.",
        "It shows shipping, payment method selection, and an order summary, but no backend submission yet.",
      ],
    },
    {
      feature: "dashboard",
      files: ["src/features/dashboard/pages/DashboardPage.jsx", "src/features/dashboard/constants/dashboardData.js"],
      details: [
        "DashboardPage is a static customer dashboard experience.",
        "All visible dashboard cards are driven by local constant data.",
        "It is not connected to a real backend or user account system.",
      ],
    },
    {
      feature: "admin",
      files: ["src/features/admin/pages/AdminPanelPage.jsx", "src/features/admin/pages/adminPanel.css"],
      details: [
        "AdminPanelPage is a full admin console with tabs for dashboard, orders, products, customers, analytics, notifications, and settings.",
        "It reads users and bookings from public JSON files and stores changes in localStorage.",
        "Product operations are wired into the ProductsContext so admin edits update the shared catalog.",
      ],
    },
    {
      feature: "search",
      files: ["src/features/search/components/FloatingSearchBar.jsx", "src/features/search/components/SearchSuggestions.jsx"],
      details: [
        "Search components are reusable UI pieces used by the main layout.",
        "Layout computes the suggestion list from the shared product store.",
        "Search is client-side and filters the loaded catalog in memory.",
      ],
    },
    {
      feature: "auth",
      files: ["src/features/auth/context/AuthContext.jsx", "src/features/auth/context/AuthContextValue.js"],
      details: [
        "Auth is currently a placeholder provider.",
        "It exposes a null user and no login or logout flow.",
        "The admin route is not protected by this context yet.",
      ],
    },
  ],
  dataSources: [
    {
      file: "public/products.json",
      purpose: "Primary product catalog",
      notes: [
        "Used as the initial product dataset when no cached copy exists.",
        "Product pages, cart actions, search, and admin product management all read from this catalog.",
      ],
    },
    {
      file: "public/users.json",
      purpose: "Admin customer directory seed",
      notes: [
        "Loaded by the admin page for customer records.",
        "Changes are kept in localStorage once edited.",
      ],
    },
    {
      file: "public/bookings.json",
      purpose: "Admin booking/order seed",
      notes: [
        "Loaded by the admin page for orders and booking status management.",
        "Acts as a mock operational dataset rather than a live backend feed.",
      ],
    },
  ],
  sharedUtilities: [
    {
      file: "src/shared/utils/formatPrice.js",
      purpose: "Bangladeshi taka formatting helpers",
    },
    {
      file: "src/shared/components/LoadingSpinner.jsx",
      purpose: "Common loading UI",
    },
    {
      file: "src/shared/constants/theme.js",
      purpose: "Color and transition tokens",
    },
  ],
  architectureNotes: [
    "The app is local-first: most mutable data lives in React context and localStorage.",
    "React Query is configured but not yet the primary data source for products.",
    "The storefront and admin console share the same product store, which keeps changes synchronized in-browser.",
    "The auth layer is a stub, so the admin route is currently open.",
  ],
};

export const getProjectOverviewText = () => {
  const lines = [];

  lines.push(`${PROJECT_OVERVIEW.title}`);
  lines.push("");
  lines.push(PROJECT_OVERVIEW.summary);
  lines.push("");

  lines.push("Entry points:");
  PROJECT_OVERVIEW.entryPoints.forEach((item) => {
    lines.push(`- ${item.file}: ${item.role}`);
    item.details.forEach((detail) => lines.push(`  - ${detail}`));
  });
  lines.push("");

  lines.push("Layout layer:");
  lines.push(`- ${PROJECT_OVERVIEW.layoutLayer.files.join(", ")}`);
  PROJECT_OVERVIEW.layoutLayer.responsibilities.forEach((detail) => {
    lines.push(`  - ${detail}`);
  });
  lines.push("");

  lines.push("Feature modules:");
  PROJECT_OVERVIEW.featureModules.forEach((feature) => {
    lines.push(`- ${feature.feature}`);
    lines.push(`  - Files: ${feature.files.join(", ")}`);
    feature.details.forEach((detail) => lines.push(`  - ${detail}`));
  });
  lines.push("");

  lines.push("Data sources:");
  PROJECT_OVERVIEW.dataSources.forEach((source) => {
    lines.push(`- ${source.file}: ${source.purpose}`);
    source.notes.forEach((note) => lines.push(`  - ${note}`));
  });
  lines.push("");

  lines.push("Shared utilities:");
  PROJECT_OVERVIEW.sharedUtilities.forEach((utility) => {
    lines.push(`- ${utility.file}: ${utility.purpose}`);
  });
  lines.push("");

  lines.push("Architecture notes:");
  PROJECT_OVERVIEW.architectureNotes.forEach((note) => lines.push(`- ${note}`));

  return lines.join("\n");
};

export default PROJECT_OVERVIEW;