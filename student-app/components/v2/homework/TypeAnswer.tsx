/**
 * B qism — yozib javob berish (dizayn: 82 · TypeAnswer "B 5/10").
 * Bo'sh joy savolining o'zi (GrammarBlank), faqat variantlar o'rniga
 * tushib qolgan so'z ekrandagi kirill klaviaturasida yoziladi. Tekshirish
 * urg'usiz va ё/е farqisiz. "Birinchi harf" yordami — bir marta.
 * Vebda jismoniy klaviaturadan ham yozish mumkin.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { designImages } from '@/constants/v2/designImages';
import type { GrammarBlank } from '@/data/lessonContent';

import { BackspaceIcon, BulbHint, LockSmall } from './icons';
import { FeedbackSheet, LabelHeader, Txt, webShadow } from './ui';

/** Har 5-savol (5/10, 10/10) yozib javob beriladi. */
export const isTypedQuestion = (index: number) => (index + 1) % 5 === 0;

/** Urg'u, ё/е, bosh harf va tinish belgilarisiz solishtirish. */
export const normalizeRu = (s: string) =>
  s
    .normalize('NFD')
    .replace(/́/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:«»"'\s]+/g, ' ')
    .trim();

const ROWS = [
  ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х'],
  ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
  ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'Ъ'],
];

type Props = {
  blank: GrammarBlank;
  label: string;
  index: number;
  total: number;
  replay: boolean;
  onAnswer: (correct: boolean, typed: string) => void;
  onNext: () => void;
  onClose: () => void;
};

