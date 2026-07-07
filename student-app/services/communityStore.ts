import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { profileStats } from '@/data/mock';
import { addCoins } from '@/services/coinsStore';
import { useAvatarUri } from '@/services/avatarStore';

const POSTS_KEY = 'mh_community_posts';

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

const SEED_POSTS: CommunityPost[] = [
  {
    id: 'p0',
    authorName: 'Homework.uz jamoasi',
    authorEmoji: '📢',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
    text: "Assalomu alaykum, aziz o'quvchilar! Yangi 'Speaking Battle' rejimi ilovaga qo'shildi — endi boshqa o'quvchilar bilan jonli musobaqalasha olasiz. Sinab ko'ring! 🏆",
    imageUri: null,
    likeCount: 42,
    likedByMe: false,
    shareCount: 5,
    viewCount: 310,
    comments: [],
    official: true,
  },
  {
    id: 'p1',
    authorName: 'Azizbek',
    authorEmoji: '🧑',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    text: "Bugun Present Perfect mavzusini yakunladim! Dastlab juda chalkash tuyulgan edi, lekin videodarslardagi misollar juda yordam berdi 💪",
    imageUri: null,
    likeCount: 14,
    likedByMe: false,
    shareCount: 1,
    viewCount: 86,
    comments: [
      {
        id: 'c1',
        postId: 'p1',
        parentId: null,
        authorName: 'Zarina',
        authorEmoji: '👩',
        createdAt: Date.now() - 1000 * 60 * 60 * 20,
        text: 'Zo\'r! Menga ham shu mavzu ancha qiyin bo\'lgandi 😄',
        likeCount: 3,
        likedByMe: false,
      },
      {
        id: 'c2',
        postId: 'p1',
        parentId: 'c1',
        authorName: 'Azizbek',
        authorEmoji: '🧑',
        createdAt: Date.now() - 1000 * 60 * 60 * 18,
        text: 'Rahmat! Ha, mashq qilgan sari osonlashadi',
        likeCount: 1,
        likedByMe: false,
      },
    ],
  },
  {
    id: 'p2',
    authorName: 'Madina',
    authorEmoji: '👩‍🦱',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    text: "So'zlar ro'yxatidagi yangi 20 ta so'zni yodladim. Kim menga hamroh bo'lib, birga mashq qilishni xohlaydi? 📚",
    imageUri: null,
    likeCount: 9,
    likedByMe: false,
    shareCount: 0,
    viewCount: 54,
    comments: [
      {
        id: 'c3',
        postId: 'p2',
        parentId: null,
        authorName: 'Diyor',
        authorEmoji: '🧑‍🦰',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
        text: 'Men ham qo\'shilaman!',
        likeCount: 2,
        likedByMe: false,
      },
    ],
  },
  {
    id: 'p3',
    authorName: 'Sardor',
    authorEmoji: '🧔',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    text: "Speaking Battle'da birinchi marta g'alaba qozondim! Juda qiziqarli o'yin ekan 🏆",
    imageUri: null,
    likeCount: 21,
    likedByMe: false,
    shareCount: 2,
    viewCount: 130,
    comments: [
      {
        id: 'c4',
        postId: 'p3',
        parentId: null,
        authorName: 'Gulnoza',
        authorEmoji: '🧕',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
        text: "Tabriklayman! 🎉",
        likeCount: 4,
        likedByMe: false,
      },
      {
        id: 'c5',
        postId: 'p3',
        parentId: null,
        authorName: 'Kamila',
        authorEmoji: '👱‍♀️',
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
        text: 'Men ham urinib ko\'raman',
        likeCount: 1,
        likedByMe: false,
      },
    ],
  },
];

let posts: CommunityPost[] = SEED_POSTS;
let loaded = false;
let loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(POSTS_KEY)
      .then((raw) => {
        if (raw) posts = JSON.parse(raw);
      })
      .catch(() => {})
      .finally(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch {
    // Xotiraga yozib bo'lmasa jim o'tkazib yuboramiz.
  }
}

export function getPosts(): CommunityPost[] {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt);
}

export function getPost(postId: string): CommunityPost | undefined {
  return posts.find((p) => p.id === postId);
}

export async function loadPosts(): Promise<void> {
  await ensureLoaded();
  notify();
}

export async function addPost(text: string, authorName: string, authorEmoji: string, imageUri?: string | null): Promise<void> {
  await ensureLoaded();
  const post: CommunityPost = {
    id: `me-${Date.now()}`,
    authorName,
    authorEmoji,
    createdAt: Date.now(),
    text,
    imageUri: imageUri ?? null,
    likeCount: 0,
    likedByMe: false,
    shareCount: 0,
    viewCount: 0,
    comments: [],
    me: true,
  };
  posts = [post, ...posts];
  notify();
  await persist();
  await addCoins(1);
}

export async function toggleLikePost(postId: string): Promise<void> {
  await ensureLoaded();
  posts = posts.map((p) =>
    p.id === postId ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) } : p
  );
  notify();
  await persist();
}

export async function toggleLikeComment(postId: string, commentId: string): Promise<void> {
  await ensureLoaded();
  posts = posts.map((p) =>
    p.id !== postId
      ? p
      : {
          ...p,
          comments: p.comments.map((c) =>
            c.id === commentId ? { ...c, likedByMe: !c.likedByMe, likeCount: c.likeCount + (c.likedByMe ? -1 : 1) } : c
          ),
        }
  );
  notify();
  await persist();
}

export async function addComment(postId: string, text: string, parentId: string | null): Promise<void> {
  await ensureLoaded();
  const comment: CommunityComment = {
    id: `me-c-${Date.now()}`,
    postId,
    parentId,
    authorName: profileStats.name.split(' ')[0],
    authorEmoji: '🙂',
    createdAt: Date.now(),
    text,
    likeCount: 0,
    likedByMe: false,
    me: true,
  };
  posts = posts.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p));
  notify();
  await persist();
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
