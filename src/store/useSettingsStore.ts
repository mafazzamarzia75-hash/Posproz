/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface LabelPreset {
  id: string;
  name: string;
  /** Lebar label dalam mm */
  widthMm: number;
  /** Tinggi label dalam mm */
  heightMm: number;
  /** Jumlah label per baris (untuk layout grid) */
  columns: number;
  /** Ukuran font harga */
  priceFontSize?: number;
  /** Ukuran font nama produk */
  nameFontSize?: number;
  /** Tampilkan harga */
  showPrice: boolean;
  /** Tampilkan nama produk */
  showName: boolean;
  /** Tampilkan barcode */
  showBarcode: boolean;
}

/** Preset ukuran label standar yang umum digunakan */
export const LABEL_PRESETS: LabelPreset[] = [
  // === Label Barcode Produk (Harga + Nama + Barcode) ===
  { id: '58x30', name: 'Thermal 58×30mm', widthMm: 58, heightMm: 30, columns: 1, showPrice: true, showName: true, showBarcode: true, priceFontSize: 9, nameFontSize: 7 },
  { id: '58x40', name: 'Thermal 58×40mm', widthMm: 58, heightMm: 40, columns: 1, showPrice: true, showName: true, showBarcode: true, priceFontSize: 11, nameFontSize: 8 },
  { id: '80x30', name: 'Thermal 80×30mm', widthMm: 80, heightMm: 30, columns: 1, showPrice: true, showName: true, showBarcode: true, priceFontSize: 9, nameFontSize: 7 },
  { id: '80x50', name: 'Thermal 80×50mm', widthMm: 80, heightMm: 50, columns: 1, showPrice: true, showName: true, showBarcode: true, priceFontSize: 14, nameFontSize: 10 },
  { id: '40x25', name: 'Label Kecil 40×25mm', widthMm: 40, heightMm: 25, columns: 2, showPrice: true, showName: false, showBarcode: true, priceFontSize: 8, nameFontSize: 6 },
  { id: 'a4-grid', name: 'A4 Grid 10×6 (63.5×33.9mm)', widthMm: 63.5, heightMm: 33.9, columns: 3, showPrice: true, showName: true, showBarcode: true, priceFontSize: 10, nameFontSize: 8 },

  // === Label Rak (Shelf Label) — Nama Produk besar + Harga besar, tanpa barcode ===
  { id: 'shelf-100x50', name: '🏷️ Label Rak 100×50mm', widthMm: 100, heightMm: 50, columns: 1, showPrice: true, showName: true, showBarcode: false, priceFontSize: 18, nameFontSize: 12 },
  { id: 'shelf-100x40', name: '🏷️ Label Rak 100×40mm', widthMm: 100, heightMm: 40, columns: 1, showPrice: true, showName: true, showBarcode: false, priceFontSize: 16, nameFontSize: 10 },
  { id: 'shelf-80x50', name: '🏷️ Label Rak 80×50mm', widthMm: 80, heightMm: 50, columns: 1, showPrice: true, showName: true, showBarcode: false, priceFontSize: 16, nameFontSize: 11 },
  { id: 'shelf-80x35', name: '🏷️ Label Rak 80×35mm', widthMm: 80, heightMm: 35, columns: 1, showPrice: true, showName: true, showBarcode: false, priceFontSize: 14, nameFontSize: 9 },
  { id: 'shelf-58x40', name: '🏷️ Label Rak 58×40mm', widthMm: 58, heightMm: 40, columns: 1, showPrice: true, showName: true, showBarcode: false, priceFontSize: 14, nameFontSize: 9 },
  { id: 'shelf-58x30', name: '🏷️ Label Rak 58×30mm', widthMm: 58, heightMm: 30, columns: 1, showPrice: true, showName: true, showBarcode: false, priceFontSize: 12, nameFontSize: 8 },
];

/** Posisi navbar yang bisa dipindahkan pengguna */
export type NavbarPosition = 'bottom' | 'top' | 'left' | 'right';

