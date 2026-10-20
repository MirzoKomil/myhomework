/**
 * Kompyuter: Tarjimon (dizayn: D_Translator.dc.html).
 *
 * Mantiq mobil tarjimon.tsx bilan aynan bir xil (translateText u yerdan
 * ko'chirilgan — mobil fayl o'zgarmasligi uchun): Google Translate ochiq
 * endpointi, transliteratsiya (dt=rm), yozish to'xtagach avtomatik tarjima,
 * natija shaxsiy lug'atga avtomatik qo'shiladi, "Oxirgilar" qurilmada.
 * Klaviatura: Enter — darhol tarjima qilish.
 */
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { getRecentTranslations, pushRecentTranslation, replaceMyWord, type RecentTranslation } from '@/components/v2/practice/shared';
import { go } from '@/components/v2/library/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';

import { DesktopPage, Kbd } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { IArrow, ICheck, ISpeaker, ISwap, Over, T } from './ui';

type Direction = 'uz-other' | 'other-uz';
const MAX = 500;

async function translateText(text: string, sl: string, tl: string): Promise<{ text: string; translit: string }> {
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=rm&q=${encodeURIComponent(text)}`);
  const data = await res.json();
  const segs: unknown[] = Array.isArray(data?.[0]) ? data[0] : [];
  const text_ = segs.map((x) => (Array.isArray(x) && typeof x[0] === 'string' ? x[0] : '')).join('');
  if (!text_.trim()) throw new Error('empty translation');
  const translit = segs
    .map((x) => (Array.isArray(x) && x[0] == null && typeof x[2] === 'string' ? x[2] : ''))
    .join('')
    .trim();
  return { text: text_, translit };
}

export function DTranslator() {
  const { courseLang } = useLang();
  const isRu = courseLang === 'russian';
  const otherCode = isRu ? 'ru' : 'en';
  const otherLabel = isRu ? 'Ruscha' : 'Inglizcha';

  const [dir, setDir] = useState<Direction>('uz-other');
  const [source, setSource] = useState('');
  const [result, setResult] = useState<{ text: string; translit: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [recent, setRecent] = useState<RecentTranslation[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<{ src: string; word: string } | null>(null);

  const sl = dir === 'uz-other' ? 'uz' : otherCode;
  const tl = dir === 'uz-other' ? otherCode : 'uz';

  useEffect(() => {
    getRecentTranslations().then(setRecent);
  }, []);

  const saveToVocab = async (src: string, out: string, otherOut: boolean) => {
    const otherText = otherOut ? out : src;
    const uzText = otherOut ? src : out;
    const prev = lastSaved.current;
    const editing = prev && (src.startsWith(prev.src) || prev.src.startsWith(src));
    await replaceMyWord(editing ? prev.word : null, { word: otherText, translation: uzText }, 'translator');
    lastSaved.current = { src, word: otherText };
    setSaved(true);
  };

  const run = async (text: string, from = sl, to = tl, d = dir) => {
    if (!text.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const r = await translateText(text.trim(), from, to);
      setResult(r);
      await saveToVocab(text.trim(), r.text, to !== 'uz');
      await pushRecentTranslation({ source: text.trim(), target: r.text, dir: d });
      setRecent(await getRecentTranslations());
    } catch {
      setError('Tarjima qilishda xatolik yuz berdi. Internetni tekshirib qayta urining.');
    } finally {
      setLoading(false);
    }
  };

  const onChange = (t: string) => {
    setSource(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(t), 700);
  };
  // Enter — kutmasdan darhol tarjima (dizayndagi "Enter tarjima qilish").
  const runNow = () => {
    if (timer.current) clearTimeout(timer.current);
    void run(source);
  };

  const swap = () => {
    const d: Direction = dir === 'uz-other' ? 'other-uz' : 'uz-other';
    setDir(d);
    const nextSource = result?.text ?? source;
    setSource(nextSource);
    setResult(null);
    run(nextSource, tl, sl, d);
  };

  const listen = () => {
    if (!result) return;
    Speech.stop();
    Speech.speak(result.text, { language: tl === 'ru' ? 'ru-RU' : tl === 'en' ? 'en-US' : 'uz-UZ', rate: 0.9 });
  };

  const openRecent = (r: RecentTranslation) => {
    setDir(r.dir);
    setSource(r.source);
    lastSaved.current = null;
    const [f, t] = r.dir === 'uz-other' ? ['uz', otherCode] : [otherCode, 'uz'];
    run(r.source, f, t, r.dir);
  };

  useDesktopKeys({ Enter: runNow });

  return (
    <DesktopPage title="Tarjimon" subtitle={`${isRu ? 'rus' : 'ingliz'} ↔ oʻzbek · urgʻu va misollar bilan`} back={R.practice} scroll={false} contentStyle={{ paddingBottom: 32, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={s.lang}>
          <T size={16}>{dir === 'uz-other' ? 'Oʻzbekcha' : otherLabel}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Tillarni almashtirish" onPress={swap} style={({ pressed }) => [s.swap, pressed && { backgroundColor: '#1E3FD1' }]}>
          <ISwap />
        </Pressable>
        <View style={s.lang}>
          <T size={16}>{dir === 'uz-other' ? otherLabel : 'Oʻzbekcha'}</T>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 0, gap: 16 }}>
        <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: 16 }}>
          <View style={s.src}>
            <Over color="#4A5468">Matn</Over>
            <TextInput
              accessibilityLabel="Matn"
              multiline
              value={source}
              onChangeText={(t) => onChange(t.slice(0, MAX))}
              maxLength={MAX}
              placeholder="Matn kiriting"
              placeholderTextColor="#9AA4BC"
              style={s.input}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T w={700} size={13} color="#4A5468">
                {source.length} / {MAX}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Kbd>Enter</Kbd>
                <T w={700} size={13} color="#4A5468">
                  tarjima qilish
                </T>
              </View>
            </View>
          </View>

          <View style={s.out}>
            <Over color="#B8C1D6">Tarjima</Over>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
            ) : (
              <T size={36} lh={43.2} color={result ? '#FFFFFF' : '#4A5468'}>
                {result?.text ?? 'Tarjima shu yerda chiqadi'}
              </T>
            )}
            {!!error && (
              <T w={600} size={18} color="#B8C1D6">
                {error}
              </T>
            )}
            {!!result?.translit && (
              <T w={600} size={18} color="#B8C1D6">
                [{result.translit}]
              </T>
            )}
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable accessibilityRole="button" disabled={!result} onPress={listen} style={({ pressed }) => [s.listen, pressed && { backgroundColor: '#1E3FD1' }]}>
                <ISpeaker />
                <T size={16} color="#FFFFFF">
                  Tinglash
                </T>
              </Pressable>
              {saved && !!result && !loading && (
                <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.saved}>
                  <ICheck size={18} color="#6EE7B7" sw={2.8} />
                  <T size={16} color="#6EE7B7">
                    Lugʻatga qoʻshildi
                  </T>
                </View>
              )}
            </View>
            <Pressable accessibilityRole="link" onPress={() => go(R.lugat)} style={s.openLugat}>
              <T size={16} color="#A9BBFF">
                Lugʻatimni ochish
              </T>
              <IArrow size={18} color="#A9BBFF" sw={2.4} />
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
            <Over>Oxirgilar</Over>
            <View style={s.recent}>
              {recent.length === 0 ? (
                <View style={s.recentRow}>
                  <T w={600} size={14} color="#4A5468">
                    Hali tarjima qilinmagan
                  </T>
                </View>
              ) : (
                recent.map((r, i) => {
                  const [top, bottom] = r.dir === 'uz-other' ? [r.target, r.source] : [r.source, r.target];
                  return (
                    <Pressable
                      key={`${r.source}-${i}`}
                      accessibilityRole="button"
                      onPress={() => openRecent(r)}
                      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.recentRow, i < recent.length - 1 && s.divider, hovered && { backgroundColor: '#F7F9FF' }]}
                    >
                      <T size={17} lines={1}>
                        {top}
                      </T>
                      <T w={600} size={14} color="#4A5468" lines={1}>
                        {bottom}
                      </T>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
          <View style={s.tip}>
            <Image source={designImages['cc0d95446730f059d25d989e2c9845ad']} style={{ width: 150, height: 150, flexShrink: 0 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
            <T w={700} size={18} lh={27} color="#6B4800" style={{ flex: 1 }}>
              Domik maslahati: soʻzni emas, butun iborani yozing — tarjima tabiiyroq chiqadi.
            </T>
          </View>
        </View>
      </View>
    </DesktopPage>
  );
}

const s = StyleSheet.create({
  lang: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  swap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  src: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 26, paddingVertical: 22, paddingHorizontal: 26, gap: 10 },
  input: { flex: 1, padding: 0, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 30, lineHeight: 39, color: '#0B1220', textAlignVertical: 'top', outlineStyle: 'none' } as object,
  out: { flex: 1, minWidth: 0, backgroundColor: '#0B1220', borderRadius: 26, paddingVertical: 22, paddingHorizontal: 26, gap: 10 },
  listen: { height: 50, paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 9 },
  saved: { height: 50, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#0F2E26', flexDirection: 'row', alignItems: 'center', gap: 8 },
  openLugat: { marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1F2940', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recent: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  recentRow: { paddingVertical: 12, paddingHorizontal: 20, gap: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  tip: { flex: 1, minWidth: 0, height: 248, flexDirection: 'row', alignItems: 'center', gap: 22, backgroundColor: '#FFF4D1', borderRadius: 26, paddingTop: 20, paddingRight: 28, paddingBottom: 20, paddingLeft: 18 },
});
