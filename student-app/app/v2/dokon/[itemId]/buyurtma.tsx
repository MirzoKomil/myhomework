/**
 * v2 Do'kon — buyurtma berish (dizayn: 46 · Checkout).
 *
 * Buyurtma eski do'kondagi bilan AYNAN bir xil: shopStore.placeOrder —
 * coin yetarli bo'lsa coin yechiladi va /api/state/demo-shop-orders ga
 * POST qilinadi. Server manzil maydonini qabul qilmaydi, shuning uchun
 * manzil faqat qurilmada saqlanadi ("Manzil saqlanadi" — keyingi
 * buyurtmada qayta to'ldiriladi). Qabul qiluvchi va telefon — profildan.
 * Coin yetmasa — sariq "Yana N coin · ~2–3 dars" qatori joriy dars
 * vazifasiga olib boradi (bosh sahifadagi joriy dars).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadCurrentLesson } from '@/components/v2/practice/shared';
import { BagIcon, ChevronRightIcon, CoinFill, LockIcon, PhoneIcon, TruckIcon } from '@/components/v2/rewards/icons';
import { EARN_HOMEWORK, EARN_LESSON_DONE, fmt, lessonsFor, ScreenHeader, useShopProducts } from '@/components/v2/rewards/parts';
import { ProductImage } from '@/components/v2/rewards/shopParts';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useCoins } from '@/services/coinsStore';
import { fetchDemoStudentProfile } from '@/services/contentApi';
import { placeOrder } from '@/services/shopStore';
import { useAuth } from '@/services/studentAuthStore';

const ADDRESS_KEY = 'mh_v2_delivery_address';
type Address = { region: string; city: string; street: string; landmark: string };
const EMPTY: Address = { region: '', city: '', street: '', landmark: '' };

/** +998901234567 → +998 90 123 45 67 */
function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  return raw;
}

function Field({ label, value, onChange, flex, optional }: { label: string; value: string; onChange: (v: string) => void; flex?: number; optional?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 5 }, flex ? { flex, minWidth: 0 } : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label}
        placeholder={optional ? '' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && { borderColor: '#2F5BFF' }]}
      />
    </View>
  );
}

