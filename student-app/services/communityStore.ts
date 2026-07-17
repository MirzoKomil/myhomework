import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import { profileStats } from '@/data/mock';
import { addCoins } from '@/services/coinsStore';
import { useAvatarUri } from '@/services/avatarStore';

// Hamjamiyat (Community) — ilgari faqat qurilma xotirasida (AsyncStorage)
// yashagan postlar endi serverda saqlanadi: bitta umumiy lenta, namuna
// o'quvchi ilovadan va CRM administratori bir xil ko'radi, admin istalgan
// post/izohni o'chira oladi.
const API_BASE =
  Platform.OS === 'web'
    ? '/api/state/community'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/community';

const UPLOAD_BASE =
  Platform.OS === 'web'
    ? '/api/upload/community-image'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/upload/community-image';

export type CommunityComment = {
  id: string;
  postId: string;
  parentId: string | null;
  authorName: string;
  authorEmoji: string;
  createdAt: number;
  text: string;
  likeCount: number;
  likedByMe: boolean;
  me?: boolean;
};

export type CommunityPost = {
  id: string;
  authorName: string;
  authorEmoji: string;
  createdAt: number;
  text: string;
  imageUri?: string | null;
  likeCount: number;
  likedByMe: boolean;
  shareCount: number;
  viewCount: number;
  comments: CommunityComment[];
  me?: boolean;
  official?: boolean;
};

// Server javob bermaguncha ekranda ko'rsatiladigan boshlang'ich ko'rinish —
// birinchi haqiqiy fetch tugagach haqiqiy ma'lumot bilan almashtiriladi.
const FALLBACK_POSTS: CommunityPost[] = [
  {
    id: 'p0',
    authorName: 'Homework.uz jamoasi',
    authorEmoji: '📢',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    text: "Assalomu alaykum, aziz o'quvchilar! Yangi 'Speaking Battle' rejimi ilovaga qo'shildi — endi boshqa o'quvchilar bilan jonli musobaqalasha olasiz. Sinab ko'ring! 🏆",
    imageUri: null,
    likeCount: 42,
    likedByMe: false,
    shareCount: 5,
    viewCount: 310,
    comments: [],
    official: true,
  },
];

let posts: CommunityPost[] = FALLBACK_POSTS;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// blob:/data: URI'lar faqat ularni yaratgan brauzer sessiyasida ishlaydi —
// bir marta serverga yozib qayta yuklansa (yoki boshqa qurilma/CRM'dan
// ochilsa), doim o'lik bo'ladi. addPost endi bunday URI'larni hech qachon
// saqlamaydi, lekin shu tekshiruv eski (fix'dan oldingi) postlarda qolib
// ketgan buzilgan rasm o'rniga hech narsa ko'rsatmaslikni ta'minlaydi.
export function isDisplayableImageUri(uri?: string | null): uri is string {
  return !!uri && !uri.startsWith('blob:') && !uri.startsWith('data:');
}

export function getPosts(): CommunityPost[] {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt);
}

export function getPost(postId: string): CommunityPost | undefined {
  return posts.find((p) => p.id === postId);
}

// Har chaqirilganda serverdan qayta yuklaydi (bir marta emas) — shu tufayli
// admin CRM'da bir postni yoki izohni o'chirsa, o'quvchi hamjamiyat ekraniga
// qaytganda darhol yangilangan holatni ko'radi.
export async function loadPosts(): Promise<void> {
  try {
    const res = await fetch(API_BASE);
    const data = await res.json();
    if (Array.isArray(data.posts)) posts = data.posts;
  } catch {
    // Tarmoq xatosi bo'lsa, oldingi (yoki boshlang'ich) holat saqlanib qoladi.
  } finally {
    notify();
  }
}

// Rasm tanlanganda ImagePicker qaytaradigan URI (webda blob:/data:, nativeda
// file://) faqat shu qurilma/sessiya doirasida ishlaydi — postni serverga
// yozib, keyin qayta yuklab ochsak (yoki CRM'dan ko'rsak), bu URI allaqachon
// o'lik bo'ladi. Shu sabab haqiqiy yuklashdan oldin uni serverga haqiqiy
// faylga aylantirib, doimiy /uploads/... havolasini olamiz.
async function uploadCommunityImage(imageUri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const blobResp = await fetch(imageUri);
      const blob = await blobResp.blob();
      formData.append('file', blob, 'post-image.jpg');
    } else {
      // @ts-expect-error — React Native'ning FormData'si {uri,name,type} shaklidagi
      // fayl obyektini qabul qiladi, bu web File/Blob turidan farq qiladi.
      formData.append('file', { uri: imageUri, name: 'post-image.jpg', type: 'image/jpeg' });
    }
    const res = await fetch(UPLOAD_BASE, { method: 'POST', body: formData });
    if (!res.ok) {
      console.error('uploadCommunityImage: HTTP', res.status);
      return null;
    }
    const data = await res.json();
    return data.url ?? null;
  } catch (err) {
    console.error('uploadCommunityImage failed:', err);
    return null;
  }
}

