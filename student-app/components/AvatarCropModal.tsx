import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

const FRAME_SIZE = 260;
const OUTPUT_SIZE = 480;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type Props = {
  visible: boolean;
  imageUri: string | null;
  onConfirm: (croppedUri: string) => void;
  onCancel: () => void;
};

export function AvatarCropModal({ visible, imageUri, onConfirm, onCancel }: Props) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!imageUri) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize(null);
    if (typeof window === 'undefined') return;
    const img = new window.Image();
    img.onload = () => setNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.src = imageUri;
  }, [imageUri]);

  // "cover" bazaviy shkala — rasm FRAME_SIZE'ni to'liq qoplashi uchun kerakli minimal kattalashtirish.
  const baseCoverScale = naturalSize ? Math.max(FRAME_SIZE / naturalSize.width, FRAME_SIZE / naturalSize.height) : 1;
  const effectiveScale = baseCoverScale * zoom;
  const displayedW = naturalSize ? naturalSize.width * effectiveScale : FRAME_SIZE;
  const displayedH = naturalSize ? naturalSize.height * effectiveScale : FRAME_SIZE;
  const maxOffsetX = Math.max(0, (displayedW - FRAME_SIZE) / 2);
  const maxOffsetY = Math.max(0, (displayedH - FRAME_SIZE) / 2);

  const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          offsetAtDragStart.current = offset;
          dragStart.current = { x: 0, y: 0 };
        },
        onPanResponderMove: (_evt, gesture) => {
          setOffset({
            x: clamp(offsetAtDragStart.current.x + gesture.dx, maxOffsetX),
            y: clamp(offsetAtDragStart.current.y + gesture.dy, maxOffsetY),
          });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxOffsetX, maxOffsetY, offset]
  );

  const changeZoom = (delta: number) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((zoom + delta) * 10) / 10));
    setZoom(next);
    const nextScale = baseCoverScale * next;
    const nextW = naturalSize ? naturalSize.width * nextScale : FRAME_SIZE;
    const nextH = naturalSize ? naturalSize.height * nextScale : FRAME_SIZE;
    const nextMaxX = Math.max(0, (nextW - FRAME_SIZE) / 2);
    const nextMaxY = Math.max(0, (nextH - FRAME_SIZE) / 2);
    setOffset((o) => ({ x: clamp(o.x, nextMaxX), y: clamp(o.y, nextMaxY) }));
  };

  const confirm = () => {
    if (!imageUri || !naturalSize || typeof document === 'undefined') {
      if (imageUri) onConfirm(imageUri);
      return;
    }
    const sourceImg = new window.Image();
    sourceImg.crossOrigin = 'anonymous';
    sourceImg.onload = () => {
      // Kadr ichida ko'rinayotgan hudud — avval ekrandagi (displayed) piksellarda, keyin manba rasm piksellariga o'giriladi.
      const visibleLeftDisplayed = (displayedW - FRAME_SIZE) / 2 - offset.x;
      const visibleTopDisplayed = (displayedH - FRAME_SIZE) / 2 - offset.y;
      const sourceX = visibleLeftDisplayed / effectiveScale;
      const sourceY = visibleTopDisplayed / effectiveScale;
      const sourceSize = FRAME_SIZE / effectiveScale;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onConfirm(imageUri);
        return;
      }
      ctx.drawImage(sourceImg, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      onConfirm(canvas.toDataURL('image/jpeg', 0.88));
    };
    sourceImg.onerror = () => onConfirm(imageUri);
    sourceImg.src = imageUri;
  };

  if (!imageUri) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Text style={styles.title}>Rasmni moslashtiring</Text>
        <Text style={styles.subtitle}>Suring va kattalashtiring, so'ng tasdiqlang</Text>

        <View style={styles.frameWrap} {...panResponder.panHandlers}>
          <Image
            source={{ uri: imageUri }}
            style={[
              styles.image,
              {
                width: displayedW,
                height: displayedH,
                transform: [{ translateX: offset.x }, { translateY: offset.y }],
              },
            ]}
            resizeMode="cover"
          />
        </View>

        <View style={styles.zoomRow}>
          <Pressable style={styles.zoomBtn} onPress={() => changeZoom(-0.2)} hitSlop={8}>
            <Ionicons name="remove" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <Pressable style={styles.zoomBtn} onPress={() => changeZoom(0.2)} hitSlop={8}>
            <Ionicons name="add" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Bekor qilish</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={confirm}>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Tasdiqlash</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontFamily: theme.fonts.bold, fontSize: 17, color: '#fff' },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, marginBottom: 20 },
  frameWrap: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: FRAME_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#fff',
  },
  image: { position: 'absolute', top: '50%', left: '50%', marginLeft: -FRAME_SIZE / 2, marginTop: -FRAME_SIZE / 2 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 22 },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLabel: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: '#fff', minWidth: 48, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 28, width: '100%', maxWidth: 320 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  cancelBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
