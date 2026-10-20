/**
 * Kompyuter: o'tgan hafta natijasi (dizayn: D_LeagueResult) — Liga sahifasi
 * ustida markazdagi karta. Haftalik liga natijalari serverda saqlanmaydi —
 * mobil ekrandagi kabi bo'sh (0) holat: "Natija hali yoʻq", —, 0, +0.
 * Hafta oralig'i haqiqiy sanadan. Klaviatura: Esc — yopish.
 */
import { router, type Href } from 'expo-router';
import { Image, Share, StyleSheet, View } from 'react-native';

import { goBack, lastWeekLabel, TIERS } from '@/components/v2/rewards/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';

import { DLeaderboard } from './DLeaderboard';
import { caps, CloseBtn, DButton, DPopup, IArrowUp, IBolt, ICoin, IShare, T } from './ui';

// Liga tizimi serverda yo'q: hamma Bronza'da, natija 0 (mobil kabi).
const CURRENT = TIERS[0];
const NEXT = TIERS[1];

export function DLeagueResult() {
  const week = lastWeekLabel();
  const close = () => goBack(R.league);
  const share = () => {
    Share.share({
      message: `Domwork · ${CURRENT.name} liga. Oʻtgan hafta (${week}) natijasi hali yoʻq.`,
    }).catch(() => {});
  };

  return (
    <>
      <DLeaderboard />
      <DPopup visible onClose={close} width={540} label="Natija hali yoʻq">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <T f="bodyHeavy" size={12} color="#4A5468" style={caps()}>
            Oʻtgan hafta · {week}
          </T>
          <CloseBtn onPress={close} />
        </View>
        <View style={s.art}>
          <View style={s.circle} />
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${CURRENT.name} ligadan ${NEXT.name} ligaga`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}
          >
            <View style={[s.chip, { backgroundColor: '#263048' }]}>
              <T f="bodyHeavy" size={14} color="#E7C9A5">
                {CURRENT.name}
              </T>
            </View>
            <Image
              source={designImages.e91544c14ad5b2b62bbbe447f02474b2}
              accessibilityLabel="Kubok koʻtargan Domik"
              style={{ width: 150, height: 150, marginTop: 8 }}
              resizeMode="contain"
            />
            <View style={[s.chip, { backgroundColor: '#E6EAF2', gap: 6 }]}>
              <IArrowUp size={15} sw={2.8} />
              <T f="bodyHeavy" size={14}>
                {NEXT.name}
              </T>
            </View>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <T f="display" size={32} lh={35} accessibilityRole="header" style={{ letterSpacing: -0.64, textAlign: 'center' }}>
            Natija hali yoʻq
          </T>
          <T f="body" size={15} lh={22.5} color="#4A5468" style={{ textAlign: 'center' }}>
            Haftalik liga natijalari hali hisoblanmayapti. Haftani {CURRENT.name} ligada boshlaysiz — top 5 {NEXT.name} ligaga chiqadi.
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={s.stat}>
            <T f="bodyHeavy" size={22} color="#8A4B12">
              —
            </T>
            <T size={13} color="#4A5468">
              {CURRENT.name} liga
            </T>
          </View>
          <View style={s.stat}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <IBolt size={18} />
              <T f="bodyHeavy" size={22} color="#6A3CF0">
                0
              </T>
            </View>
            <T size={13} color="#4A5468">
              chaqmoq
            </T>
          </View>
          <View style={s.stat}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <ICoin size={20} />
              <T f="bodyHeavy" size={22} color="#7A5300">
                +0
              </T>
            </View>
            <T size={13} color="#4A5468">
              bonus coin
            </T>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 4,
          }}
        >
          <DButton kind="white" label="Natijani ulashish" icon={<IShare />} onPress={share} />
          <View style={{ flex: 1 }} />
          <DButton label={`${CURRENT.name} ligaga qaytish`} onPress={() => router.replace(R.league as Href)} />
        </View>
      </DPopup>
    </>
  );
}

const s = StyleSheet.create({
  art: {
    backgroundColor: '#0B1220',
    borderRadius: 22,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: -6,
  },
  circle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 260,
    height: 260,
    marginLeft: -130,
    marginTop: -130,
    borderRadius: 130,
    backgroundColor: '#141D30',
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 2,
  },
});
