/**
 * v2 Imtihon (dizayn: "Domwork — Imtihon topshirish (yangi ilova)", 1–26-ekranlar).
 *
 * Bosqichlar: kirish → tayyorgarlik (ovoz) → savollar (5 bo'lim) → tanaffus →
 * ko'rib chiqish → natija → tahlil. Mantiq: services/examV2.ts.
 * Imtihon ichida to'g'ri/xato ovozi YO'Q (javob bilinmasin); faqat neytral
 * select/flip/pop/unlock, tinglash bo'limida ular ham o'chadi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedFill, Confetti, CountUp, Pop, SlideUp } from '@/components/v2/motion';
import { Txt } from '@/components/v2/homework/ui';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { saveExamResult } from '@/services/examStore';
import {
  BREAK_SEC,
  LEAVE_GRACE_MS,
  LEAVE_LIMIT,
  SECTION_LABEL,
  buildAttempt,
  clearSession,
  cooldownLeft,
  grade,
  isAnswered,
  lessonIdsByNo,
  loadExamBank,
  loadOutcome,
  loadSession,
  mediaUrl,
  saveOutcome,
  saveSession,
  type Answer,
  type AttemptQuestion,
  type ExamBank,
  type ExamOutcome,
  type SectionKey,
  type Session,
} from '@/services/examV2';
import { playSfx } from '@/services/sfx';
import { v2Back } from '@/services/v2Nav';

const INK = '#0B1220';
const MU = '#4A5468';
const CO = '#2F5BFF';
const COP = '#1E3FD1';
const BG = '#F4F6FA';
const TR = '#E7EBF3';
const GREEN = '#0FA968';

/* eslint-disable @typescript-eslint/no-require-imports */
const IMG = {
  desk: require('@/assets/images/v2/d/exam-desk.webp'),
  warn: require('@/assets/images/v2/d/exam-warn.webp'),
  again: require('@/assets/images/v2/d/exam-again.webp'),
  medal: require('@/assets/images/v2/d/exam-medal.webp'),
  headphones: designImages['32eee84d436da97eb104c837c0065230'],
  reading: designImages['e57b4e5aeb29652a1e91b899a8e24693'],
  clock: designImages['d9b3ac63886f3fdd8214701a31f0956a'],
  thinking: designImages['cc0d95446730f059d25d989e2c9845ad'],
};
/* eslint-enable @typescript-eslint/no-require-imports */

let LESSON_IDS: string[] = [];
lessonIdsByNo().then((x) => (LESSON_IDS = x));
function openLesson(no?: number) {
  const lid = no ? LESSON_IDS[no - 1] : undefined;
  router.push((lid ? R.lesson(lid) : R.path) as Href);
}
const TITLE = (id: string) => (id === 'final' ? 'Yakuniy imtihon' : `${id.replace('interval-', '')}-oraliq imtihon`);
const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const hms = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type Phase = 'loading' | 'intro' | 'ready' | 'exam' | 'break' | 'review' | 'result' | 'analysis' | 'missing';

