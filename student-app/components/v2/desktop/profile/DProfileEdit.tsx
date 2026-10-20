/**
 * Kompyuter: Profilni tahrirlash — avatar (dizayn: D_ProfileEdit).
 *
 * Mantiq mobil ekran (app/v2/profil/avatar.tsx) bilan aynan bir xil:
 * 10 ta tayyor avatar yoki galereyadan rasm (ImagePicker + AvatarCropModal),
 * "Saqlash" — savePreset + setAvatarUri(presetUri(...)) (webda ham ishlaydi).
 * Shaxsiy ma'lumotlar faqat ko'rish uchun: fetchDemoStudentProfile, login —
 * auth; dizayndagi qo'shimcha "Guruh" va "Kurs muddati" — fetchDemoSchedule
 * (guruh) va fetchDemoStudentPayments (tarif, kurs boshlanishi + 3 oy).
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AvatarCropModal } from '@/components/AvatarCropModal';
import { DEFAULT_PRESET, getSavedPreset, presetSource, presetUri, PRESETS, savePreset, type PresetKey } from '@/components/v2/profile/avatars';
import { courseEnd, dm, dmy, goBack, groupFromTopic, parseIso, supportUrl, tgByPhone } from '@/components/v2/profile/shared';
import { useDesktopKeys } from '@/components/v2/desktop/useDesktop';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { useLang } from '@/i18n/LanguageContext';
import { setAvatarUri, useAvatarUri } from '@/services/avatarStore';
import {
  fetchDemoSchedule,
  fetchDemoStudentPayments,
  fetchDemoStudentProfile,
  type DemoPaymentsResponse,
  type DemoProfileResponse,
} from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';

import { CameraIcon, CheckIcon, EyeIcon, H, LockIcon, Over, PPage, T, TgIcon } from './ui';

type Choice = { kind: 'preset'; key: PresetKey } | { kind: 'custom'; uri: string };

export function DProfileEdit() {
  const { courseLang } = useLang();
  const { student } = useAuth();
  const avatarUri = useAvatarUri();
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [pay, setPay] = useState<DemoPaymentsResponse | null>(null);
  const [group, setGroup] = useState('');
  const [savedPreset, setSavedPreset] = useState<PresetKey | null | undefined>(undefined);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    fetchDemoStudentPayments().then(setPay).catch(() => {});
    fetchDemoSchedule()
      .then((s) => setGroup(groupFromTopic(s?.topic)))
      .catch(() => {});
    getSavedPreset().then(setSavedPreset);
  }, []);

  // Joriy holat: o'zi yuklagan rasm, tanlangan tayyor avatar yoki standart (tulki).
  const current: Choice =
    avatarUri && savedPreset === null ? { kind: 'custom', uri: avatarUri } : { kind: 'preset', key: savedPreset ?? DEFAULT_PRESET.key };
  const shown = choice ?? current;
  const shownSrc = shown.kind === 'custom' ? { uri: shown.uri } : presetSource(PRESETS.find((p) => p.key === shown.key)!.id);
  const shownLabel = shown.kind === 'custom' ? 'oʻz rasmingiz' : PRESETS.find((p) => p.key === shown.key)!.label.toLowerCase();

  // Yangi avatar tanlanmaguncha «Saqlash» o'chiq (dizayndagi holat).
  const dirty =
    choice !== null &&
    (choice.kind !== current.kind ||
      (choice.kind === 'custom' ? choice.uri !== (current as { uri: string }).uri : choice.key !== (current as { key: PresetKey }).key));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    setCropUri(result.assets[0].uri);
  };

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      if (choice?.kind === 'custom') {
        await savePreset(null);
        await setAvatarUri(choice.uri);
      } else if (choice?.kind === 'preset') {
        const p = PRESETS.find((x) => x.key === choice.key)!;
        const uri = presetUri(p.id);
        await savePreset(p.key);
        if (uri) await setAvatarUri(uri);
      }
    } finally {
      setSaving(false);
      goBack(R.profile);
    }
  };

  // Esc — bekor qilish (tanlov saqlanmaydi), Enter — saqlash (faol bo'lsa).
  useDesktopKeys({ Escape: () => goBack(R.profile), Enter: dirty ? () => void save() : undefined }, cropUri === null);

  const full = (profile?.name || student?.name || '').trim().split(/\s+/);
  const start = parseIso(pay?.courseStartDate);
  const end = start ? courseEnd(start) : null;
  const rows: { label: string; value: string }[] = [
    { label: 'Ism', value: full[0] ?? '' },
    { label: 'Familiya', value: full.slice(1).join(' ') },
    { label: 'Telefon', value: profile?.phone ?? '' },
    { label: 'Login', value: student?.login || profile?.studentId || '' },
    { label: 'Guruh', value: [group, pay?.tariffLabel ?? ''].filter(Boolean).join(' · ') },
    { label: 'Kurs muddati', value: start && end ? `${dm(start)} – ${dmy(end)}` : '' },
  ];
  const managerUrl = tgByPhone(profile?.salesManagerPhone ?? '', supportUrl(courseLang));

  return (
    <PPage title="Profilni tahrirlash" subtitle="Faqat avatarni oʻzgartirish mumkin" back={R.profile}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
        <View style={s.left}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
            <Image source={shownSrc} accessibilityLabel={`Joriy avatar: ${shownLabel}`} style={s.big} />
            <View style={{ flex: 1, gap: 6 }}>
              <H size={28} role="header">
                Avatarni almashtirish
              </H>
              <T f="body" size={15} color="#4A5468" lh={22.5}>
                10 ta tayyor avatardan tanlang yoki oʻz rasmingizni yuklang
              </T>
            </View>
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel="Avatar tanlash" style={s.grid}>
            {[PRESETS.slice(0, 5), PRESETS.slice(5)].map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row' }}>
                {row.map((p) => {
                  const on = shown.kind === 'preset' && shown.key === p.key;
                  return (
                    <View key={p.key} style={{ flex: 1, alignItems: 'center' }}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={p.label}
                        onPress={() => setChoice({ kind: 'preset', key: p.key })}
                        style={{ alignItems: 'center', gap: 8 }}
                      >
                        <View style={[s.opt, on ? s.optOn : null]}>
                          <Image source={presetSource(p.id)} style={s.optImg} />
                          {on && (
                            <View style={s.check}>
                              <CheckIcon size={14} color="#FFFFFF" sw={3} />
                            </View>
                          )}
                        </View>
                        <T f={on ? 'bodyHeavy' : 'bodyBold'} size={13} color={on ? '#1E3FD1' : '#4A5468'}>
                          {p.label}
                        </T>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <Pressable accessibilityRole="button" onPress={pickImage} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.upload, hovered && { backgroundColor: '#EBF0FF' }]}>
            <CameraIcon size={20} />
            <T size={15} color="#1E3FD1">
              Galereyadan yuklash
            </T>
          </Pressable>

          <View style={s.footer}>
            <T f="bodyBold" size={14} color="#4A5468" style={{ flex: 1 }}>
              {dirty ? '' : 'Yangi avatar tanlasangiz, «Saqlash» faollashadi'}
            </T>
            <Pressable accessibilityRole="link" onPress={() => goBack(R.profile)} style={s.cancel}>
              <T size={15} color="#4A5468">
                Bekor qilish
              </T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !dirty || saving }}
              disabled={!dirty || saving}
              onPress={save}
              style={[s.save, dirty ? s.saveOn : s.saveOff]}
            >
              <T size={15} color={dirty ? '#FFFFFF' : '#5B6478'}>
                Saqlash
              </T>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 5, minWidth: 0, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
              <Over>Shaxsiy maʼlumotlar</Over>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <LockIcon size={14} color="#4A5468" />
                <T size={13} color="#4A5468">
                  Faqat koʻrish
                </T>
              </View>
            </View>
            <View style={s.card}>
              {rows.map((r) => (
                <View key={r.label} style={[s.row, s.rowBorder]}>
                  <LockIcon size={17} />
                  <T f="bodyBold" size={14} color="#4A5468" style={{ width: 104 }}>
                    {r.label}
                  </T>
                  <T size={16} lines={1} style={{ flex: 1 }}>
                    {r.value}
                  </T>
                </View>
              ))}
              <View style={s.row}>
                <LockIcon size={17} />
                <T f="bodyBold" size={14} color="#4A5468" style={{ width: 104 }}>
                  Parol
                </T>
                <View style={{ flex: 1 }}>
                  {/* Parol API orqali qaytarilmaydi — mobil ekrandagidek ustozga murojaat. */}
                  {showPass ? (
                    <T f="bodyBold" size={13} color="#4A5468">
                      Ustozingizga murojaat qiling
                    </T>
                  ) : (
                    <T size={16} accessibilityLabel="Yashirin parol">
                      ••••••••
                    </T>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
                  onPress={() => setShowPass((v) => !v)}
                  style={s.showBtn}
                >
                  <EyeIcon size={17} />
                  <T size={14} color="#1E3FD1">
                    {showPass ? 'Yashirish' : 'Koʻrsatish'}
                  </T>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={s.notice}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Image source={designImages.f639c30e1400761df83230b833ba42b2} style={{ width: 64, height: 64 }} resizeMode="contain" />
              <T size={16} color="#1E3FD1" lh={22.4} style={{ flex: 1 }}>
                Maʼlumotlarni oʻzgartirish uchun menejerga yozing
              </T>
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Menejerga Telegramda yozish"
              onPress={() => Linking.openURL(managerUrl).catch(() => {})}
              style={s.tg}
            >
              <TgIcon size={18} />
              <T size={15}>Yozish</T>
            </Pressable>
          </View>
        </View>
      </View>
      <AvatarCropModal
        visible={cropUri !== null}
        imageUri={cropUri}
        onConfirm={(uri) => {
          setCropUri(null);
          setChoice({ kind: 'custom', uri });
        }}
        onCancel={() => setCropUri(null)}
      />
    </PPage>
  );
}

