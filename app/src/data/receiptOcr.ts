import { NativeModules, Platform } from 'react-native';
import type { ReceiptLine } from '@yumo/shared';
import { flattenReceiptBlocks } from './receiptOcrMap';

/**
 * On-device receipt OCR (Kitchen §5). Thin adapter over ML Kit text recognition
 * so the vendor never leaks into the UI — swap the import here for a different
 * engine and nothing else changes. Native-only: `ocrAvailable` is false on web
 * and in Expo Go (module unlinked), where the ReceiptSheet falls back to paste.
 */

/** True only where the native recognizer is actually linked (a dev / EAS build). */
export const ocrAvailable: boolean = Platform.OS !== 'web' && NativeModules.TextRecognition != null;

/** Photograph/library image URI → receipt lines for `parseReceipt`. */
export async function ocrReceipt(uri: string): Promise<ReceiptLine[]> {
  const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
  const result = await TextRecognition.recognize(uri);
  return flattenReceiptBlocks(result.blocks);
}
