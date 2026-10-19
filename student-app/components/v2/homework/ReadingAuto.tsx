/**
 * "O'qish" qismi — avtomatik (o'qituvchi tekshiruvisiz).
 *
 * Kelishuv: uyga vazifada faqat avtomatik tekshiriladigan qismlar qoladi.
 * Avval bu qism har gapni yozma tarjima qilib o'qituvchiga yuborardi va
 * "Ko'rib chiqilmoqda" holatida qolib ketardi. Endi o'quvchi matnni o'qiydi,
 * tinglaydi, kerak bo'lsa tarjimasini ochadi va "O'qidim" bosadi. Matn bo'yicha
 * savollar "Test" qismida avtomatik tekshiriladi (kitobdagidek).
 */
import * as Speech from 'expo-speech';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RichText, speakableText } from '@/components/RichText';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import type { HomeworkPart } from '@/data/lessonContent';
import { addCoins } from '@/services/coinsStore';
import { getLessonProgress, markHomeworkPartDone } from '@/services/lessonProgressStore';

import { SpeakerIcon } from './icons';
import { isTeacherGraded } from './lib';
import { getLessonScores } from './scoreStore';
import { CloseButton, Txt } from './ui';

type Props = {
  lessonId: string;
  partId: string;
  title: string;
  overline: string;
  /** Rus tilidagi matn va (bo'lsa) kitobdagi o'zbekcha tarjimasi. */
  paragraph: { russianText: string; uzbekText?: string };
  sentences: { russianText: string }[];
  allParts: HomeworkPart[];
  onClose: () => void;
};

export function ReadingAuto({ lessonId, partId, title, overline, paragraph, sentences, allParts, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [speaking, setSpeaking] = useState(false);
  const [showUz, setShowUz] = useState(false);
  const [saving, setSaving] = useState(false);
  const text = paragraph.russianText.trim() || sentences.map((s) => s.russianText).join(' ');
  const already = !!getLessonProgress(lessonId).homeworkParts[partId];

  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(speakableText(text), { language: 'ru-RU', onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    Speech.stop();
    if (!already) {
      await markHomeworkPartDone(lessonId, partId);
      // Boshqa qismlardagi kabi: bajarilgan qism uchun +1 coin.
      addCoins(1);
    }
    const progress = getLessonProgress(lessonId);
    const scores = getLessonScores(lessonId);
    const allDone = allParts.filter((p) => !isTeacherGraded(p)).every((p) => progress.homeworkParts[p.id] || scores[p.id]?.finished);
    router.replace((allDone && !already ? `${R.homework(lessonId)}?yuborildi=1` : R.homework(lessonId)) as Href);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={st.header}>
        <CloseButton bg="#F4F6FA" onPress={onClose} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt f="bodyHeavy" size={12} color="#4A5468" numberOfLines={1}>
            {overline}
          </Txt>
          <Txt f="bodyHeavy" size={16} numberOfLines={1}>
            {title}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? "To'xtatish" : 'Matnni tinglash'}
          onPress={toggleSpeech}
          style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
        >
          <SpeakerIcon />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={st.body}>
        <View style={st.card}>
          <Txt f="bodyHeavy" size={12} color="#4A5468">
            MATNNI OʻQING
          </Txt>
          <RichText text={text} style={st.ru} />
        </View>

        {!!paragraph.uzbekText && (
          <Pressable accessibilityRole="button" onPress={() => setShowUz((v) => !v)} style={st.uzCard}>
            <Txt f="bodyHeavy" size={14} color="#1E3FD1">
              {showUz ? 'Tarjimani yashirish' : 'Tarjimasini koʻrish'}
            </Txt>
            {showUz && <RichText text={paragraph.uzbekText} style={st.uz} />}
          </Pressable>
        )}

        <View style={st.hint}>
          <Txt f="body" size={13} color="#4A5468" lh={18}>
            Matn boʻyicha savollar «Test» qismida — oʻqib boʻlgach javob bering.
          </Txt>
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: saving }}
          onPress={finish}
          style={({ pressed }) => [st.btnPrimary, pressed && { opacity: 0.85 }]}
        >
          <Txt f="bodyHeavy" size={16} color="#FFFFFF">
            {already ? 'Vazifaga qaytish' : 'Oʻqidim'}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  listen: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  card: { backgroundColor: '#F4F6FA', borderRadius: 22, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  ru: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 17, lineHeight: 27, color: '#0B1220' },
  uzCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E6EE', paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  uz: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, lineHeight: 22, color: '#26304A' },
  hint: { paddingHorizontal: 4 },
  footer: { paddingTop: 12, paddingHorizontal: 20 },
  btnPrimary: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
});
