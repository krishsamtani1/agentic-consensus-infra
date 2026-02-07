import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // Data stays fresh for 60 seconds - no refetch on tab switch
      gcTime: 5 * 60_000,         // Keep unused data in cache for 5 minutes
      refetchOnMount: false,       // Don't refetch when component mounts if data is fresh
      refetchOnWindowFocus: false,  // Don't refetch when window regains focus
      retry: 1,                    // Only retry once on failure
      retryDelay: 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
