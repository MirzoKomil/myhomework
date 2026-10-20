/**
 * Kompyuter: Buyurtma berish (dizayn: D_Checkout).
 *
 * Mantiq mobil Checkout bilan AYNAN bir xil: shopStore.placeOrder (coin
 * yetsa yechiladi, /api/state/demo-shop-orders ga POST), manzil qurilmada
 * saqlanadi (bir xil kalit), qabul qiluvchi va telefon — profildan, coin
 * yetmasa sariq qator joriy dars vazifasiga olib boradi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { loadCurrentLesson } from '@/components/v2/practice/shared';
import { EARN_HOMEWORK, EARN_LESSON_DONE, fmt, lessonsFor, productImages, useShopProducts } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { useAvatarUri } from '@/services/avatarStore';
import { useCoins } from '@/services/coinsStore';
import { fetchDemoStudentProfile } from '@/services/contentApi';
import { placeOrder } from '@/services/shopStore';
import { useAuth } from '@/services/studentAuthStore';

import { caps, DButton, HeaderButton, IBag, IChevron, ICoin, ILock, IPin, ITruck, LockedButton, T } from './ui';

// Mobil Checkout bilan bir xil kalit — manzil ikkala ko'rinishda ham saqlanadi.
const ADDRESS_KEY = 'mh_v2_delivery_address';
type Address = {
  region: string;
  city: string;
  street: string;
  landmark: string;
};
const EMPTY: Address = { region: '', city: '', street: '', landmark: '' };

/** +998901234567 → +998 90 123 45 67 */
function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  return raw;
}

const go = (href: string) => router.push(href as Href);

function Field({ label, value, onChange, style }: { label: string; value: string; onChange: (v: string) => void; style?: object }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 7 }, style]}>
      <T f="bodyHeavy" size={14} color="#34405A">
        {label}
      </T>
      <TextInput
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[s.input, focused && { borderColor: '#2F5BFF' }]}
      />
    </View>
  );
}