export default function ExamScreen() {
  const insets = useSafeAreaInsets();
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const id = String(examId);
  const [exam, setExam] = useState<ExamBank | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [s, setS] = useState<Session | null>(null);
  const [resume, setResume] = useState<Session | null>(null);
  const [last, setLast] = useState<ExamOutcome | null>(null);
  const [outcome, setOutcome] = useState<ExamOutcome | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState<null | 'map' | 'exit' | 'left'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [breakEnd, setBreakEnd] = useState(0);
  const [reload, setReload] = useState(0);
  const sRef = useRef<Session | null>(null);
  sRef.current = s;

  // ── Yuklash ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let off = false;
    (async () => {
      const tryLoad = () => loadExamBank(id).catch(() => undefined);
      const [first, sess, lastO] = await Promise.all([tryLoad(), loadSession(id), loadOutcome(id)]);
      // Tarmoq/token kechiksa — bir marta qayta urinish.
      const bank = first ?? (await new Promise((r) => setTimeout(r, 1200)).then(tryLoad));
      if (off) return;
      if (!bank) return setPhase('missing');
      setExam(bank);
      setLast(lastO);
      if (sess && sess.deadline > Date.now()) setResume(sess);
      else if (sess) {
        // Ilova yopiq turganda vaqt tugagan — javoblar o'zi topshiriladi.
        const o = grade(bank, sess, 'timeout');
        await finishWith(bank, o);
        return;
      }
      setPhase('intro');
    })();
    return () => {
      off = true;
    };
  }, [id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Taymer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = s ? (s.deadline - now) / 1000 : 0;
  const warned = useRef({ five: false, one: false });
  useEffect(() => {
    if (phase !== 'exam' || !s || !exam) return;
    if (left <= 0) finish('timeout');
    else if (left <= 60 && !warned.current.one) {
      warned.current.one = true;
      setToast('1 daqiqa qoldi');
    } else if (left <= 300 && !warned.current.five) {
      warned.current.five = true;
      const unanswered = s.questions.filter((q) => !isAnswered(s.answers[q.id])).length;
      setToast(`5 daqiqa qoldi · ${unanswered} ta javobsiz savol`);
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (phase === 'break' && now >= breakEnd) endBreak();
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ilovadan chiqishni hisoblash (qo'ng'iroq / <10 s hisoblanmaydi) ───────
  const leftAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const cur = sRef.current;
      if (phase !== 'exam' || !cur) return;
      if (st === 'background') leftAt.current = Date.now();
      if (st === 'active' && leftAt.current) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away < LEAVE_GRACE_MS) return;
        const leaves = cur.leaves + 1;
        update({ leaves });
        if (leaves >= LEAVE_LIMIT) finish('left');
        else setSheet('left');
      }
    });
    return () => sub.remove();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((p: Partial<Session>) => {
    const cur = sRef.current;
    if (!cur) return;
    const next = { ...cur, ...p };
    sRef.current = next;
    setS(next);
    saveSession(next);
  }, []);

  const start = () => {
    if (!exam) return;
    const t = Date.now();
    const sess: Session = {
      examId: id,
      startedAt: t,
      deadline: t + exam.durationSec * 1000,
      pausedMs: 0,
      questions: buildAttempt(exam, t),
      answers: {},
      flags: [],
      index: 0,
      leaves: 0,
      plays: {},
      breaksTaken: [],
    };
    warned.current = { five: false, one: false };
    sRef.current = sess;
    setS(sess);
    saveSession(sess);
    playSfx('flip');
    setPhase('exam');
  };
  const continueSession = () => {
    if (!resume) return;
    sRef.current = resume;
    setS(resume);
    setResume(null);
    setPhase('exam');
  };

  async function finishWith(bank: ExamBank, o: ExamOutcome) {
    setOutcome(o);
    setLast(o);
    await saveOutcome(o);
    await clearSession(id);
    saveExamResult(id, {
      passed: o.passed,
      scorePercent: o.percent,
      attemptedAt: o.finishedAt,
      mistakes: o.mistakes.slice(0, 40).map((m) => ({ question: m.question, yourAnswer: m.yourAnswer, correctAnswer: m.correctAnswer })),
    });
    setPhase('result');
    playSfx(o.passed ? 'complete' : 'lose');
    if (o.passed) setTimeout(() => playSfx('levelup'), 700);
  }
  const finish = (reason: ExamOutcome['reason']) => {
    const cur = sRef.current;
    if (!exam || !cur || phase === 'result') return;
    setSheet(null);
    finishWith(exam, grade(exam, cur, reason));
  };

  // ── Navigatsiya ────────────────────────────────────────────────────────────
  const q = s ? s.questions[s.index] : undefined;
  const sectionOf = (i: number) => s?.questions[i]?.section;
  const goto = (i: number) => {
    if (!s) return;
    update({ index: Math.max(0, Math.min(s.questions.length - 1, i)) });
    setSheet(null);
    if (sectionOf(i) !== 'listen') playSfx('flip');
  };
  const next = () => {
    if (!s || !exam) return;
    const i = s.index;
    if (i >= s.questions.length - 1) return setPhase('review');
    const a = sectionOf(i);
    const b = sectionOf(i + 1);
    if (a && b && a !== b && !s.breaksTaken.includes(a)) {
      update({ breaksTaken: [...s.breaksTaken, a], index: i + 1 });
      if (a !== 'listen') playSfx('unlock');
      setBreakEnd(Date.now() + BREAK_SEC * 1000);
      return setPhase('break');
    }
    goto(i + 1);
  };
  function endBreak() {
    const cur = sRef.current;
    if (!cur) return;
    // Tanaffus vaqti umumiy taymerga qo'shilmaydi.
    const used = Math.max(0, Math.min(BREAK_SEC * 1000, BREAK_SEC * 1000 - (breakEnd - Date.now())));
    update({ deadline: cur.deadline + used, pausedMs: cur.pausedMs + used });
    setPhase('exam');
  }
  const answer = (a: Answer) => {
    if (!s || !q) return;
    update({ answers: { ...s.answers, [q.id]: a } });
    if (q.section !== 'listen') playSfx('select');
  };
  const toggleFlag = () => {
    if (!s || !q) return;
    const on = s.flags.includes(q.id);
    update({ flags: on ? s.flags.filter((x) => x !== q.id) : [...s.flags, q.id] });
    if (q.section !== 'listen') playSfx('pop');
  };

  // ── Ko'rinish ──────────────────────────────────────────────────────────────
  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 };
  if (phase === 'loading')
    return (
      <View style={[st.fill, st.center]}>
        <ActivityIndicator color={CO} accessibilityLabel="Yuklanmoqda" />
      </View>
    );
  if (phase === 'missing' || !exam)
    return (
      <View style={[st.fill, st.center, pad]}>
        <Txt f="bodyHeavy" size={16}>Imtihonni yuklab bo'lmadi</Txt>
        <Txt f="body" size={14} color={MU}>Internetni tekshirib, qayta urinib ko'ring.</Txt>
        <Btn label="Qayta urinish" onPress={() => { setPhase('loading'); setReload((n) => n + 1); }} />
        <Btn label="Orqaga" onPress={() => v2Back(R.exams)} ghost />
      </View>
    );

  if (phase === 'intro') return <Intro exam={exam} id={id} last={last} resume={resume} pad={pad} onNext={() => setPhase('ready')} onResume={continueSession} />;
  if (phase === 'ready') return <Ready pad={pad} onBack={() => setPhase('intro')} onStart={start} />;
  if (phase === 'result' && outcome) return <Result exam={exam} id={id} o={outcome} pad={pad} onAnalysis={() => setPhase('analysis')} />;
  if (phase === 'analysis' && outcome) return <Analysis o={outcome} pad={pad} onBack={() => setPhase('result')} />;
  if (!s) return null;

  if (phase === 'break') {
    const done = new Set(s.breaksTaken).size;
    const nextSec = sectionOf(s.index) as SectionKey;
    return (
      <View style={[st.fill, pad, { paddingHorizontal: 24 }]}>
        <View style={[st.fill, st.center, { gap: 10 }]}>
          <Pop>
            <Image source={IMG.clock} style={{ width: 160, height: 160 }} accessibilityIgnoresInvertColors />
          </Pop>
          <Txt f="bodyHeavy" size={12} color={COP} style={st.over}>
            {done} / {exam.sections.length} BO'LIM TUGADI
          </Txt>
          <Txt f="display" size={30}>Qisqa tanaffus</Txt>
          <Txt f="body" size={15} color={MU} style={{ textAlign: 'center' }}>
            Imtihon taymeri to'xtatildi. Keyingi bo'lim — {SECTION_LABEL[nextSec]}.
          </Txt>
          <View accessibilityLabel="Tanaffus qolgan vaqti">
            <Txt f="display" size={56}>{mmss((breakEnd - now) / 1000)}</Txt>
          </View>
          <SegBar exam={exam} s={s} />
        </View>
        <Btn label="Davom etish" onPress={endBreak} />
      </View>
    );
  }

  if (phase === 'review') {
    const unanswered = s.questions.filter((x) => !isAnswered(s.answers[x.id]));
    const flagged = s.questions.filter((x) => s.flags.includes(x.id));
    return (
      <View style={[st.fill, pad]}>
        <View style={st.headRow}>
          <IconBtn label="Imtihondan chiqish" onPress={() => setSheet('exit')} text="✕" />
          <View style={{ flex: 1 }} />
          <Timer sec={left} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Image source={IMG.desk} style={{ width: 84, height: 84 }} />
            <View style={{ flex: 1 }}>
              <Txt f="display" size={23}>Topshirishga tayyormisiz?</Txt>
              <Txt f="bodyBold" size={14} color={MU}>
                {s.questions.length - unanswered.length} / {s.questions.length} savolga javob berildi
              </Txt>
            </View>
          </View>
          <View style={st.card}>
            {exam.sections.map((sec, i) => {
              const qs = s.questions.filter((x) => x.section === sec.key);
              const a = qs.filter((x) => isAnswered(s.answers[x.id])).length;
              return (
                <View key={sec.key} style={[st.row, i > 0 && st.rowLine]}>
                  <Txt f="bodyHeavy" size={14} style={{ flex: 1 }}>
                    {i + 1}. {SECTION_LABEL[sec.key]}
                  </Txt>
                  <Txt f="bodyHeavy" size={14} color={a < qs.length ? '#B42318' : MU}>
                    {a} / {qs.length}
                  </Txt>
                </View>
              );
            })}
          </View>
          {unanswered.length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => { setPhase('exam'); goto(unanswered[0].no - 1); }} style={[st.pillRow, { backgroundColor: '#FDECEC' }]}>
              <Txt f="bodyHeavy" size={15} color="#B42318" style={{ flex: 1 }}>{unanswered.length} ta javobsiz</Txt>
              <Txt f="bodyHeavy" size={14} color="#B42318">{unanswered.slice(0, 6).map((x) => x.no).join(', ')} ›</Txt>
            </Pressable>
          )}
          {flagged.length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => { setPhase('exam'); goto(flagged[0].no - 1); }} style={[st.pillRow, { backgroundColor: '#FFF4D1' }]}>
              <Txt f="bodyHeavy" size={15} color="#7A5300" style={{ flex: 1 }}>⚑ {flagged.length} ta belgilangan</Txt>
              <Txt f="bodyHeavy" size={14} color="#7A5300">{flagged.slice(0, 6).map((x) => x.no).join(', ')} ›</Txt>
            </Pressable>
          )}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <Btn label="Topshirish" onPress={() => finish('submit')} />
          <Txt f="body" size={12} color={MU} style={{ textAlign: 'center' }}>Topshirgandan keyin javoblarni o'zgartirib bo'lmaydi</Txt>
        </View>
        {sheet === 'exit' && <ExitSheet answered={s.questions.length - unanswered.length} onStay={() => setSheet(null)} onExit={() => finish('exit')} />}
      </View>
    );
  }

  // ── Savol ekrani ───────────────────────────────────────────────────────────
  if (!q) return null;
  const a = s.answers[q.id];
  const flagged = s.flags.includes(q.id);
  const secIdx = exam.sections.findIndex((x) => x.key === q.section);
  const canNext = q.kind !== 'sentenceBuild' || (Array.isArray(a) && a.length === q.words.length) || !isAnswered(a);
  return (
    <View style={[st.fill, pad]}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <View style={st.headRow}>
          <IconBtn label="Imtihondan chiqish" onPress={() => setSheet('exit')} text="✕" />
          <View style={{ flex: 1 }}>
            <Txt f="bodyHeavy" size={12} color={COP} style={st.over} numberOfLines={1}>
              {secIdx + 1}/{exam.sections.length} · {SECTION_LABEL[q.section]}
            </Txt>
            <Txt f="bodyHeavy" size={15}>Savol {q.no} / {s.questions.length}</Txt>
          </View>
          <Timer sec={left} />
        </View>
        <SegBar exam={exam} s={s} />
      </View>
      {toast && (
        <SlideUp style={st.toast}>
          <Image source={IMG.clock} style={{ width: 40, height: 40 }} />
          <Txt f="bodyHeavy" size={15} color="#fff" style={{ flex: 1 }} accessibilityRole="text">{toast}</Txt>
        </SlideUp>
      )}
      <ScrollView key={q.id} contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
        <SlideUp distance={24}>
          <QuestionBody q={q} a={a} s={s} onAnswer={answer} onPlay={(dlg) => update({ plays: { ...s.plays, [dlg]: (s.plays[dlg] ?? 0) + 1 } })} />
        </SlideUp>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: flagged }} onPress={toggleFlag} style={[st.small, flagged && { backgroundColor: '#FFF4D1', borderColor: '#F5B70A' }]}>
            <Txt f="bodyHeavy" size={14} color={flagged ? '#7A5300' : MU}>⚑ {flagged ? 'Belgilangan' : 'Keyinroq qaytaman'}</Txt>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" onPress={() => setSheet('map')} style={st.small}>
            <Txt f="bodyHeavy" size={14}>▦ Savollar</Txt>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {q.no > 1 && <IconBtn label="Oldingi savol" onPress={() => goto(s.index - 1)} text="‹" big />}
          <View style={{ flex: 1 }}>
            <Btn label={q.no === s.questions.length ? "Ko'rib chiqish" : 'Keyingi'} onPress={next} disabled={!canNext} />
          </View>
        </View>
      </View>
      {sheet === 'map' && <MapSheet exam={exam} s={s} onGo={goto} onClose={() => setSheet(null)} onReview={() => { setSheet(null); setPhase('review'); }} />}
      {sheet === 'exit' && <ExitSheet answered={s.questions.filter((x) => isAnswered(s.answers[x.id])).length} onStay={() => setSheet(null)} onExit={() => finish('exit')} />}
      {sheet === 'left' && <LeftSheet leaves={s.leaves} onBack={() => setSheet(null)} />}
    </View>
  );
}

