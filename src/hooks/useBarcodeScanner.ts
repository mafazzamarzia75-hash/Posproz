/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { scannerService } from '../services/hardware/ScannerService';

// Hook untuk menangkap input scanner barcode secara global (HID Keyboard Mode)
export const useBarcodeScanner = (onScan: (code: string) => void) => {
  useEffect(() => {
    scannerService.start();
    const unsubscribe = scannerService.subscribe(onScan);

    return () => {
      unsubscribe();
      scannerService.stop();
    };
  }, [onScan]);
};
