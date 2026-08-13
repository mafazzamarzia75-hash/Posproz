import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { migrateLegacyToDexie } from './lib/migrateLegacy';

// 🔄 Migrasi satu kali: IndexedDB legacy → Dexie (PosPro_OfflineDB)
// Agar aplikasi hanya memakai SATU jalur penyimpanan (Dexie).
// Aman dijalankan ulang — data yang sudah ada di Dexie tidak ditimpa.
migrateLegacyToDexie().catch(e => {
  console.warn('Migrasi legacy → Dexie gagal (non-fatal):', e);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
