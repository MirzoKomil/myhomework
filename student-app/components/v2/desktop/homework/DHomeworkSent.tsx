/**
 * Kompyuter: "Vazifa tekshirildi" oynasi (dizayn: D_HomeworkSent) — sahifa
 * ustida markazda karta, orqasi xiralashgan. Raqamlar va havolalar mobil
 * HomeworkSent bilan bir xil (popup komponenti hisoblab beradi).
 * Klaviatura: Esc — yopish.
 */
import { Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { Bounce } from '@/components/v2/motion';
import { designImages } from '@/constants/v2/designImages';

import { BigButton, caps, IChevron, IClose, ICoin, Txt, webShadow } from './dui';

type Row = { id: string; label: string; correct: number; total: number };

export function DHomeworkSentCard({
  visible,
  onClose,
  lessonNumber,
  rows,
  correct,
  total,
  pct,
  coins,
  mistakes,
  onMistakesList,
  onReview,
  onRepeat,
  onSkip,
  confetti,
}: {
  visible: boolean;
  onClose: () => void;
  lessonNumber?: number;
  rows: Row[];
  correct: number;
  total: number;
  pct: number;
  coins: number;
  mistakes: number;
  onMistakesList: () => void;
  onReview: () => void;
  onRepeat: () => void;
  onSkip: () => void;
  confetti?: React.ReactNode;
}) {
  useDesktopKeys({ Escape: onClose }, visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.backdrop}>
        <Pressable accessibilityLabel="Yopish" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal role="dialog" aria-modal style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Bounce delay={250}>
              <Image
                source={designImages['81a355f68578bf95c65fc6772f9124c9']}
                accessibilityLabel="Barmogʻini koʻtargan Domik"
                resizeMode="contain"
                style={{ width: 112, height: 112, marginTop: -10, marginBottom: -6, marginLeft: -6 }}
              />
            </Bounce>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Txt f="display" size={30} lh={33} style={{ letterSpacing: -0.6 }} accessibilityRole="header">
                Vazifa tekshirildi
              </Txt>
              <Txt f="bodyBold" size={15} color="#4A5468">
                {lessonNumber ? `${lessonNumber}-dars · ` : ''}Uyga vazifa · {correct} / {total} toʻgʻri ({pct}%)
              </Txt>
              <View style={st.coinChip}>
                <ICoin size={16} />
                <Txt f="bodyHeavy" size={14} color="#7A5300">
                  +{coins} coin
                </Txt>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.close, hovered && { backgroundColor: '#E4E8F0' }]}>
              <IClose size={20} />
            </Pressable>
          </View>

          <View style={st.result}>
            <Txt f="bodyHeavy" size={12} color="#4A5468" style={caps(12, 0.06)}>
              Natija · avtomatik tekshirildi
            </Txt>
            <View style={{ marginTop: 4 }}>
              {rows.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: '#E2E6EE' }} />}
                  <View style={st.row}>
                    <Txt f="bodyBold" size={15} style={{ flex: 1 }}>
                      {r.label}
                    </Txt>
                    <Txt f="bodyHeavy" size={15} color="#087A4A">
                      {r.correct} / {r.total}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>
            <Pressable accessibilityRole="link" onPress={onMistakesList} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.mist, hovered && { backgroundColor: '#FAFBFD' }]}>
              <View style={st.badge}>
                <Txt f="bodyHeavy" size={14} color="#B42318">
                  {mistakes}
                </Txt>
              </View>
              <Txt f="body" size={14} color="#34405A" style={{ flex: 1 }}>
                {'xato '}
                <Txt f="bodyBold" size={14} color="#0B1220">
                  Xatolarim
                </Txt>
                {' roʻyxatiga qoʻshildi'}
              </Txt>
              <IChevron size={18} color="#6B7489" sw={2.2} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable accessibilityRole="link" onPress={onSkip} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.skip, hovered && { opacity: 0.75 }]}>
              <Txt f="bodyHeavy" size={15} color="#4A5468" numberOfLines={1}>
                Oʻtkazib yuborish
              </Txt>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="link" onPress={onReview} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.soft, hovered && { backgroundColor: '#DCE5FF' }]}>
              <Txt f="bodyHeavy" size={15} color="#1E3FD1" numberOfLines={1}>
                Javoblarimni koʻrish
              </Txt>
            </Pressable>
            <BigButton label={`Xatolarni takrorlash · ${mistakes} ta`} kind="primary" onPress={onRepeat} height={54} size={15} pad={[22, 22]} style={[{ gap: 9 }, webShadow('0 5px 0 #1E3FD1')]} />
          </View>
        </View>
      </View>
      {confetti}
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,18,32,0.55)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as object) : null),
  },
  card: {
    width: 640,
    maxWidth: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    gap: 18,
    ...webShadow('0 30px 80px rgba(0,0,0,0.35)'),
  },
  coinChip: { alignSelf: 'flex-start', height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 6 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', flexShrink: 0 },
  result: { backgroundColor: '#F4F6FA', borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
  mist: { marginTop: 6, minHeight: 52, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  skip: { height: 54, paddingLeft: 4, paddingRight: 8, justifyContent: 'center' },
  soft: { height: 54, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
});
