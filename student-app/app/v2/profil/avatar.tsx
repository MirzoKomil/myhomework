/**
 * v2 Profil tahrirlash — avatar (dizayn: ProfileEdit.dc.html).
 *
 * Avatar: 10 ta tayyor rasm (designImages) yoki galereyadan yuklangan
 * rasm (eski profile/edit.tsx dagi ImagePicker + AvatarCropModal).
 * "Saqlash" tanlovni avatarStore orqali saqlaydi (serverga ham yuklanadi).
 * Shaxsiy ma'lumotlar faqat ko'rish uchun — fetchDemoStudentProfile.
 * Parol API orqali qaytarilmaydi, shuning uchun "Koʻrsatish" eski
 * ekrandagi kabi ustozga murojaat qilishni aytadi.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarCropModal } from '@/components/AvatarCropModal';
import { DEFAULT_PRESET, getSavedPreset, presetSource, presetUri, PRESETS, savePreset, type PresetKey } from '@/components/v2/profile/avatars';
import { CameraIcon, CheckIcon, EyeIcon, LockIcon, TelegramIcon } from '@/components/v2/profile/icons';
import { Column, goBack, Header, supportUrl, tgByPhone } from '@/components/v2/profile/shared';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useLang } from '@/i18n/LanguageContext';
import { setAvatarUri, useAvatarUri } from '@/services/avatarStore';
import { fetchDemoStudentProfile, type DemoProfileResponse } from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';

type Choice = { kind: 'preset'; key: PresetKey } | { kind: 'custom'; uri: string };

export default function V2ProfileEdit() {
  const insets = useSafeAreaInsets();
  const { courseLang } = useLang();
  const { student } = useAuth();
  const avatarUri = useAvatarUri();
  const [profile, setProfile] = useState<DemoProfileResponse | null>(null);
  const [savedPreset, setSavedPreset] = useState<PresetKey | null | undefined>(undefined);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDemoStudentProfile().then(setProfile).catch(() => {});
    getSavedPreset().then(setSavedPreset);
  }, []);

  // Joriy holat: o'zi yuklagan rasm, tanlangan tayyor avatar yoki standart (tulki).
  const current: Choice =
    avatarUri && savedPreset === null
      ? { kind: 'custom', uri: avatarUri }
      : { kind: 'preset', key: savedPreset ?? DEFAULT_PRESET.key };
  const shown = choice ?? current;
  const shownSrc =
    shown.kind === 'custom'
      ? { uri: shown.uri }
      : presetSource(PRESETS.find((p) => p.key === shown.key)!.id);
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

  const full = (profile?.name || student?.name || '').trim().split(/\s+/);
  const firstName = full[0] ?? '';
  const lastName = full.slice(1).join(' ');
  const rows: { label: string; value: string }[] = [
    { label: 'Ism', value: firstName },
    { label: 'Familiya', value: lastName },
    { label: 'Telefon', value: profile?.phone ?? '' },
    { label: 'Login', value: student?.login || profile?.studentId || '' },
  ];
  const managerUrl = tgByPhone(profile?.salesManagerPhone ?? '', supportUrl(courseLang));

  return (
    <View style={st.screen}>
      <Header title="Profilni tahrirlash" fallback={R.profile} />
      <ScrollView contentContainerStyle={[st.content, { paddingBottom: Math.max(22, insets.bottom + 12) }]} showsVerticalScrollIndicator={false}>
        <Column style={st.col}>
          <View style={st.top}>
            <View style={st.bigAvatarRing}>
              <Image source={shownSrc} accessibilityLabel={`Joriy avatar: ${shownLabel}`} style={st.bigAvatar} />
            </View>
            <View style={st.topText}>
              <Text style={st.topTitle}>Avatarni almashtirish</Text>
              <Text style={st.topSub}>10 ta tayyor avatardan tanlang yoki oʻz rasmingizni yuklang</Text>
            </View>
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel="Avatar tanlash" style={st.grid}>
            {PRESETS.map((p) => {
              const on = shown.kind === 'preset' && shown.key === p.key;
              return (
                <View key={p.key} style={st.cell}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={p.label}
                    onPress={() => setChoice({ kind: 'preset', key: p.key })}
                    style={[st.opt, on && st.optOn]}
                  >
                    <Image source={presetSource(p.id)} style={st.optImg} />
                    {on && <View style={st.check}><CheckIcon /></View>}
                  </Pressable>
                </View>
              );
            })}
            <Pressable accessibilityRole="button" onPress={pickImage} style={({ pressed }) => [st.upload, pressed && st.pressed]}>
              <CameraIcon />
              <Text style={st.uploadText}>Galereyadan yuklash</Text>
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            <View style={st.secHead}>
              <Text style={st.secTitle}>Shaxsiy maʼlumotlar</Text>
              <Text style={st.secNote}>Faqat koʻrish</Text>
            </View>
            <View style={st.card}>
              {rows.map((r) => (
                <View key={r.label} style={[st.row, st.rowBorder]}>
                  <LockIcon />
                  <Text style={st.rowLabel}>{r.label}</Text>
                  <Text style={st.rowValue} numberOfLines={1}>{r.value}</Text>
                </View>
              ))}
              <View style={st.row}>
                <LockIcon />
                <Text style={st.rowLabel}>Parol</Text>
                <Text style={st.rowValue} numberOfLines={1}>
                  {showPass ? (
                    <Text style={st.passHint}>Ustozingizga murojaat qiling</Text>
                  ) : (
                    <Text accessibilityLabel="Yashirin parol" style={st.dots}>••••••••</Text>
                  )}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
                  onPress={() => setShowPass((v) => !v)}
                  style={st.showBtn}
                >
                  <EyeIcon />
                  <Text style={st.showText}>{showPass ? 'Yashirish' : 'Koʻrsatish'}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={st.notice}>
            <Text style={st.noticeText}>Maʼlumotlarni oʻzgartirish uchun menejerga yozing</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Menejerga Telegramda yozish"
              onPress={() => Linking.openURL(managerUrl).catch(() => {})}
              style={({ pressed }) => [st.tg, pressed && st.pressed]}
            >
              <TelegramIcon />
              <Text style={st.tgText}>Yozish</Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }} />
          <View style={st.saveWrap}>
            {!dirty && <Text style={st.saveHint}>Yangi avatar tanlasangiz, «Saqlash» faollashadi</Text>}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !dirty || saving }}
              onPress={save}
              disabled={!dirty || saving}
              style={({ pressed }) => [dirty ? st.save : st.saveOff, pressed && dirty && st.savePressed]}
            >
              <Text style={[st.saveText, !dirty && st.saveTextOff]}>Saqlash</Text>
            </Pressable>
          </View>
        </Column>
      </ScrollView>
      <AvatarCropModal
        visible={cropUri !== null}
        imageUri={cropUri}
        onConfirm={(uri) => {
          setCropUri(null);
          setChoice({ kind: 'custom', uri });
        }}
        onCancel={() => setCropUri(null)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12 },
  col: { flexGrow: 1, gap: 10 },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 2 },
  bigAvatarRing: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFFFFF', margin: -3, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bigAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF1E6' },
  topText: { flex: 1, minWidth: 0, gap: 2, marginLeft: 3 },
  topTitle: { fontFamily: fonts.display, fontWeight: 'normal', fontSize: 20, letterSpacing: -0.2, color: '#0B1220' },
  topSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 17.55, color: '#4A5468' },
  grid: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell: { width: '20%', alignItems: 'center' },
  opt: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F4F6FA' },
  optOn: {
    // Dizayndagi ikki qavatli halqa: 3px oq + 3px ko'k.
    borderWidth: 0,
    boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 6px #2F5BFF',
  },
  optImg: { width: 52, height: 52, borderRadius: 26 },
  check: {
    position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#2F5BFF',
    borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  upload: {
    width: '100%', height: 48, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#B9C6F5', backgroundColor: '#F5F8FF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#1E3FD1' },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  secTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#4A5468' },
  secNote: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  rowLabel: { width: 74, flexShrink: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  rowValue: { flex: 1, minWidth: 0, fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  dots: { letterSpacing: 1.8 },
  passHint: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#4A5468' },
  showBtn: { height: 44, marginRight: -8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  showText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 13, color: '#1E3FD1' },
  notice: { backgroundColor: '#E8EEFF', borderRadius: 18, paddingVertical: 10, paddingRight: 10, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeText: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, lineHeight: 17.55, color: '#1E3FD1' },
  tg: { height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#1B6FA8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flexShrink: 0 },
  tgText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#FFFFFF' },
  save: {
    height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderBottomWidth: 4, borderBottomColor: '#1E3FD1',
  },
  savePressed: { opacity: 0.9 },
  saveWrap: { gap: 8, flexShrink: 0 },
  saveHint: { textAlign: 'center', fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 16, color: '#4A5468' },
  saveOff: { height: 56, borderRadius: 18, backgroundColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  saveTextOff: { color: '#4A5468' },
  saveText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 17, color: '#FFFFFF' },
});