export default function V2Checkout() {
  const insets = useSafeAreaInsets();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const products = useShopProducts();
  const coins = useCoins();
  const { student } = useAuth();
  const p = products?.find((x) => x.id === itemId);
  const [addr, setAddr] = useState<Address>(EMPTY);
  const [name, setName] = useState(student?.name?.split(' ')[0] ?? '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentLesson()
      .then((l) => setLessonId(l?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ADDRESS_KEY)
      .then((raw) => {
        if (raw) setAddr({ ...EMPTY, ...JSON.parse(raw) });
        return fetchDemoStudentProfile().then((pr) => {
          if (!pr) return;
          if (pr.name) setName(pr.name.split(' ')[0]);
          setPhone(pr.phone);
          // Saqlangan manzil bo'lmasa — CRM'dagi manzil ko'cha maydoniga.
          if (!raw && pr.address) setAddr((a) => ({ ...a, street: pr.address }));
        });
      })
      .catch(() => {});
  }, []);

  const set = (k: keyof Address) => (v: string) => {
    setAddr((a) => {
      const next = { ...a, [k]: v };
      AsyncStorage.setItem(ADDRESS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  if (!p) return <View style={styles.screen}><ScreenHeader title="Buyurtma berish" fallback={R.shop} /></View>;

  const missing = Math.max(0, p.price - coins);
  // Dizayndagi qisqa ko'rinish: "Bosma kitob · 120 bet".
  const sub = [p.category === 'books' ? 'Bosma kitob' : p.delivered ? 'Yetkazib beriladi' : '', p.pages ? `${p.pages} bet` : ''].filter(Boolean).join(' · ');
  const ready = !!(addr.region.trim() && addr.city.trim() && addr.street.trim());

  const submit = async () => {
    if (busy || missing > 0) return;
    if (!ready) {
      setError('Viloyat, shahar va koʻcha maydonlarini toʻldiring');
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await placeOrder(p);
    setBusy(false);
    if (ok) router.replace(R.orders as never);
    else setError('Ushbu mahsulotni sotib olish uchun yetarlicha coiningiz yoʻq.');
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title="Buyurtma berish"
        fallback={R.shopItem(p.id)}
        right={
          <Pressable accessibilityRole="link" accessibilityLabel="Buyurtmalarim" onPress={() => router.push(R.orders as never)} style={({ pressed }) => [styles.ordersBtn, pressed && { opacity: 0.75 }]}>
            <BagIcon size={21} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 27 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.column, { flex: 1 }]}>
          <View style={styles.product}>
            <ProductImage product={p} style={styles.thumb} iconSize={30} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.pName} numberOfLines={2}>{p.name}</Text>
              {!!sub && <Text style={styles.pSub} numberOfLines={1}>{sub}</Text>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <CoinFill />
              <Text style={styles.pName}>{fmt(p.price)}</Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={styles.section}>Yetkazib berish manzili</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Viloyat" value={addr.region} onChange={set('region')} flex={1} />
              <Field label="Shahar / tuman" value={addr.city} onChange={set('city')} flex={1.3} />
            </View>
            <Field label="Koʻcha, uy, xonadon" value={addr.street} onChange={set('street')} />
            <Field label="Moʻljal (ixtiyoriy)" value={addr.landmark} onChange={set('landmark')} optional />
          </View>

          <View style={styles.phone}>
            <PhoneIcon />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.phoneLabel}>Qabul qiluvchi · {name}</Text>
              <Text style={styles.phoneVal}>{phone ? formatPhone(phone) : '—'}</Text>
            </View>
            <Text style={styles.phoneLabel}>profildan</Text>
          </View>

          <View style={styles.note}>
            <TruckIcon size={22} color="#087A4A" />
            <Text style={styles.noteText}>
              <Text style={{ fontFamily: fonts.bodyHeavy, color: '#087A4A' }}>Bepul yetkazish</Text> · 2–4 ish kuni. Kuryer kelishdan oldin qoʻngʻiroq qiladi.
            </Text>
          </View>

          {missing > 0 && (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push((lessonId ? R.homework(lessonId) : R.path) as never)}
              style={({ pressed }) => [styles.earn, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.earnIcon}><CoinFill size={20} /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.earnTitle}>Yana {fmt(missing)} coin · ~{lessonsFor(missing)} dars</Text>
                <Text style={styles.earnSub}>Vazifa {EARN_HOMEWORK}, dars yakuni +{EARN_LESSON_DONE}</Text>
              </View>
              <ChevronRightIcon size={18} color="#7A5300" strokeWidth={2.2} />
            </Pressable>
          )}

          <View style={{ flex: 1, minHeight: 16 }} />
          <View style={{ gap: 10 }}>
            <View style={styles.totals}>
              <Text style={styles.totLabel}>Balans</Text>
              <CoinFill size={15} />
              <Text style={styles.totVal}>{fmt(coins)}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.totLabel}>Jami</Text>
              <CoinFill size={15} />
              <Text style={styles.totVal}>{fmt(p.price)}</Text>
            </View>
            {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
            {missing > 0 ? (
              <View accessibilityRole="button" accessibilityState={{ disabled: true }} style={[styles.cta, { backgroundColor: '#E4E8F0' }]}>
                <LockIcon size={18} color="#4A5468" />
                <Text style={[styles.ctaText, { color: '#4A5468' }]}>{fmt(missing)} coin yetishmayapti</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy }}
                onPress={submit}
                style={({ pressed }) => [styles.cta, { backgroundColor: pressed ? '#1E3FD1' : '#2F5BFF' }, busy && { opacity: 0.6 }]}
              >
                <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Buyurtma berish · {fmt(p.price)} coin</Text>
              </Pressable>
            )}
            <Text style={styles.foot}>
              {missing > 0 ? 'Manzil saqlanadi — coin yetganda bir bosishda buyurtma berasiz' : 'Manzil saqlanadi — keyingi buyurtmada qayta yozish shart emas'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { flexGrow: 1, paddingTop: 16, paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 14 },
  ordersBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  earn: { minHeight: 60, backgroundColor: '#FFF4D1', borderRadius: 20, paddingVertical: 8, paddingLeft: 10, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  earnIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  earnTitle: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  earnSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, color: '#5C4300' },
  product: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  pName: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16, color: '#0B1220' },
  pSub: { fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, color: '#4A5468' },
  section: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#4A5468', letterSpacing: 0.72, textTransform: 'uppercase', paddingLeft: 4 },
  fieldLabel: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 12, color: '#4A5468', paddingLeft: 2 },
  input: { height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: '#DDE2EB', backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 15, color: '#0B1220', outlineStyle: 'none' } as never,
  phone: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 4, paddingLeft: 16, paddingRight: 6, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  phoneLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 12, color: '#4A5468' },
  phoneVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 15, color: '#0B1220' },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 4 },
  noteText: { flex: 1, fontFamily: fonts.body, fontWeight: 'normal', fontSize: 13, lineHeight: 19, color: '#4A5468' },
  totals: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  totLabel: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 14, color: '#4A5468' },
  totVal: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 14, color: '#0B1220', marginLeft: -2 },
  error: { fontFamily: fonts.bodyBold, fontWeight: 'normal', fontSize: 13, color: '#B42318', textAlign: 'center' },
  cta: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontFamily: fonts.bodyHeavy, fontWeight: 'normal', fontSize: 16 },
  foot: { textAlign: 'center', fontFamily: fonts.body, fontWeight: 'normal', fontSize: 12, lineHeight: 17, color: '#4A5468' },
});
