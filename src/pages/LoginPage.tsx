/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Halaman Login
 * Autentikasi user dengan username & password
 * Default admin: admin / admin123
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { indexdbUser } from '@/lib/indexdbUser';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Jika sudah login, redirect ke page sesuai role
  useEffect(() => {
    if (indexdbUser.isLoggedIn()) {
      const user = indexdbUser.getCurrentUser();
      if (user) {
        if (user.role === 'admin' || user.role === 'super_admin') navigate('/', { replace: true });
        else if (user.role === 'kasir') navigate('/pos', { replace: true });
        else if (user.role === 'gudang') navigate('/inventory', { replace: true });
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await indexdbUser.login(username, password);
      if (result.success) {
        const user = indexdbUser.getCurrentUser();
        if (user) {
          if (user.role === 'admin' || user.role === 'super_admin') navigate('/', { replace: true });
          else if (user.role === 'kasir') navigate('/pos', { replace: true });
          else if (user.role === 'gudang') navigate('/inventory', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(result.error || 'Login gagal');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#10B981] to-emerald-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-[28px] flex items-center justify-center mx-auto shadow-lg">
            <Store size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mt-4 tracking-tight">POS Kasir</h1>
          <p className="text-emerald-100 font-bold text-sm mt-1">Sistem Kasir Offline</p>
        </div>

        {/* Card Login */}
        <div className="bg-white rounded-[40px] p-8 shadow-2xl">
          <h2 className="text-xl font-black text-slate-800 tracking-tight mb-6">Masuk</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-[16px] flex items-center gap-3">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full bg-slate-50 border border-slate-100 pl-10 pr-12 py-4 rounded-2xl font-bold text-slate-700 focus:border-[#10B981] focus:bg-white outline-none transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#10B981] hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Lock size={18} />
              )}
              MASUK
            </button>
          </form>


        </div>
      </div>
    </div>
  );
};

export default LoginPage;