// Rasm biriktirilgan bo'lsa-yu, yuklash muvaffaqiyatsiz bo'lsa, buni chaqiruvchiga
// bildiramiz (imageUploadFailed=true) — avval bu holat sukut saqlab, rasmsiz
// post yuborilib, foydalanuvchi hech qanday xabar ko'rmasdi.
export async function addPost(
  text: string,
  authorName: string,
  authorEmoji: string,
  imageUri?: string | null
): Promise<{ imageUploadFailed: boolean }> {
  let uploadedImageUrl: string | null = null;
  if (imageUri) {
    uploadedImageUrl = await uploadCommunityImage(imageUri);
  }
  const imageUploadFailed = !!imageUri && !uploadedImageUrl;
  try {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, authorName, authorEmoji, imageUri: uploadedImageUrl }),
    });
    const data = await res.json();
    if (data.post) {
      posts = [data.post, ...posts];
      notify();
    }
  } catch {
    // Post yuborilmasa jim o'tkazib yuboramiz — foydalanuvchi ekranda qoladi.
  }
  await addCoins(1);
  return { imageUploadFailed };
}

export async function toggleLikePost(postId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(postId)}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.post) {
      posts = posts.map((p) => (p.id === postId ? data.post : p));
      notify();
    }
  } catch {
    // jim o'tkazib yuboramiz
  }
}

export async function toggleLikeComment(postId: string, commentId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.comment) {
      posts = posts.map((p) =>
        p.id !== postId ? p : { ...p, comments: p.comments.map((c) => (c.id === commentId ? data.comment : c)) }
      );
      notify();
    }
  } catch {
    // jim o'tkazib yuboramiz
  }
}

export async function addComment(postId: string, text: string, parentId: string | null): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parentId, authorName: profileStats.name.split(' ')[0], authorEmoji: '🙂' }),
    });
    const data = await res.json();
    if (data.comment) {
      posts = posts.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, data.comment] } : p));
      notify();
    }
  } catch {
    // jim o'tkazib yuboramiz
  }
}

export function usePosts(): CommunityPost[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadPosts().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return getPosts();
}

export function usePost(postId: string): CommunityPost | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    loadPosts().then(() => setTick((t) => t + 1));
    return subscribe(() => setTick((t) => t + 1));
  }, [postId]);
  return getPost(postId);
}

export function useMyIdentity(): { name: string; emoji: string; avatarUri: string | null } {
  const avatarUri = useAvatarUri();
  return { name: profileStats.name, emoji: '🙂', avatarUri };
}

export type CommunityActivity = {
  likes: { postId: string; postText: string; likeCount: number }[];
  comments: { postId: string; postText: string; authorName: string; authorEmoji: string; text: string }[];
  replies: { postId: string; myCommentText: string; authorName: string; authorEmoji: string; text: string }[];
  hasActivity: boolean;
};

export function useCommunityActivity(): CommunityActivity {
  const posts = usePosts();

  const myPosts = posts.filter((p) => p.me);
  const likes = myPosts.map((p) => ({ postId: p.id, postText: p.text, likeCount: p.likeCount }));

  const comments: CommunityActivity['comments'] = [];
  myPosts.forEach((p) => {
    p.comments.forEach((c) => {
      if (!c.me) comments.push({ postId: p.id, postText: p.text, authorName: c.authorName, authorEmoji: c.authorEmoji, text: c.text });
    });
  });

  const myCommentIds = new Set<string>();
  posts.forEach((p) => p.comments.forEach((c) => c.me && myCommentIds.add(c.id)));

  const replies: CommunityActivity['replies'] = [];
  posts.forEach((p) => {
    p.comments.forEach((c) => {
      if (c.parentId && myCommentIds.has(c.parentId) && !c.me) {
        const myComment = p.comments.find((mc) => mc.id === c.parentId);
        replies.push({ postId: p.id, myCommentText: myComment?.text ?? '', authorName: c.authorName, authorEmoji: c.authorEmoji, text: c.text });
      }
    });
  });

  const hasActivity = likes.some((l) => l.likeCount > 0) || comments.length > 0 || replies.length > 0;

  return { likes, comments, replies, hasActivity };
}

export function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  if (minutes < 1) return 'hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  if (hours < 24) return `${hours} soat oldin`;
  if (days < 30) return `${days} kun oldin`;
  return `${months} oy oldin`;
}
