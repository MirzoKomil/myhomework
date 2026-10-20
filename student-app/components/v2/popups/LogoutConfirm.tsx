/**
 * v2 "Hisobdan chiqasizmi?" oynasi (dizayn: LogoutConfirm).
 *
 * Chiqish mantig'i eski Sozlamalar bilan bir xil: clearAuth + kesh
 * tozalanadi, keyin to'g'ridan-to'g'ri login ekraniga o'tiladi (bosh
 * sahifaga qaytsa eski o'quvchi ma'lumoti ko'rinib qolardi).
 * Dizayndagi fon rasmi — Sozlamalar ekranining xiralashtirilgan surati;
 * bu yerda oyna haqiqiy Sozlamalar ustida ochiladi va fon xiralashtiriladi.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CloseIcon } from '@/components/v2/settings/icons';
import { designImages } from '@/constants/v2/designImages';
import { fonts } from '@/constants/v2/tokens';
import { R } from '@/constants/v2/routes';
import { invalidateCache } from '@/services/contentApi';
import { clearAuth } from '@/services/studentAuthStore';
import { DLogoutConfirm } from '@/components/v2/desktop/profile/DLogoutConfirm';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

export function LogoutConfirmPopup(props: { visible: boolean; onClose: () => void }) {
  // Kompyuterda — markazdagi karta (D_LogoutConfirm dizayni), telefonda — avvalgidek.
  return useIsDesktop() ? <DLogoutConfirm {...props} /> : <LogoutConfirmPopupMobile {...props} />;
}

function LogoutConfirmPopupMobile({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await clearAuth();
      invalidateCache();
    } finally {
      setBusy(false);
      onClose();
      router.replace(R.login as Href);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Dizayndagi xira fon: ostidagi ekran qorong'ilashtirilib, xiralashtiriladi */}
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Yopish" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.column}>
          <View accessibilityRole="alert" accessibilityViewIsModal style={styles.card}>
            <View style={styles.closeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yopish"
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <CloseIcon />
              </Pressable>
            </View>
            <Image
              source={designImages['2cd25447aeeb1dae168031b723ce25b1']}
              accessibilityLabel="Xayrlashayotgan Domik"
              resizeMode="contain"
              style={styles.domik}
            />
            <Text accessibilityRole="header" style={styles.title}>
              Hisobdan chiqasizmi?
            </Text>
            <Text style={styles.body}>
              Oflayn yuklangan darslar oʻchmaydi. Qayta kirish uchun login va parolingiz kerak boʻladi.
            </Text>
            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}
              >
                <Text style={[styles.btnText, { color: '#0B1220' }]}>Bekor qilish</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy }}
                onPress={confirm}
                style={({ pressed }) => [styles.btn, styles.exit, pressed && styles.pressed]}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Chiqish</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(11,18,32,0.69)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } as object) : null),
  },
  column: { width: '100%', maxWidth: 432, alignSelf: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 60px rgba(0,0,0,.35)' } as object)
      : { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 20 }, elevation: 12 }),
  },
  closeRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  domik: { width: 128, height: 118, marginTop: -34 },
  title: {
    fontFamily: fonts.display,
    fontWeight: 'normal',
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.48,
    color: '#0B1220',
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 21,
    color: '#4A5468',
    textAlign: 'center',
  },
  buttons: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: '#EEF1F7' },
  exit: { backgroundColor: '#D92D20' },
  btnText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, lineHeight: 22 },
});
