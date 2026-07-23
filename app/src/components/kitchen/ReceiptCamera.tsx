import { useRef } from 'react';
import { Modal, View, Text, Pressable, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../../theme';
import { Serif, PrimaryButton, TextLink } from '../kit';
import { haptics } from '../../haptics';

/**
 * Full-screen receipt camera (native). Point at a receipt, tap the shutter →
 * `onCapture(uri)` with the photo. Permission is requested on open (not at boot).
 * Web has no path here — the ReceiptSheet only opens this when OCR is available.
 */
export function ReceiptCamera({ visible, onCapture, onClose }: { visible: boolean; onCapture: (uri: string) => void; onClose: () => void }) {
  const { c } = useTheme();
  const [perm, requestPerm] = useCameraPermissions();
  const ref = useRef<CameraView>(null);

  const shoot = async () => {
    try {
      const pic = await ref.current?.takePictureAsync({ quality: 0.6 });
      if (pic?.uri) { haptics.success(); onCapture(pic.uri); }
    } catch {
      onClose();
    }
  };

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>{children}</View>
    </Modal>
  );

  if (Platform.OS === 'web') return null;
  if (!perm) return null;
  if (!perm.granted) {
    return (
      <Frame>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Serif size={22} weight="medium" color="#F7F2EA">Camera access</Serif>
          <Text style={{ color: '#C7BBAA', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            {perm.canAskAgain ? 'Allow the camera to photograph your receipt.' : 'Enable camera for Yumo in Settings to scan receipts.'}
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
      <CameraView ref={ref} style={{ flex: 1 }} facing="back" />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View style={{ flexDirection: 'row', paddingTop: 56, paddingHorizontal: 20 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close camera" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#F7F2EA', fontSize: 20, fontWeight: '600' }}>✕</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 44, gap: 18 }}>
          <Text style={{ color: '#F7F2EA', fontSize: 14, textShadowColor: '#000', textShadowRadius: 6 }}>Fit the whole receipt in frame</Text>
          <Pressable onPress={shoot} accessibilityRole="button" accessibilityLabel="Take photo" style={{ width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#F7F2EA', backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: c('accent') }} />
          </Pressable>
        </View>
      </View>
    </Frame>
  );
}
