import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';

const BONUS_LESSONS = [
  { id: 'b1', title: 'Bonus dars 1 — Kundalik suhbat', date: 'Yakshanba, 12.07', duration: '18 daq' },
  { id: 'b2', title: 'Bonus dars 2 — Grammatika mashqi', date: 'Yakshanba, 19.07', duration: '22 daq' },
  { id: 'b3', title: 'Bonus dars 3 — Talaffuz sirlari', date: 'Yakshanba, 26.07', duration: '15 daq' },
  { id: 'b4', title: 'Bonus dars 4 — Idiomalar', date: 'Yakshanba, 02.08', duration: '20 daq' },
  { id: 'b5', title: 'Bonus dars 5 — Amerika slangi', date: 'Yakshanba, 09.08', duration: '17 daq' },
  { id: 'b6', title: 'Bonus dars 6 — Ish suhbati', date: 'Yakshanba, 16.08', duration: '21 daq' },
  { id: 'b7', title: 'Bonus dars 7 — Sayohat iboralari', date: 'Yakshanba, 23.08', duration: '19 daq' },
  { id: 'b8', title: 'Bonus dars 8 — Telefon orqali gaplashish', date: 'Yakshanba, 30.08', duration: '16 daq' },
  { id: 'b9', title: 'Bonus dars 9 — Restoranda buyurtma', date: 'Yakshanba, 06.09', duration: '18 daq' },
  { id: 'b10', title: 'Bonus dars 10 — Ijtimoiy tarmoqlar tili', date: 'Yakshanba, 13.09', duration: '20 daq' },
  { id: 'b11', title: 'Bonus dars 11 — Filmlardan iboralar', date: 'Yakshanba, 20.09', duration: '23 daq' },
  { id: 'b12', title: 'Bonus dars 12 — Yangiliklarni tinglash', date: 'Yakshanba, 27.09', duration: '22 daq' },
  { id: 'b13', title: 'Bonus dars 13 — Debat mashqlari', date: 'Yakshanba, 04.10', duration: '25 daq' },
  { id: 'b14', title: 'Bonus dars 14 — Hikoya aytish', date: 'Yakshanba, 11.10', duration: '20 daq' },
  { id: 'b15', title: 'Bonus dars 15 — Prezentatsiya mahorati', date: 'Yakshanba, 18.10', duration: '24 daq' },
  { id: 'b16', title: "Bonus dars 16 — Muzokara san'ati", date: 'Yakshanba, 25.10', duration: '21 daq' },
  { id: 'b17', title: 'Bonus dars 17 — Kundalik yozish', date: 'Yakshanba, 01.11', duration: '18 daq' },
  { id: 'b18', title: 'Bonus dars 18 — Yakuniy takrorlash', date: 'Yakshanba, 08.11', duration: '26 daq' },
];

const UNLOCKED_COUNT = 1;

export default function BonusLessonsScreen() {
  const [dialogLesson, setDialogLesson] = useState<(typeof BONUS_LESSONS)[number] | null>(null);
  const [showLockedNotice, setShowLockedNotice] = useState(false);

  const openLesson = (lesson: (typeof BONUS_LESSONS)[number], locked: boolean) => {
    if (locked) {
      setShowLockedNotice(true);
      return;
    }
    setDialogLesson(lesson);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Bonus darslar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Har yakshanba kuni beriladigan qo'shimcha video darslar to'plami</Text>
        {BONUS_LESSONS.map((lesson, index) => {
          const locked = index >= UNLOCKED_COUNT;
          return (
            <Pressable key={lesson.id} onPress={() => openLesson(lesson, locked)}>
              <Card style={locked ? styles.cardLocked : styles.card}>
                <View style={[styles.iconWrap, locked && styles.iconWrapLocked]}>
                  <Ionicons name={locked ? 'lock-closed' : 'play-circle'} size={locked ? 20 : 26} color={locked ? theme.colors.textLight : '#D97706'} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.title, locked && styles.titleLocked]}>{lesson.title}</Text>
                  <Text style={styles.meta}>{locked ? 'Hali ochilmagan' : `${lesson.date} · ${lesson.duration}`}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={dialogLesson !== null} animationType="fade" transparent onRequestClose={() => setDialogLesson(null)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setDialogLesson(null)} />
          {dialogLesson && (
            <View style={styles.dialogCard}>
              <View style={styles.dialogIconWrap}>
                <Ionicons name="play-circle" size={30} color="#D97706" />
              </View>
              <Text style={styles.dialogTitle}>{dialogLesson.title}</Text>
              <Text style={styles.dialogSubtitle}>Video tez orada qo'shiladi</Text>
              <Pressable style={styles.dialogConfirmBtn} onPress={() => setDialogLesson(null)}>
                <Text style={styles.dialogConfirmText}>Tushunarli</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={showLockedNotice} animationType="fade" transparent onRequestClose={() => setShowLockedNotice(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowLockedNotice(false)} />
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}>
              <Ionicons name="lock-closed" size={30} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.dialogTitle}>Bu bonus dars hali ochilmagan</Text>
            <Text style={styles.dialogSubtitle}>Har yakshanba navbatdagi bonus dars ochiladi. Iltimos, o'z navbatini kuting.</Text>
            <Pressable style={styles.dialogConfirmBtn} onPress={() => setShowLockedNotice(false)}>
              <Text style={styles.dialogConfirmText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 32, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 19 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardLocked: { flexDirection: 'row', alignItems: 'center', gap: 14, opacity: 0.6 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  iconWrapLocked: { backgroundColor: theme.colors.bg },
  info: { flex: 1 },
  title: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  titleLocked: { color: theme.colors.textMuted },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', marginBottom: 4 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  dialogConfirmBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    marginTop: 10,
  },
  dialogConfirmText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
