/**
 * Qism ekranining yordamchi holatlari: qayta urinish (65% dan kam) va
 * kontent hali kiritilmagan holat. Dizaynda alohida artboard yo'q —
 * shu guruhning ranglari va shriftlarida, eski ekrandagi matnlar bilan.
 */
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { designImages } from '@/constants/v2/designImages';

import { PASS_THRESHOLD } from './lib';
import { CloseButton, Txt, webShadow } from './ui';

function Center({ children }: { children: React.ReactNode }) {
  return <View style={st.center}>{children}</View>;
}

export function RetryView({ percent, onRetry }: { percent: number; onRetry: () => void }) {
  return (
    <Center>
      <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 124, height: 130 }} accessibilityElementsHidden />
      <Txt f="display" size={24} style={{ textAlign: 'center' }} accessibilityRole="header">
        Yana bir bor urinib koʻring!
      </Txt>
      <Txt f="body" size={14} color="#4A5468" lh={20} style={{ textAlign: 'center' }}>
        {percent}% toʻgʻri javob berdingiz. Davom etish uchun kamida {Math.round(PASS_THRESHOLD * 100)}% kerak.
      </Txt>
      <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [st.btn, webShadow('0 5px 0 #1E3FD1'), pressed && { opacity: 0.85 }]}>
        <Txt f="bodyHeavy" size={17} color="#FFFFFF">
          Qayta boshlash
        </Txt>
      </Pressable>
    </Center>
  );
}

export function EmptyPartView({ onClose, text }: { onClose: () => void; text?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <CloseButton onPress={onClose} />
      </View>
      <Center>
        <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 124, height: 130 }} accessibilityElementsHidden />
        <Txt f="bodyBold" size={15} color="#4A5468" lh={21} style={{ textAlign: 'center' }}>
          {text ?? 'Bu dars uchun mashqlar hali tayyorlanmoqda. Birozdan soʻng qayta urinib koʻring.'}
        </Txt>
      </Center>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  btn: { alignSelf: 'stretch', height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