export function TypeAnswerView({ blank, label, index, total, replay, onAnswer, onNext, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const [hints, setHints] = useState(1);
  const [result, setResult] = useState<boolean | null>(null);
  const pieces = blank.sentence.split(/_{2,}/);
  // Gap boshidagi so'z bo'lsa bosh harf bilan yoziladi — klaviatura kichik harf beradi.
  const startsSentence = pieces[0].trim() === '';
  const letters = typed.replace(/\s/g, '').length;
  const need = normalizeRu(blank.answer).replace(/\s/g, '').length;
  const canCheck = result === null && letters >= need;

  const add = (ch: string) => {
    if (result !== null) return;
    setTyped((t) => {
      const lower = ch.toLowerCase();
      return t + (t.length === 0 && startsSentence ? ch.toUpperCase() : lower);
    });
  };
  const del = () => result === null && setTyped((t) => t.slice(0, -1));
  const check = () => {
    if (!canCheck) return;
    const ok = normalizeRu(typed) === normalizeRu(blank.answer);
    setResult(ok);
    onAnswer(ok, typed.trim());
  };
  const takeHint = () => {
    if (hints <= 0 || result !== null) return;
    setHints(0);
    setTyped(blank.answer.slice(0, 1));
  };

  // Vebda jismoniy klaviatura: kirill harflar, Backspace, Enter.
  const ref = useRef({ add, del, check });
  ref.current = { add, del, check };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') ref.current.del();
      else if (e.key === 'Enter') ref.current.check();
      else if (/^[Ѐ-ӿ ,.\-]$/.test(e.key)) ref.current.add(e.key);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={label} current={index + 1} barValue={index + (result !== null ? 1 : 0)} total={total} color="#2F5BFF" onClose={onClose} sub="Yozib javob bering" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <View accessibilityLabel={blank.sentence} style={st.qCard}>
          <Image source={designImages['c04932e65803a7f5c40ff5868fd21516']} resizeMode="contain" style={{ width: 64, height: 64, flexShrink: 0 }} accessibilityElementsHidden />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Txt f="bodyHeavy" size={11} color="#1E3FD1" style={{ letterSpacing: 0.66, textTransform: 'uppercase' }}>
              Tushib qolgan soʻzni yozing
            </Txt>
            <Txt f="display" size={21} lh={26.25} lang="ru" style={{ letterSpacing: -0.21 }} accessibilityRole="header">
              «
              {pieces.map((piece, i) => (
                <Txt key={i} f="display" size={21} lh={26.25}>
                  {piece}
                  {i < pieces.length - 1 &&
                    (result !== null ? (
                      <Txt f="display" size={21} color={result ? '#075E3A' : '#B42318'}>
                        {blank.answer}
                      </Txt>
                    ) : (
                      <Txt f="display" size={21} style={st.blankLine}>
                        {Platform.OS === 'web' ? '' : '\u2003\u2003'}
                      </Txt>
                    ))}
                </Txt>
              ))}
              »
            </Txt>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Txt f="bodyBold" size={13} color="#4A5468" style={{ paddingHorizontal: 4 }}>
            Javobingiz (ruscha)
          </Txt>
          <View
            accessibilityRole="text"
            accessibilityLabel={`Javobingiz: ${typed}`}
            style={[
              st.input,
              result === true && { borderColor: '#087A4A' },
              result === false && { borderColor: '#D92D20' },
              result === null && webShadow('0 0 0 4px #E0E8FF'),
            ]}
          >
            <Txt f="bodyBold" size={20} lang="ru">
              {typed}
            </Txt>
            {result === null && <View style={st.caret} />}
          </View>
          <View style={st.inputMeta}>
            <Txt f="body" size={12} color="#4A5468">
              Urgʻu belgisi shart emas
            </Txt>
            <Txt f="body" size={12} color="#4A5468">
              {letters} belgi
            </Txt>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: hints <= 0 || result !== null }}
            disabled={hints <= 0 || result !== null}
            onPress={takeHint}
            style={({ pressed }) => [st.hintBtn, (hints <= 0 || result !== null) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
          >
            <BulbHint />
            <Txt f="bodyHeavy" size={14}>
              Birinchi harf · {hints} marta
            </Txt>
          </Pressable>
          <View style={st.reward}>
            <Txt f="bodyBold" size={13} color="#4A5468">
              {replay ? 'Takrorlash · ball oʻzgarmaydi' : 'Toʻgʻri javob · +1 coin'}
            </Txt>
          </View>
        </View>
      </ScrollView>

      {result !== null ? (
        <FeedbackSheet
          correct={result}
          coin={result && !replay}
          padBottom={28}
          detail={result ? blank.sentence.replace(/_{2,}/, blank.answer) : `Toʻgʻri javob: «${blank.answer}»`}
          buttonLabel={result ? 'Davom etish' : 'Tushunarli'}
          onPress={onNext}
        />
      ) : (
        <View accessibilityLabel="Kirill klaviaturasi" style={[st.kb, { paddingBottom: Math.max(30, insets.bottom + 10) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCheck }}
            disabled={!canCheck}
            onPress={check}
            style={({ pressed }) => [st.checkBtn, canCheck && { backgroundColor: '#2F5BFF' }, pressed && { opacity: 0.85 }]}
          >
            {!canCheck && <LockSmall />}
            <Txt f="bodyHeavy" size={16} color={canCheck ? '#FFFFFF' : '#4A5468'}>
              {canCheck ? 'Tekshirish' : 'Tekshirish · soʻzni tugating'}
            </Txt>
          </Pressable>
          {ROWS.map((row, r) => (
            <View key={r} style={st.kbRow}>
              {row.map((k) => (
                <Key key={k} label={k} onPress={() => add(k)} />
              ))}
              {r === 2 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Oʻchirish" onPress={del} style={[st.key, { backgroundColor: '#D5DAE4' }]}>
                  <BackspaceIcon />
                </Pressable>
              )}
            </View>
          ))}
          <View style={st.kbRow}>
            <Key label="Ё" onPress={() => add('Ё')} />
            <Key label="," a11y="Vergul" onPress={() => add(',')} />
            <Pressable accessibilityRole="button" accessibilityLabel="Boʻsh joy" onPress={() => add(' ')} style={[st.key, st.keyShadow, { flex: 5 }]}>
              <Txt f="bodyHeavy" size={13} color="#4A5468" lang="ru">
                пробел
              </Txt>
            </Pressable>
            <Key label="." a11y="Nuqta" onPress={() => add('.')} />
          </View>
        </View>
      )}
    </View>
  );
}

function Key({ label, a11y, onPress }: { label: string; a11y?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} style={({ pressed }) => [st.key, st.keyShadow, pressed && { backgroundColor: '#E8EEFF' }]}>
      <Txt f="bodyHeavy" size={16} lang="ru">
        {label}
      </Txt>
    </Pressable>
  );
}

const st = StyleSheet.create({
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  qCard: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  blankLine: {
    borderBottomWidth: 3,
    borderBottomColor: '#2F5BFF',
    ...(Platform.OS === 'web' ? ({ display: 'inline-block', width: 46, height: 0, verticalAlign: -2 } as object) : null),
  },
  input: {
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2F5BFF',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  caret: { width: 2, height: 24, backgroundColor: '#2F5BFF', marginLeft: 1, borderRadius: 1 },
  inputMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 },
  hintBtn: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reward: { flex: 1, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 4 },
  kb: { paddingTop: 10, paddingHorizontal: 4, backgroundColor: '#E4E8F0', gap: 6 },
  checkBtn: { marginHorizontal: 12, marginBottom: 4, height: 52, borderRadius: 16, backgroundColor: '#C9CFDB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  kbRow: { flexDirection: 'row', gap: 3 },
  key: { flex: 1, minWidth: 0, height: 44, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  keyShadow: webShadow('0 1px 0 #C9CFDB', { borderBottomWidth: 1, borderBottomColor: '#C9CFDB' }),
});
