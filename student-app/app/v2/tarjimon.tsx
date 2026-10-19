/**
 * v2 Tarjimon (dizayn: 37 · Translator).
 *
 * Tarjima eski app/(tabs)/translator.tsx'dagi bilan bir xil (Google
 * Translate'ning ochiq endpointi). Talaffuz satri — shu endpointning
 * transliteratsiyasi (dt=rm), bo'lsa. "Tinglash" — expo-speech.
 * Yangi dizayn: har bir tarjima avtomatik shaxsiy lug'atga qo'shiladi
 * ("Lugʻatga qoʻshildi" holati) va "Lugʻatimni ochish" Lug'at ekraniga olib
 * boradi. Lug'at va "Oxirgilar" shu qurilmada saqlanadi (serverda joy yo'q).
 */
import * as Speech from 'expo-speech';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon, SavedCheckIcon, SpeakerIcon, SwapIcon } from '@/components/v2/practice/icons';
import {
  displayRu,
  getRecentTranslations,
  goBack,
  pushRecentTranslation,
  replaceMyWord,
  reset,
  type RecentTranslation,
} from '@/components/v2/practice/shared';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';

type Direction = 'uz-other' | 'other-uz';

async function translateText(text: string, sl: string, tl: string): Promise<{ text: string; translit: string }> {
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=rm&q=${encodeURIComponent(text)}`,
  );
  const data = await res.json();
  const segs: unknown[] = Array.isArray(data?.[0]) ? data[0] : [];
  const text_ = segs.map((s) => (Array.isArray(s) && typeof s[0] === 'string' ? s[0] : '')).join('');
  if (!text_.trim()) throw new Error('empty translation');
  // dt=rm: transliteratsiya alohida segmentda (index 2 — natija tilida).
  const translit = segs.map((s) => (Array.isArray(s) && s[0] == null && typeof s[2] === 'string' ? s[2] : '')).join('').trim();
  return { text: text_, translit };
}

export default function TranslatorScreen() {
  const insets = useSafeAreaInsets();
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
  // Shu yozish davomida oxirgi avtomatik saqlangan so'z (oraliq shakllar to'planib qolmasin).
  const lastSaved = useRef<{ src: string; word: string } | null>(null);

  const sl = dir === 'uz-other' ? 'uz' : otherCode;
  const tl = dir === 'uz-other' ? otherCode : 'uz';

  useEffect(() => { getRecentTranslations().then(setRecent); }, []);

  const run = async (text: string, from = sl, to = tl, d = dir) => {
    if (!text.trim()) { setResult(null); return; }
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

  // Yozish to'xtagach avtomatik tarjima (dizaynda alohida tugma yo'q).
  const onChange = (t: string) => {
    setSource(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(t), 700);
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

  // Dizaynda "+ Lugʻatga" tugmasi o'rniga "Lugʻatga qoʻshildi" holati — tarjima o'zi saqlanadi.
  const saveToVocab = async (src: string, out: string, otherOut: boolean) => {
    const otherText = otherOut ? out : src;
    const uzText = otherOut ? src : out;
    const prev = lastSaved.current;
    // Matn davom ettirilayotgan bo'lsa (bir-birining boshi), oldingi oraliq yozuv almashtiriladi.
    const editing = prev && (src.startsWith(prev.src) || prev.src.startsWith(src));
    await replaceMyWord(editing ? prev.word : null, { word: otherText, translation: uzText }, 'translator');
    lastSaved.current = { src, word: otherText };
    setSaved(true);
  };

  const openRecent = (r: RecentTranslation) => {
    setDir(r.dir);
    setSource(r.source);
    lastSaved.current = null;
    const [f, t] = r.dir === 'uz-other' ? ['uz', otherCode] : [otherCode, 'uz'];
    run(r.source, f, t, r.dir);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 44) + 10, paddingBottom: Math.max(insets.bottom, 30) }]} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" onPress={() => goBack()} style={styles.back}>
              <BackIcon />
            </Pressable>
            <Text accessibilityRole="header" style={styles.h1}>Tarjimon</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.langRow}>
              <View style={styles.lang}><Text style={styles.langText}>{dir === 'uz-other' ? 'Oʻzbekcha' : otherLabel}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Tillarni almashtirish" onPress={swap} style={styles.swap}>
                <SwapIcon />
              </Pressable>
              <View style={styles.lang}><Text style={styles.langText}>{dir === 'uz-other' ? otherLabel : 'Oʻzbekcha'}</Text></View>
            </View>

            <View style={styles.srcCard}>
              <Text nativeID="src-label" style={styles.label}>Matn</Text>
              <TextInput
                accessibilityLabel="Matn"
                aria-labelledby="src-label"
                multiline
                numberOfLines={1}
                value={source}
                onChangeText={onChange}
                placeholder="Matn kiriting"
                placeholderTextColor="#9AA4BC"
                style={styles.src}
              />
            </View>

            <View style={styles.outCard}>
              <Text style={[styles.label, { color: '#9AA4BC' }]}>Tarjima</Text>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" style={{ alignSelf: 'flex-start' }} />
              ) : (
                <Text style={[styles.out, !result && { color: '#4A5468' }]}>{result?.text ?? 'Tarjima shu yerda chiqadi'}</Text>
              )}
              {!!error && <Text style={styles.translit}>{error}</Text>}
              {!!result?.translit && <Text style={styles.translit}>[{result.translit}]</Text>}
              <View style={styles.outActions}>
                <Pressable accessibilityRole="button" disabled={!result} onPress={listen} style={styles.listen}>
                  <SpeakerIcon size={18} strokeWidth={2.2} full={false} />
                  <Text style={styles.btnText}>Tinglash</Text>
                </Pressable>
                {saved && !!result && !loading && (
                  <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.savedChip}>
                    <SavedCheckIcon />
                    <Text style={styles.savedText} numberOfLines={1}>Lugʻatga qoʻshildi</Text>
                  </View>
                )}
              </View>
              <Pressable accessibilityRole="link" onPress={() => router.push(R.lugat as Href)} style={styles.openLugat}>
                <Text style={styles.openLugatText}>Lugʻatimni ochish</Text>
                <Text style={styles.openLugatText} accessibilityElementsHidden importantForAccessibility="no">→</Text>
              </Pressable>
            </View>

            <Text style={[styles.label, { marginTop: 6 }]}>Oxirgilar</Text>
            <View style={styles.recent}>
              {recent.length === 0 ? (
                <View style={styles.recentRow}>
                  <Text style={styles.recentSub}>Hali tarjima qilinmagan</Text>
                </View>
              ) : (
                recent.map((r, i) => {
                  // Yuqorida o'rganilayotgan til (rus), pastda o'zbekcha.
                  const [top, bottom] = r.dir === 'uz-other' ? [r.target, r.source] : [r.source, r.target];
                  return (
                    <Pressable
                      key={`${r.source}-${i}`}
                      accessibilityRole="button"
                      onPress={() => openRecent(r)}
                      style={[styles.recentRow, i < recent.length - 1 && styles.divider]}
                    >
                      <Text style={styles.recentTop}>{top}</Text>
                      <Text style={styles.recentSub}>{bottom}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={styles.tip}>
              <Image
                source={(designImages as Record<string, ImageSourcePropType>)['cc0d95446730f059d25d989e2c9845ad']}
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.tipImg}
                resizeMode="contain"
              />
              <Text style={styles.tipText}>Domik maslahati: soʻzni emas, butun iborani yozing — tarjima tabiiyroq chiqadi.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { flexGrow: 1 },
  column: { flex: 1, maxWidth: 480, alignSelf: 'center', width: '100%' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  h1: { flex: 1, fontFamily: fonts.display, fontSize: 26, lineHeight: 34, letterSpacing: -0.52, color: '#0B1220', ...reset },

  body: { flex: 1, paddingTop: 16, paddingHorizontal: 20, gap: 12 },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lang: { flex: 1, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  langText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#0B1220', ...reset },
  swap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },

  srcCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, gap: 10 },
  label: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 16.4, letterSpacing: 0.72, textTransform: 'uppercase', color: '#4A5468', ...reset },
  src: { minHeight: 27.3, fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 27.3, color: '#0B1220', padding: 0, textAlignVertical: 'top', outlineStyle: 'none' } as object,

  outCard: { backgroundColor: '#0B1220', borderRadius: 24, padding: 18, gap: 8 },
  out: { fontFamily: displayRu, fontSize: 28, lineHeight: 32.2, color: '#FFFFFF', ...reset },
  translit: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20.5, color: '#B8C1D6', ...reset },
  outActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  listen: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedChip: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(46, 204, 138, 0.16)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#7BE0B0', ...reset },
  openLugat: { minHeight: 44, marginTop: -2, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openLugatText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#9DB4FF', ...reset },
  btnText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#FFFFFF', ...reset },

  recent: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  recentRow: { paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  recentTop: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 20, color: '#0B1220', ...reset },
  recentSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: '#4A5468', ...reset },

  tip: { marginTop: 'auto', backgroundColor: '#FFF4D1', borderRadius: 20, paddingVertical: 10, paddingLeft: 8, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipImg: { width: 64, height: 64 },
  tipText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18.2, color: '#4D3A00', ...reset },
});
