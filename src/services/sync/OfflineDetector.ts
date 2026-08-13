/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Offline Detection Service
 * 
 * Strategi deteksi:
 * - Status "online/offline" ditentukan oleh navigator.onLine (event browser).
 * - Tidak memakai fetch health-check eksternal, karena:
 *   - google.com/favicon.ico → diblokir CORS
 *   - root supabase.co/ → 404 tanpa header CORS
 *   - /auth/v1/health → 401 (butuh apikey)
 *   Semua itu hanya menimbulkan noise di console tanpa menambah akurasi,
 *   karena navigator.onLine sudah menjadi sumber kebenaran yang andal.
 */

export type OnlineStatusCallback = (isOnline: boolean) => void;

class OfflineDetector {
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<OnlineStatusCallback> = new Set();

  constructor() {
    this.setupListeners();
  }

  /**
   * Setup online/offline event listeners (sumber kebenaran status)
   */
  private setupListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Handle online event
   */
  private handleOnline() {
    if (!this.isOnline) {
      this.isOnline = true;
      console.log('✅ Online - Starting sync...');
      this.notifyListeners(true);
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline() {
    if (this.isOnline) {
      this.isOnline = false;
      console.log('❌ Offline - Working in offline mode');
      this.notifyListeners(false);
    }
  }

  /**
   * Subscribe ke status perubahan online/offline
   */
  subscribe(callback: OnlineStatusCallback): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify semua listeners tentang perubahan status
   */
  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach((callback) => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error('Error in offline detector callback:', error);
      }
    });
  }

  /**
   * Get current online status
   */
  getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Cleanup (jika diperlukan)
   */
  destroy() {
    this.listeners.clear();
  }

  /**
   * Manual check (untuk testing atau force check)
   */
  async checkNow(): Promise<boolean> {
    return this.isOnline;
  }
}

// Export singleton instance
export const offlineDetector = new OfflineDetector();