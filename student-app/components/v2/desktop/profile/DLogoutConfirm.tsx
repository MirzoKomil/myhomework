/**
 * Kompyuter: "Hisobdan chiqasizmi?" oynasi (dizayn: D_LogoutConfirm).
 *
 * Chiqish mantig'i mobil oyna (popups/LogoutConfirm.tsx) bilan aynan bir
 * xil: clearAuth + kesh tozalanadi, keyin login ekraniga o'tiladi.
 * Markazdagi 480px karta, fon — sahifaning o'zi (xira + qoraytirilgan).
 * Esc yoki fon — yopish (DPopupFrame).
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DPopupFrame } from '@/components/v2/desktop/home/DPopupFrame';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { invalidateCache } from '@/services/contentApi';
import { clearAuth } from '@/services/studentAuthStore';

import { CloseIcon, H, LogoutIcon, T } from './ui';

export function DLogoutConfirm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
    <DPopupFrame visible={visible} onClose={onClose} width={480}>
      <View accessibilityRole="alert" style={{ gap: 18 }}>
        <View style={s.closeRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={s.close}>
            <CloseIcon />
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Image source={designImages['2cd25447aeeb1dae168031b723ce25b1']} accessibilityLabel="Xayrlashayotgan Domik" style={{ width: 140, height: 140 }} resizeMode="contain" />
          <H size={28} role="header" style={{ textAlign: 'center' }}>
            Hisobdan chiqasizmi?
          </H>
          <T f="body" size={15} color="#4A5468" lh={23.25} style={{ textAlign: 'center' }}>
            Oflayn yuklangan darslar oʻchmaydi. Qayta kirish uchun login va parolingiz kerak boʻladi.
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
          <Pressable accessibilityRole="button" onPress={onClose} style={[s.btn, s.cancel]}>
            <T size={15}>Bekor qilish</T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ busy }} onPress={confirm} style={[s.btn, s.exit]}>
            <LogoutIcon size={19} color="#FFFFFF" sw={2.4} />
            <T size={15} color="#FFFFFF">
              Chiqish
            </T>
          </Pressable>
        </View>
      </View>
    </DPopupFrame>
  );
}

const s = StyleSheet.create({
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: -44, zIndex: 1 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  btn: { flex: 1, height: 54, paddingHorizontal: 22, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  cancel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE' },
  exit: { backgroundColor: '#D92D20', boxShadow: '0 5px 0 #B42318' },
});
