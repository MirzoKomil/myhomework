/**
 * Kompyuter: Uyga vazifa (dizayn: D_Homework). Ma'lumot mobil
 * vazifa/index.tsx bilan aynan bir xil: dars kontenti (loadLessonInfo),
 * bajarilgan qismlar (lessonProgressStore), natijalar (scoreStore),
 * ijodiy vazifa holati (creativeSubmissionApi). Vazifa muddati serverda
 * yo'q — "—". Qismlar harfsiz: tur ikonkasi + nom (kelishuv).
 * Klaviatura: Enter — asosiy tugma (qismni davom ettirish).
 */
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { KindIcon } from '@/components/v2/homework/KindIcon';
import { isTeacherGraded, KIND_SHORT, KIND_SUB, KIND_TILE, lessonLabel, loadLessonInfo, partLetter, partQuestionCount, type LessonInfo } from '@/components/v2/homework/lib';
import { useHomeworkScores, type PartScore } from '@/components/v2/homework/scoreStore';
import { blankExtras } from '@/components/v2/homework/ChoiceParts';
import { splitTitle } from '@/components/v2/lessons/data';
import { Confetti } from '@/components/v2/motion';
import { HomeworkSentPopup } from '@/components/v2/popups/HomeworkSent';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import type { HomeworkPart } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { fetchCreativeSubmission, submissionKey, type CreativeSubmissionRecord } from '@/services/creativeSubmissionApi';
import { useLessonProgress } from '@/services/lessonProgressStore';
import { playSfx } from '@/services/sfx';
import { speakUnlessRecent } from '@/services/voicePraise';

import { BigButton, IArrow, IBulb, ICheck, IChevron, IClose, ICoin, IVideo, Loading, Txt, webShadow } from './dui';

