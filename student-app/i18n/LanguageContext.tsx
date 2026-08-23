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

// 7-vazifa (40-vazifa'ni qayta ko'rib chiqish): avval `?lang=russian` yoki
// `?lang=english` ("english"/"russian" — kurs tili qiymatlari) interfeys
// tiliga ("uz"/"ru") to'g'ridan-to'g'ri xaritalanardi — shu sabab CRM'ning
// "Ilovani ko'rish" preview'ida Rus tili kursi tanlanganda butun ilova
// interfeysi (menyu, "Salom" kabi matnlar) ham ruschaga o'tib qolardi,
// aslida bu faqat KURS kontenti tanlovi bo'lishi kerak edi. Interfeys
// tili kurs tilidan MUSTAQIL — standart bo'yicha har doim o'zbekcha
// (pastdagi courseLang mexanizmiga qarang) — shu sabab endi bu yerda
// faqat aniq "uz"/"ru" qiymatlari qabul qilinadi (haqiqiy interfeys-til
// deep link uchun), "english"/"russian" (kurs qiymatlari) e'tiborga
// olinmaydi.
function readQueryLang(): AppLang | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = (params.get('lang') || '').toLowerCase();
    if (v === 'uz' || v === 'ru') return v;
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
export type CourseLang = 'english' | 'russian';

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

  // 5-vazifa: telefon "Bosh ekranga qo'shish" qilinganda ilova nomi va
  // ikonkasi kursga (ingliz/rus) mos chiqishi kerak — "Homework" ingliz
  // tili uchun, "Domwork" rus tili uchun. Bitta web build ikkala kursga
  // ham xizmat qilgani uchun bu build vaqtida emas, courseLang aniqlangan
  // zahoti shu yerda DOM'dagi manifest/ikonka/nom teglarini almashtirib
  // qo'yish orqali amalga oshiriladi — Android "Bosh ekranga qo'shish"
  // (manifest.webmanifest) va iOS Safari (apple-touch-icon/apple-mobile-
  // web-app-title) shu tegning JOriy (dinamik yangilangan) qiymatini
  // o'qiydi, sahifa birinchi yuklangandagi qiymatni emas.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const isRussian = courseLang === 'russian';
    const appName = isRussian ? 'Domwork' : 'Homework';
    const manifestHref = isRussian ? '/student/manifest-russian.webmanifest' : '/student/manifest-english.webmanifest';
    const iconHref = isRussian ? '/student/pwa-icon-domwork.png' : '/student/pwa-icon-homework.jpg';

    document.querySelector('link[rel="manifest"]')?.setAttribute('href', manifestHref);
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', iconHref);
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', appName);
    document.querySelector('meta[name="application-name"]')?.setAttribute('content', appName);
    document.title = appName;
  }, [courseLang]);

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

// 3-vazifa: ba'zi tushuntiruvchi matnlar ("90 kunda ingliz tilida
// gapiring", "Speaking topiklar" kabi) doim ingliz tili kursiga xos
// so'zlar bilan yozib qo'yilgan — Rus tili kursida o'qiyotgan o'quvchiga
// (o'zbekcha interfeysda) chiqqanda noto'g'ri/chalkash bo'lib qolardi.
// Faqat aynan shu holatda (o'zbekcha interfeys + rus tili kursi) shu
// so'zlarni almashtiradi; boshqa hech qanday holatga (ruscha interfeys,
// ingliz tili kursi) ta'sir qilmaydi.
export function localizeCourseWording(text: string, lang: AppLang, courseLang: CourseLang): string {
  if (lang !== 'uz' || courseLang !== 'russian') return text;
  return text
    .replace(/Vocabulary Book/g, 'Daftar')
    .replace(/Coursebook|Course book/g, 'Kurs kitobi')
    .replace(/Homework Shop/g, 'Domwork magazin')
    .replace(/Homework/g, 'Domwork')
    .replace(/Speaking/g, 'Razgovor')
    .replace(/speaking/g, 'razgovor')
    .replace(/ingliz tili/g, 'rus tili')
    .replace(/inglizcha/g, 'ruscha');
}