// ── Bo'laklar ──────────────────────────────────────────────────────────────
function Btn({ label, onPress, disabled, color = CO, shadow = COP, ghost }: { label: string; onPress: () => void; disabled?: boolean; color?: string; shadow?: string; ghost?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        st.btn,
        ghost ? { backgroundColor: '#fff', borderWidth: 2, borderColor: '#D5DBE7' } : { backgroundColor: color, boxShadow: `0 5px 0 ${shadow}` } as object,
        disabled && { opacity: 0.45 },
        pressed && { transform: [{ translateY: 3 }] },
      ]}
    >
      <Txt f="bodyHeavy" size={17} color={ghost ? INK : '#fff'}>{label}</Txt>
    </Pressable>
  );
}
function IconBtn({ label, onPress, text, big }: { label: string; onPress: () => void; text: string; big?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[st.icon, big && { width: 56, height: 56, borderRadius: 18, borderWidth: 2, borderColor: '#D5DBE7' }]}>
      <Txt f="bodyHeavy" size={big ? 22 : 18}>{text}</Txt>
    </Pressable>
  );
}
function Timer({ sec }: { sec: number }) {
  const low = sec <= 300;
  const m = Math.floor(Math.max(0, sec) / 60);
  return (
    <View accessibilityRole="timer" accessibilityLabel={`Qolgan vaqt ${m} daqiqa`} style={[st.timer, low && { backgroundColor: '#FDECEC', borderColor: '#F4B5AE' }]}>
      <Txt f="bodyHeavy" size={16} color={low ? '#B42318' : INK}>⏱ {mmss(sec)}</Txt>
    </View>
  );
}
function SegBar({ exam, s }: { exam: ExamBank; s: Session }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="progressbar" accessibilityLabel="Imtihon jarayoni">
      {exam.sections.map((sec) => {
        const qs = s.questions.filter((x) => x.section === sec.key);
        const done = qs.filter((x) => isAnswered(s.answers[x.id])).length;
        return (
          <View key={sec.key} style={{ flex: sec.count, height: 8, borderRadius: 4, backgroundColor: TR, overflow: 'hidden' }}>
            <AnimatedFill pct={qs.length ? (done / qs.length) * 100 : 0} color={CO} height={8} radius={4} />
          </View>
        );
      })}
    </View>
  );
}
function Option({ label, sel, onPress, ru = true }: { label: string; sel: boolean; onPress: () => void; ru?: boolean }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: sel }} onPress={onPress} style={({ pressed }) => [st.opt, sel && st.optSel, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View style={[st.dot, sel && { backgroundColor: CO, borderColor: CO }]}>{sel && <Txt f="bodyHeavy" size={13} color="#fff">✓</Txt>}</View>
      <Txt f="bodyHeavy" size={17} lang={ru ? 'ru' : undefined} style={{ flex: 1 }}>{label}</Txt>
    </Pressable>
  );
}

