/**
 * v2 Darajalar (dizayn: 41 · Levels).
 *
 * Eski profile/levels.tsx bilan bir xil manba: chaqmoq soni
 * (lightningStore) va data/levels.ts dagi oraliqlar. "Taxminan N kun" —
 * dizayndagi "kuniga o'rtacha ~50 ta" stavkasidan hisoblanadi.
 */
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEVEL_BADGES, LevelUpPopup, levelName } from '@/components/v2/popups/LevelUp';
import { BoltFill, ChevronRightIcon, LockIcon, TICK2, TickIcon } from '@/components/v2/rewards/icons';
import { fmt, ScreenHeader } from '@/components/v2/rewards/parts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { getLevelProgress, LEVELS } from '@/data/levels';
import { useLang } from '@/i18n/LanguageContext';
import { useLightning } from '@/services/lightningStore';

const PER_DAY = 50;

export default function V2Levels() {
  const lightning = useLightning();
  const { courseLang } = useLang();
  const progress = getLevelProgress(lightning);
  const curIdx = LEVELS.findIndex((l) => l.key === progress.level.key);
  const [popup, setPopup] = useState(false);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Darajalar" fallback={R.profile} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.hero}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Image source={LEVEL_BADGES[curIdx]} accessibilityLabel={`${curIdx + 1}-daraja nishoni`} style={{ width: 76, height: 80 }} resizeMode="contain" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.heroOver}>Hozirgi daraja</Text>
                <Text style={styles.heroTitle}>{curIdx + 1} · {levelName(curIdx, courseLang)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <BoltFill size={18} color="#FFC93C" />
                  <Text style={styles.heroBolt}>{fmt(lightning)} chaqmoq</Text>
                </View>
              </View>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progress.progressPercent }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${progress.progressPercent}%` }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              {progress.next ? (
                <Text style={styles.heroFoot}>
                  Keyingisi: <Text style={{ fontFamily: fonts.bodyHeavy }}>{fmt(progress.remaining)} chaqmoq</Text> · taxminan {Math.max(1, Math.ceil(progress.remaining / PER_DAY))} kun
                </Text>
              ) : (
                <Text style={styles.heroFoot}>Eng yuqori darajadasiz</Text>
              )}
              <Text style={styles.heroFoot}>{progress.progressPercent}%</Text>
            </View>
          </View>

          <View style={styles.list}>
            {LEVELS.map((l, i) => {
              const reached = lightning >= l.min;
              const current = i === curIdx;
              return (
                <View key={l.key} style={[styles.row, i < LEVELS.length - 1 && styles.rowBorder, current && { backgroundColor: '#F0EBFF' }]}>
                  <Image source={LEVEL_BADGES[i]} accessibilityLabel={`${i + 1}-daraja nishoni`} style={[{ width: 46, height: 46 }, !reached && { opacity: 0.55 }]} resizeMode="contain" />
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text style={styles.rowTitle}>{i + 1} · {levelName(i, courseLang)}</Text>
                    <Text style={styles.rowSub}>{l.max ? `${fmt(l.min)}–${fmt(l.max)}` : `${fmt(l.min)}+`} chaqmoq</Text>
                  </View>
                  {current ? (
                    <View style={styles.here}><Text style={styles.hereText}>Siz shu yerdasiz</Text></View>
                  ) : reached ? (
                    <View style={styles.done}><TickIcon size={15} color="#087A4A" strokeWidth={3} d={TICK2} /></View>
                  ) : (
                    <LockIcon />
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.note}>
            <BoltFill size={20} />
            <Text style={styles.noteText}>Chaqmoq — dars, vazifa, mashq va jonli darsdan. Kuniga oʻrtacha ~50 ta.</Text>
          </View>

          <Pressable accessibilityRole="button" onPress={() => setPopup(true)} style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]}>
            <Text style={styles.linkText}>Darajaga chiqqanda nima boʻladi?</Text>
            <ChevronRightIcon color="#5A2FD6" strokeWidth={2.2} />
          </Pressable>
        </View>
      </ScrollView>
      <LevelUpPopup visible={popup} onClose={() => setPopup(false)} levelIndex={Math.min(curIdx + 1, LEVELS.length - 1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 32 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 12 },
  hero: { backgroundColor: '#6A3CF0', borderRadius: 26, paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  heroOver: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, lineHeight: 16, letterSpacing: 0.72, textTransform: 'uppercase', color: '#FFFFFF' },
  heroTitle: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 28, lineHeight: 31, color: '#FFFFFF' },
  heroBolt: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  track: { height: 10, borderRadius: 5, backgroundColor: '#5A2FD6', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#FFC93C' },
  heroFoot: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#FFFFFF', flexShrink: 1 },
  list: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  row: { minHeight: 64, paddingVertical: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, lineHeight: 20, color: '#0B1220' },
  rowSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  here: { height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#6A3CF0', justifyContent: 'center' },
  hereText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 11, color: '#FFFFFF' },
  done: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 4 },
  noteText: { flex: 1, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 19, color: '#4A5468' },
  link: { height: 48, borderRadius: 16, backgroundColor: '#F0EBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  linkText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#5A2FD6' },
});
