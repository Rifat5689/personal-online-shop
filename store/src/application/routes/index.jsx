import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import StoreRoutes from './storeRoutes';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
const AdminRoutes = lazy(() => import('./adminRoutes'));
const Login = lazy(() => import('../../pages/admin/Login/Login'));
export function AppRoutes() {
 return <Suspense fallback={<LoadingSpinner label="Loading page..." />}><Routes>
  <Route path="/secure/admin/*" element={<AdminRoutes />} />
  <Route path="/demoadmin" element={<Login demo={import.meta.env.VITE_DEMO_MODE === 'true'} />} />
  <Route path="/*" element={<StoreRoutes />} />
 </Routes></Suspense>;
}
