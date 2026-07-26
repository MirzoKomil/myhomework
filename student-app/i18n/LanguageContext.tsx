import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { fetchDemoStudentProfile } from '@/services/contentApi';
import { useAuth } from '@/services/studentAuthStore';
import { translations, AppLang, TranslationKey } from './translations';

// Bu kalit faqat o'quvchi Sozlamalardan o'zi tanlagan interfeys tilini
// saqlaydi. Eski `mh_student_lang` kurs tilidan avtomatik yozilgan bo'lishi
// mumkin, shu sababli yangilanishdan keyin undan foydalanilmaydi.
const LANG_PREFERENCE_KEY = 'mh_student_lang_preference_v2';

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

// CRM preview'i `?course=english|russian` yuborganda, bu tanlov interfeys
// tilidan alohida ravishda aynan qaysi dars kontenti ko'rinishini belgilaydi.
function readQueryCourseLang(): CourseLang | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const v = (new URLSearchParams(window.location.search).get('course') || '').toLowerCase();
    if (v === 'russian' || v === 'ru') return 'russian';
    if (v === 'english' || v === 'en') return 'english';
  } catch {
    // ignore
  }
  return null;
}

// 43-vazifa: o'quvchining haqiqiy KURS yo'nalishi ('english'/'russian') —
// ilova UI tilidan (uz/ru) mustaqil signal. Masalan, rus tilini o'rganayotgan
// o'quvchi ilova menyusini o'zbekcha ko'rishni tanlashi mumkin, lekin Radio
// bo'limi baribir rus radiolarini ko'rsatishi kerak — shu sababli bu ikkitasi
// aralashtirilmasligi kerak.
type CourseLang = 'english' | 'russian';

type Ctx = {
  lang: AppLang;
  setLang: (l: AppLang) => void;
  t: (key: TranslationKey) => string;
  courseLang: CourseLang;
};

const LanguageContext = createContext<Ctx>({
  lang: 'uz',
  setLang: () => {},
  t: (key) => translations.uz[key],
  courseLang: 'english',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>('uz');
  const [courseLang, setCourseLang] = useState<CourseLang>('english');
  const { student, token } = useAuth();
  // URL orqali aniq til tanlangan bo'lsa, boshqa manbalar (real o'quvchi,
  // namuna o'quvchi) uni bekor qilmasligi kerak.
  const queryOverride = useRef<AppLang | null>(null);
  const queryCourseOverride = useRef<CourseLang | null>(null);

  useEffect(() => {
    queryOverride.current = readQueryLang();
    queryCourseOverride.current = readQueryCourseLang();
    if (queryCourseOverride.current) setCourseLang(queryCourseOverride.current);
  }, []);

  // 1-ustuvorlik: URL'dagi ?lang= preview uchun aniq ko'rsatma. Boshqa
  // holatlarda dastlabki interfeys tili o'zbekcha; faqat foydalanuvchining
  // Sozlamalardan o'zi qilgan tanlovi qayta tiklanadi.
  useEffect(() => {
    (async () => {
      if (queryOverride.current) {
        setLangState(queryOverride.current);
        return;
      }
      try {
        const saved = await AsyncStorage.getItem(LANG_PREFERENCE_KEY);
        if (saved === 'uz' || saved === 'ru') setLangState(saved);
        else {
          setLangState('uz');
          await AsyncStorage.removeItem('mh_student_lang');
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Kurs tili UI tilidan mustaqil. Rus guruhidagi o'quvchi menyularni
  // o'zbekcha ko'radi, ammo unga ruscha dars va kursga tegishli kontent keladi.
  useEffect(() => {
    if (!queryCourseOverride.current && student?.lang) {
      setCourseLang(student.lang === 'russian' ? 'russian' : 'english');
    }
  }, [student?.lang]);

  useEffect(() => {
    if (token || queryCourseOverride.current) return;
    fetchDemoStudentProfile()
      .then((profile) => {
        if (profile?.lang) setCourseLang(profile.lang === 'russian' ? 'russian' : 'english');
      })
      .catch(() => {});
  }, [token]);

  const setLang = useCallback((l: AppLang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_PREFERENCE_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[lang][key] ?? translations.uz[key],
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, courseLang }}>{children}</LanguageContext.Provider>
  );
}

export function useLang(): Ctx {
  return useContext(LanguageContext);
}
