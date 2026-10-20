/**
 * Kompyuter: Test natijasi — javoblar (dizayn: D_TestReview). Ma'lumot mobil
 * vazifa-natija.tsx bilan aynan bir xil: savollar — dars kontenti, o'quvchi
 * javoblari va natijalari — scoreStore (picks / results / eski yozuvlarda
 * mistakes). Standart — test qismi, ?qism=<partId> bilan boshqasi.
 * Xatolar to'liq kenglikda (javobingiz / to'g'ri javob), to'g'rilari
 * ikki ustunli to'rda.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { isTeacherGraded, loadLessonInfo, partLabel, type LessonInfo } from '@/components/v2/homework/lib';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import { FadeInUp, useCountUp } from '@/components/v2/motion';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';
import { v2Back } from '@/services/v2Nav';

import { IBack, ICheck, IChevron, IClose, ICoin, IRepeat, Loading, Txt } from './dui';

type Row = { n: number; prompt: string; correct: string; pick?: string; ok: boolean };

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

/** 190px halqa (dizayn: r 54, chiziq 14, 128 viewBox, yumaloq uch). */
function Ring({ pct: target }: { pct: number }) {
  const pct = useCountUp(target, { duration: 800, delay: 150 });
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 190, height: 190, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={190} height={190} viewBox="0 0 128 128" style={StyleSheet.absoluteFill}>
        <Circle cx={64} cy={64} r={r} stroke="#FDECEC" strokeWidth={14} fill="none" />
        {pct > 0 && <Circle cx={64} cy={64} r={r} stroke="#087A4A" strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 64 64)" />}
      </Svg>
      <Txt f="display" size={42} style={{ letterSpacing: -0.84 }}>
        {pct}%
      </Txt>
    </View>
  );
}

