import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth";
import { CartProvider } from "@/features/cart";
import { ProductsProvider } from "@/features/products/context/ProductsContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60000, refetchOnWindowFocus: false },
  },
});

/**
 * Root provider tree: QueryClient → Auth → Cart.
 * Add additional providers here as the app grows.
 */
const AppProviders = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ProductsProvider>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </ProductsProvider>
  </QueryClientProvider>
);

export default AppProviders;
