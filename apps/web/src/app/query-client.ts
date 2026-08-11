import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // React Query já usa gcTime=5 min e refetchOnWindowFocus=true por padrão.
      staleTime: 30_000,
    },
  },
});
