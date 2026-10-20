/**
 * Kompyuter: "O'qish" qismi (dizayn: D_Reading — joylashuv). Xulq mobil
 * ReadingAuto bilan aynan bir xil (kelishuv: o'qish avtomatik, ustoz
 * tekshiruvisiz): matnni o'qish, "Tinglash" (ru-RU), tarjimani ochish/
 * yashirish, "O'qidim" → qism bajarildi (+1 coin). Matn bo'yicha savollar
 * "Test" qismida — dizayndagi o'ng "Savol" paneli o'rnida tarjima va izoh.
 */
import * as Speech from 'expo-speech';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { RichText, speakableText } from '@/components/RichText';
import { FocusFrame } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { isTeacherGraded } from '@/components/v2/homework/lib';
import { getLessonScores } from '@/components/v2/homework/scoreStore';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import type { HomeworkPart } from '@/data/lessonContent';
import { addCoins } from '@/services/coinsStore';
import { v2Back } from '@/services/v2Nav';
import { getLessonProgress, markHomeworkPartDone } from '@/services/lessonProgressStore';

import type { PartCtx } from './DPart';
import { BigButton, caps, IBulb, ISpeaker, KeysHint, Txt } from './dui';

type Props = {
  ctx: PartCtx;
  part: HomeworkPart;
  paragraph: { russianText: string; uzbekText?: string };
  sentences: { russianText: string }[];
};

export function DReading({ ctx, part, paragraph, sentences }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [showUz, setShowUz] = useState(false);
  const [saving, setSaving] = useState(false);
  const text = paragraph.russianText.trim() || sentences.map((s) => s.russianText).join(' ');
  const already = !!getLessonProgress(ctx.lessonId).homeworkParts[part.id];
  // Sarlavhadagi «...» qismi — matn nomi (bo'lsa).
  const heading = part.title.match(/«[^»]+»/)?.[0] ?? part.title;

  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(speakableText(text), { language: 'ru-RU', onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  // Mobil ReadingAuto.finish bilan aynan bir xil.
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    Speech.stop();
    if (!already) {
      await markHomeworkPartDone(ctx.lessonId, part.id);
      addCoins(1);
    }
    const progress = getLessonProgress(ctx.lessonId);
    const scores = getLessonScores(ctx.lessonId);
    const allDone = ctx.allParts.filter((p) => !isTeacherGraded(p)).every((p) => progress.homeworkParts[p.id] || scores[p.id]?.finished);
    router.replace((allDone && !already ? `${R.homework(ctx.lessonId)}?yuborildi=1` : R.homework(ctx.lessonId)) as Href);
  };

  useDesktopKeys({ Enter: finish });

  return (
    <FocusFrame
      closeTo={ctx.closeTo}
      onClose={() => {
        Speech.stop();
        v2Back(ctx.closeTo);
      }}
      title={part.title}
      subtitle={ctx.overline}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speaking ? "To'xtatish" : 'Matnni tinglash'}
          onPress={toggleSpeech}
          style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
        >
          <ISpeaker />
          <Txt f="bodyHeavy" size={14} color="#FFFFFF">
            {speaking ? 'Toʻxtatish' : 'Tinglash'}
          </Txt>
        </Pressable>
      }
      footer={
        <>
          <KeysHint keys={['Esc']} label="chiqish" />
          <View style={{ flex: 1 }} />
          <BigButton label={already ? 'Vazifaga qaytish' : 'Oʻqidim'} kind="primary" kbd="Enter" onPress={finish} height={56} pad={[26, 22]} />
        </>
      }
      footerHeight={100}
      footerWidth={1240}
    >
      <View style={{ flexGrow: 1, alignItems: 'center', paddingVertical: 26, paddingHorizontal: 24 }}>
        <View style={{ width: 1240, maxWidth: '100%', flexGrow: 1, flexDirection: 'row', gap: 24 }}>
          <View accessibilityLabel="Matn" style={st.textCard}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <Txt f="display" size={30} lang="ru" style={{ letterSpacing: -0.6, flexShrink: 1 }} accessibilityRole="header">
                {heading}
              </Txt>
              <Txt f="bodyBold" size={13} color="#4A5468">
                Matnni oʻqing
              </Txt>
            </View>
            <RichText text={text} style={st.ru} />
          </View>

          <View style={st.side}>
            {!!paragraph.uzbekText && (
              <View style={{ gap: 14 }}>
                <Txt f="bodyHeavy" size={12} color="#4A5468" style={caps(12)}>
                  Tarjima
                </Txt>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowUz((v) => !v)}
                  style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.uzBtn, hovered && { borderColor: '#9DB2FF' }]}
                >
                  <Txt f="bodyHeavy" size={16} color="#1E3FD1">
                    {showUz ? 'Tarjimani yashirish' : 'Tarjimasini koʻrish'}
                  </Txt>
                </Pressable>
                {showUz && <RichText text={paragraph.uzbekText} style={st.uz} />}
              </View>
            )}
            <View style={st.hint}>
              <IBulb size={18} color="#087A4A" />
              <Txt f="bodyBold" size={14} color="#075E3A" lh={19.6} style={{ flex: 1 }}>
                Matn boʻyicha savollar «Test» qismida — oʻqib boʻlgach javob bering.
              </Txt>
            </View>
          </View>
        </View>
      </View>
    </FocusFrame>
  );
}

const st = StyleSheet.create({
  listen: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 8 },
  textCard: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 28, paddingVertical: 28, paddingHorizontal: 32, gap: 18 },
  ru: { fontFamily: fonts.bodyMedium, fontWeight: 'normal', fontSize: 25, lineHeight: 46, color: '#0B1220' },
  side: { width: 522, flexShrink: 0, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 26, gap: 22 },
  uzBtn: { minHeight: 56, borderRadius: 18, borderWidth: 2, borderColor: '#E2E6EE', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  uz: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 18, lineHeight: 28, color: '#26304A' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E3F7EE', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
});
