/**
 * Kompyuter: "Dars yopiq" oynasi (dizayn: D_LessonLocked.dc.html).
 *
 * LessonLockedPopup ichidan chaqiriladi — raqamlar o'sha hisobdan keladi
 * (qadamlar, so'zlar, dialoglar, vazifa savollari, jonli dars vaqti).
 * Sahifa ustida markazda karta, orqasi xira + blur. Esc — yopish,
 * Enter — joriy darsni davom ettirish.
 */
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { designImages } from '@/constants/v2/designImages';

import { useDesktopKeys } from '../useDesktop';
import { IArrow, ICheck, IClose, ILock, InKbd, T } from './ui';

export type LockedRow = { label: string; right: string; done: boolean; current: boolean };

export function DLessonLocked({
  visible,
  onClose,
  onContinue,
  badge,
  title,
  sub,
  activeNumber,
  stepNo,
  stepTotal,
  left,
  rows,
}: {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
  badge: string;
  title: string;
  sub: string;
  activeNumber: number;
  stepNo: number;
  stepTotal: number;
  left: number;
  rows: LockedRow[];
}) {
  useDesktopKeys({ Escape: onClose, Enter: onContinue }, visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={[StyleSheet.absoluteFill, s.backdrop]} />
        <View accessibilityViewIsModal accessibilityRole="none" style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
            <Image source={designImages['68633deaacf537e7e92265a39c0e0949']} style={s.mascot} resizeMode="contain" accessibilityLabel="Qum soati ushlagan Domik" />
            <View style={{ flex: 1, minWidth: 0, gap: 6, paddingTop: 4 }}>
              <View style={s.badge}>
                <ILock size={14} color="#34405A" strokeWidth={2.4} />
                <T size={13} color="#34405A">
                  {badge}
                </T>
              </View>
              <T f="display" size={30} lh={33} ls={-0.6} accessibilityRole="header" style={{ marginTop: 2 }}>
                {title}
              </T>
              <T f="bodyBold" size={15} color="#4A5468">
                {sub}
              </T>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={({ pressed }) => [s.close, pressed && { opacity: 0.85 }]}>
              <IClose />
            </Pressable>
          </View>
          <T f="body" size={16} lh={24} color="#34405A">
            Avval {activeNumber}-darsni yakunlang: siz{' '}
            <T size={16} lh={24}>
              {stepNo} / {stepTotal}
            </T>{' '}
            qadamdasiz, yana {left} ta qadam qoldi.
          </T>
          <View accessibilityLabel={`${activeNumber}-dars qadamlari`} style={s.list}>
            {rows.map((r, k) => (
              <View key={k} style={[s.row, r.current && { backgroundColor: '#E8EEFF' }]}>
                {r.done ? (
                  <View style={[s.circle, { backgroundColor: '#087A4A' }]}>
                    <ICheck size={15} strokeWidth={3.2} />
                  </View>
                ) : r.current ? (
                  <View style={[s.circle, { backgroundColor: '#2F5BFF' }]}>
                    <T size={14} color="#FFFFFF">
                      {k + 1}
                    </T>
                  </View>
                ) : (
                  <View style={[s.circle, s.todo]}>
                    <T size={14} color="#4A5468">
                      {k + 1}
                    </T>
                  </View>
                )}
                <T size={15} style={{ flex: 1 }} lines={1}>
                  {r.label}
                </T>
                {!!(r.right || r.current) && (
                  <T size={13} color={r.current ? '#1E3FD1' : '#4A5468'}>
                    {r.current ? (r.right ? `${r.right} · hozir` : 'hozir') : r.right}
                  </T>
                )}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 2 }}>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [s.later, pressed && { opacity: 0.7 }]}>
              <T size={15} color="#4A5468">
                Keyinroq
              </T>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={onContinue} style={({ pressed }) => [s.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
              <T size={16} color="#FFFFFF">
                {activeNumber}-darsni davom ettirish
              </T>
              <IArrow size={18} />
              <InKbd>Enter</InKbd>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { backgroundColor: 'rgba(11,18,32,0.35)', backdropFilter: 'blur(8px)' } as object,
  card: { width: 560, maxWidth: '92%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28, gap: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' } as object,
  mascot: { width: 112, height: 117, marginTop: -6, marginBottom: -4, marginLeft: -6, flexShrink: 0 },
  badge: { alignSelf: 'flex-start', height: 28, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#EEF1F7', flexDirection: 'row', alignItems: 'center', gap: 6 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  list: { padding: 8, backgroundColor: '#F4F6FA', borderRadius: 20, gap: 2 },
  row: { borderRadius: 14, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  circle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  todo: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE' },
  later: { height: 54, paddingHorizontal: 18, borderRadius: 17, justifyContent: 'center' },
  cta: { height: 54, paddingLeft: 26, paddingRight: 22, borderRadius: 17, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0 5px 0 #1E3FD1' } as object,
});
