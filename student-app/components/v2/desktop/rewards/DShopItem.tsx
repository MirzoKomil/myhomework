/**
 * Kompyuter: Kitob sahifasi (dizayn: D_ShopItem).
 *
 * Mahsulot mobil ekrandagi manbadan (useShopProducts — kursdagi kitoblar).
 * Tavsif, afzalliklar, sahifalar rasmlari va bet soni — CRM'da kiritilgan
 * bo'lsa chiqadi; bo'lmagan qiymat "—". Buyurtma oqimi o'zgarmagan:
 * coin yetsa — Checkout, yetmasa — manzilni oldindan kiritish havolasi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DesktopPage } from '@/components/v2/desktop/Shell';
import { fmt, lessonsFor, productDescription, productImages, useShopProducts, type ShopProductV2 } from '@/components/v2/rewards/parts';
import { ProductCover } from '@/components/v2/rewards/shopParts';
import { R } from '@/constants/v2/routes';
import { useCoins } from '@/services/coinsStore';

import { caps, DButton, HeaderButton, IBag, ICheck, IChevron, ICoin, ITruck, IZoom, LockedButton, T, webShadow } from './ui';

// Muqova foni (CRM bermasa) — mobil ekrandagi qiymat.
const HERO_BG = '#E1DAD4';
const THUMB_BG = '#EAE4DF';

const go = (href: string) => router.push(href as Href);

export function DShopItem() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const products = useShopProducts();
  const coins = useCoins();
  const p = products?.find((x) => x.id === itemId);
  const ordersBtn = <HeaderButton label="Buyurtmalarim" icon={<IBag />} onPress={() => go(R.orders)} />;

  if (!products)
    return (
      <DesktopPage title="" back={R.shop}>
        {null}
      </DesktopPage>
    );
  if (!p) {
    return (
      <DesktopPage title="Mahsulot" back={R.shop} actions={ordersBtn}>
        <T f="body" size={16} color="#4A5468">
          Mahsulot topilmadi.
        </T>
      </DesktopPage>
    );
  }

  const images = productImages(p);
  const missing = Math.max(0, p.price - coins);
  const desc = productDescription(p);
  const pct = Math.round(Math.max(0, Math.min(1, coins / Math.max(1, p.price))) * 100);
  const bg = p.coverBg ?? HERO_BG;
  const isBook = p.category === 'books';
  const openViewer = (i = 0) => images.length && go(`${R.imageViewer(p.id)}${i ? `?i=${i}` : ''}`);
  const others = products
    .filter((x) => x.id !== p.id)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);
  const specs: [string, string][] = [
    ['Hajmi', p.pages ? `${p.pages} bet` : '—'],
    ['Format', isBook ? 'Bosma kitob' : '—'],
    // Mavzular soni CRM'da alohida maydon emas — bo'sh holat.
    ['Mavzular', '—'],
    ['Yetkazish', p.delivered ? 'Bepul' : '—'],
  ];

  return (
    <DesktopPage
      title={isBook ? 'Kitob' : 'Mahsulot'}
      subtitle={isBook ? 'Doʻkon · qoʻshimcha kitoblar' : 'Doʻkon'}
      back={R.shop}
      actions={ordersBtn}
      contentStyle={{
        flex: 1,
        paddingBottom: 32,
        flexDirection: 'row',
        gap: 32,
      }}
    >
      <View style={{ width: 540, gap: 14 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rasmni kattalashtirish"
          disabled={!images.length}
          onPress={() => openViewer(0)}
          style={[s.hero, { backgroundColor: bg }]}
        >
          <ProductCover product={p} size={520} bg={bg} fade={0.12} iconSize={140} />
          {images.length > 0 && (
            <>
              <View style={[s.pill, { left: 18, paddingHorizontal: 16, gap: 8 }]}>
                <IZoom />
                <T f="bodyHeavy" size={14}>
                  Kattalashtirish uchun bosing
                </T>
              </View>
              <View style={[s.pill, { right: 18, paddingHorizontal: 16, gap: 6 }]}>
                {images.map((_, i) => (
                  <View key={i} accessibilityLabel={i === 0 ? 'Muqova' : `Ichki sahifa ${i}`} style={[s.dot, i === 0 && s.dotOn]} />
                ))}
              </View>
            </>
          )}
        </Pressable>
        {images.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {images.slice(0, 3).map((uri, i) => (
              <Pressable
                key={uri + i}
                accessibilityRole="link"
                accessibilityLabel={i === 0 ? 'Muqova' : `Ichki sahifa ${i}`}
                onPress={() => openViewer(i)}
                style={[s.thumb, { backgroundColor: i === 0 ? bg : THUMB_BG }, i === 0 && webShadow('inset 0 0 0 2px #0B1220')]}
              >
                <Image source={{ uri }} style={{ width: 100, height: 100 }} resizeMode="contain" />
              </Pressable>
            ))}
            {Array.from({ length: Math.max(0, 3 - images.length) }, (_, k) => (
              <View key={`e${k}`} style={{ flex: 1 }} />
            ))}
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 18 }}>
        <View style={{ gap: 6 }}>
          {isBook && (
            <T f="bodyHeavy" size={12} color="#4A5468" style={caps()}>
              Qoʻshimcha kitob · bosma
            </T>
          )}
          <T f="display" size={40} lh={42} accessibilityRole="header" style={{ letterSpacing: -0.8 }}>
            {p.name}
          </T>
          {!!desc && (
            <T f="body" size={16} lh={23} color="#4A5468">
              {desc}
            </T>
          )}
        </View>
        {!!p.features?.length && (
          <View style={{ gap: 10 }}>
            {p.features.map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={s.tick}>
                  <ICheck size={15} color="#087A4A" sw={3} />
                </View>
                <T size={16} style={{ flex: 1 }}>
                  {f}
                </T>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {specs.map(([l, v]) => (
            <View key={l} style={s.spec}>
              <T size={13} color="#4A5468">
                {l}
              </T>
              <T f="bodyHeavy" size={15}>
                {v}
              </T>
            </View>
          ))}
        </View>
        <View style={s.price}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ICoin size={34} />
              <T f="display" size={36} lh={40} style={{ letterSpacing: -0.36 }}>
                {fmt(p.price)}
              </T>
            </View>
            <T size={16} color="#4A5468">
              Sizda{' '}
              <T f="bodyBold" size={16}>
                {fmt(coins)}
              </T>
            </T>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={s.track}>
            <View style={[s.fill, { width: `${pct}%` }]} />
          </View>
          <T f="bodyHeavy" size={15} color="#7A5300">
            {missing > 0 ? `yana ${fmt(missing)} coin · ~${lessonsFor(missing)} dars` : 'Coin yetarli — buyurtma bera olasiz'}
          </T>
          {missing > 0 && (
            <Pressable
              accessibilityRole="link"
              onPress={() => go(R.checkout(p.id))}
              style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.addr, hovered && { backgroundColor: '#EEF1F7' }]}
            >
              <ITruck />
              <T f="bodyHeavy" size={15} style={{ flex: 1 }}>
                Yetkazish manzilini oldindan kiriting
              </T>
              <IChevron />
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          {missing > 0 ? (
            <LockedButton label={`${fmt(missing)} coin yetishmayapti`} style={{ flex: 1 }} />
          ) : (
            <DButton label="Buyurtma berish" height={56} onPress={() => go(R.checkout(p.id))} style={{ flex: 1, borderRadius: 18 }} />
          )}
          <Pressable accessibilityRole="link" onPress={() => go(R.shop)} style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [hovered && { opacity: 0.75 }]}>
            <T f="bodyHeavy" size={15} color="#1E3FD1" numberOfLines={1}>
              Coin qanday yigʻiladi?
            </T>
          </Pressable>
        </View>
        <View style={{ flex: 1 }} />
        {others.length > 0 && (
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <T f="bodyHeavy" size={16}>
                Boshqa kitoblar
              </T>
              <Pressable accessibilityRole="link" onPress={() => go(R.shop)}>
                <T f="bodyHeavy" size={14} color="#1E3FD1">
                  Doʻkonga qaytish
                </T>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {others.map((o) => (
                <MiniBook key={o.id} p={o} />
              ))}
              {Array.from({ length: 3 - others.length }, (_, k) => (
                <View key={`e${k}`} style={{ flex: 1 }} />
              ))}
            </View>
          </View>
        )}
      </View>
    </DesktopPage>
  );
}

function MiniBook({ p }: { p: ShopProductV2 }) {
  const uri = productImages(p)[0];
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${p.name}, ${fmt(p.price)} coin`}
      onPress={() => go(R.shopItem(p.id))}
      style={({ hovered }: { hovered?: boolean; pressed: boolean }) => [s.mini, hovered && { backgroundColor: '#FAFBFD' }]}
    >
      <View style={s.miniImg}>{uri ? <Image source={{ uri }} style={{ width: 52, height: 52 }} resizeMode="contain" /> : null}</View>
      <View style={{ gap: 2, minWidth: 0, flexShrink: 1 }}>
        <T f="bodyHeavy" size={14} numberOfLines={1} ellipsizeMode="clip">
          {p.name}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <ICoin size={13} />
          <T f="bodyHeavy" size={13} color="#4A5468">
            {fmt(p.price)}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: {
    flex: 1,
    minHeight: 0,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    bottom: 18,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A9B3C8' },
  dotOn: { width: 22, backgroundColor: '#0B1220' },
  thumb: {
    flex: 1,
    height: 104,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F7EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spec: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  price: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 22,
    gap: 12,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EEF1F7',
    overflow: 'hidden',
  },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#F5B70A' },
  addr: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F4F6FA',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mini: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    overflow: 'hidden',
  },
  miniImg: {
    width: 46,
    height: 52,
    borderRadius: 12,
    backgroundColor: THUMB_BG,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
