/**
 * Kompyuter: "Jonli dars boshlandi" oynasi (dizayn: D_LiveNow).
 * Ma'lumot mobil LiveNow bilan bir xil: ustoz (fetchDemoStudentProfile), vaqt
 * va guruh havolasi (fetchDemoSchedule), davomiylik (to'lov tarifi), dars va
 * slaydlar soni (resolveCurrentLesson). "Namuna" belgisi o'quvchiga
 * ko'rsatilmaydi (egasi qarori). Esc — yopish.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { resolveCurrentLesson, type CurrentLesson } from '@/components/v2/home/currentLesson';
import { splitTitle } from '@/components/v2/lessons/data';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoSchedule, fetchDemoStudentPayments, fetchDemoStudentProfile } from '@/services/contentApi';

import { DPopupFrame } from './DPopupFrame';
import { ChevronIcon, CloseIcon, MonitorIcon, TgIcon } from './icons';

const pad = (n: number) => String(n).padStart(2, '0');
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

type Data = { teacher: string; time: string; link: string; duration: number; lesson: CurrentLesson | null };

export function DLiveNow({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
        time: startsAt ? `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}` : (sc?.lessonTime ?? ''),
        link: sc?.telegramGroupLink ?? '',
        duration: pay?.lessonDuration ?? 0,
        lesson,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const lesson = d?.lesson ?? null;
  // "32-dars · Kafe va restoranda «Мо́жно меню́?» · 30 daqiqa" — bor qismlardan
  // (nom va ibora Bosh sahifa kartasidagidek ajratiladi: splitTitle).
  const st = lesson ? splitTitle(lesson.name) : null;
  const phrase = st?.phrase || lesson?.phrase || '';
  const lessonLine = [lesson ? `${lesson.number}-dars` : '', st ? `${st.title}${phrase ? ` ${phrase}` : ''}` : '', d?.duration ? `${d.duration} daqiqa` : '']
    .filter(Boolean)
    .join(' · ');

  const openSlides = () => {
    if (!lesson) return;
    onClose();
    router.push(R.slides(lesson.id) as Href);
  };

  return (
    <DPopupFrame visible={visible} onClose={onClose} width={580}>
      <View style={s.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish (Esc)" onPress={onClose} style={s.close}>
          <CloseIcon />
        </Pressable>
      </View>
      <View style={s.main}>
        <View style={s.avatarRing}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{d?.teacher ? initialsOf(d.teacher) : ''}</Text>
          </View>
          <View style={s.badge}>
            <View style={s.badgeDot} />
            <Text style={s.badgeText}>JONLI</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <Text accessibilityRole="header" style={s.title}>
            {d?.time ? `Jonli dars boshlandi · ${d.time}` : 'Jonli dars boshlandi'}
          </Text>
          <Text style={s.body}>
            {!!d?.teacher && <Text style={s.bodyName}>{d.teacher}</Text>}
            {d?.teacher ? ' ' : ''}Telegram guruhda kutmoqda.{lessonLine ? ` ${lessonLine}` : ''}
          </Text>
        </View>
      </View>
      <Pressable accessibilityRole="link" onPress={openSlides} style={s.slides}>
        <View style={s.slidesIcon}>
          <MonitorIcon size={22} color="#2F5BFF" />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={s.slidesTitle}>Slaydlar tayyor</Text>
          <Text style={s.slidesSub}>{lesson?.slidesCount ?? 0} ta slayd · darsda ochiq turadi</Text>
        </View>
        <ChevronIcon size={18} />
      </Pressable>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" onPress={onClose} style={s.later}>
          <Text style={s.laterText}>Keyinroq</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityState={{ disabled: !d?.link }}
          onPress={() => {
            if (d?.link) void Linking.openURL(d.link);
          }}
          style={({ pressed }) => [s.tg, pressed && { backgroundColor: '#1E96D4' }]}
        >
          <TgIcon size={19} />
          <Text style={s.tgText}>Telegram guruhga kirish</Text>
        </Pressable>
      </View>
    </DPopupFrame>
  );
}

const T = (f: string, size: number, extra?: TextStyle): TextStyle => ({ fontFamily: f, fontWeight: 'normal', fontSize: size, ...extra });

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  main: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  avatarRing: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: T(fonts.display, 34, { color: '#FFFFFF' }),
  badge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: '#D92D20',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  badgeText: T(fonts.bodyHeavy, 12, { letterSpacing: 0.72, color: '#FFFFFF' }),
  title: T(fonts.display, 26, { lineHeight: 29.12, letterSpacing: -0.52, color: '#0B1220' }),
  body: T(fonts.body, 15, { lineHeight: 22.5, color: '#4A5468' }),
  bodyName: { fontFamily: fonts.bodyHeavy, color: '#0B1220' },
  slides: { backgroundColor: '#F4F6FA', borderRadius: 18, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  slidesIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  slidesTitle: T(fonts.bodyHeavy, 16, { color: '#0B1220' }),
  slidesSub: T(fonts.bodyBold, 14, { color: '#4A5468' }),
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 2 },
  later: { height: 54, paddingHorizontal: 22, borderRadius: 17, justifyContent: 'center' },
  laterText: T(fonts.bodyHeavy, 15, { color: '#4A5468' }),
  tg: { height: 54, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 9 },
  tgText: T(fonts.bodyHeavy, 15, { color: '#0B1220' }),
});
