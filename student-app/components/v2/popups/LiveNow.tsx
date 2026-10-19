/**
 * "Jonli dars boshlandi" pastki oynasi (dizayn: LiveNow.dc.html, 79).
 * Bildirishnomalardagi jonli dars sarlavhasidan ochiladi.
 *
 * Ma'lumot: ustoz — fetchDemoStudentProfile (asosiy ustoz), vaqt va guruh
 * havolasi — fetchDemoSchedule, dars davomiyligi — fetchDemoStudentPayments,
 * dars raqami/nomi/ibora va slaydlar soni — joriy dars (resolveCurrentLesson).
 * Dars hali boshlanmagan bo'lsa "Namuna: dars boshlanganda" belgisi chiqadi —
 * oyna dars boshlanganda qanday ko'rinishini oldindan ko'rsatadi.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveCurrentLesson, type CurrentLesson } from '@/components/v2/home/currentLesson';
import { ChevronRightIcon, CloseIcon, EyeSmallIcon, ScreenIcon, TelegramIcon } from '@/components/v2/home/icons';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoSchedule, fetchDemoStudentPayments, fetchDemoStudentProfile } from '@/services/contentApi';

const pad = (n: number) => String(n).padStart(2, '0');
const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

type Data = {
  teacher: string;
  startsAt: Date | null;
  time: string;
  link: string;
  duration: number;
  lesson: CurrentLesson | null;
};

export function LiveNowPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    Promise.all([
      fetchDemoStudentProfile().catch(() => null),
      fetchDemoSchedule().catch(() => null),
      fetchDemoStudentPayments().catch(() => null),
      resolveCurrentLesson().catch(() => null),
    ]).then(([pr, sc, pay, lesson]) => {
      if (cancelled) return;
      const startsAt = sc?.startsAt ? new Date(sc.startsAt) : null;
      setD({
        teacher: pr?.mainTeacherName ?? '',
        startsAt,
        time: startsAt ? `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}` : (sc?.lessonTime ?? ''),
        link: sc?.telegramGroupLink ?? '',
        duration: pay?.lessonDuration ?? 0,
        lesson,
      });
    });
    return () => { cancelled = true; };
  }, [visible]);

  const preview = !d?.startsAt || d.startsAt.getTime() > Date.now();
  const lesson = d?.lesson ?? null;
  // "32-dars · Kafe va restoranda «Мо́жно меню́?» · 30 daqiqa" — bor qismlardan.
  const lessonLine = [
    lesson ? `${lesson.number}-dars` : '',
    lesson ? `${lesson.name}${lesson.phrase ? ` ${lesson.phrase}` : ''}` : '',
    d?.duration ? `${d.duration} daqiqa` : '',
  ].filter(Boolean).join(' · ');

  const openSlides = () => {
    if (!lesson) return;
    onClose();
    router.push(R.slides(lesson.id) as Href);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Yopish" onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View style={styles.column}>
          <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
            <ScrollView bounces={false} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
              <View style={styles.grip} />
              <View style={styles.topRow}>
                {preview ? (
                  <View style={styles.sample}>
                    <EyeSmallIcon />
                    <Text style={styles.sampleText}>Namuna: dars boshlanganda</Text>
                  </View>
                ) : <View />}
                <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={styles.close}>
                  <CloseIcon />
                </Pressable>
              </View>

              <View style={styles.center}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{d?.teacher ? initialsOf(d.teacher) : ''}</Text>
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>JONLI</Text>
                  </View>
                </View>
                <Text style={styles.title} accessibilityRole="header">
                  {d?.time ? `Jonli dars boshlandi · ${d.time}` : 'Jonli dars boshlandi'}
                </Text>
                <Text style={styles.body}>
                  {!!d?.teacher && <Text style={styles.bodyName}>{d.teacher}</Text>}
                  {d?.teacher ? ' ' : ''}Telegram guruhda kutmoqda.{lessonLine ? ` ${lessonLine}` : ''}
                </Text>
              </View>

              <Pressable accessibilityRole="link" onPress={openSlides} style={styles.slides}>
                <View style={styles.slidesIcon}>
                  <ScreenIcon />
                </View>
                <View style={styles.slidesText}>
                  <Text style={styles.slidesTitle}>Slaydlar tayyor</Text>
                  <Text style={styles.slidesSub}>{lesson?.slidesCount ?? 0} ta slayd · darsda ochiq turadi</Text>
                </View>
                <ChevronRightIcon color="#6B7489" />
              </Pressable>

              <Pressable
                accessibilityRole="link"
                accessibilityState={{ disabled: !d?.link }}
                onPress={() => { if (d?.link) void Linking.openURL(d.link); }}
                style={({ pressed }) => [styles.tg, pressed && { backgroundColor: '#1E96D4' }]}
              >
                <TelegramIcon size={18} />
                <Text style={styles.tgText}>Telegram guruhga kirish</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.later}>
                <Text style={styles.laterText}>Keyinroq</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(11,18,32,0.35)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(3px)' } as object) : null),
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '100%' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingHorizontal: 20,
    boxShadow: '0 -12px 40px rgba(0,0,0,.25)',
  },
  inner: { gap: 14 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE4', alignSelf: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -10 },
  sample: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#EEF1F7', flexDirection: 'row', alignItems: 'center', gap: 5 },
  sampleText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 10 },
  avatarWrap: { width: 84, height: 84 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#2F5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 6px #FDECEC',
  },
  avatarText: { fontFamily: fonts.bodyHeavy, fontSize: 28, color: '#FFFFFF', fontWeight: 'normal' },
  liveBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: '#D92D20',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  liveText: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.48, color: '#FFFFFF', fontWeight: 'normal' },
  title: {
    marginTop: 8,
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28.6,
    letterSpacing: -0.52,
    color: '#0B1220',
    textAlign: 'center',
    fontWeight: 'normal',
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21.75, color: '#4A5468', textAlign: 'center', fontWeight: 'normal' },
  bodyName: { fontFamily: fonts.bodyHeavy, color: '#0B1220' },
  slides: { minHeight: 56, borderRadius: 16, backgroundColor: '#F4F6FA', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  slidesIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  slidesText: { flex: 1, gap: 1 },
  slidesTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', fontWeight: 'normal' },
  slidesSub: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  tg: { height: 56, borderRadius: 18, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  tgText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#0B1220', fontWeight: 'normal' },
  later: { height: 46, marginTop: -6, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#1E3FD1', fontWeight: 'normal' },
});
