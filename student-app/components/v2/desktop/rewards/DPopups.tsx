/**
 * Kompyuter popup kartalari (dizayn: D_LevelUp, D_OrderSuccess,
 * D_StreakConfirm, D_StreakLost). Mantiq, raqamlar va havolalar mobil popup
 * komponentlarida qoladi — bu yerga tayyor qiymatlar va bosish funksiyalari
 * keladi. "Namuna: …" belgilari o'quvchiga ko'rsatilmaydi (egasi qarori, mobil kabi).
 * Klaviatura: Esc — yopish.
 */
import type { ReactNode } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Bounce, Pop } from '@/components/v2/motion';
import { fmt } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';

import { caps, CloseBtn, DButton, DPopup, IBolt, ICheck, IClose, ICoin, IFlame, InfoBox, IShield, LockedButton, T } from './ui';

const IArrowRight = ({ size = 16, color = '#4A5468', sw = 2.4 }: { size?: number; color?: string; sw?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

const strike = Platform.OS === 'web' ? ({ textDecorationLine: 'line-through' } as const) : ({ textDecorationLine: 'line-through' } as const);

function TopClose({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
      <CloseBtn onPress={onClose} />
    </View>
  );
}

function PriceVal({ price }: { price: number }) {
  return (
    <T f="bodyHeavy" size={15}>
      <T f="bodyHeavy" size={15} color="#B42318">
        −{fmt(price)}
      </T>{' '}
      coin
    </T>
  );
}

function BalanceVal({ from, to }: { from: number; to: number }) {
  return (
    <>
      <T size={15} color="#4A5468" style={strike}>
        {fmt(from)}
      </T>
      <IArrowRight />
      <ICoin size={16} />
      <T f="bodyHeavy" size={15}>
        {fmt(to)} coin
      </T>
    </>
  );
}

// ---------- D_LevelUp ----------

export function DLevelUpCard({
  visible,
  onClose,
  badge,
  title,
  desc,
  total,
  badgeName,
  confetti,
}: {
  visible: boolean;
  onClose: () => void;
  badge: number;
  title: string;
  desc: string;
  total: string;
  badgeName: string;
  confetti?: ReactNode;
}) {
  return (
    <DPopup visible={visible} onClose={onClose} width={520} label={title} overlay={confetti}>
      <TopClose onClose={onClose} />
      <View style={s.lvlArt}>
        <View style={s.lvlCircle} />
        <Bounce delay={100}>
          <Image source={designImages.cd192c1f07c6ae01a6b80b26d84e0ec7} accessibilityLabel="Quvonayotgan Domik" style={{ width: 170, height: 170 }} resizeMode="contain" />
        </Bounce>
        <Pop delay={420} from={0.2}>
          <Image source={badge} accessibilityLabel={`${title.split(' ')[0]}-daraja nishoni`} style={{ width: 130, height: 130 }} resizeMode="contain" />
        </Pop>
      </View>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <T f="bodyHeavy" size={13} color="#6A3CF0" style={caps(13)}>
          Yangi daraja!
        </T>
        <T f="display" size={32} lh={35} accessibilityRole="header" style={{ letterSpacing: -0.64, textAlign: 'center' }}>
          {title}
        </T>
        <T f="body" size={15} lh={22.5} color="#4A5468" style={{ textAlign: 'center' }}>
          {desc}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={s.tile}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IBolt size={19} />
            <T f="bodyHeavy" size={22}>
              {total}
            </T>
          </View>
          <T size={13} color="#4A5468">
            jami chaqmoq
          </T>
        </View>
        <View style={s.tile}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#F5B70A',
              }}
            />
            <T f="bodyHeavy" size={22} numberOfLines={1}>
              {badgeName}
            </T>
          </View>
          <T size={13} color="#4A5468">
            profil nishoni
          </T>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: 2,
        }}
      >
        <DButton label="Darajalarga qaytish" onPress={onClose} />
      </View>
    </DPopup>
  );
}

// ---------- D_OrderSuccess ----------

