import React from 'react';
import {Routes,Route} from 'react-router-dom';
import AdminRoutes from './adminRoutes';
import StoreRoutes from './storeRoutes';
import Login from '../../pages/admin/Login/Login';
export function AppRoutes(){return <Routes><Route path="/secure/admin/*" element={<AdminRoutes/>}/><Route path="/demoadmin" element={<Login demo={import.meta.env.VITE_DEMO_MODE==='true'}/>}/><Route path="/*" element={<StoreRoutes/>}/></Routes>;}