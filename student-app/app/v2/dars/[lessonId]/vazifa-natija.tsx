/**
 * v2 Test natijasi — javoblar (dizayn: 75 · C · Test natijasi).
 *
 * HomeworkSent oynasidagi "Javoblarimni ko'rish"dan ochiladi. Savollar —
 * dars kontenti (loadLessonInfo → homeworkParts), o'quvchi javoblari va
 * natijalari — scoreStore (har savol tanlangan javobi: picks, to'g'ri/xato:
 * results; eski yozuvlarda — xatolar ro'yxati). Standart — test (C) qismi,
 * ?qism=<partId> bilan boshqa avtomatik qism ham ko'rsatiladi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { BackIcon, Check, CloseIcon } from '@/components/v2/homework/icons';
import { isTeacherGraded, loadLessonInfo, partLabel, type LessonInfo } from '@/components/v2/homework/lib';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { Txt, webShadow } from '@/components/v2/homework/ui';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';

type Row = { n: number; prompt: string; correct: string; pick?: string; ok: boolean };

/** Qism savollarini umumiy ko'rinishga keltiradi: savol, to'g'ri javob. */
function questionsOf(p: HomeworkPart): { prompt: string; correct: string }[] {
  switch (p.kind) {
    case 'multipleChoice':
      return p.questions.map((q) => ({ prompt: q.question, correct: q.options[q.correctIndex] ?? '' }));
    case 'fillBlank':
      return p.blanks.map((b) => ({ prompt: b.sentence, correct: b.sentence.replace(/_{2,}/, b.answer) }));
    case 'sentenceBuild':
      return p.items.map((it) => ({ prompt: it.translation, correct: it.answer.join(' ') }));
    default:
      return [];
  }
}
const mistakeKey = (p: HomeworkPart, i: number) =>
  p.kind === 'multipleChoice' ? p.questions[i]?.question : p.kind === 'fillBlank' ? p.blanks[i]?.sentence : p.kind === 'sentenceBuild' ? p.items[i]?.translation : '';

function Ring({ pct }: { pct: number }) {
  // conic-gradient(#087A4A 0 pct, #FDECEC pct 100%) — 60px halqa, ichida 46px oq doira.
  const r = 26.5;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={60} height={60} style={StyleSheet.absoluteFill}>
        <Circle cx={30} cy={30} r={r} stroke="#FDECEC" strokeWidth={7} fill="none" />
        <Circle cx={30} cy={30} r={r} stroke="#087A4A" strokeWidth={7} fill="none" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 30 30)" />
      </Svg>
      <Txt f="display" size={15}>
        {pct}%
      </Txt>
    </View>
  );
}