/** Dizayndagi plitka ranglari (Test — #6A3CF0); qolganlari mobil KIND_TILE. */
const tileOf = (k: HomeworkPart['kind']) => (k === 'multipleChoice' ? { ...KIND_TILE[k], fg: '#6A3CF0' } : KIND_TILE[k]);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function DHomework() {
  const { lessonId, yuborildi, bajarildi } = useLocalSearchParams<{ lessonId: string; yuborildi?: string; bajarildi?: string }>();
  const id = String(lessonId);
  const [info, setInfo] = useState<LessonInfo | null>(null);
  const [error, setError] = useState(false);
  const [creative, setCreative] = useState<CreativeSubmissionRecord | null>(null);
  const [, setReading] = useState<CreativeSubmissionRecord | null>(null);
  const [sentOpen, setSentOpen] = useState(yuborildi === '1');
  // "Vazifa tekshirildi" bayrami faqat bir marta (mobil kabi).
  const [celebrate, setCelebrate] = useState(yuborildi === '1');
  const [burst] = useState(bajarildi === '1');
  const [prevLesson, setPrevLesson] = useState<{ name: string; isVideo: boolean } | null>(null);
  useEffect(() => {
    if (yuborildi === '1') router.setParams({ yuborildi: undefined });
    if (!burst) return;
    playSfx('complete');
    speakUnlessRecent('correct', 1550);
    router.setParams({ bajarildi: undefined });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = useLessonProgress(id);
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

  // Oldingi dars nomi va turi (videodars / jonli dars) — "31-dars videodarsi" qatori uchun.
  useEffect(() => {
    if (!info?.prev) return;
    let cancelled = false;
    const prevId = info.prev.id;
    const prevIndex = info.prev.number - 1;
    fetchMobileContent()
      .then((mc) => {
        const l = mc.lessons.find((x) => x.id === prevId);
        if (!cancelled) setPrevLesson({ name: l?.name ?? '', isVideo: prevIndex % 2 === 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [info]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchCreativeSubmission(id).then((r) => !cancelled && setCreative(r));
      fetchCreativeSubmission(submissionKey(id, 'reading')).then((r) => !cancelled && setReading(r));
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const parts = info?.content.homeworkParts ?? [];
  const lessonScores = scores[id] ?? {};
  const isDone = (p: HomeworkPart) =>
    p.kind === 'creative' ? creative?.status === 'graded' : !!progress.homeworkParts[p.id] || !!lessonScores[p.id]?.finished;
  const isPending = (p: HomeworkPart) => p.kind === 'creative' && creative?.status === 'pending';
  const autoParts = parts.filter((p) => !isTeacherGraded(p));
  const answeredOf = (p: HomeworkPart) => {
    const total = partQuestionCount(p);
    if (isDone(p)) return total;
    return Math.min(total, lessonScores[p.id]?.answered ?? 0);
  };
  const totalQ = autoParts.reduce((a, p) => a + partQuestionCount(p), 0);
  const answeredQ = autoParts.reduce((a, p) => a + answeredOf(p), 0);
  const earned = autoParts.reduce((a, p) => a + (lessonScores[p.id]?.coins ?? 0), 0);
  const correctQ = autoParts.reduce((a, p) => a + Math.min(partQuestionCount(p), lessonScores[p.id]?.correct ?? 0), 0);
  const allAutoDone = autoParts.length > 0 && autoParts.every(isDone);
  const current = parts.find((p) => !isDone(p) && !isPending(p));
  const openPart = (p: HomeworkPart) => router.push(R.homeworkPart(id, p.id) as Href);
  const ctaPress = () => (current ? openPart(current) : allAutoDone ? setSentOpen(true) : undefined);
  useDesktopKeys({ Enter: info && !sentOpen ? ctaPress : undefined });

  const back = R.lesson(id);
  if (!info) {
    return (
      <DesktopPage title="Uyga vazifa" back={back}>
        <Loading error={error} />
      </DesktopPage>
    );
  }

  const prev = info.prev && info.prev.content.homeworkParts.length > 0 ? info.prev : null;
  const prevScores = prev ? (scores[prev.id] ?? {}) : {};
  const prevAuto = prev ? prev.content.homeworkParts.filter((p) => !isTeacherGraded(p)) : [];
  const prevTotal = prevAuto.reduce((a, p) => a + partQuestionCount(p), 0);
  const prevCorrect = prevAuto.reduce((a, p) => a + (prevScores[p.id]?.correct ?? 0), 0);

  // "Yodda tuting": bo'sh joy savollaridan ikkitasi (avval xato qilinganlari) — mobil bilan bir xil.
  const remember = parts
    .flatMap((p) => (p.kind === 'fillBlank' ? p.blanks.map((b) => ({ b, wrong: (lessonScores[p.id]?.mistakes ?? []).includes(b.sentence) })) : []))
    .sort((x, y) => Number(y.wrong) - Number(x.wrong))
    .slice(0, 2)
    .map(({ b }) => b);

  // Mobil yorliq bilan bir xil ma'no; tugmaga sig'ishi uchun qism nomining qisqasi ("Boʻsh joyni davom ettirish").
  const continueLabel = current
    ? `${partLetter(current) ? `${partLetter(current)} qismni` : `${KIND_SHORT[current.kind]}ni`} ${lessonScores[current.id]?.answered ? 'davom ettirish' : 'boshlash'}`
    : 'Natijani koʻrish';

  return (
    <DesktopPage title="Uyga vazifa" subtitle={lessonLabel(info.number, info.name)} back={back}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 24 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 18 }}>
          <View accessibilityLabel="Muddat va natija" style={st.dark}>
            <View style={{ gap: 2, flexShrink: 0 }}>
              <Txt f="bodyBold" size={14} color="#B8C1D6">
                Muddat
              </Txt>
              {/* Vazifa muddati serverda yo'q (mobil kabi). */}
              <Txt f="display" size={34} lh={35.7} color="#FFFFFF" style={{ letterSpacing: -0.34 }}>
                —
              </Txt>
            </View>
            <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#263048' }} />
            <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
              {/* Tor oynada (1024px) matnlar ikki qatorga o'tadi, so'zma-so'z bo'linmaydi. */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8, rowGap: 2 }}>
                <Txt f="bodyHeavy" size={14} color="#FFFFFF">
                  {answeredQ} / {totalQ} savol javob berildi
                </Txt>
                <Txt f="bodyHeavy" size={14} color="#7FE0AE">
                  {correctQ} ta toʻgʻri = {earned} coin
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={autoParts.map((p) => `${p.title} ${answeredOf(p)} / ${partQuestionCount(p)}`).join(', ')}>
                {(autoParts.length ? autoParts : [null]).map((p, i) => (
                  <View key={p?.id ?? i} style={st.seg}>
                    <View style={{ width: `${p ? (answeredOf(p) / Math.max(1, partQuestionCount(p))) * 100 : 0}%`, height: 10, borderRadius: 5, backgroundColor: '#FFC93C' }} />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                {autoParts.map((p) => (
                  <Txt key={p.id} f="bodyBold" size={13} color="#B8C1D6" numberOfLines={1}>
                    {KIND_SHORT[p.kind]} · {answeredOf(p)} / {partQuestionCount(p)}
                  </Txt>
                ))}
              </View>
            </View>
            <View accessibilityLabel={`Coin: ${earned} / ${totalQ}`} style={st.coinPill}>
              <ICoin size={20} />
              <Txt f="bodyHeavy" size={18} color="#FFC93C">
                {earned} / {totalQ}
              </Txt>
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 0, gap: 16 }}>
            {parts.length === 0 && (
              <View style={[st.part, { flex: 0 }]}>
                <Txt f="body" size={15} color="#4A5468">
                  Bu dars uchun vazifa hali kiritilmagan.
                </Txt>
              </View>
            )}
            {parts.map((p) => (
              <PartCard
                key={p.id}
                part={p}
                focused={current?.id === p.id}
                done={isDone(p)}
                pending={isPending(p)}
                answered={answeredOf(p)}
                score={lessonScores[p.id]}
                onOpen={() => openPart(p)}
              />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 14 }}>
            <BigButton label={continueLabel} kind="primary" arrow kbd="Enter" onPress={ctaPress} style={{ flex: 1, flexShrink: 1 }} />
            {/* Barcha avtomatik savollar javoblanmaguncha "Topshirish" qulflangan (mobil kabi). */}
            {allAutoDone ? (
              <BigButton label="Topshirish" kind="soft" onPress={() => setSentOpen(true)} style={{ flex: 1, flexShrink: 1 }} />
            ) : (
              <BigButton label={`Topshirish · ${Math.max(0, totalQ - answeredQ)} savol qoldi`} kind="disabled" lock pad={[24, 24]} style={{ flex: 1, flexShrink: 1 }} />
            )}
          </View>
        </View>

        <View style={{ width: 340, flexShrink: 0, gap: 16 }}>
          <View style={st.autoCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image source={designImages['81a355f68578bf95c65fc6772f9124c9']} resizeMode="contain" style={{ width: 56, height: 56, flexShrink: 0 }} />
              <Txt f="body" size={14} color="#34405A" lh={20.3} style={{ flex: 1 }}>
                <Txt f="bodyHeavy" size={14}>
                  Avtomatik tekshiriladi
                </Txt>
                {` · ${totalQ}/${totalQ} boʻlgach topshirasiz, natija va coin darhol chiqadi.`}
              </Txt>
            </View>
            <View style={st.coinRow}>
              <ICoin size={18} />
              <Txt f="bodyHeavy" size={14} color="#7A5300">
                Har toʻgʻri javob · +1 coin
              </Txt>
            </View>
          </View>

          {remember.length > 0 && (
            <View accessibilityLabel="Yodda tuting" style={st.remember}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
                <View style={st.bulb}>
                  <IBulb size={19} />
                </View>
                <Txt f="bodyHeavy" size={17} accessibilityRole="header">
                  Yodda tuting
                </Txt>
              </View>
              {remember.map((b, k) => {
                const [before, ...rest] = b.sentence.split(/_{2,}/);
                const others = b.options.filter((o) => o !== b.answer);
                const tr = blankExtras(b, info.content.vocabulary, info.content.speakingPractice).translation;
                return (
                  <View key={b.id} style={[st.remRow, k === remember.length - 1 && { paddingBottom: 4 }]}>
                    <Txt f="bodyHeavy" size={18} lang="ru">
                      {before}
                      <Txt f="bodyHeavy" size={18} color="#1E3FD1">
                        {b.answer}
                      </Txt>
                      {rest.join(b.answer)}
                    </Txt>
                    {(!!tr || others.length > 0) && (
                      <Txt f="body" size={14} color="#4A5468">
                        {tr ? `${tr} ` : ''}
                        {others.length > 0 && (
                          <>
                            (
                            <Txt f="body" size={14} color="#4A5468" lang="ru">
                              {others.join(', ')}
                            </Txt>{' '}
                            emas)
                          </>
                        )}
                      </Txt>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {prev && (
            <View accessibilityLabel={`${prev.number}-dars vazifasi`} style={st.prev}>
              <Txt f="bodyBold" size={15} color="#075E3A" style={{ paddingHorizontal: 2, paddingBottom: 4 }}>
                <Txt f="bodyHeavy" size={15} color="#075E3A">
                  {prev.number}-dars vazifasi
                </Txt>
                {` · ${prevCorrect}/${prevTotal} toʻgʻri · takrorlash`}
              </Txt>
              {prev.content.homeworkParts.map((p) => (
                <PrevRow
                  key={p.id}
                  icon={<KindIcon kind={p.kind} color="#087A4A" size={19} />}
                  // "Oʻqish: «…»" → nom + izoh (dizayndagidek ikki qator).
                  title={p.title.includes(': ') ? p.title.split(': ')[0] : p.title}
                  sub={p.title.includes(': ') ? p.title.split(': ').slice(1).join(': ') : cap(KIND_SUB[p.kind])}
                  onPress={() => router.push(R.homeworkPart(prev.id, p.id) as Href)}
                />
              ))}
              {prevLesson && (
                <PrevRow
                  icon={<IVideo />}
                  title={`${prev.number}-dars ${prevLesson.isVideo ? 'videodarsi' : 'slaydlari'}`}
                  sub={splitTitle(prevLesson.name).title || `${prev.number}-dars`}
                  onPress={() => router.push((prevLesson.isVideo ? R.video(prev.id) : R.slides(prev.id)) as Href)}
                />
              )}
            </View>
          )}
        </View>
      </View>
      {burst && <Confetti count={26} seed={11} />}
      <HomeworkSentPopup
        visible={sentOpen}
        onClose={() => {
          setSentOpen(false);
          setCelebrate(false);
        }}
        celebrate={celebrate}
        lessonId={id}
        lessonNumber={info.number}
        parts={autoParts}
        scores={lessonScores}
      />
    </DesktopPage>
  );
}

function PartCard({
  part,
  focused,
  done,
  pending,
  answered,
  score,
  onOpen,
}: {
  part: HomeworkPart;
  focused: boolean;
  done: boolean;
  pending: boolean;
  answered: number;
  score: PartScore | undefined;
  onOpen: () => void;
}) {
  const tile = tileOf(part.kind);
  const total = partQuestionCount(part);
  const started = answered > 0 && !done;
  // Har savol holati — scoreStore natijalari (eski yozuvlarda: xatolar ro'yxatidan).
  const textOf = (i: number) =>
    part.kind === 'fillBlank' ? part.blanks[i]?.sentence : part.kind === 'multipleChoice' ? part.questions[i]?.question : part.kind === 'sentenceBuild' ? part.items[i]?.translation : undefined;
  const cells = Array.from({ length: total }, (_, i) => {
    if (i < answered) {
      const r = score?.results?.[i];
      if (r !== undefined) return r ? 'ok' : 'bad';
      const t = textOf(i);
      return t && (score?.mistakes ?? []).includes(t) ? 'bad' : 'ok';
    }
    return focused && i === answered ? 'next' : 'none';
  });
  const status = done ? 'Bajarildi' : pending ? 'Yuborilgan — tekshirilmoqda' : started ? `${answered} / ${total}${focused ? '' : ' · davom etmoqda'}` : '';
  return (
    <View style={[st.part, { borderColor: focused ? '#2F5BFF' : 'transparent' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={[st.tile, { backgroundColor: tile.bg }]}>
          <KindIcon kind={part.kind} color={tile.fg} size={28} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Txt f="bodyHeavy" size={20} numberOfLines={1}>
            {part.title}
          </Txt>
          <Txt f="bodyBold" size={14} color="#4A5468" numberOfLines={1}>
            {isTeacherGraded(part) ? KIND_SUB[part.kind] : `${total} savol · ${KIND_SUB[part.kind]}`}
            {!!status && (
              <Txt f="bodyHeavy" size={14} color={done ? '#075E3A' : pending ? '#4A5468' : tile.fg}>
                {` · ${status}`}
              </Txt>
            )}
          </Txt>
        </View>
        {focused ? (
          <BigButton label={started ? 'Davom etish' : 'Boshlash'} kind="primary" onPress={onOpen} height={50} size={15} pad={[20, 20]} style={[{ borderRadius: 16, gap: 8 }, webShadow('0 4px 0 #1E3FD1')]}>
            <IArrow size={17} color="#FFFFFF" sw={2.4} />
          </BigButton>
        ) : (
          <Pressable accessibilityRole="button" onPress={onOpen} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.openBtn, hovered && { backgroundColor: '#EEF1F7' }]}>
            <Txt f="bodyHeavy" size={15}>
              Ochish
            </Txt>
            <IArrow size={17} color="#0B1220" sw={2.4} />
          </Pressable>
        )}
      </View>
      <View accessibilityRole="list" accessibilityLabel={`${part.title} savollari`} style={st.grid}>
        {chunk(cells, 5).map((row, r) => (
          <View key={r} style={{ flex: 1, minHeight: 56, flexDirection: 'row', gap: 8 }}>
            {row.map((c, j) => {
              const n = r * 5 + j + 1;
              const v =
                c === 'ok'
                  ? { bg: '#E3F7EE', fg: '#075E3A', label: 'toʻgʻri' }
                  : c === 'bad'
                    ? { bg: '#FDECEC', fg: '#B42318', label: 'xato' }
                    : c === 'next'
                      ? { bg: '#FFFFFF', fg: '#1E3FD1', label: 'navbatdagi' }
                      : { bg: '#F4F6FA', fg: '#4A5468', label: 'javob berilmagan' };
              return (
                <Pressable
                  key={n}
                  accessibilityLabel={`${n}-savol: ${v.label}`}
                  onPress={onOpen}
                  style={[st.cell, { backgroundColor: v.bg }, c === 'next' && webShadow('inset 0 0 0 2px #2F5BFF', { borderWidth: 2, borderColor: '#2F5BFF' })]}
                >
                  <Txt f="bodyHeavy" size={17} color={v.fg}>
                    {n}
                  </Txt>
                  <View style={{ height: 15, justifyContent: 'center' }}>
                    {c === 'ok' && <ICheck size={15} color="#087A4A" sw={3.2} />}
                    {c === 'bad' && <IClose size={14} color="#B42318" sw={3} />}
                    {c === 'next' && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2F5BFF' }} />}
                  </View>
                </Pressable>
              );
            })}
            {/* Oxirgi qator to'lmasa — bo'sh joy (5 ustunli to'r). */}
            {Array.from({ length: 5 - row.length }, (_, k) => (
              <View key={`e${k}`} style={{ flex: 1 }} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function PrevRow({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [st.prevRow, hovered && { backgroundColor: '#FAFBFD' }]}>
      <View style={st.prevIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt f="bodyHeavy" size={15} numberOfLines={1}>
          {title}
        </Txt>
        <Txt f="bodyBold" size={13} color="#4A5468" numberOfLines={1}>
          {sub}
        </Txt>
      </View>
      <IChevron size={17} color="#075E3A" />
    </Pressable>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const st = StyleSheet.create({
  dark: { backgroundColor: '#0B1220', borderRadius: 26, paddingVertical: 22, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', gap: 28 },
  seg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#263048', overflow: 'hidden' },
  coinPill: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#1B2438', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  part: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderWidth: 2, borderRadius: 26, paddingVertical: 20, paddingHorizontal: 22, gap: 16 },
  tile: { width: 60, height: 60, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  openBtn: { height: 50, paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  grid: { flex: 1, minHeight: 0, gap: 8 },
  cell: { flex: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  autoCard: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 16, paddingRight: 18, paddingBottom: 18, paddingLeft: 14, gap: 12 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF4D1', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  remember: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, gap: 4 },
  bulb: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF4D1', alignItems: 'center', justifyContent: 'center' },
  remRow: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: '#EEF1F7', gap: 3 },
  prev: { flex: 1, minHeight: 0, backgroundColor: '#E3F7EE', borderRadius: 24, padding: 16, gap: 8 },
  prevRow: { flex: 1, minHeight: 56, maxHeight: 74, borderRadius: 16, backgroundColor: '#FFFFFF', paddingLeft: 10, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  prevIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E3F7EE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