interface SettingsState {
  isWholesaleMode: boolean;
  darkMode: boolean;
  storeInfo: {
    name: string;
    address: string;
    phone: string;
    footer: string;
  };
  printer: {
    /** Lebar kertas thermal (umum: 58mm / 80mm) */
    paperWidthMm: 58 | 80;
    /** Tambahan tinggi halaman (mm) untuk kompensasi printer/driver yang suka memotong bawah */
    extraPageHeightMm: number;
    /** Mode render barcode untuk print (beberapa driver lebih cocok PNG dibanding SVG, atau sebaliknya) */
    barcodeRenderMode: 'svg' | 'png';
  };
  label: {
    /** Preset ukuran label aktif */
    activePreset: string;
    /** Margin antar label (mm) */
    gapMm: number;
    /** Margin halaman (mm) */
    marginMm: number;
  };
  /** 🔴 Posisi navbar yang bisa digeser pengguna */
  navbar: {
    position: NavbarPosition;
    /** Koordinat custom (px) saat navbar di-drag bebas */
    x: number;
    y: number;
    /** Apakah navbar sedang di posisi custom (bukan snap) */
    isCustom: boolean;
  };
  toggleWholesaleMode: () => void;
  toggleDarkMode: () => void;
  updateStoreInfo: (info: Partial<SettingsState['storeInfo']>) => void;
  updatePrinterSettings: (printer: Partial<SettingsState['printer']>) => void;
  updateLabelSettings: (label: Partial<SettingsState['label']>) => void;
  /** 🔴 Set posisi navbar (snap ke preset) */
  setNavbarPosition: (position: NavbarPosition) => void;
  /** 🔴 Set koordinat custom navbar (drag bebas) */
  setNavbarCustom: (x: number, y: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isWholesaleMode: false,
      darkMode: false,
      storeInfo: {
        name: 'Toko Ceria',
        address: 'Jl. Merdeka No. 123, Jakarta',
        phone: '0812-3456-7890',
        footer: 'Terima Kasih Atas Kunjungan Anda!'
      },
      printer: {
        paperWidthMm: 58,
        extraPageHeightMm: 0,
        barcodeRenderMode: 'svg',
      },
      label: {
        activePreset: '58x30',
        gapMm: 2,
        marginMm: 3,
      },
      navbar: {
        position: 'bottom',
        x: 0,
        y: 0,
        isCustom: false,
      },
      toggleWholesaleMode: () => set((state) => ({ isWholesaleMode: !state.isWholesaleMode })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      updateStoreInfo: (info) => set((state) => ({ 
        storeInfo: { ...state.storeInfo, ...info } 
      })),
      updatePrinterSettings: (printer) => set((state) => ({
        printer: { ...state.printer, ...printer },
      })),
      updateLabelSettings: (label) => set((state) => ({
        label: { ...state.label, ...label },
      })),
      setNavbarPosition: (position) => set((state) => ({
        navbar: { ...state.navbar, position, isCustom: false },
      })),
      setNavbarCustom: (x, y) => set((state) => ({
        navbar: { ...state.navbar, x, y, isCustom: true },
      })),
    }),
    {
      name: 'pos-app-settings',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      // 🔴 Pastikan state baru selalu punya field navbar (untuk upgrade dari versi lama)
      // Hanya gabungkan field data (bukan fungsi) agar fungsi store tidak tertimpa undefined
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<SettingsState>;
        return {
          ...currentState,
          isWholesaleMode: persisted.isWholesaleMode ?? currentState.isWholesaleMode,
          darkMode: persisted.darkMode ?? currentState.darkMode,
          storeInfo: { ...currentState.storeInfo, ...(persisted.storeInfo ?? {}) },
          printer: { ...currentState.printer, ...(persisted.printer ?? {}) },
          label: { ...currentState.label, ...(persisted.label ?? {}) },
          navbar: persisted.navbar ?? currentState.navbar,
        };
      },
    }
  )
);