const s = StyleSheet.create({
  left: { flex: 7, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28, gap: 22 },
  big: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#FFF1E6', flexShrink: 0 },
  grid: { backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: '#EEF1F7', borderRadius: 22, paddingVertical: 28, paddingHorizontal: 16, gap: 30 },
  opt: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#F4F6FA' },
  optOn: { backgroundColor: '#E8EEFF', boxShadow: '0 0 0 3px #2F5BFF' },
  optImg: { width: 108, height: 108, borderRadius: 54 },
  check: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2F5BFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upload: {
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A9B8F5',
    backgroundColor: '#F3F6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  footer: { marginTop: 'auto', paddingTop: 18, borderTopWidth: 1, borderTopColor: '#EEF1F7', flexDirection: 'row', alignItems: 'center', gap: 14 },
  cancel: { height: 52, paddingHorizontal: 16, borderRadius: 17, justifyContent: 'center' },
  save: { height: 52, paddingHorizontal: 34, borderRadius: 17, justifyContent: 'center' },
  saveOff: { backgroundColor: '#E2E6EE', cursor: 'not-allowed' as never },
  saveOn: { backgroundColor: '#2F5BFF', boxShadow: '0 4px 0 #1E3FD1' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  row: { minHeight: 72, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  showBtn: { height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  notice: { marginTop: 'auto', backgroundColor: '#E8EEFF', borderRadius: 24, padding: 22, gap: 14 },
  tg: { height: 50, paddingHorizontal: 22, borderRadius: 17, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
});