export function DTestReview() {
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

  const backTo = `${R.homework(id)}?yuborildi=1`;
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
  const coins = sc?.coins ?? 0;
  // To'g'ri javoblar ikki ustunda; oxirgi katak — "N ta savol to'g'ri".
  const cells: (Row | null)[] = [...okRows, null];
  const gridRows: (Row | null)[][] = [];
  for (let i = 0; i < cells.length; i += 2) gridRows.push(cells.slice(i, i + 2));

  return (
    <DesktopPage
      title={part ? `${partLabel(part)} natijasi` : 'Test natijasi'}
      subtitle={`${info ? `${info.number}-dars · ` : ''}Uyga vazifa · avtomatik tekshirildi`}
      back={backTo}
    >
      {!info ? (
        <Loading error={error} />
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
            {wrongRows.map((r, k) => (
              <FadeInUp key={r.n} delay={90 + Math.min(k, 5) * 70}>
                <View accessibilityLabel={`${r.n}-savol, notoʻgʻri`} style={st.wrong}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Txt f="bodyHeavy" size={16} color="#B42318" style={{ width: 30 }}>
                      {r.n}
                    </Txt>
                    <Txt f="bodyHeavy" size={18} style={{ flex: 1 }}>
                      {r.prompt}
                    </Txt>
                    <View accessibilityLabel="xato" style={[st.mark, { backgroundColor: '#FDECEC' }]}>
                      <IClose size={14} color="#B42318" sw={3} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[st.box, { backgroundColor: '#FDECEC' }]}>
                      <Txt f="bodyHeavy" size={13} color="#B42318">
                        Sizning javobingiz
                      </Txt>
                      <Txt f="bodyHeavy" size={19} color="#B42318" lang="ru" style={st.strike}>
                        {r.pick ?? '—'}
                      </Txt>
                    </View>
                    <View style={[st.box, { backgroundColor: '#E3F7EE' }]}>
                      <Txt f="bodyHeavy" size={13} color="#075E3A">
                        Toʻgʻri javob
                      </Txt>
                      <Txt f="bodyHeavy" size={19} color="#075E3A" lang="ru">
                        {r.correct}
                      </Txt>
                    </View>
                  </View>
                </View>
              </FadeInUp>
            ))}

            <View accessibilityRole="list" accessibilityLabel="Qolgan savollar" style={{ flex: 1, minHeight: 0, gap: 10 }}>
              {gridRows.map((pair, k) => (
                <View key={k} style={{ flex: 1, minHeight: 72, maxHeight: 140, flexDirection: 'row', gap: 10 }}>
                  {pair.map((r) =>
                    r ? (
                      <View key={r.n} style={st.ok}>
                        <Txt f="bodyHeavy" size={15} color="#4A5468" style={{ width: 24, flexShrink: 0 }}>
                          {r.n}
                        </Txt>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Txt f="bodyBold" size={13} color="#4A5468" numberOfLines={2}>
                            {r.prompt}
                          </Txt>
                          <Txt f="bodyHeavy" size={16} lang="ru" numberOfLines={2}>
                            {r.correct}
                          </Txt>
                        </View>
                        <View accessibilityLabel="toʻgʻri" style={[st.mark, { backgroundColor: '#E3F7EE' }]}>
                          <ICheck size={15} color="#087A4A" sw={3.2} />
                        </View>
                      </View>
                    ) : (
                      <View key="sum" style={st.sum}>
                        <ICheck size={16} color="#087A4A" sw={3} />
                        <Txt f="bodyHeavy" size={14} color="#4A5468">
                          {okRows.length} ta savol toʻgʻri
                        </Txt>
                      </View>
                    ),
                  )}
                  {pair.length < 2 && <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          </View>

          <View style={{ width: 320, flexShrink: 0, gap: 16 }}>
            <FadeInUp style={st.result}>
              <Ring pct={pct} />
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Txt f="display" size={30} style={{ letterSpacing: -0.6 }}>
                  {correct} / {qs.length} toʻgʻri
                </Txt>
                <Txt f="bodyBold" size={15} color="#4A5468">
                  {wrongRows.length} ta xato ·{' '}
                  <Txt f="bodyHeavy" size={15} color="#7A5300">
                    +{coins} coin
                  </Txt>
                </Txt>
              </View>
              <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 10 }}>
                <View style={[st.tally, { backgroundColor: '#E3F7EE' }]}>
                  <Txt f="bodyHeavy" size={24} color="#075E3A">
                    {correct}
                  </Txt>
                  <Txt f="bodyBold" size={13} color="#075E3A">
                    toʻgʻri
                  </Txt>
                </View>
                <View style={[st.tally, { backgroundColor: '#FDECEC' }]}>
                  <Txt f="bodyHeavy" size={24} color="#B42318">
                    {wrongRows.length}
                  </Txt>
                  <Txt f="bodyBold" size={13} color="#B42318">
                    xato
                  </Txt>
                </View>
              </View>
              <View style={st.coinLine}>
                <ICoin size={18} />
                <Txt f="bodyHeavy" size={14} color="#7A5300">
                  +{coins} coin · har toʻgʻri javob +1
                </Txt>
              </View>
            </FadeInUp>
            <Pressable accessibilityRole="link" onPress={() => router.push(R.mistakes(id) as Href)} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.mist, hovered && { opacity: 0.92 }]}>
              <View style={st.mistIcon}>
                <IRepeat />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Txt f="bodyHeavy" size={15}>
                  Xatolar ustida ishlash
                </Txt>
                <Txt f="bodyBold" size={13} color="#B34700">
                  Xatoni yana bir bor yeching
                </Txt>
              </View>
              <IChevron size={17} color="#B34700" />
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => v2Back(backTo)} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.backBtn, hovered && { borderColor: '#C9D3F5' }]}>
              <IBack size={17} />
              <Txt f="bodyHeavy" size={15}>
                Vazifa natijasiga qaytish
              </Txt>
            </Pressable>
          </View>
        </View>
      )}
    </DesktopPage>
  );
}

const st = StyleSheet.create({
  wrong: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F6C9C5', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, gap: 12 },
  mark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  box: { flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, gap: 3 },
  strike: { textDecorationLine: 'line-through' },
  ok: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Yonidagi katak bilan teng kenglik: chap+o'ng (13+2)×2 = 16+14.
  sum: { flex: 1, paddingHorizontal: 13, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D5DBE7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  result: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 26, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 20 },
  tally: { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 12, gap: 2, alignItems: 'center' },
  coinLine: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF4D1', borderRadius: 14, padding: 11 },
  mist: { backgroundColor: '#FFF1E6', borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mistIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backBtn: { height: 54, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
