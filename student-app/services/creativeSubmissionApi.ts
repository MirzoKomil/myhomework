import { Platform } from 'react-native';

import { authedFetch } from '@/services/contentApi';

// 148-ish: video/speaking darslardagi "Ijodiy vazifa" — matn/audio/rasm
// haqiqiy serverga yuboriladi va ustoz kabinetida qabul qilinmaguncha
// "kutilmoqda" holatida turadi (avval hech qanday tekshiruvsiz 4 soniyada
// avtomatik "baholanardi").
const API_BASE =
  Platform.OS === 'web'
    ? '/api/state/creative-submissions'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/state/creative-submissions';

const UPLOAD_BASE =
  Platform.OS === 'web'
    ? '/api/upload/creative-submission'
    : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myhomework.uz') + '/api/upload/creative-submission';

export type CreativeSubmissionStatus = 'pending' | 'graded';

export type CreativeSubmissionRecord = {
  lessonId: string;
  lessonTitle: string;
  category: 'video' | 'speaking';
  mediaType: 'text' | 'audio';
  text: string;
  imageUrl: string | null;
  audioUrl: string | null;
  status: CreativeSubmissionStatus;
  scorePercent: number | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
};

// ImagePicker/expo-audio qaytaradigan URI (webda blob:, nativeda file://)
// faqat shu qurilma/sessiya doirasida ishlaydi — serverga haqiqiy faylga
// aylantirib doimiy /uploads/... havolasini olamiz (community rasm yuklash
// bilan bir xil pattern).
async function uploadCreativeMedia(uri: string, kind: 'image' | 'audio'): Promise<string | null> {
  try {
    const formData = new FormData();
    const fileName = kind === 'image' ? 'creative-image.jpg' : 'creative-audio.m4a';
    const mimeType = kind === 'image' ? 'image/jpeg' : 'audio/m4a';
    if (Platform.OS === 'web') {
      const blobResp = await fetch(uri);
      const blob = await blobResp.blob();
      formData.append('file', blob, fileName);
    } else {
      // @ts-expect-error — React Native'ning FormData'si {uri,name,type} shaklidagi
      // fayl obyektini qabul qiladi, bu web File/Blob turidan farq qiladi.
      formData.append('file', { uri, name: fileName, type: mimeType });
    }
    const res = await fetch(UPLOAD_BASE, { method: 'POST', body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

export async function fetchCreativeSubmission(lessonId: string): Promise<CreativeSubmissionRecord | null> {
  try {
    const res = await authedFetch(API_BASE);
    const all = await res.json();
    return all?.[lessonId] ?? null;
  } catch {
    return null;
  }
}

export async function submitCreativeSubmission(params: {
  lessonId: string;
  lessonTitle: string;
  category: 'video' | 'speaking';
  mediaType: 'text' | 'audio';
  text?: string;
  imageUri?: string | null;
  audioUri?: string | null;
}): Promise<CreativeSubmissionRecord | null> {
  const imageUrl = params.imageUri ? await uploadCreativeMedia(params.imageUri, 'image') : null;
  const audioUrl = params.audioUri ? await uploadCreativeMedia(params.audioUri, 'audio') : null;
  try {
    const res = await authedFetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: params.lessonId,
        lessonTitle: params.lessonTitle,
        category: params.category,
        mediaType: params.mediaType,
        text: params.text || '',
        imageUrl,
        audioUrl,
      }),
    });
    const data = await res.json();
    return data.record ?? null;
  } catch {
    return null;
  }
}
