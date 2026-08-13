/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import POSPage from '@/pages/POSPage';
import InventoryPage from '@/pages/InventoryPage';
import ReportPage from '@/pages/ReportPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import DashboardPage from '@/pages/DashboardPage';
import SupplierPage from '@/pages/SupplierPage';
import CustomerPage from '@/pages/CustomerPage';
import ExpensePage from '@/pages/ExpensePage';
import DiscountPage from '@/pages/DiscountPage';
import DebtPage from '@/pages/DebtPage';
import RestockPage from '@/pages/RestockPage';
import ReturPage from '@/pages/ReturPage';
import LoginPage from '@/pages/LoginPage';
import { dbProvider } from '@/services/db/DatabaseService';
import { scannerService } from '@/services/hardware/ScannerService';
import { NativeHandler } from '@/lib/nativeHandler';
import { isNativePlatform } from '@/lib/platformDetector';
import { indexdbUser } from '@/lib/indexdbUser';

import { useSettingsStore } from '@/store/useSettingsStore';
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuth(indexdbUser.isLoggedIn());
  }, []);

  if (isAuth === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <span className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RoleRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: ('admin' | 'super_admin' | 'kasir' | 'gudang')[] }) => {
  const user = indexdbUser.getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'admin' || user.role === 'super_admin') return <Navigate to="/" replace />;
    if (user.role === 'kasir') return <Navigate to="/pos" replace />;
    if (user.role === 'gudang') return <Navigate to="/inventory" replace />;
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  const [dbInitializing, setDbInitializing] = useState(true);
  const darkMode = useSettingsStore(state => state.darkMode);

  useEffect(() => {
    let mounted = true;

    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };

    setVh();
    window.addEventListener('resize', setVh);

    // ✅ Inisialisasi database secara non-blocking
    const init = async () => {
      try {
        // ✅ Untuk browser: hanya butuh delay minimal, IndexedDB langsung siap
        // ✅ Untuk native: retry cepat dengan max 2 attempt (bukan 5)
        const MAX_RETRY = 2;
        let retryCount = 0;

        while (retryCount < MAX_RETRY) {
          try {
            if (retryCount > 0) {
              // Delay kecil saja — tidak perlu exponential backoff agresif
              await new Promise(r => setTimeout(r, 200));
            }
            await dbProvider.getInstance();
            console.log("✅ Database initialized successfully");
            break;
          } catch (error) {
            retryCount++;
            if (retryCount >= MAX_RETRY) {
              console.error("❌ Database init failed after retries:", error);
              // Non-fatal di browser — IndexedDB tetap berfungsi
            }
          }
        }
      } finally {
        if (mounted) {
          setDbInitializing(false);
        }
      }
    };

    init();

    // ✅ AKTIFKAN GLOBAL BARCODE SCANNER LISTENER
    scannerService.start();

    // ✅ INISIALISASI NATIVE PLATFORM HANDLER (Android / iOS)
    NativeHandler.init();

    // Cleanup saat unmount
    return () => {
      mounted = false;
      window.removeEventListener('resize', setVh);
      scannerService.stop();
    };
  }, []);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<RoleRoute allowedRoles={['admin', 'super_admin']}><DashboardPage /></RoleRoute>} />
                  <Route path="/pos" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'kasir']}><POSPage /></RoleRoute>} />
                  <Route path="/inventory" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'gudang']}><InventoryPage /></RoleRoute>} />
                  <Route path="/reports" element={<RoleRoute allowedRoles={['admin', 'super_admin']}><ReportPage /></RoleRoute>} />
                  <Route path="/settings" element={<RoleRoute allowedRoles={['admin', 'super_admin']}><SettingsPage /></RoleRoute>} />
                  <Route path="/history" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'kasir']}><HistoryPage /></RoleRoute>} />
                  <Route path="/suppliers" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'gudang']}><SupplierPage /></RoleRoute>} />
                  <Route path="/customers" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'kasir']}><CustomerPage /></RoleRoute>} />
                  <Route path="/expenses" element={<RoleRoute allowedRoles={['admin', 'super_admin']}><ExpensePage /></RoleRoute>} />
                  <Route path="/discounts" element={<RoleRoute allowedRoles={['admin', 'super_admin']}><DiscountPage /></RoleRoute>} />
                  <Route path="/debts" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'kasir']}><DebtPage /></RoleRoute>} />
                  <Route path="/restock" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'gudang']}><RestockPage /></RoleRoute>} />
                  <Route path="/retur" element={<RoleRoute allowedRoles={['admin', 'super_admin', 'gudang']}><ReturPage /></RoleRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </div>
  );
}