function QuestionBody({ q, a, s, onAnswer, onPlay }: { q: AttemptQuestion; a: Answer; s: Session; onAnswer: (a: Answer) => void; onPlay: (dlg: string) => void }) {
  const opts = q.options ?? [];
  if (q.kind === 'vocabImage') {
    return (
      <View style={{ gap: 12 }}>
        <View style={[st.card, { alignItems: 'center', gap: 10 }]}>
          <Txt f="bodyHeavy" size={12} color={MU} style={[st.over, { alignSelf: 'flex-start' }]}>{q.question}</Txt>
          <Image source={{ uri: mediaUrl(q.image) }} accessibilityLabel={q.imageAlt ?? '1-rasm'} style={{ width: 200, height: 200, borderRadius: 20 }} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {opts.map((o, i) => (
            <View key={i} style={{ width: '48%' }}>
              <Option label={o} sel={a === i} onPress={() => onAnswer(i)} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (q.kind === 'fillBlank') {
    const chosen = typeof a === 'number' ? opts[a] : undefined;
    const parts = q.sentence.split(/_{2,}/);
    return (
      <View style={{ gap: 10 }}>
        <View style={st.card}>
          <Txt f="bodyHeavy" size={12} color={MU} style={st.over}>Bo'sh joyga mos so'z</Txt>
          <Txt f="display" size={26} lang="ru">
            {parts[0]}
            <Txt f="display" size={26} color={COP}>{chosen ? ` ${chosen} ` : ' ____ '}</Txt>
            {parts.slice(1).join('____')}
          </Txt>
        </View>
        {opts.map((o, i) => <Option key={i} label={o} sel={a === i} onPress={() => onAnswer(i)} />)}
      </View>
    );
  }
  if (q.kind === 'sentenceBuild') {
    const picked = Array.isArray(a) ? a : [];
    const pool = q.shuffledWords ?? q.words;
    const used: number[] = [];
    picked.forEach((w) => {
      const i = pool.findIndex((x, k) => x === w && !used.includes(k));
      if (i >= 0) used.push(i);
    });
    return (
      <View style={{ gap: 12 }}>
        <View style={[st.card, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
          <Image source={IMG.thinking} style={{ width: 64, height: 64 }} />
          <View style={{ flex: 1 }}>
            <Txt f="bodyHeavy" size={12} color={MU} style={st.over}>O'zbekchadan rus tiliga</Txt>
            <Txt f="display" size={19}>{q.translation}</Txt>
          </View>
        </View>
        <View style={st.drop}>
          {picked.map((w, k) => (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${w}, olib tashlash`} onPress={() => onAnswer(picked.filter((_, j) => j !== k))} style={st.chip}>
              <Txt f="bodyHeavy" size={17} lang="ru">{w}</Txt>
            </Pressable>
          ))}
          {picked.length === q.words.length && <Txt f="bodyHeavy" size={17}>{q.punct ?? '.'}</Txt>}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {pool.map((w, i) =>
            used.includes(i) ? (
              <View key={i} style={[st.chip, { backgroundColor: TR, borderColor: TR }]}><Txt f="bodyHeavy" size={17} color={TR}>{w}</Txt></View>
            ) : (
              <Pressable key={i} accessibilityRole="button" onPress={() => onAnswer([...picked, w])} style={st.chip}>
                <Txt f="bodyHeavy" size={17} lang="ru">{w}</Txt>
              </Pressable>
            ),
          )}
        </View>
        {picked.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => onAnswer(undefined)} style={st.link}>
            <Txt f="bodyHeavy" size={14} color={COP}>↺ Tozalash</Txt>
          </Pressable>
        )}
      </View>
    );
  }
  if (q.kind === 'reading') {
    return (
      <View style={{ gap: 12 }}>
        <Collapsible title="Matn">
          <Txt f="body" size={16} lang="ru" style={{ lineHeight: 25 }}>{q.passage}</Txt>
        </Collapsible>
        <Txt f="display" size={21} lang="ru">{q.question}</Txt>
        {opts.map((o, i) => <Option key={i} label={o} sel={a === i} onPress={() => onAnswer(i)} />)}
      </View>
    );
  }
  if (q.kind === 'listening') {
    return (
      <View style={{ gap: 12 }}>
        <Listen q={q} plays={s.plays[q.dialogId] ?? 0} onPlay={() => onPlay(q.dialogId)} />
        <Txt f="display" size={20}>{q.question}</Txt>
        {opts.map((o, i) => <Option key={i} label={o} ru={false} sel={a === i} onPress={() => onAnswer(i)} />)}
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={st.card}>
        <Txt f="bodyHeavy" size={12} color={MU} style={st.over}>To'g'ri javobni tanlang</Txt>
        <Txt f="display" size={20} lang="ru">{(q as any).question}</Txt>
      </View>
      {opts.map((o, i) => <Option key={i} label={o} sel={a === i} onPress={() => onAnswer(i)} />)}
    </View>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={st.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Image source={IMG.reading} style={{ width: 36, height: 36 }} />
        <Txt f="bodyHeavy" size={12} color={MU} style={[st.over, { flex: 1 }]}>{title}</Txt>
        <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)} style={st.link}>
          <Txt f="bodyHeavy" size={14} color={COP}>{open ? "Yig'ish ▴" : 'Ochish ▾'}</Txt>
        </Pressable>
      </View>
      {open && children}
    </View>
  );
}

function Listen({ q, plays, onPlay }: { q: Extract<AttemptQuestion, { kind: 'listening' }>; plays: number; onPlay: () => void }) {
  const player = useAudioPlayer({ uri: q.audioUrl }, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const max = q.maxPlays ?? 2;
  const until = q.playUntil ?? status.duration ?? 0;
  const [failed, setFailed] = useState(0);
  const t = status.currentTime || 0;
  useEffect(() => {
    if (status.playing && until && t >= until) {
      player.pause();
      player.seekTo(0);
    }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  const playing = status.playing;
  const loaded = status.isLoaded;
  const canPlay = plays < max && !playing;
  const play = () => {
    if (!loaded) {
      setFailed((f) => f + 1);
      try {
        player.replace({ uri: q.audioUrl });
      } catch {}
      return; // yuklanmagan urinish hisobga olinmaydi
    }
    player.seekTo(0);
    player.play();
    onPlay();
  };
  const frac = until ? Math.min(1, t / until) : 0;
  return (
    <View style={[st.card, { gap: 12 }]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Image source={IMG.headphones} style={{ width: 56, height: 56 }} />
        <Txt f="bodyHeavy" size={12} color={MU} style={[st.over, { flex: 1 }]}>Tinglang va javob bering</Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dialogni ijro etish, ${max - plays} marta qoldi`}
          accessibilityState={{ disabled: !canPlay }}
          disabled={!canPlay}
          onPress={play}
          style={[st.play, !canPlay && { opacity: 0.4 }]}
        >
          <Txt f="bodyHeavy" size={20} color="#fff">{playing ? '❚❚' : '▶'}</Txt>
        </Pressable>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: TR, overflow: 'hidden' }}>
            <View style={{ width: `${frac * 100}%`, height: 8, backgroundColor: CO }} />
          </View>
          <Txt f="bodyHeavy" size={12} color={COP}>
            {failed && !loaded ? "Audio yuklanmadi — qayta bosing (hisoblanmaydi)" : plays >= max ? 'Eshitish tugadi' : `Yana ${max - plays} marta`}
          </Txt>
        </View>
      </View>
    </View>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable accessibilityLabel="Yopish" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,18,32,.35)' }]} />
      <SlideUp style={st.sheet}>
        <View style={st.grab} />
        {children}
      </SlideUp>
    </View>
  );
}
function MapSheet({ exam, s, onGo, onClose, onReview }: { exam: ExamBank; s: Session; onGo: (i: number) => void; onClose: () => void; onReview: () => void }) {
  const answered = s.questions.filter((x) => isAnswered(s.answers[x.id])).length;
  return (
    <Sheet onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt f="display" size={24} style={{ flex: 1 }}>Savollar</Txt>
        <Txt f="bodyBold" size={14} color={MU}>{answered} / {s.questions.length} javob</Txt>
      </View>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
        {exam.sections.map((sec, si) => (
          <View key={sec.key} style={{ gap: 6 }}>
            <Txt f="bodyHeavy" size={11} color={MU} style={st.over}>{si + 1}. {SECTION_LABEL[sec.key]}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {s.questions.filter((x) => x.section === sec.key).map((x) => {
                const ans = isAnswered(s.answers[x.id]);
                const fl = s.flags.includes(x.id);
                const cur = x.no - 1 === s.index;
                return (
                  <Pressable
                    key={x.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${x.no}-savol, ${ans ? 'javob berilgan' : 'javobsiz'}${fl ? ', belgilangan' : ''}`}
                    onPress={() => onGo(x.no - 1)}
                    style={[st.cell, ans && { backgroundColor: CO, borderColor: CO }, fl && { borderColor: '#F5B70A' }, cur && { borderColor: CO, borderWidth: 3 }]}
                  >
                    <Txt f="bodyHeavy" size={14} color={ans ? '#fff' : INK}>{x.no}</Txt>
                    {(ans || fl) && <Txt f="bodyHeavy" size={9} color={ans ? '#fff' : '#B98500'}>{fl ? '⚑' : '✓'}</Txt>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <Btn label="Topshirishga o'tish" onPress={onReview} />
    </Sheet>
  );
}
function ExitSheet({ answered, onStay, onExit }: { answered: number; onStay: () => void; onExit: () => void }) {
  return (
    <Sheet onClose={onStay}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Image source={IMG.thinking} style={{ width: 100, height: 100 }} />
        <Txt f="display" size={24}>Imtihonni yakunlaysizmi?</Txt>
        <Txt f="body" size={15} color={MU} style={{ textAlign: 'center' }}>
          {answered} ta savolga javob bergansiz. Chiqsangiz, natija shu javoblar bo'yicha hisoblanadi; keyingi urinish 24 soatdan keyin.
        </Txt>
      </View>
      <Btn label="Imtihonni davom ettirish" onPress={onStay} />
      <Btn label="Yakunlash va chiqish" onPress={onExit} ghost />
    </Sheet>
  );
}
function LeftSheet({ leaves, onBack }: { leaves: number; onBack: () => void }) {
  return (
    <Sheet>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Pop><Image source={IMG.warn} style={{ width: 112, height: 112 }} /></Pop>
        <Txt f="display" size={24}>Imtihondan chiqdingiz</Txt>
        <Txt f="body" size={15} color={MU} style={{ textAlign: 'center' }}>
          Imtihon paytida boshqa ilovaga o'tmang. Yana {LEAVE_LIMIT - leaves} marta chiqsangiz, imtihon shu holatda topshiriladi.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'stretch' }}>
          {Array.from({ length: LEAVE_LIMIT }, (_, i) => <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < leaves ? '#F79009' : TR }} />)}
        </View>
        <Txt f="bodyHeavy" size={13} color="#B54708">Ogohlantirish: {leaves} / {LEAVE_LIMIT}</Txt>
      </View>
      <Btn label="Imtihonga qaytish" onPress={onBack} />
    </Sheet>
  );
}

function Intro({ exam, id, last, resume, pad, onNext, onResume }: { exam: ExamBank; id: string; last: ExamOutcome | null; resume: Session | null; pad: object; onNext: () => void; onResume: () => void }) {
  const [now] = useState(Date.now());
  const wait = cooldownLeft(exam, last, now);
  const rules = [
    `Bitta umumiy taymer — ${Math.round(exam.durationSec / 60)} daqiqa. Faqat bo'limlar orasidagi tanaffusda to'xtaydi`,
    "Javoblar to'g'ri-xatoligi oxirida ko'rsatiladi; javobsiz savol xato hisoblanadi",
    "Savolni belgilab, istalgan bo'limga qaytish mumkin; har urinishda savollar boshqacha",
    "Ilovadan 3 marta chiqilsa imtihon topshiriladi (qo'ng'iroq va 10 soniyadan qisqa chiqish hisoblanmaydi)",
    `O'tish: jami ${exam.passPercent}% va har bo'limda kamida ${exam.sectionMinPercent}%. Qayta topshirish — ${exam.cooldownHours} soatdan keyin`,
  ];
  return (
    <View style={[st.fill, pad]}>
      <View style={[st.headRow, { paddingHorizontal: 20 }]}>
        <IconBtn label="Yopish" onPress={() => v2Back(R.exams)} text="✕" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Pop><Image source={IMG.desk} style={{ width: 96, height: 96 }} /></Pop>
          <View style={{ flex: 1 }}>
            {exam.lessons[1] > 0 && <Txt f="bodyHeavy" size={12} color={COP} style={st.over}>{exam.lessons[0]}–{exam.lessons[1]}-DARSLAR</Txt>}
            <Txt f="display" size={27}>{TITLE(id)}</Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[[String(exam.totalQuestions), 'savol'], [mmss(exam.durationSec), 'daqiqa'], [`${exam.passPercent}%`, "o'tish bali"]].map(([v, l]) => (
            <View key={l} style={[st.card, { flex: 1, alignItems: 'center', padding: 10 }]}>
              <Txt f="display" size={22}>{v}</Txt>
              <Txt f="bodyBold" size={12} color={MU}>{l}</Txt>
            </View>
          ))}
        </View>
        <View style={[st.card, { paddingVertical: 4 }]}>
          {exam.sections.map((sec, i) => (
            <View key={sec.key} style={[st.row, i > 0 && st.rowLine]}>
              <Txt f="bodyHeavy" size={14} style={{ flex: 1 }}>{i + 1}. {SECTION_LABEL[sec.key]}</Txt>
              <Txt f="bodyBold" size={13} color={MU}>{sec.count} savol</Txt>
            </View>
          ))}
        </View>
        <View style={{ gap: 6 }}>
          {rules.map((r) => (
            <Txt key={r} f="body" size={13} color={MU}>• {r}</Txt>
          ))}
        </View>
        {last && (
          <View style={[st.card, { backgroundColor: last.passed ? '#E3F7EE' : '#F0F3FF' }]}>
            <Txt f="bodyHeavy" size={14} color={last.passed ? '#075E3A' : COP}>
              Oxirgi natija: {last.percent}% · {last.passed ? "o'tdingiz" : "o'tmadi"}
            </Txt>
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        {resume ? (
          <>
            <Txt f="bodyBold" size={14} color={MU} style={{ textAlign: 'center' }}>
              Imtihon davom etmoqda · {Object.keys(resume.answers).length} javob saqlangan · qolgan vaqt {mmss((resume.deadline - now) / 1000)}
            </Txt>
            <Btn label="Davom etish" onPress={onResume} />
          </>
        ) : last?.passed ? (
          <Btn label="Sertifikatni ko'rish" onPress={() => router.push(R.certificates as Href)} />
        ) : wait > 0 ? (
          <Btn label={`Qayta urinish ${hms(wait)} dan keyin`} onPress={() => {}} disabled />
        ) : (
          <Btn label="Davom etish" onPress={onNext} />
        )}
      </View>
    </View>
  );
}

function Ready({ pad, onBack, onStart }: { pad: object; onBack: () => void; onStart: () => void }) {
  const [ok, setOk] = useState({ sound: false, quiet: false });
  return (
    <View style={[st.fill, pad]}>
      <View style={[st.headRow, { paddingHorizontal: 20 }]}>
        <IconBtn label="Orqaga" onPress={onBack} text="‹" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Image source={IMG.headphones} style={{ width: 136, height: 136 }} />
          <Txt f="display" size={26}>Ovozni tekshiring</Txt>
          <Txt f="body" size={15} color={MU} style={{ textAlign: 'center' }}>Quloqchin taqing va tinglash bo'limiga tayyorlaning.</Txt>
        </View>
        {([
          ['sound', 'Ovoz aniq eshitilyapti'],
          ['quiet', 'Tinch joydaman, imtihonga vaqtim bor'],
        ] as const).map(([k, l]) => (
          <Pressable key={k} accessibilityRole="checkbox" accessibilityState={{ checked: ok[k] }} onPress={() => { setOk((v) => ({ ...v, [k]: !v[k] })); playSfx('tap'); }} style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }]}>
            <View style={[st.dot, { borderRadius: 6 }, ok[k] && { backgroundColor: CO, borderColor: CO }]}>{ok[k] && <Txt f="bodyHeavy" size={13} color="#fff">✓</Txt>}</View>
            <Txt f="bodyBold" size={15}>{l}</Txt>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20 }}>
        <Btn label="Imtihonni boshlash" onPress={onStart} disabled={!ok.sound || !ok.quiet} />
      </View>
    </View>
  );
}

function Result({ exam, id, o, pad, onAnalysis }: { exam: ExamBank; id: string; o: ExamOutcome; pad: object; onAnalysis: () => void }) {
  const weakest = [...o.sections].sort((a, b) => a.percent - b.percent)[0];
  const lessons = [...new Set(o.mistakes.filter((m) => m.section === weakest?.key && m.lessonRef).map((m) => m.lessonRef as number))].sort((a, b) => a - b).slice(0, 3);
  const wait = cooldownLeft(exam, o);
  return (
    <View style={[st.fill, pad]}>
      {o.passed && <Confetti count={34} />}
      <View style={[st.headRow, { paddingHorizontal: 20 }]}>
        <IconBtn label="Yopish" onPress={() => v2Back(R.exams)} text="✕" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Pop><Image source={o.passed ? IMG.medal : IMG.again} style={{ width: 132, height: 132 }} /></Pop>
          <Txt f="bodyHeavy" size={12} color={o.passed ? '#087A4A' : MU} style={st.over}>{TITLE(id).toUpperCase()}</Txt>
          <CountUp value={o.percent} suffix="%" style={{ fontFamily: undefined, fontSize: 58, fontWeight: '800', color: INK }} />
          <Txt f="display" size={22} color={o.passed ? '#075E3A' : INK}>{o.passed ? "Imtihondan o'tdingiz!" : "Bu safar o'tmadi — tayyorlanamiz!"}</Txt>
          <Txt f="body" size={14} color={MU} style={{ textAlign: 'center' }}>
            {o.correct} / {o.total} to'g'ri
            {o.passed ? '' : o.correct < o.needed ? ` · o'tish uchun ${o.needed} ta kerak edi — ${o.needed - o.correct} ta yetmadi` : ` · bo'limlardan biri ${exam.sectionMinPercent}% dan past`}
            {o.reason === 'timeout' ? ' · vaqt tugadi' : o.reason === 'left' ? ' · ilovadan 3 marta chiqildi' : ''}
          </Txt>
        </View>
        <View style={[st.card, { gap: 12 }]}>
          {o.sections.map((x, i) => {
            const color = x.percent < exam.sectionMinPercent ? '#D92D20' : x.percent < exam.passPercent ? '#F5B70A' : GREEN;
            return (
              <View key={x.key} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row' }}>
                  <Txt f="bodyHeavy" size={14} style={{ flex: 1 }}>{x.percent >= exam.sectionMinPercent ? '✓ ' : '! '}{SECTION_LABEL[x.key]}</Txt>
                  <Txt f="bodyHeavy" size={13}>{x.correct}/{x.total} · {x.percent}%</Txt>
                </View>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: TR, overflow: 'hidden' }}>
                  <AnimatedFill pct={x.percent} color={color} height={10} radius={5} delay={200 + i * 120} fromZero />
                </View>
              </View>
            );
          })}
        </View>
        {!o.passed && weakest && (
          <View style={[st.card, { backgroundColor: '#F0F3FF', flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
            <Image source={IMG.reading} style={{ width: 42, height: 42 }} />
            <View style={{ flex: 1 }}>
              <Txt f="bodyHeavy" size={15} color={COP}>{lessons.length ? `Takrorlang: ${lessons.join(', ')}-darslar` : `Takrorlang: ${SECTION_LABEL[weakest.key]}`}</Txt>
              <Txt f="body" size={13} color={MU}>{SECTION_LABEL[weakest.key]} bo'limidagi xatolar shu darslardan</Txt>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        {o.passed ? (
          <Btn label="Sertifikatni ko'rish" onPress={() => router.push(R.certificates as Href)} />
        ) : (
          <Btn label="Darslarni takrorlash" onPress={() => openLesson(lessons[0])} />
        )}
        <Btn label={`Javoblar tahlili · ${o.mistakes.length} xato`} onPress={onAnalysis} ghost />
        {!o.passed && wait > 0 && <Txt f="bodyHeavy" size={14} color={MU} style={{ textAlign: 'center' }}>⏱ Qayta urinish {hms(wait)} dan keyin</Txt>}
      </View>
    </View>
  );
}

function Analysis({ o, pad, onBack }: { o: ExamOutcome; pad: object; onBack: () => void }) {
  return (
    <View style={[st.fill, pad]}>
      <View style={[st.headRow, { paddingHorizontal: 20 }]}>
        <IconBtn label="Orqaga" onPress={onBack} text="‹" />
        <Txt f="display" size={24} style={{ flex: 1 }}>Javoblar tahlili</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {!o.passed && (
          <Txt f="body" size={13} color={MU}>To'g'ri javoblar imtihondan o'tgandan keyin ochiladi. Hozir — mavzu va dars.</Txt>
        )}
        {o.mistakes.map((m) => (
          <View key={m.id} style={[st.card, { flexDirection: 'row', gap: 12 }]}>
            <View style={[st.dot, { backgroundColor: '#FDECEC', borderColor: '#FDECEC', borderRadius: 10, width: 30, height: 30 }]} accessibilityLabel="Xato">
              <Txt f="bodyHeavy" size={14} color="#B42318">✕</Txt>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt f="bodyHeavy" size={12} color={MU}>{m.no}-savol · {SECTION_LABEL[m.section]}{m.lessonRef ? ` · ${m.lessonRef}-dars` : ''}</Txt>
              <Txt f="bodyHeavy" size={15} lang="ru">{m.question}</Txt>
              <Txt f="bodyBold" size={14} color="#B42318">✕ Sizniki: {m.yourAnswer || 'javob berilmagan'}</Txt>
              {o.passed && <Txt f="bodyBold" size={14} color="#087A4A" lang="ru">✓ To'g'ri: {m.correctAnswer}</Txt>}
              {m.lessonRef ? (
                <Pressable accessibilityRole="link" onPress={() => openLesson(m.lessonRef)} style={[st.link, { alignSelf: 'flex-start' }]}>
                  <Txt f="bodyHeavy" size={14} color={COP}>{m.lessonRef}-darsni ochish ›</Txt>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BG },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  over: { letterSpacing: 0.7, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: '#E4E8F0' },
  btn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  timer: { height: 44, paddingHorizontal: 14, borderRadius: 15, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E2E6EE', justifyContent: 'center' },
  small: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2, borderColor: '#E2E6EE', backgroundColor: '#fff', justifyContent: 'center' },
  opt: { minHeight: 58, borderRadius: 18, borderWidth: 2, borderColor: '#E2E6EE', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  optSel: { borderColor: CO, backgroundColor: '#F0F3FF' },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#C6CDDB', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  drop: { minHeight: 100, borderRadius: 20, backgroundColor: '#fff', borderWidth: 2, borderStyle: 'dashed', borderColor: '#C6CDDB', padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E2E6EE', justifyContent: 'center' },
  link: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#E6ECFF', justifyContent: 'center', alignSelf: 'center' },
  play: { width: 52, height: 52, borderRadius: 26, backgroundColor: CO, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingBottom: 28, gap: 12 },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#D5DBE7', alignSelf: 'center' },
  cell: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: '#C6CDDB', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pillRow: { minHeight: 48, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  toast: { position: 'absolute', top: 120, left: 20, right: 20, zIndex: 5, backgroundColor: INK, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
