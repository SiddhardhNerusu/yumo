import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, Platform } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useTheme } from '../theme';
import { Serif, PrimaryButton, TextLink } from './kit';
import { haptics } from '../haptics';

// Food packages use linear symbologies — restrict to these (mirrors the Goyo
// scanner) so the detector is cheap and never fires on a stray QR code.
const TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14'] as const;

/**
 * Full-screen barcode scanner (native). Fires `onScanned` exactly once with a
 * digits-only EAN (`firedRef` guards the multi-frame race), then the caller
 * resolves it via OpenFoodFacts. Web has no reliable camera-scan path, so it
 * shows a hint to type the number into search instead.
 */
export function BarcodeScanner({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (ean: string) => void }) {
  const { c } = useTheme();
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (visible) { firedRef.current = false; setTorch(false); }
  }, [visible]);

  const handle = (r: BarcodeScanningResult) => {
    if (firedRef.current) return;
    const digits = (r.data ?? '').replace(/\D/g, '');
    if (digits.length < 6) return;
    firedRef.current = true;
    haptics.success();
    onScanned(digits);
  };

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>{children}</View>
    </Modal>
  );

  if (Platform.OS === 'web') {
    return (
      <Frame>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Serif size={22} weight="medium" color="#F7F2EA">Scanning needs the app</Serif>
          <Text style={{ color: '#C7BBAA', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            Camera barcode scanning runs on your phone. For now, type the number into search — it resolves the same way.
          </Text>
          <View style={{ marginTop: 8, alignSelf: 'stretch' }}><PrimaryButton label="Got it" onPress={onClose} full /></View>
        </View>
      </Frame>
    );
  }

  if (!perm) return null; // permissions still loading
  if (!perm.granted) {
    return (
      <Frame>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Serif size={22} weight="medium" color="#F7F2EA">Camera access</Serif>
          <Text style={{ color: '#C7BBAA', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            {perm.canAskAgain ? 'Allow camera to scan a barcode.' : 'Enable camera for Yumo in Settings to scan barcodes.'}
          </Text>
          <View style={{ marginTop: 8, alignSelf: 'stretch', gap: 10 }}>
            {perm.canAskAgain ? <PrimaryButton label="Allow camera" onPress={requestPerm} full /> : null}
            <View style={{ alignItems: 'center' }}><TextLink label="Cancel" onPress={onClose} tone="neutral" /></View>
          </View>
        </View>
      </Frame>
    );
  }

  return (
    <Frame>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...TYPES] }}
        onBarcodeScanned={handle}
      />
      {/* overlay: scan frame + controls, outside the camera surface */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20 }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#F7F2EA', fontSize: 20, fontWeight: '600' }}>✕</Text>
          </Pressable>
          <Pressable onPress={() => setTorch((t) => !t)} hitSlop={12} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: torch ? c('accent') : 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>🔦</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 250, height: 160, borderRadius: 18, borderWidth: 3, borderColor: c('accent') }} />
          <Text style={{ color: '#F7F2EA', fontSize: 14, marginTop: 18, textShadowColor: '#000', textShadowRadius: 6 }}>Point at a barcode</Text>
        </View>
        <View style={{ height: 80 }} />
      </View>
    </Frame>
  );
}
