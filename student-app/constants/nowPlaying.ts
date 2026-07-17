import { Asset } from 'expo-asset';

// 146-ish: qulflangan ekran / boshqaruv markazidagi "Endi ijro etilmoqda"
// vidjeti uchun umumiy metama'lumotlar — radio va podkast pleyerlarida
// ishlatiladi. Rasm doim Homework logotipi (har bir stansiya/epizodning
// o'z rasmi emas) — brend izchilligi uchun ataylab shunday.
//
// Funksiya sifatida eksport qilingan — chaqirilmaguncha ishlamaydi, chunki
// bu SSR/statik eksport paytidagi Node muhitida mavjud emas (faqat
// brauzer/native runtime'da ishlaydi). `Asset.fromModule` ishlatiladi —
// `Image.resolveAssetSource` (avvalgi versiya) faqat haqiqiy native
// react-native'da mavjud; react-native-web'da bu statik metod umuman yo'q
// va har chaqirilganda xato tashlaydi. Bu xato `setActiveForLockScreen(...)`
// chaqiruvining argument obyekti ichida sodir bo'lganligi sabab, butun
// chaqiruv (title/artist bilan birga) hech qachon amalga oshmay qolar edi —
// shu sabab qulflangan ekranda umuman hech narsa yangilanmasdi.
export function getHomeworkArtworkUri(): string {
  try {
    return Asset.fromModule(require('@/assets/images/icon.png')).uri;
  } catch {
    return '';
  }
}
export const HOMEWORK_SCHOOL_NAME = 'Homework onlayn maktabi';
