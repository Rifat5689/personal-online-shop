import React,{useState,useEffect} from 'react';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StoreProvider} from './StoreProvider';
import {AuthProvider} from './AuthProvider';
import {AdminPwaProvider} from '../../features/pwa/AdminPwaProvider';
import {request} from '../../services/api';
export function AppProviders({children}){
 const[client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30000,gcTime:30*60*1000}}}));
 useEffect(() => {
  if (/^\/(secure|demoadmin)(\/|$)/.test(window.location.pathname)) return;
  // Start the catalog alongside store configuration, avoiding a sequential API waterfall.
  for (const resource of ['products', 'categories']) void client.prefetchQuery({
   queryKey: [resource, 'originsofbeauty'], queryFn: () => request('get', `/${resource}/store/originsofbeauty`), staleTime: 60000,
  });
 }, [client]);
 return <QueryClientProvider client={client}><BrowserRouter><AuthProvider><StoreProvider><AdminPwaProvider>{children}</AdminPwaProvider></StoreProvider></AuthProvider></BrowserRouter></QueryClientProvider>;
}