export function DOrderSuccessCard({ visible, onClose, price, coins }: { visible: boolean; onClose: () => void; price: number; coins: number }) {
  return (
    <DPopup visible={visible} onClose={onClose} width={540} label="Streak himoyasi sotib olindi">
      <TopClose onClose={onClose} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <Bounce delay={120}>
          <View style={[s.box, { width: 132, height: 132, backgroundColor: '#E3F7EE' }]}>
            <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} accessibilityLabel="Qalqon ushlagan Domik" style={{ width: 124, height: 124 }} resizeMode="contain" />
            <Pop delay={380} style={s.okBadge}>
              <ICheck size={19} color="#FFFFFF" sw={3} />
            </Pop>
          </View>
        </Bounce>
        <View style={{ flex: 1, gap: 6 }}>
          <T f="bodyHeavy" size={13} color="#087A4A" style={caps(13)}>
            Buyurtma tasdiqlandi
          </T>
          <T f="display" size={28} lh={31.4} accessibilityRole="header" style={{ letterSpacing: -0.56 }}>
            Streak himoyasi sotib olindi
          </T>
          <T f="body" size={15} lh={22.5} color="#4A5468">
            Dars qoldirgan kuni seriyangiz avtomatik saqlanadi. Himoya bir marta ishlaydi.
          </T>
        </View>
      </View>
      <InfoBox
        rows={[
          ['Narxi', <PriceVal key="p" price={price} />],
          ['Balans', <BalanceVal key="b" from={coins} to={coins - price} />],
          [
            'Holati',
            <View key="h" style={s.okChip}>
              <T f="bodyHeavy" size={14} color="#075E3A">
                Faol · 1 dona
              </T>
            </View>,
          ],
        ]}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <DButton label="Doʻkonga qaytish" onPress={onClose} />
      </View>
    </DPopup>
  );
}

// ---------- D_StreakConfirm ----------

export function DStreakConfirmCard({ visible, onClose, onConfirm, price, coins }: { visible: boolean; onClose: () => void; onConfirm: () => void; price: number; coins: number }) {
  const missing = Math.max(0, price - coins);
  return (
    <DPopup visible={visible} onClose={onClose} width={520} label="Streak himoyasini sotib olasizmi?">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
        <View
          style={[
            s.box,
            {
              width: 110,
              height: 110,
              borderRadius: 28,
              backgroundColor: '#E8EEFF',
            },
          ]}
        >
          <Image source={designImages.f1f2b5015be3aab0bfaac974e1e01af0} accessibilityLabel="Qalqon ushlagan Domik" style={{ width: 104, height: 104 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, paddingTop: 8 }}>
          <T f="display" size={28} lh={31.4} accessibilityRole="header" style={{ letterSpacing: -0.56 }}>
            Streak himoyasini sotib olasizmi?
          </T>
        </View>
        <CloseBtn onPress={onClose} />
      </View>
      <InfoBox
        rows={[
          ['Narxi', <PriceVal key="p" price={price} />],
          ['Balans', <BalanceVal key="b" from={coins} to={coins - price} />],
        ]}
      />
      <View style={s.note}>
        <IFlame />
        <T size={15} color="#34405A" style={{ flex: 1 }}>
          <T f="bodyHeavy" size={15} color="#B34700">
            Bir marta ishlaydi:
          </T>{' '}
          dars qoldirilgan kuni seriya saqlanadi.
        </T>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 10,
          marginTop: 2,
        }}
      >
        <DButton kind="ghost" label="Bekor qilish" onPress={onClose} />
        {missing > 0 ? (
          // Coin yetmasa — mobil kabi qulflangan tugma.
          <LockedButton label={`${fmt(missing)} coin yetishmayapti`} style={{ height: 52, borderRadius: 17, paddingHorizontal: 22 }} />
        ) : (
          <DButton kind="green" label={`Tasdiqlash · ${fmt(price)} coin`} icon={<ICoin size={18} />} onPress={onConfirm} />
        )}
      </View>
    </DPopup>
  );
}