export default function TestReviewScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId, qism } = useLocalSearchParams<{ lessonId: string; qism?: string }>();
  const id = String(lessonId);
  const [info, setInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState(false);
  const scores = useHomeworkScores();

  useEffect(() => {
    let cancelled = false;
    loadLessonInfo(id)
      .then((r) => !cancelled && setInfo(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`${R.homework(id)}?yuborildi=1` as Href));

  const parts = info?.content.homeworkParts.filter((p) => !isTeacherGraded(p) && questionsOf(p).length > 0) ?? [];
  const part = parts.find((p) => p.id === qism) ?? parts.find((p) => p.kind === 'multipleChoice') ?? parts[0];
  const sc = part ? scores[id]?.[part.id] : undefined;
  const qs = part ? questionsOf(part) : [];
  const answered = sc ? (sc.finished ? qs.length : Math.min(qs.length, sc.answered)) : 0;
  const rows: Row[] = part
    ? qs.slice(0, answered).map((q, i) => ({
        n: i + 1,
        prompt: q.prompt,
        correct: q.correct,
        pick: sc?.picks?.[i] || undefined,
        ok: sc?.results?.[i] ?? !(sc?.mistakes ?? []).includes(mistakeKey(part, i) ?? ''),
      }))
    : [];
  const correct = Math.min(qs.length, sc?.correct ?? rows.filter((r) => r.ok).length);
  const wrongRows = rows.filter((r) => !r.ok);
  const okRows = rows.filter((r) => r.ok);
  const pct = qs.length ? Math.round((correct / qs.length) * 100) : 0;

  return (
    <View style={st.screen}>
      <View style={[st.column, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
        <View style={st.header}>
          <Pressable accessibilityRole="link" accessibilityLabel="Orqaga" onPress={back} style={({ pressed }) => [st.back, pressed && st.pressed]}>
            <BackIcon />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Txt f="display" size={24} lh={26.4} style={{ letterSpacing: -0.48 }} accessibilityRole="header" numberOfLines={1}>
              {part ? `${partLabel(part)} natijasi` : 'Test natijasi'}
            </Txt>
            <Txt f="bodyBold" size={13} color="#4A5468" numberOfLines={1}>
              {info ? `${info.number}-dars · ` : ''}Uyga vazifa · avtomatik tekshirildi
            </Txt>
          </View>
        </View>

        {!info ? (
          <View style={st.center}>
            {error ? (
              <Txt f="bodyBold" size={15} color="#4A5468">
                Vazifani yuklab boʻlmadi
              </Txt>
            ) : (
              <ActivityIndicator color="#2F5BFF" accessibilityLabel="Yuklanmoqda" />
            )}
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.body, { paddingBottom: Math.max(20, insets.bottom + 14) }]} showsVerticalScrollIndicator={false}>
            <View style={st.summary}>
              <Ring pct={pct} />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt f="display" size={22}>
                  {correct} / {qs.length} toʻgʻri
                </Txt>
                <Txt f="bodyBold" size={13} color="#4A5468">
                  {wrongRows.length} ta xato ·{' '}
                  <Txt f="bodyBold" size={13} color="#7A5300">
                    +{sc?.coins ?? 0} coin
                  </Txt>
                </Txt>
              </View>
            </View>

            {wrongRows.map((r) => (
              <View key={r.n} accessibilityLabel={`${r.n}-savol, notoʻgʻri`} style={[st.wrongCard, webShadow('inset 0 0 0 2px #F4B4AE', { borderWidth: 2, borderColor: '#F4B4AE' })]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Txt f="bodyHeavy" size={13} color="#B42318" style={{ width: 22 }}>
                    {r.n}
                  </Txt>
                  <Txt f="bodyHeavy" size={15} style={{ flex: 1 }}>
                    {r.prompt}
                  </Txt>
                  <View accessibilityLabel="Notoʻgʻri" style={[st.mark, { backgroundColor: '#FDECEC' }]}>
                    <CloseIcon size={14} color="#B42318" strokeWidth={3} />
                  </View>
                </View>
                <View style={[st.answerBox, { backgroundColor: '#FDECEC' }]}>
                  <Txt f="bodyHeavy" size={12} color="#B42318">
                    Sizning javobingiz
                  </Txt>
                  <Txt f="bodyHeavy" size={16} color="#7A1C14" lang="ru" style={st.strike}>
                    {r.pick ?? '—'}
                  </Txt>
                </View>
                <View style={[st.answerBox, { backgroundColor: '#E3F7EE' }]}>
                  <Txt f="bodyHeavy" size={12} color="#075E3A">
                    Toʻgʻri javob
                  </Txt>
                  <Txt f="bodyHeavy" size={16} color="#075E3A" lang="ru">
                    {r.correct}
                  </Txt>
                </View>
              </View>
            ))}

            {okRows.length > 0 && (
              <View accessibilityLabel="Qolgan savollar" style={st.list}>
                {okRows.map((r, k) => (
                  <View key={r.n} style={[st.li, k > 0 && { borderTopWidth: 1, borderTopColor: '#EEF1F7' }]}>
                    <Txt f="bodyHeavy" size={13} color="#4A5468" style={{ width: 22 }}>
                      {r.n}
                    </Txt>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <Txt f="body" size={13} color="#4A5468">
                        {r.prompt}
                      </Txt>
                      <Txt f="bodyHeavy" size={15} lang="ru">
                        {r.correct}
                      </Txt>
                    </View>
                    <View accessibilityLabel="Toʻgʻri" style={[st.mark, { backgroundColor: '#E3F7EE' }]}>
                      <Check size={16} color="#087A4A" />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  pressed: { opacity: 0.85 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { paddingTop: 16, paddingHorizontal: 20, gap: 12 },
  summary: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  wrongCard: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  mark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  answerBox: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  strike: { textDecorationLine: 'line-through', ...({ textDecorationThickness: 2 } as object) },
  list: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 2, paddingHorizontal: 16 },
  li: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
