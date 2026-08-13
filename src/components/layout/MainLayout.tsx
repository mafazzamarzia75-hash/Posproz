/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MainLayout — Layout utama dengan navbar yang BISA DIGESER (draggable).
 * Pengguna dapat memindahkan navbar ke:
 * - Bawah (default)
 * - Atas
 * - Kiri
 * - Kanan
 * - Posisi bebas (drag ke mana saja)
 * Posisi tersimpan persisten di localStorage.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, History, Wallet, BarChart3, Store, Bot, Truck, Users, TrendingDown, Percent, LogOut, User as UserIcon, PackagePlus, RotateCcw, ChevronDown, ChevronUp, GripHorizontal, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, X } from 'lucide-react';
import StockAlert from '@/components/pos/StockAlert';
import { cn } from '@/lib/utils';
import { useSettingsStore, NavbarPosition } from '@/store/useSettingsStore';
import { indexdbUser } from '@/lib/indexdbUser';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const storeName = useSettingsStore(state => state.storeInfo.name);
  const currentUser = indexdbUser.getCurrentUser();
  const [navCollapsed, setNavCollapsed] = useState(false);

  // 🔴 State navbar draggable dari store
  const navbar = useSettingsStore(state => state.navbar);
  const setNavbarPosition = useSettingsStore(state => state.setNavbarPosition);
  const setNavbarCustom = useSettingsStore(state => state.setNavbarCustom);

  // 🔴 State drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showPositionMenu, setShowPositionMenu] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const rawMenuItems = [
    { path: '/', icon: <LayoutDashboard />, label: 'Beranda', roles: ['admin', 'super_admin'], colorHex: '#6366F1', bgHex: '#6366F1', accentStyle: { backgroundColor: '#4f46e5', color: 'white' } },
    { path: '/pos', icon: <ShoppingCart />, label: 'Kasir', roles: ['admin', 'super_admin', 'kasir'], colorHex: '#10b981', bgHex: '#10b981', accentStyle: { backgroundColor: '#059669', color: 'white' } },
    { path: '/restock', icon: <PackagePlus />, label: 'Masuk', roles: ['admin', 'super_admin', 'gudang'], colorHex: '#0ea5e9', bgHex: '#0ea5e9', accentStyle: { backgroundColor: '#0284c7', color: 'white' } },
    { path: '/retur', icon: <RotateCcw />, label: 'Retur', roles: ['admin', 'super_admin', 'gudang'], colorHex: '#f43f5e', bgHex: '#f43f5e', accentStyle: { backgroundColor: '#e11d48', color: 'white' } },
    { path: '/inventory', icon: <Package />, label: 'Produk', roles: ['admin', 'super_admin', 'gudang'], colorHex: '#f59e0b', bgHex: '#f59e0b', accentStyle: { backgroundColor: '#d97706', color: 'white' } },
    { path: '/suppliers', icon: <Truck />, label: 'Supplier', roles: ['admin', 'super_admin', 'gudang'], colorHex: '#8b5cf6', bgHex: '#8b5cf6', accentStyle: { backgroundColor: '#7c3aed', color: 'white' } },
    { path: '/expenses', icon: <TrendingDown />, label: 'Biaya', roles: ['admin', 'super_admin'], colorHex: '#d946ef', bgHex: '#d946ef', accentStyle: { backgroundColor: '#c026d3', color: 'white' } },
    { path: '/discounts', icon: <Percent />, label: 'Diskon', roles: ['admin', 'super_admin'], colorHex: '#ec4899', bgHex: '#ec4899', accentStyle: { backgroundColor: '#db2777', color: 'white' } },
    { path: '/customers', icon: <Users />, label: 'Pelanggan', roles: ['admin', 'super_admin', 'kasir'], colorHex: '#14b8a6', bgHex: '#14b8a6', accentStyle: { backgroundColor: '#0d9488', color: 'white' } },
    { path: '/debts', icon: <Wallet />, label: 'Hutang', roles: ['admin', 'super_admin', 'kasir'], colorHex: '#3b82f6', bgHex: '#3b82f6', accentStyle: { backgroundColor: '#1d4ed8', color: 'white' } },
    { path: '/history', icon: <History />, label: 'Riwayat', roles: ['admin', 'super_admin', 'kasir'], colorHex: '#06b6d4', bgHex: '#06b6d4', accentStyle: { backgroundColor: '#0891b2', color: 'white' } },
    { path: '/reports', icon: <BarChart3 />, label: 'Laporan', roles: ['admin', 'super_admin'], colorHex: '#a855f7', bgHex: '#a855f7', accentStyle: { backgroundColor: '#9333ea', color: 'white' } },
    { path: '/settings', icon: <Store />, label: 'Toko', roles: ['admin', 'super_admin'], colorHex: '#6b7280', bgHex: '#6b7280', accentStyle: { backgroundColor: '#4b5563', color: 'white' } },
  ];

  const menuItems = rawMenuItems.filter(item => {
    const role = currentUser?.role || 'admin';
    return item.roles.includes(role);
  });

  // 🔴 Handler drag mulai — dukung mouse & touch
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const rect = navRef.current?.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    if (rect) {
      // 🔴 Nonaktifkan transform preset & set posisi aktual (rect sudah termasuk transform)
      // Ini mencegah navbar melompat saat beralih dari mode preset ke mode custom
      setNavbarCustom(rect.left, rect.top);
      setDragOffset({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    }
  }, [setNavbarCustom]);

  // 🔴 Handler drag bergerak — dukung mouse & touch
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const navWidth = navRef.current?.offsetWidth || 200;
    const navHeight = navRef.current?.offsetHeight || 60;
    const maxX = window.innerWidth - navWidth - 8;
    const maxY = window.innerHeight - navHeight - 8;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const newX = Math.max(8, Math.min(maxX, clientX - dragOffset.x));
    const newY = Math.max(8, Math.min(maxY, clientY - dragOffset.y));
    setNavbarCustom(newX, newY);
  }, [isDragging, dragOffset, setNavbarCustom]);

  // 🔴 Handler drag selesai
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 🔴 Pasang listener drag global — mouse & touch
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 🔴 Gaya posisi navbar
  const getNavbarStyle = (): React.CSSProperties => {
    if (navbar.isCustom) {
      return {
        position: 'fixed',
        left: navbar.x,
        top: navbar.y,
        zIndex: 50,
      };
    }
    switch (navbar.position) {
      case 'top':
        return { position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 50 };
      case 'left':
        return { position: 'fixed', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 50 };
      case 'right':
        return { position: 'fixed', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 50 };
      default:
        return { position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 50 };
    }
  };

  // 🔴 Layout navbar: horizontal (bawah/atas) vs vertikal (kiri/kanan)
  const isVertical = navbar.position === 'left' || navbar.position === 'right';
  const isCustom = navbar.isCustom;

  return (
    <div className="flex flex-col min-h-[calc(var(--vh,1vh)*100)]" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      {/* Top Header */}
      <header className="h-16 px-6 flex items-center justify-between shrink-0 z-40" style={{ 
        backgroundColor: 'var(--color-bg-elevated)',
        borderBottomColor: 'var(--color-border-light)',
        borderBottomWidth: '1px'
      }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: 'var(--color-primary-600)' }}>
            <Store size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-black leading-tight tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{storeName}</h1>
            <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-tertiary)' }}>Sistem Kasir · Tema High Density</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-black leading-none" style={{ color: 'var(--color-text-primary)' }}>{currentUser.name || 'User'}</div>
                  <div className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-primary-600)' }}>{currentUser.role || 'kasir'}</div>
                </div>
                <div className="w-9 h-9 rounded-xl border flex items-center justify-center font-extrabold text-xs uppercase" style={{ 
                  backgroundColor: 'var(--color-primary-100)',
                  borderColor: 'var(--color-primary-300)',
                  color: 'var(--color-primary-700)'
                }}>
                  {(currentUser.name || 'User').slice(0, 2)}
                </div>
              </div>
              <button
                onClick={() => {
                  indexdbUser.logout();
                  navigate('/login');
                }}
                title="Logout"
                className="p-2 rounded-xl transition-all flex items-center justify-center"
                style={{ 
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Scrollable Content Panel — padding menyesuaikan posisi navbar */}
      <main className={`flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 transition-all duration-300 ${
        navCollapsed ? 'pb-20' : 'pb-28'
      }`} style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <StockAlert />
          {children}
        </div>
      </main>

      {/* 🔴 NAVBAR DRAGGABLE — bisa dipindah ke mana saja */}
      {!navCollapsed && (
        <div
          ref={navRef}
          style={getNavbarStyle()}
          className={cn(
            "select-none",
            isCustom && "cursor-grab active:cursor-grabbing"
          )}
        >
          <nav 
            className={cn(
              "backdrop-blur-md rounded-[28px] flex items-center gap-2 overflow-x-auto shadow-xl select-none",
              isVertical 
                ? "flex-col h-auto w-[76px] py-3 px-1 overflow-y-auto max-h-[calc(var(--vh,1vh)*100-32px)] custom-scrollbar-thin"
                : "h-20 px-4 scrollbar-none",
              isCustom && "border-2 border-dashed border-indigo-300"
            )}
            style={{ 
              backgroundColor: 'var(--color-bg-elevated)',
              borderColor: 'var(--color-border-light)',
              borderWidth: '1px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)'
            }}
          >
            {/* 🔴 Handle drag — SELALU terlihat, bisa di-drag mouse/touch */}
            <button
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 cursor-grab active:cursor-grabbing shrink-0 hover:bg-indigo-200 transition-all"
              title="Geser untuk memindahkan navbar"
            >
              <GripHorizontal size={16} />
            </button>

            {/* Tombol sembunyikan */}
            <button
              onClick={(e) => { e.preventDefault(); setNavCollapsed(true); }}
              className="flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-2xl min-w-[44px] shrink-0 hover:opacity-75 transition-all active:scale-95"
              title="Sembunyikan navigasi"
            >
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100/50 border border-slate-200/50 text-slate-400 hover:text-slate-600 transition-all">
                <ChevronDown size={16} strokeWidth={2.5} />
              </div>
              <span className="text-[7px] font-bold text-slate-400 uppercase text-center mt-0.5">Sembunyikan</span>
            </button>

            {/* 🔴 Tombol pindah posisi */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowPositionMenu(!showPositionMenu); }}
              className="flex flex-col items-center justify-center gap-1 py-1 px-1.5 rounded-2xl min-w-[44px] shrink-0 hover:opacity-75 transition-all active:scale-95"
              title="Pindahkan posisi navbar"
            >
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100/50 border border-slate-200/50 text-slate-400 hover:text-slate-600 transition-all">
                <ArrowDown size={16} strokeWidth={2.5} />
              </div>
              <span className="text-[7px] font-bold text-slate-400 uppercase text-center mt-0.5">Posisi</span>
            </button>

            {/* Menu item */}
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 transition-all py-1 px-2.5 rounded-2xl min-w-[64px] shrink-0",
                    isActive 
                      ? "scale-105" 
                      : "hover:opacity-75 active:scale-95"
                  )}
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 border" style={{
                    backgroundColor: isActive ? item.accentStyle.backgroundColor : `${item.bgHex}15`,
                    borderColor: isActive ? 'transparent' : `${item.colorHex}40`,
                    boxShadow: isActive ? `0 4px 12px ${item.bgHex}30` : 'none',
                    color: isActive ? 'white' : item.colorHex
                  }}>
                    <div className={cn(
                      "transition-transform duration-200",
                      isActive ? "scale-110" : "scale-100",
                      "[&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:stroke-[2.5]"
                    )} style={{ color: isActive ? 'white' : item.colorHex }}>
                      {item.icon}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[8px] tracking-tight leading-none truncate max-w-[62px] uppercase text-center mt-0.5 font-bold",
                    isActive 
                      ? "font-extrabold" 
                      : "font-black"
                  )} style={{
                    color: isActive ? item.accentStyle.backgroundColor : 'var(--color-text-secondary)'
                  }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

        </div>
      )}

      {/* 🔴 MODAL PILIH POSISI NAVBAR — selalu di tengah layar, pasti terlihat */}
      {showPositionMenu && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
                  <ArrowDown size={16} />
                </div>
                <h3 className="font-black text-slate-800">Posisi Navbar</h3>
              </div>
              <button
                onClick={() => setShowPositionMenu(false)}
                className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pilihan posisi */}
            <div className="p-4 space-y-1.5">
              {[
                { pos: 'bottom' as NavbarPosition, label: 'Bawah', icon: <ArrowDown size={16} /> },
                { pos: 'top' as NavbarPosition, label: 'Atas', icon: <ArrowUp size={16} /> },
                { pos: 'left' as NavbarPosition, label: 'Kiri', icon: <ArrowLeft size={16} /> },
                { pos: 'right' as NavbarPosition, label: 'Kanan', icon: <ArrowRight size={16} /> },
              ].map(opt => (
                <button
                  key={opt.pos}
                  onClick={() => { setNavbarPosition(opt.pos); setShowPositionMenu(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                    navbar.position === opt.pos && !navbar.isCustom
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                      : "text-slate-600 hover:bg-slate-50 border border-transparent"
                  )}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}

              <div className="border-t border-slate-100 my-2" />

              <button
                onClick={() => { setNavbarCustom(16, 16); setShowPositionMenu(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                  navbar.isCustom
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                    : "text-slate-600 hover:bg-slate-50 border border-transparent"
                )}
              >
                <GripHorizontal size={16} /> Geser Bebas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tombol untuk membuka kembali navigasi — compact, di bawah */}
      {navCollapsed && (
        <button
          onClick={() => setNavCollapsed(false)}
          className="fixed bottom-1 left-1/2 -translate-x-1/2 z-[100] flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-all active:scale-95 animate-in slide-in-from-bottom-4 fade-in duration-200 backdrop-blur-sm"
          title="Buka navigasi"
        >
          <ChevronUp size={12} strokeWidth={3} />
          <span className="text-[9px] font-black uppercase tracking-widest">Menu</span>
        </button>
      )}
    </div>
  );
};

export default MainLayout;