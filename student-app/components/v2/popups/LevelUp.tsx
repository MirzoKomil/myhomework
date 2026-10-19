/**
 * "Yangi daraja!" oynasi (dizayn: 42 · LevelUp).
 *
 * Darajalar eski data/levels.ts dan (chaqmoq oralig'i bo'yicha). Daraja
 * oshganda coin sovg'asi serverda/ilovada YO'Q — shuning uchun coin
 * kartasi 0 ko'rsatadi (coinReward berilmasa), soxta raqam yo'q.
 */
import { router } from 'expo-router';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BoltFill, CloseIcon, CoinFill } from '@/components/v2/rewards/icons';
import { fmt } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { LEVELS } from '@/data/levels';
import { useLang } from '@/i18n/LanguageContext';

/** Har bir daraja nishoni — dizayn rasmlari (1..5). */
export const LEVEL_BADGES = [
  designImages.e0075f409ade6741e1515b9b344c2571,
  designImages['02122e23f58cb07d26e8524e55ccb8b0'],
  designImages['5b5ad36506e557f32656fd97d291d0e3'],
  designImages['5cf848e6643888e0c2ffc873dc37c6a3'],
  designImages.f561781d559c63b7ef26fcbf36820493,
];

/** Daraja nomi: oxirgisi kurs brendiga qarab (Domwork / Homework afsonasi). */
export function levelName(index: number, courseLang: string) {
  if (index === LEVELS.length - 1) return `${courseLang === 'russian' ? 'Domwork' : 'Homework'} afsonasi`;
  return LEVELS[index].name;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Ko'rsatiladigan daraja (0..4); berilmasa eng yuqori daraja. */
  levelIndex?: number;
  /** Daraja oshganda beriladigan coin — hozir bunday sovg'a yo'q, shuning uchun 0. */
  coinReward?: number;
};

export function LevelUpPopup({ visible, onClose, levelIndex = LEVELS.length - 1, coinReward = 0 }: Props) {
  const { courseLang } = useLang();
  const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  const level = LEVELS[idx];
  const isTop = idx === LEVELS.length - 1;
  const name = levelName(idx, courseLang);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Yopish" onPress={onClose} />
        <View style={styles.wrap} pointerEvents="box-none">
          <View accessibilityViewIsModal style={styles.card}>
            <View style={styles.top}>
              <View style={styles.chip}>
                <BoltFill />
                <Text style={styles.chipText}>{fmt(level.min)} chaqmoq</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={styles.close}>
                <CloseIcon />
              </Pressable>
            </View>
            <View style={styles.art}>
              <Image source={designImages.cd192c1f07c6ae01a6b80b26d84e0ec7} accessibilityLabel="Quvonayotgan Domik" style={styles.domik} resizeMode="contain" />
              <Image source={LEVEL_BADGES[idx]} accessibilityLabel={`${idx + 1}-daraja nishoni`} style={styles.badge} resizeMode="contain" />
            </View>
            <View style={{ gap: 4, alignItems: 'center' }}>
              <Text style={styles.over}>Yangi daraja!</Text>
              <Text accessibilityRole="header" style={styles.title}>{idx + 1} · {name}</Text>
              <Text style={styles.desc}>
                {isTop
                  ? 'Siz eng yuqori darajaga chiqdingiz. Profilingizda oltin nishon paydo boʻladi.'
                  : `${level.description}. Profilingizda yangi nishon paydo boʻladi.`}
              </Text>
            </View>
            <View style={styles.grid}>
              <View style={[styles.tile, { backgroundColor: '#FFF4D1' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <CoinFill size={20} />
                  <Text style={[styles.tileBig, { color: '#7A5300' }]}>+{fmt(coinReward)}</Text>
                </View>
                <Text style={[styles.tileSmall, { color: '#7A5300' }]}>coin sovgʻa</Text>
              </View>
              <View style={[styles.tile, { backgroundColor: '#F0EBFF' }]}>
                <Text style={[styles.tileBig, { color: '#5A2FD6' }]} numberOfLines={1}>{isTop ? 'Oltin' : level.name}</Text>
                <Text style={[styles.tileSmall, { color: '#5A2FD6' }]}>profil nishoni</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                router.push(R.home as never);
              }}
              style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}
            >
              <Text style={styles.ctaText}>Davom etish</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,18,32,0.35)' },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, width: '100%', maxWidth: 480, alignSelf: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,.35)',
  },
  top: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#F0EBFF', flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#5A2FD6' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  art: { width: 250, height: 190, marginTop: -8 },
  domik: { position: 'absolute', left: 0, top: 0, width: 196, height: 188 },
  badge: { position: 'absolute', right: -4, bottom: 0, width: 104, height: 91 },
  over: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, letterSpacing: 1.04, textTransform: 'uppercase', color: '#5A2FD6' },
  title: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 28, lineHeight: 31, letterSpacing: -0.56, color: '#0B1220', textAlign: 'center' },
  desc: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 14, lineHeight: 20, color: '#4A5468', textAlign: 'center' },
  grid: { alignSelf: 'stretch', flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 18, padding: 10, alignItems: 'center', gap: 2 },
  tileBig: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 22, lineHeight: 28 },
  tileSmall: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, lineHeight: 16 },
  cta: { alignSelf: 'stretch', height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#FFFFFF' },
});
