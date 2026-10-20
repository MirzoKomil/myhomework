/**
 * Kompyuter: Tez tekshiruv (dizayn: D_QuickCheck.dc.html) — fokus rejim.
 *
 * Mantiq mobil ekran bilan bir xil: savollar dialog matnidan (buildQuickCheck),
 * "Tinglash" — javob replikasini expo-speech o'qiydi, tanlovda sfx va ovozli
 * maqtov (playSfx, praiseAnswer); ?d= — qaysi dialog; natija serverga
 * yuborilmaydi; oxirgi savoldan keyin audio dialogga qaytadi.
 * Klaviatura: 1/2/3 tanlash, Space tinglash, Enter davom etish, Esc yopish.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FadeInUp } from '@/components/v2/motion';
import { buildQuickCheck, getAudioTracks, speakerColor, speakersOf, trackLines, type DialogLine } from '@/components/v2/lessons/data';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';
import { stripRichText } from '@/services/richText';
import { playSfx } from '@/services/sfx';
import { praiseAnswer, resetPraiseRun, stopVoice } from '@/services/voicePraise';

import { FocusFrame, FocusProgress, KbdHint } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { IArrow, ICheck, IClose, ISpeaker, InKbd, T } from './ui';

const plainLines = (ls: DialogLine[]) => ls.map((l) => ({ ...l, ru: stripRichText(l.ru), uz: stripRichText(l.uz) }));

export function DQuickCheck({ id }: { id: string }) {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const trackIdx = Math.max(0, Number(d) || 0);
  const [mc, setMc] = useState<MobileContent | null>(null);
  const [error, setError] = useState(false);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [info, setInfo] = useState<{ number: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then((x) => {
        if (cancelled) return;
        setMc(x);
        const l = x.lessons.find((y) => y.id === id);
        const idx = l ? x.lessons.filter((y) => y.courseId === l.courseId).findIndex((y) => y.id === id) : -1;
        if (idx >= 0) setInfo({ number: idx + 1 });
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const tracks = useMemo(() => (mc ? getAudioTracks(mc, id) : []), [mc, id]);
  const track = tracks[trackIdx];
  const lines = useMemo(() => (mc && track ? plainLines(trackLines(mc, track)) : []), [mc, track]);
  const pool = useMemo(() => (mc ? tracks.filter((_, k) => k !== trackIdx).flatMap((t) => plainLines(trackLines(mc, t))) : []), [mc, tracks, trackIdx]);
  const questions = useMemo(() => buildQuickCheck(lines, pool), [lines, pool]);
  const speakers = speakersOf(lines);
  const q = questions[qi];
  const answered = picked !== null;
  const right = answered && picked === q?.correct;

  useEffect(() => {
    resetPraiseRun();
  }, [trackIdx]);
  useEffect(() => () => stopVoice(), []);

  const listen = () => {
    if (!q) return;
    stopVoice();
    Speech.stop();
    Speech.speak(q.answer.ru, { language: 'ru-RU', rate: 0.9 });
  };
  const next = () => {
    if (!answered) return;
    if (qi + 1 < questions.length) {
      setQi(qi + 1);
      setPicked(null);
    } else {
      router.replace(`${R.audioDialog(id)}?d=${trackIdx}` as Href);
    }
  };
  const pick = (k: number) => {
    if (!q || answered || k >= q.options.length) return;
    setPicked(k);
    playSfx(k === q.correct ? 'correct' : 'wrong');
    praiseAnswer(k === q.correct);
  };

  useDesktopKeys({ '1': () => pick(0), '2': () => pick(1), '3': () => pick(2), '4': () => pick(3), ' ': listen, Enter: next });

  const total = questions.length;
  const segs = (total ? questions : [null]).map((_, k) => (!total ? '#E2E6EE' : k < qi ? '#087A4A' : k === qi ? '#2F5BFF' : '#E2E6EE'));
  const tone = right ? { bg: '#E3F7EE', border: '#BFE8D3', ink: '#075E3A', dot: '#087A4A', btn: '#087A4A', shadow: '#075E3A', kbd: '#075E3A', kbdInk: '#CFF2E0' } : { bg: '#FDECEC', border: '#F6C7C3', ink: '#B42318', dot: '#B42318', btn: '#2F5BFF', shadow: '#1E3FD1', kbd: '#1E3FD1', kbdInk: '#DCE5FF' };

  return (
    <FocusFrame
      closeTo={R.lesson(id)}
      title={`Tez tekshiruv · ${trackIdx + 1}-dialog`}
      subtitle={info ? `${info.number}-dars · Audio dialoglar` : undefined}
      center={<FocusProgress width={440} left={`Savol ${total ? qi + 1 : 0} / ${total}`} right="Tinglab tushunish" rightColor="#4A5468" segments={segs} label={`${total} savoldan ${total ? qi + 1 : 0}-si`} />}
      scroll={false}
    >
      <View style={{ flex: 1 }}>
        <View style={s.stage}>
          {!q ? (
            <T f="body" size={14} color="#4A5468">
              {error ? 'Savollarni yuklab boʻlmadi.' : mc ? 'Bu dialog uchun savol yoʻq.' : 'Yuklanmoqda…'}
            </T>
          ) : (
            <View style={s.wrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={{ width: 124, height: 114 }} resizeMode="contain" accessibilityElementsHidden />
                <View style={{ gap: 6, flex: 1 }}>
                  <View style={{ minHeight: 26, justifyContent: 'center' }}>
                    <T size={12} color="#1E3FD1" ls={0.96} style={{ textTransform: 'uppercase' }}>
                      Tinglab tushunish
                    </T>
                  </View>
                  <T f="display" size={34} lh={37.4} ls={-0.68} accessibilityRole="header">
                    {q.answer.speaker} nima dedi?
                  </T>
                  <T f="bodyBold" size={15} color="#4A5468">
                    Tinglang va toʻgʻri javobni tanlang
                  </T>
                </View>
              </View>

              <View style={s.context}>
                <View style={[s.avatar, { backgroundColor: speakerColor(speakers, q.context.speaker) }]} accessibilityRole="image" accessibilityLabel={q.context.speaker}>
                  <T size={14} color="#FFFFFF">
                    {q.context.speaker.charAt(0).toUpperCase()}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={12} color="#4A5468" ls={0.96} style={{ textTransform: 'uppercase' }}>
                    {q.context.speaker}
                  </T>
                  <T size={20}>{q.context.ru}</T>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`${q.answer.speaker} javobini tinglash (Space)`} onPress={listen} style={({ pressed }) => [s.listen, pressed && { backgroundColor: '#1E3FD1' }]}>
                  <ISpeaker size={19} color="#FFFFFF" />
                  <T size={15} color="#FFFFFF">
                    Tinglash
                  </T>
                  <InKbd>Space</InKbd>
                </Pressable>
              </View>

              <View accessibilityRole="radiogroup" style={{ gap: 14 }}>
                {q.options.map((opt, k) => {
                  const isRight = answered && k === q.correct;
                  const isWrong = answered && k === picked && k !== q.correct;
                  const c = isRight ? '#087A4A' : isWrong ? '#B42318' : '#E2E6EE';
                  return (
                    <Pressable
                      key={k}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: picked === k, disabled: answered }}
                      disabled={answered}
                      onPress={() => pick(k)}
                      style={[s.opt, { borderColor: c, boxShadow: `0 4px 0 ${c}`, backgroundColor: isRight ? '#E3F7EE' : isWrong ? '#FDECEC' : '#FFFFFF' } as object]}
                    >
                      <View style={[s.num, isRight || isWrong ? { backgroundColor: c, borderWidth: 0 } : null]}>
                        <T size={14} color={isRight || isWrong ? '#FFFFFF' : '#4A5468'}>
                          {k + 1}
                        </T>
                      </View>
                      <T size={21} lh={27.3} color={isRight ? '#075E3A' : isWrong ? '#B42318' : '#0B1220'} style={{ flex: 1 }}>
                        {opt}
                      </T>
                      {(isRight || isWrong) && (
                        <View style={[s.mark, { backgroundColor: c }]}>{isRight ? <ICheck size={16} strokeWidth={3.2} /> : <IClose size={14} color="#FFFFFF" strokeWidth={3.2} />}</View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {answered && (
                <View accessibilityLabel="Audio matni" style={s.script}>
                  <T size={12} color="#4A5468" ls={0.96} style={{ textTransform: 'uppercase', width: 110 }}>
                    Audio matni
                  </T>
                  <View style={[s.avatar, { backgroundColor: speakerColor(speakers, q.answer.speaker) }]} accessibilityRole="image" accessibilityLabel={q.answer.speaker}>
                    <T size={14} color="#FFFFFF">
                      {q.answer.speaker.charAt(0).toUpperCase()}
                    </T>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={17}>«{q.answer.ru}»</T>
                    {!!q.answer.uz && (
                      <T f="body" size={14} color="#4A5468">
                        {q.answer.uz}
                      </T>
                    )}
                  </View>
                  <KbdHint keys={q.options.map((_, k) => String(k + 1))} label="tanlash" />
                </View>
              )}
            </View>
          )}
        </View>

        {q && answered ? (
          <FadeInUp key={qi}>
            <View accessibilityRole="alert" style={[s.footer, { backgroundColor: tone.bg, borderTopColor: tone.border }]}>
              <View style={s.footIn}>
                <View style={[s.bigDot, { backgroundColor: tone.dot }]}>{right ? <ICheck size={30} strokeWidth={3.2} /> : <IClose size={28} color="#FFFFFF" strokeWidth={3.2} />}</View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <T f="display" size={28} ls={-0.56} color={tone.ink}>
                    {right ? 'Toʻgʻri!' : 'Notoʻgʻri'}
                  </T>
                  <T f="bodyBold" size={16} lh={22.4} color={tone.ink}>
                    «{q.answer.ru.replace(/[.!?…]+$/, '')}»{q.answer.uz ? ` — ${q.answer.uz}` : ''}
                  </T>
                </View>
                <Pressable accessibilityRole="button" onPress={next} style={({ pressed }) => [s.cta, { backgroundColor: tone.btn, boxShadow: `0 5px 0 ${tone.shadow}` } as object, pressed && { opacity: 0.9 }]}>
                  <T size={16} color="#FFFFFF">
                    Davom etish
                  </T>
                  <IArrow size={18} />
                  <InKbd bg={tone.kbd} color={tone.kbdInk}>
                    Enter
                  </InKbd>
                </Pressable>
              </View>
            </View>
          </FadeInUp>
        ) : (
          q && (
            <View style={[s.footer, { backgroundColor: '#FFFFFF', borderTopColor: '#E4E8F0', borderTopWidth: 1 }]}>
              <View style={s.footIn}>
                <KbdHint keys={q.options.map((_, k) => String(k + 1))} label="tanlash" />
                <View style={{ flex: 1 }} />
                <View accessibilityState={{ disabled: true }} style={[s.cta, { backgroundColor: '#2F5BFF', opacity: 0.5, boxShadow: '0 5px 0 #1E3FD1' } as object]}>
                  <T size={16} color="#FFFFFF">
                    Davom etish
                  </T>
                  <IArrow size={18} />
                  <InKbd>Enter</InKbd>
                </View>
              </View>
            </View>
          )
        )}
      </View>
    </FocusFrame>
  );
}

const s = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  wrap: { width: 880, maxWidth: '100%', gap: 22 },
  context: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 22, paddingLeft: 24, paddingRight: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listen: { height: 52, paddingLeft: 18, paddingRight: 16, borderRadius: 16, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 9, boxShadow: '0 4px 0 #1E3FD1' } as object,
  opt: { minHeight: 74, borderRadius: 20, borderWidth: 2, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  num: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D5DBE7', alignItems: 'center', justifyContent: 'center' },
  mark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  script: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  footer: { height: 132, borderTopWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  footIn: { width: 880, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 16 },
  bigDot: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 58, paddingLeft: 26, paddingRight: 22, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