// ---------- D_StreakLost ----------

export function DStreakLostCard({
  visible,
  onClose,
  sample,
  shieldPrice,
  onStart,
  onShop,
}: {
  visible: boolean;
  onClose: () => void;
  sample: number;
  shieldPrice: number;
  onStart: () => void;
  onShop: () => void;
}) {
  return (
    <DPopup visible={visible} onClose={onClose} width={540} label="Seriya uzildi">
      <TopClose onClose={onClose} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
        <Image
          source={designImages['78f533d49645c292f499fbc1b6168dd2']}
          accessibilityLabel="Uxlab qolgan Domik"
          style={{
            width: 150,
            height: 150,
            marginTop: -6,
            marginBottom: -6,
            marginLeft: -8,
            marginRight: -4,
          }}
          resizeMode="contain"
        />
        <View style={{ flex: 1, gap: 8 }}>
          <T f="display" size={32} lh={35} accessibilityRole="header" style={{ letterSpacing: -0.64 }}>
            Seriya uzildi
          </T>
          <View accessible accessibilityRole="image" accessibilityLabel={`Seriya ${sample} kundan 0 ga tushdi`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
            <T f="display" size={36} color="#B34700" style={[{ letterSpacing: -0.72 }, strike]}>
              {sample}
            </T>
            <View style={{ alignSelf: 'center' }}>
              <IArrowRight size={26} />
            </View>
            <T f="display" size={42} style={{ letterSpacing: -0.84 }}>
              0
            </T>
            <T f="bodyHeavy" size={18} color="#4A5468">
              kun
            </T>
          </View>
        </View>
      </View>
      <T f="body" size={15} lh={23.25} color="#4A5468">
        Kecha birorta ham dars yoki mashq boʻlmadi.{' '}
        <T f="bodyHeavy" size={15}>
          Streak himoyangiz yoʻq edi
        </T>
        , shuning uchun seriya qaytadan boshlanadi.
      </T>
      <View accessible accessibilityLabel={`Oldingi seriya: ${sample} kun`} style={s.week}>
        {Array.from({ length: sample }, (_, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 6 }}>
            <View style={[s.day, { backgroundColor: '#FFE2CC' }]}>
              <ICheck size={18} color="#B34700" sw={3} />
            </View>
            <T f="bodyHeavy" size={13} color="#4A5468">
              {i + 1}
            </T>
          </View>
        ))}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View
            style={[
              s.day,
              {
                borderWidth: 2.5,
                borderStyle: 'dashed',
                borderColor: '#B42318',
              },
            ]}
          >
            <IClose size={18} color="#B42318" sw={2.8} />
          </View>
          <T f="bodyHeavy" size={13} color="#B42318">
            {sample + 1}-kun
          </T>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginTop: 2,
        }}
      >
        <DButton
          kind="white"
          height={54}
          label={`Himoya olish · ${shieldPrice} coin`}
          icon={<IShield size={19} color="#2F5BFF" sw={2.2} />}
          onPress={onShop}
          style={{ flex: 1, flexBasis: 0, paddingHorizontal: 14 }}
        />
        <DButton height={54} label="Yangi seriyani boshlash" onPress={onStart} style={{ flex: 1, flexBasis: 0, paddingHorizontal: 14 }} />
      </View>
    </DPopup>
  );
}

const s = StyleSheet.create({
  lvlArt: {
    backgroundColor: '#6A3CF0',
    borderRadius: 22,
    height: 190,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    marginTop: -4,
  },
  lvlCircle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 300,
    height: 300,
    marginLeft: -150,
    marginTop: -150,
    borderRadius: 150,
    backgroundColor: '#7C4DFF',
  },
  tile: {
    flex: 1,
    flexBasis: 0,
    backgroundColor: '#F4F6FA',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
  },
  box: { borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  okBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#087A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  okChip: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#E3F7EE',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF1E6',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  week: {
    backgroundColor: '#F4F6FA',
    borderRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
