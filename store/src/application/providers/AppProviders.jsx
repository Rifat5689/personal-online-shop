import React,{useState} from 'react';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StoreProvider} from './StoreProvider';
import {AuthProvider} from './AuthProvider';
import {AdminPwaProvider} from '../../features/pwa/AdminPwaProvider';
export function AppProviders({children}){
 const[client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30000}}}));
 return <QueryClientProvider client={client}><BrowserRouter><AuthProvider><StoreProvider><AdminPwaProvider>{children}</AdminPwaProvider></StoreProvider></AuthProvider></BrowserRouter></QueryClientProvider>;
}
