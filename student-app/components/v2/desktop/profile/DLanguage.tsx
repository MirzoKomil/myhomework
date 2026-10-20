/**
 * Kompyuter: Ilova tili (dizayn: D_Language).
 *
 * Mantiq mobil ekran (app/v2/sozlamalar/til.tsx) bilan bir xil: til
 * LanguageContext orqali saqlanadi, tanlov "Saqlash" bosilgandagina
 * qo'llanadi; boshqa til tanlanmaguncha tugma o'chiq. Ilova tarjimalari
 * faqat uz va ru — English kartasi ko'rinadi, lekin tanlab bo'lmaydi.
 * Klaviatura: Esc — bekor qilish, Enter — saqlash.
 */
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { goBack } from '@/components/v2/settings/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { useLang } from '@/i18n/LanguageContext';
import type { AppLang } from '@/i18n/translations';

import { SettingsLayout } from './settingsNav';
import { CheckIcon, H, Over, T } from './ui';

type Option = { code: AppLang | 'en'; badge: string; name: string; sub: string; lang?: string; available: boolean };

const OPTIONS: Option[] = [
  { code: 'uz', badge: 'UZ', name: 'Oʻzbekcha', sub: 'Lotin yozuvi', available: true },
  { code: 'ru', badge: 'RU', name: 'Ру́сский', sub: 'Rus tili', lang: 'ru', available: true },
  { code: 'en', badge: 'EN', name: 'English', sub: 'Ingliz tili', lang: 'en', available: false },
];
const MENU = ['Bosh sahifa', 'Darslar', 'Mashq', 'Liga', 'Doʻkon', 'Profil'];
const BUTTONS = ['Bugungi dars', 'Uyga vazifa', 'Davom etish'];

export function DLanguage() {
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
  useDesktopKeys({ Escape: () => goBack(R.settings), Enter: changed ? save : undefined });

  return (
    <SettingsLayout active="language" title="Ilova tili" subtitle="Interfeys tili">
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
          <Image source={designImages['2770f303e2a36a9ec52c3a0b44e9b032']} style={{ width: 140, height: 140, marginVertical: -8 }} resizeMode="contain" />
          <View style={{ flex: 1, gap: 6 }}>
            <H size={26} lh={1.15} role="header">
              Ilova qaysi tilda koʻrinsin?
            </H>
            <T f="body" size={16} color="#4A5468" lh={24} style={{ maxWidth: 540 }}>
              Menyu, tugmalar va eslatmalar shu tilda chiqadi. Rus tili darslari oʻzgarmaydi.
            </T>
          </View>
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Ilova tili" style={{ flexDirection: 'row', gap: 16 }}>
          {OPTIONS.map((o) => {
            const checked = selected === o.code;
            const current = lang === o.code;
            return (
              <Pressable
                key={o.code}
                accessibilityRole="radio"
                accessibilityState={{ checked, disabled: !o.available }}
                disabled={!o.available}
                onPress={() => setSelected(o.code)}
                style={[s.opt, checked && s.optOn]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={[s.badge, checked && { backgroundColor: '#2F5BFF' }]}>
                    <T size={16} color={checked ? '#FFFFFF' : '#34405A'}>
                      {o.badge}
                    </T>
                  </View>
                  {checked ? (
                    <View style={s.radioOn}>
                      <CheckIcon size={15} color="#FFFFFF" sw={3} />
                    </View>
                  ) : (
                    <View style={s.radioOff} />
                  )}
                </View>
                <View style={{ gap: 3 }}>
                  <View {...(Platform.OS === 'web' && o.lang ? ({ lang: o.lang } as object) : null)}>
                    <H size={24}>{o.name}</H>
                  </View>
                  <T f="bodyBold" size={14} color="#4A5468">
                    {current ? `${o.sub} · hozirgi til` : o.sub}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.preview}>
          <Over>{`Hozirgi koʻrinish · ${currentName}`}</Over>
          <PreviewRow label="Menyu" items={MENU} />
          <PreviewRow label="Tugmalar" items={BUTTONS} primary="Davom etish" />
          <T f="body" size={14} color="#4A5468" lh={21}>
            «Bugungi dars» · «Uyga vazifa» · «Davom etish». Mashqlardagi ruscha soʻzlar va tarjimalar oʻzgarmaydi.
          </T>
        </View>

        <View style={s.footer}>
          <T f="bodyBold" size={14} color="#4A5468" style={{ flex: 1 }}>
            Boshqa til tanlasangiz, «Saqlash» faollashadi
          </T>
          <Pressable accessibilityRole="link" onPress={() => goBack(R.settings)} style={s.cancel}>
            <T size={15} color="#4A5468">
              Bekor qilish
            </T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !changed }} disabled={!changed} onPress={save} style={[s.save, changed ? s.saveOn : s.saveOff]}>
            <T size={15} color={changed ? '#FFFFFF' : '#5B6478'}>
              Saqlash
            </T>
          </Pressable>
        </View>
      </View>
    </SettingsLayout>
  );
}

function PreviewRow({ label, items, primary }: { label: string; items: string[]; primary?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <T size={13} color="#4A5468" style={{ width: 86 }}>
        {label}
      </T>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((t) => {
          const on = t === primary;
          return (
            <View key={t} style={[s.chip, on && s.chipOn]}>
              <T size={15} color={on ? '#FFFFFF' : '#0B1220'}>
                {t}
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, gap: 24 },
  opt: { flex: 1, minWidth: 0, borderWidth: 2, borderColor: '#E4E8F0', backgroundColor: '#FFFFFF', borderRadius: 22, padding: 26, gap: 52 },
  optOn: { borderColor: '#2F5BFF', backgroundColor: '#F3F6FF' },
  badge: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  radioOn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  radioOff: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#C9D0DD' },
  preview: { backgroundColor: '#F4F6FA', borderRadius: 22, padding: 26, gap: 18 },
  chip: { height: 44, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE', justifyContent: 'center' },
  chipOn: { backgroundColor: '#2F5BFF', borderWidth: 0 },
  footer: { marginTop: 'auto', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#EEF1F7', flexDirection: 'row', alignItems: 'center', gap: 16 },
  cancel: { height: 52, paddingHorizontal: 18, borderRadius: 17, justifyContent: 'center' },
  save: { height: 52, paddingHorizontal: 34, borderRadius: 17, justifyContent: 'center' },
  saveOff: { backgroundColor: '#E2E6EE', cursor: 'not-allowed' as never },
  saveOn: { backgroundColor: '#2F5BFF', boxShadow: '0 4px 0 #1E3FD1' },
});
