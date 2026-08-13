/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * UUID Generator untuk ID lokal di IndexedDB
 */

import { v4 as uuidv4, v5 as uuidv5, NIL as NAMESPACE_NIL } from 'uuid';

/**
 * Generate UUID v4 (random)
 * Digunakan untuk ID baru yang dibuat di lokal
 */
export const generateUUID = (): string => {
  return uuidv4();
};

/**
 * Generate UUID v5 (deterministic)
 * Digunakan untuk generate ID berdasarkan namespace + data
 * Contoh: generateUUIDv5('user-email', 'admin@example.com') selalu menghasilkan ID yang sama
 */
export const generateUUIDv5 = (namespace: string, data: string): string => {
  // Gunakan NIL namespace sebagai base
  return uuidv5(data, NAMESPACE_NIL);
};

/**
 * Validate apakah string adalah valid UUID
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Generate ID dengan prefix (contoh: "user_550e8400-e29b-41d4-a716-446655440000")
 */
export const generatePrefixedUUID = (prefix: string): string => {
  return `${prefix}_${generateUUID()}`;
};
