/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 🚀 FIREBASE CLIENT - DATA GATEWAY
 * ✅ Mengubungkan aplikasi React langsung ke Google Firestore Cloud Database
 * ✅ Mendukung Penanganan Kendala Keamanan & Pengujian Konektivitas
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Inisialisasi Aplikasi Firebase - DEACTIVATED AS REQUESTED
export const isFirebaseConfigured = false;
export const app = null as any;
export const db = null as any;
export const auth = null as any;

console.log("🟡 [Firebase]: Layanan SDK dinonaktifkan sesuai dengan permintaan perubahan database.");


// Pengujian Koneksi Online ke Server Firestore
async function testFirebaseConnection() {
  if (!isFirebaseConfigured) return;
  try {
    // Jalankan getDocFromServer pada lokasi dummy untuk memicu handshake
    await getDocFromServer(doc(db, 'system', 'handshake'));
    console.log("🟢 [Firebase]: Koneksi ke Firestore Cloud Server berhasil diverifikasi.");
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("⚠️ [Firebase]: Klien sedang offline atau memiliki gangguan konektivitas.");
    } else {
      console.log("ℹ️ [Firebase]: Handshake selesai (handshake doc might not exist yet, which is normal).");
    }
  }
}

// Lakukan sign-in otomatis jika Firebase terkonfigurasi
if (isFirebaseConfigured) {
  signInAnonymously(auth)
    .then((userCred) => {
      console.log("🟢 [Firebase]: Pengguna terotentikasi secara anonim, UID:", userCred.user.uid);
      testFirebaseConnection();
    })
    .catch((err) => {
      if (err && err.code === 'auth/admin-restricted-operation') {
        console.warn("⚠️ [Firebase]: Autentikasi anonim dinonaktifkan/dibatasi di Firebase Console. Beroperasi dalam mode unauthenticated hybrid secara mulus.");
      } else {
        console.warn("⚠️ [Firebase]: Kendala masuk anonim:", err);
      }
      // Tetap uji konektivitas karena gerbang aturan keamanan kami sudah dikonfigurasi untuk menerima request secara aman tanpa auth
      testFirebaseConnection();
    });
}

// --- Firestore Zero-Trust Error Handling (Mandatory Security Skill Requirement) ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Tangkap kegagalan hak akses (Missing or insufficient permissions) dan bungkus dengan informasi terperinci
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  const errString = JSON.stringify(errInfo);
  console.error('❌ [Firestore SecAudit Error]: ', errString);
  throw new Error(errString);
}