export function DCheckout() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const products = useShopProducts();
  const coins = useCoins();
  const avatar = useAvatarUri();
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

  const ordersBtn = <HeaderButton label="Buyurtmalarim" icon={<IBag />} onPress={() => go(R.orders)} />;
  if (!p)
    return (
      <DesktopPage title="Buyurtma berish" back={R.shop} actions={ordersBtn}>
        {null}
      </DesktopPage>
    );

  const missing = Math.max(0, p.price - coins);
  const pct = Math.round(Math.max(0, Math.min(1, coins / Math.max(1, p.price))) * 100);
  // Dizayndagi qisqa ko'rinish: "Bosma kitob · 120 bet" (mobil kabi).
  const sub = [p.category === 'books' ? 'Bosma kitob' : p.delivered ? 'Yetkazib beriladi' : '', p.pages ? `${p.pages} bet` : ''].filter(Boolean).join(' · ');
  const ready = !!(addr.region.trim() && addr.city.trim() && addr.street.trim());
  const addrLine = [addr.city.trim(), addr.street.trim()].filter(Boolean).join(', ');
  const cover = productImages(p)[0];

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
    if (ok) router.replace(R.orders as Href);
    else setError('Ushbu mahsulotni sotib olish uchun yetarlicha coiningiz yoʻq.');
  };

  const steps = ['Manzilni kiriting — u saqlanadi', 'Coin yetganda bir bosishda buyurtma', 'Kuryer 2–4 ish kunida olib keladi'];

  return (
    <DesktopPage
      title="Buyurtma berish"
      subtitle={`Doʻkon · «${p.name}»`}
      back={R.shopItem(p.id)}
      actions={ordersBtn}
      contentStyle={{
        flex: 1,
        paddingBottom: 32,
        flexDirection: 'row',
        gap: 24,
      }}
    >
      <View style={s.form}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={s.formIcon}>
            <ITruck />
          </View>
          <T f="bodyHeavy" size={19} accessibilityRole="header">
            Yetkazib berish manzili
          </T>
        </View>
        <View style={{ gap: 20 }}>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <Field label="Viloyat" value={addr.region} onChange={set('region')} style={{ flex: 1, minWidth: 0 }} />
            <Field label="Shahar / tuman" value={addr.city} onChange={set('city')} style={{ flex: 1, minWidth: 0 }} />
          </View>
          <Field label="Koʻcha, uy, xonadon" value={addr.street} onChange={set('street')} />
          <Field label="Moʻljal (ixtiyoriy)" value={addr.landmark} onChange={set('landmark')} />
        </View>
        <View style={s.recipient}>
          <Image source={avatar ? { uri: avatar } : designImages['93faebd4826b1da6adaee5d0dcda6209']} style={{ width: 44, height: 44, borderRadius: 22 }} />
          <View style={{ flex: 1, gap: 1 }}>
            <T size={13} color="#4A5468">
              Qabul qiluvchi · {name}
            </T>
            <T f="bodyHeavy" size={16}>
              {phone ? formatPhone(phone) : '—'}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ILock size={15} sw={2.2} />
            <T f="bodyHeavy" size={13} color="#4A5468">
              profildan
            </T>
          </View>
        </View>
        <View style={s.free}>
          <ITruck color="#087A4A" />
          <T size={15} color="#075E3A" style={{ flex: 1 }}>
            <T f="bodyHeavy" size={15} color="#075E3A">
              Bepul yetkazish
            </T>{' '}
            · 2–4 ish kuni. Kuryer kelishdan oldin qoʻngʻiroq qiladi.
          </T>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {steps.map((t, i) => (
            <View key={t} style={s.step}>
              <View style={s.stepNum}>
                <T f="bodyHeavy" size={13} color="#FFFFFF">
                  {i + 1}
                </T>
              </View>
              <T size={14} lh={19.6} color="#34405A" style={{ flex: 1 }}>
                {t}
              </T>
            </View>
          ))}
        </View>
      </View>

      <View style={s.aside}>
        <T f="bodyHeavy" size={12} color="#4A5468" style={caps()}>
          Buyurtma
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={[s.thumb, { backgroundColor: p.coverBg ?? '#DCD5CE' }]}>
            {cover ? <Image source={{ uri: cover }} style={{ width: 100, height: 100 }} resizeMode="contain" /> : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T f="bodyHeavy" size={18} numberOfLines={2}>
              {p.name}
            </T>
            {!!sub && (
              <T size={14} color="#4A5468">
                {sub}
              </T>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ICoin size={18} />
            <T f="bodyHeavy" size={18}>
              {fmt(p.price)}
            </T>
          </View>
        </View>
        <View style={s.info}>
          {(
            [
              [p.category === 'books' ? 'Kitob' : 'Mahsulot', <Coins key="a" n={p.price} />],
              [
                'Yetkazish',
                <T key="b" f="bodyHeavy" size={15} color="#087A4A">
                  Bepul · 2–4 ish kuni
                </T>,
              ],
              ['Balans', <Coins key="c" n={coins} />],
              ['Jami', <Coins key="d" n={p.price} />],
            ] as [string, ReactNode][]
          ).map(([l, v], i) => (
            <View key={l} style={[s.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#E4E8F0' }]}>
              <T size={15} color="#4A5468">
                {l}
              </T>
              {v}
            </View>
          ))}
        </View>
        {!!addrLine && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              paddingHorizontal: 4,
            }}
          >
            <IPin />
            <T size={14} lh={20.3} color="#4A5468" style={{ flex: 1 }}>
              {addrLine}
            </T>
          </View>
        )}
        {missing > 0 && (
          <Pressable
            accessibilityRole="link"
            onPress={() => go(lessonId ? R.homework(lessonId) : R.path)}
            style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.earn, hovered && { backgroundColor: '#FFEDBA' }]}
          >
            <View style={s.earnIcon}>
              <ICoin size={22} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T f="bodyHeavy" size={15} color="#7A5300">
                Yana {fmt(missing)} coin · ~{lessonsFor(missing)} dars
              </T>
              <T size={13} color="#4A5468">
                Vazifa {EARN_HOMEWORK}, dars yakuni +{EARN_LESSON_DONE}
              </T>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#FFFFFF',
                  overflow: 'hidden',
                  marginTop: 4,
                }}
              >
                <View
                  style={{
                    width: `${pct}%`,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#F5B70A',
                  }}
                />
              </View>
            </View>
            <IChevron color="#7A5300" />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <View
          style={{
            height: 1,
            backgroundColor: '#EEF1F7',
            marginHorizontal: -22,
          }}
        />
        {!!error && (
          <T accessibilityRole="text" size={13} color="#B42318" style={{ textAlign: 'center' }}>
            {error}
          </T>
        )}
        {missing > 0 ? (
          <LockedButton label={`${fmt(missing)} coin yetishmayapti`} />
        ) : (
          <DButton label={`Buyurtma berish · ${fmt(p.price)} coin`} height={56} onPress={submit} disabled={busy} style={[{ borderRadius: 18 }, busy && { opacity: 0.6 }]} />
        )}
        <T size={14} lh={20.3} color="#4A5468" style={{ textAlign: 'center' }}>
          {missing > 0 ? 'Manzil saqlanadi — coin yetganda bir bosishda buyurtma berasiz' : 'Manzil saqlanadi — keyingi buyurtmada qayta yozish shart emas'}
        </T>
      </View>
    </DesktopPage>
  );
}

function Coins({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <ICoin size={16} />
      <T f="bodyHeavy" size={15}>
        {fmt(n)}
      </T>
    </View>
  );
}

const s = StyleSheet.create({
  form: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 30,
    gap: 22,
  },
  formIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 56,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E2E6EE',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontFamily: fonts.bodyBold,
    fontWeight: 'normal',
    fontSize: 16,
    color: '#0B1220',
    outlineStyle: 'none',
  } as never,
  recipient: {
    backgroundColor: '#F4F6FA',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  free: {
    backgroundColor: '#E3F7EE',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  step: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F4F6FA',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aside: {
    width: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  thumb: {
    width: 100,
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    backgroundColor: '#F4F6FA',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  earn: {
    backgroundColor: '#FFF4D1',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  earnIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
