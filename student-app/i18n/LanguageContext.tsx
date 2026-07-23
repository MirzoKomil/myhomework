import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { fetchDemoStudentProfile } from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';
import { translations, AppLang, TranslationKey } from './translations';

const LANG_KEY = 'mh_student_lang';

// 40-vazifa: CRM'ning "Ilovani ko'rish" preview'i /student/?lang=russian
// (yoki ?lang=english) ko'rinishida ochilganda, admin qaysi tilni tanlagan
// bo'lsa o'sha til ko'rsatiladi — bu tanlov boshqa hech narsa (haqiqiy
// o'quvchi yoki namuna o'quvchi kursi tili) tomonidan bekor qilinmaydi.
function readQueryLang(): AppLang | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = (params.get('lang') || '').toLowerCase();
    if (v === 'russian' || v === 'ru') return 'ru';
    if (v === 'english' || v === 'uz') return 'uz';
  } catch {
    // ignore
  }
  return null;
}

type Ctx = {
  lang: AppLang;
  setLang: (l: AppLang) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<Ctx>({
  lang: 'uz',
  setLang: () => {},
  t: (key) => translations.uz[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>('uz');
  const { student, token } = useAuth();
  // URL orqali aniq til tanlangan bo'lsa, boshqa manbalar (real o'quvchi,
  // namuna o'quvchi) uni bekor qilmasligi kerak.
  const queryOverride = useRef<AppLang | null>(null);

  useEffect(() => {
    queryOverride.current = readQueryLang();
  }, []);

  // 1-ustuvorlik: URL'dagi ?lang= yoki oldin saqlangan tanlov.
  useEffect(() => {
    (async () => {
      if (queryOverride.current) {
        setLangState(queryOverride.current);
        try {
          await AsyncStorage.setItem(LANG_KEY, queryOverride.current);
        } catch {
          // ignore
        }
        return;
      }
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved === 'uz' || saved === 'ru') setLangState(saved);
      } catch {
        // ignore
      }
    })();
  }, []);

  // 2-ustuvorlik: haqiqiy o'quvchi login qilgan bo'lsa, ilova tili o'sha
  // o'quvchining kurs yo'nalishiga (ingliz/rus) qarab avtomatik moslanadi.
  useEffect(() => {
    if (queryOverride.current) return;
    if (student?.lang) {
      const resolved: AppLang = student.lang === 'russian' ? 'ru' : 'uz';
      setLangState(resolved);
      AsyncStorage.setItem(LANG_KEY, resolved).catch(() => {});
    }
  }, [student?.lang]);

  // 3-ustuvorlik: hech kim real login qilmagan bo'lsa (CRM'ning "Ilovani
  // ko'rish" preview holati) — CRM'da hozir tanlangan "Namuna o'quvchi"ning
  // o'z kurs tiliga qarab moslanadi (masalan admin biror o'quvchining
  // qatoridagi "Ilovada ko'rish" tugmasini bossa).
  useEffect(() => {
    if (queryOverride.current) return;
    if (token) return; // haqiqiy o'quvchi allaqachon 2-ustuvorlikda hal qilindi
    fetchDemoStudentProfile()
      .then((profile) => {
        if (!profile) return;
        const resolved: AppLang = profile.lang === 'russian' ? 'ru' : 'uz';
        setLangState(resolved);
        AsyncStorage.setItem(LANG_KEY, resolved).catch(() => {});
      })
      .catch(() => {});
  }, [token]);

  const setLang = useCallback((l: AppLang) => {
    queryOverride.current = l;
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[lang][key] ?? translations.uz[key],
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLang(): Ctx {
  return useContext(LanguageContext);
}
