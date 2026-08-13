/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Native Handler - Web Only Version
 * Untuk pengembangan berbasis web, fitur native tidak tersedia
 */

export class NativeHandler {
  private static initialized = false;

  static init() {
    if (this.initialized) return;
    console.log("ℹ️ Native features tidak tersedia di web platform");
    this.initialized = true;
  }

  /**
   * No-op untuk web platform
   */
  static enableWakeLock() {
    console.log("ℹ️ Wake Lock tidak tersedia di web platform");
  }
}