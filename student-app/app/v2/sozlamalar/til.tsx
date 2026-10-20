/**
 * v2 Ilova tili (dizayn: 56 · Language).
 *
 * Til eski ekrandagi kabi LanguageContext orqali saqlanadi. Tanlov
 * "Saqlash" bosilgandagina qo'llanadi; boshqa til tanlanmaguncha tugma
 * o'chiq (dizayndagi kulrang holat). Ilova
 * tarjimalari hozircha faqat uz va ru — English qatori dizayndagi kabi
 * ko'rinadi, lekin tarjima yo'qligi sababli tanlab bo'lmaydi.
 */
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckMarkIcon, EyeIcon } from '@/components/v2/settings/icons';
import { Column, goBack, ScreenHeader } from '@/components/v2/settings/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import type { AppLang } from '@/i18n/translations';
import { DLanguage } from '@/components/v2/desktop/profile/DLanguage';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

type Option = { code: AppLang | 'en'; badge: string; name: string; sub: string; lang?: string; available: boolean };

const OPTIONS: Option[] = [
  { code: 'uz', badge: 'UZ', name: 'Oʻzbekcha', sub: 'Lotin yozuvi', available: true },
  { code: 'ru', badge: 'RU', name: 'Ру́сский', sub: 'Rus tili', lang: 'ru', available: true },
  { code: 'en', badge: 'EN', name: 'English', sub: 'Ingliz tili', lang: 'en', available: false },
];

export default function V2Language() {
  return useIsDesktop() ? <DLanguage /> : <V2LanguageMobile />;
}

function V2LanguageMobile() {
  const insets = useSafeAreaInsets();
  const { lang, setLang } = useLang();
  const [selected, setSelected] = useState<Option['code']>(lang);

  useEffect(() => setSelected(lang), [lang]);

  // Hozirgi tildan farqli til tanlanganda gina saqlash mumkin.
  const changed = selected !== lang;
  const currentName = OPTIONS.find((o) => o.code === lang)?.name ?? OPTIONS[0].name;

  const save = () => {
    if (!changed) return;
    if (selected === 'uz' || selected === 'ru') setLang(selected);
    goBack(R.settings);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 34 }]}
        showsVerticalScrollIndicator={false}
      >
        <Column style={styles.fill}>
          <ScreenHeader title="Ilova tili" fallback={R.settings} />
          <View style={styles.body}>
            <View style={styles.heroWrap}>
              <Image
                source={designImages['2770f303e2a36a9ec52c3a0b44e9b032']}
                resizeMode="contain"
                style={styles.hero}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <Text style={styles.note}>Menyu, tugmalar va eslatmalar shu tilda chiqadi. Rus tili darslari oʻzgarmaydi.</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ilova tili" style={styles.group}>
              {OPTIONS.map((o, i) => {
                const checked = selected === o.code;
                const current = lang === o.code;
                return (
                  <Pressable
                    key={o.code}
                    accessibilityRole="radio"
                    accessibilityState={{ checked, disabled: !o.available }}
                    disabled={!o.available}
                    onPress={() => setSelected(o.code)}
                    style={[styles.row, checked && styles.rowChecked, i < OPTIONS.length - 1 && styles.divider]}
                  >
                    <View style={[styles.badge, checked && styles.badgeChecked]}>
                      <Text style={[styles.badgeText, checked && { color: '#FFFFFF' }]}>{o.badge}</Text>
                    </View>
                    <View style={styles.texts}>
                      <Text style={styles.name} {...(Platform.OS === 'web' && o.lang ? ({ lang: o.lang } as object) : null)}>
                        {o.name}
                      </Text>
                      <Text style={styles.sub}>{current ? `${o.sub} · hozirgi til` : o.sub}</Text>
                    </View>
                    {checked ? (
                      <View style={styles.radioOn}>
                        <CheckMarkIcon size={12} color="#FFFFFF" strokeWidth={3.6} />
                      </View>
                    ) : (
                      <View style={styles.radioOff} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.preview}>
              <View style={{ marginTop: 1 }}>
                <EyeIcon />
              </View>
              <View style={styles.previewTexts}>
                <Text style={styles.previewTitle}>Hozirgi koʻrinish · {currentName}</Text>
                <Text style={styles.previewBody}>
                  «Bugungi dars» · «Uyga vazifa» · «Davom etish». Mashqlardagi ruscha soʻzlar va tarjimalar oʻzgarmaydi.
                </Text>
              </View>
            </View>
            <View style={styles.footer}>
              <Text style={styles.hint}>Boshqa til tanlasangiz, «Saqlash» faollashadi</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !changed }}
                disabled={!changed}
                onPress={save}
                style={({ pressed }) => [changed ? styles.save : styles.saveOff, changed && pressed && styles.savePressed]}
              >
                <Text style={[styles.saveText, !changed && { color: '#4A5468' }]}>Saqlash</Text>
              </Pressable>
            </View>
          </View>
        </Column>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  scroll: { flexGrow: 1 },
  fill: { flex: 1 },
  body: { flex: 1, paddingTop: 20, paddingHorizontal: 20, gap: 16 },
  heroWrap: { flexDirection: 'row', justifyContent: 'center' },
  hero: { width: 200, height: 200 },
  note: {
    fontFamily: fonts.body,
    fontWeight: 'normal',
    fontSize: 14,
    lineHeight: 20.3,
    color: '#4A5468',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  group: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  row: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF' },
  rowChecked: { backgroundColor: '#F5F8FF' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeChecked: { backgroundColor: '#2F5BFF' },
  badgeText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, letterSpacing: 0.52, color: '#4A5468' },
  texts: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, lineHeight: 22, color: '#0B1220' },
  sub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#4A5468' },
  radioOn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2F5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioOff: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#B4BCCB', flexShrink: 0 },
  save: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#2F5BFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 0 #1E3FD1' } as object)
      : { shadowColor: '#1E3FD1', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 2 }),
  },
  saveOff: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#E4E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as object) : null),
  },
  preview: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D5DBE7',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  previewTexts: { flex: 1, gap: 3 },
  previewTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, lineHeight: 18, color: '#0B1220' },
  previewBody: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 18.85, color: '#4A5468' },
  footer: { gap: 8, flexShrink: 0, marginTop: 'auto' },
  hint: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468', textAlign: 'center' },
  savePressed: { transform: [{ translateY: 2 }] },
  saveText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, lineHeight: 22, color: '#FFFFFF' },
});
