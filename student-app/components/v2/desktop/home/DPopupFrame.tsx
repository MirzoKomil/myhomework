/**
 * Kompyuter popup'lari uchun umumiy ramka: haqiqiy sahifa ustida
 * xiralashtirilgan + qoraytirilgan fon (dizayndagi fon rasmlari — sahifaning
 * xira skrinshoti; ilovada esa sahifaning o'zi ko'rinadi), markazda karta.
 * Esc yoki fonni bosish — yopadi.
 */
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';

export function DPopupFrame({ visible, onClose, width, children }: { visible: boolean; onClose: () => void; width: number; children: ReactNode }) {
  useDesktopKeys({ Escape: onClose }, visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <Pressable accessibilityLabel="Yopish" onPress={onClose} style={[StyleSheet.absoluteFill, s.backdrop]} />
        <View accessibilityViewIsModal role="dialog" aria-modal style={[s.card, { width }]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  // Dizayn fonidan o'lchangan: #F4F6FA → #757882 (≈ #0B1220 55%).
  backdrop: {
    backgroundColor: 'rgba(11,18,32,0.55)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as object) : null),
  },
  card: {
    maxWidth: '100%',
    maxHeight: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    gap: 18,
    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
  },
});
