/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ✅ Platform Detector - Web Only Version
 * Semua platform detection mengembalikan web
 */

/**
 * Selalu false - web tidak menggunakan Tauri
 */
export function isTauri(): boolean {
  return false;
}

/**
 * Selalu false - web platform bukan native platform
 */
export function isNativePlatform(): boolean {
  return false;
}

/**
 * Selalu mengembalikan 'web'
 */
export function getPlatformName(): string {
  return 'web';
}

/**
 * Selalu false - SQLite native tidak tersedia di web
 */
export function hasSqliteSupport(): boolean {
  return false;
}