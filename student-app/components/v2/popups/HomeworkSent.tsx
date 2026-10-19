/**
 * v2 "Vazifa tekshirildi" pastki oynasi (dizayn: HomeworkSent).
 *
 * Uyga vazifaning barcha avtomatik tekshiriladigan qismlari tugagach
 * ko'rsatiladi. Raqamlar (to'g'ri javoblar, coin, xatolar) — har bir qism
 * tugaganda scoreStore'ga yozilgan haqiqiy natijalar.
 */
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bounce } from '@/components/v2/motion';
import { playSfx } from '@/services/sfx';
import { speak } from '@/services/voicePraise';

import { ChevronRight, CloseIcon, Coin } from '@/components/v2/homework/icons';
import { partLabel, partQuestionCount } from '@/components/v2/homework/lib';
import type { PartScore } from '@/components/v2/homework/scoreStore';
import { Txt, webShadow } from '@/components/v2/homework/ui';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';

type Props = {
  visible: boolean;
  onClose: () => void;
  lessonId?: string;
  lessonNumber?: number;
  /** Avtomatik tekshiriladigan qismlar (ustoz tekshiradiganlar kirmaydi). */
  parts?: HomeworkPart[];
  scores?: Record<string, PartScore>;
};

export function HomeworkSentPopup({ visible, onClose, lessonId, lessonNumber, parts = [], scores = {} }: Props) {
  const insets = useSafeAreaInsets();
  const rows = parts.map((p) => {
    const total = partQuestionCount(p);
    const sc = scores[p.id];
    return { id: p.id, label: partLabel(p), correct: Math.min(total, sc?.correct ?? 0), total, coins: sc?.coins ?? 0, mistakes: sc?.mistakes.length ?? 0 };
  });
  const correct = rows.reduce((a, r) => a + r.correct, 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const coins = rows.reduce((a, r) => a + r.coins, 0);
  const mistakes = rows.reduce((a, r) => a + r.mistakes, 0);
  const pct = total ? Math.round((correct / total) * 100) : 0;

  useEffect(() => {
    if (!visible) return;
    playSfx('unlock');
    // "Barakalla" faqat yaxshi natijada; past natijada — yumshoq dalda.
    speak(pct >= 70 ? 'homework' : 'wrong', 700);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (href: string) => {
    onClose();
    router.push(href as Href);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.backdrop}>
        <Pressable accessibilityLabel="Yopish" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={st.column}>
          <View accessibilityViewIsModal style={[st.sheet, { paddingBottom: Math.max(24, insets.bottom + 10) }]}>
            <View style={st.handle} />
            <View style={st.closeRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={({ pressed }) => [st.close, pressed && st.pressed]}>
                <CloseIcon />
              </Pressable>
            </View>
            <View style={st.hero}>
              <Bounce delay={250}>
                <Image
                  source={designImages['81a355f68578bf95c65fc6772f9124c9']}
                  accessibilityLabel="Barmogʻini koʻtargan Domik"
                  resizeMode="contain"
                  style={{ width: 124, height: 130 }}
                />
              </Bounce>
              <Txt f="display" size={26} lh={28.6} style={{ letterSpacing: -0.52, textAlign: 'center' }} accessibilityRole="header">
                Vazifa tekshirildi
              </Txt>
              <Txt f="bodyBold" size={14} color="#4A5468" style={{ textAlign: 'center' }}>
                {lessonNumber ? `${lessonNumber}-dars · ` : ''}Uyga vazifa · {correct} / {total} toʻgʻri ({pct}%)
              </Txt>
              <View style={st.coinChip}>
                <Coin size={16} />
                <Txt f="bodyHeavy" size={14} color="#7A5300">
                  +{coins} coin
                </Txt>
              </View>
            </View>
            <View style={st.result}>
              <Txt f="bodyHeavy" size={12} color="#4A5468" style={{ letterSpacing: 0.72, textTransform: 'uppercase' }}>
                Natija · avtomatik tekshirildi
              </Txt>
              {rows.map((r) => (
                <View key={r.id} style={st.row}>
                  <Txt f="bodyBold" size={14} style={{ flex: 1 }}>
                    {r.label}
                  </Txt>
                  <Txt f="bodyHeavy" size={14} color="#075E3A">
                    {r.correct} / {r.total}
                  </Txt>
                </View>
              ))}
              <Pressable accessibilityRole="link" onPress={() => go(R.lugat)} style={({ pressed }) => [st.mistakesRow, pressed && st.pressed]}>
                <View style={st.mistakesBadge}>
                  <Txt f="bodyHeavy" size={13} color="#B42318">
                    {mistakes}
                  </Txt>
                </View>
                <Txt f="bodyBold" size={13} color="#4A5468" lh={17.55} style={{ flex: 1 }}>
                  {'xato '}
                  <Txt f="bodyHeavy" size={13}>
                    Xatolarim
                  </Txt>
                  {' roʻyxatiga qoʻshildi'}
                </Txt>
                <ChevronRight size={16} />
              </Pressable>
            </View>
            <View style={{ gap: 6 }}>
              <Pressable accessibilityRole="button" onPress={() => lessonId && go(R.mistakes(lessonId))} style={({ pressed }) => [st.primary, pressed && st.pressed]}>
                <Txt f="bodyHeavy" size={16} color="#FFFFFF">
                  Xatolarni takrorlash · {mistakes} ta
                </Txt>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable accessibilityRole="button" onPress={() => lessonId && go(R.testReview(lessonId))} style={({ pressed }) => [st.secondary, { backgroundColor: '#EEF1F7' }, pressed && st.pressed]}>
                  <Txt f="bodyHeavy" size={15} color="#1E3FD1">
                    Javoblarimni koʻrish
                  </Txt>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => lessonId && go(R.complete(lessonId))} style={({ pressed }) => [st.secondary, pressed && st.pressed]}>
                  <Txt f="bodyHeavy" size={15} color="#4A5468">
                    Oʻtkazib yuborish
                  </Txt>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11,18,32,0.55)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as object) : null),
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 14,
    ...webShadow('0 -12px 40px rgba(0,0,0,.25)', { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: -12 }, elevation: 12 }),
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE4', alignSelf: 'center' },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -10 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  hero: { alignItems: 'center', gap: 8, marginTop: -30 },
  coinChip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 5 },
  result: { backgroundColor: '#F4F6FA', borderRadius: 20, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  primary: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  secondary: { flex: 1, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mistakesRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  mistakesBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
