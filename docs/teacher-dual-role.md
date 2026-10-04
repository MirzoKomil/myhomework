# 10-vazifa: asosiy va yordamchi ustozlik

## Ishlatish

- HR → Xodimlar: asosiy ustozni tahrirlang va **Yordamchi ustoz sifatida ham ko‘rsatilsin** belgisini yoqing. Yangi va mavjud profillar uchun standart qiymat o‘chiq.
- Bir xil HR ID va login ishlatiladi; ikkinchi akkaunt yaratilmaydi. Faol, kurs tiliga mos ustoz yordamchi ustoz ro‘yxatiga qo‘shiladi.
- Sotuvdagi to‘lov/biriktirish va o‘quvchi tahrirlash oynalarida asosiy ustoz yordamchi ro‘yxatida bloklanadi. Server ham shu ID yoki bir xil login orqali o‘ziga yordamchi biriktirishni rad etadi.
- Ustoz → Akademik bo‘lim → Davomat: asosiy davomat va yordamchi sifatida o‘quvchi biriktirilgan bo‘lsa yordamchi davomat alohida tablarda ochiladi. Mobil tugmalar kamida 44 px.
- Yordamchi tabda o‘quvchi, telefon va asosiy ustoz ismi ko‘rinadi; Qatnashdi/Kelmadi belgisi faqat yordamchi davomatga yoziladi. Asosiy davomatning mavjud baholash qoidasi saqlanadi.

Belgini o‘chirish yangi biriktirishlar uchun ustozni yordamchi ro‘yxatidan olib tashlaydi. Avvalgi biriktirishlar, davomat va ishlab topilgan maoshni o‘chirmaydi; mavjud o‘quvchini boshqa yordamchiga qo‘lda qayta biriktirish mumkin.

## Maosh va tarix

Bir xodim uchun bitta maosh qatori: asosiy ustozlik tarifi va asosiy davomatdan hisoblangan summa + yordamchi stavkasi va yordamchi davomatdan hisoblangan summa. Tariflar, stavka va dars chegaralari amaldagi tahrirlanuvchi KPI sozlamalaridan olinadi. Hisob tafsilotlari ikki rolni alohida ko‘rsatadi.

Yangi hisoblash asosida `academicPolicy: dual-role-v1` va ikkala roldagi o‘quvchilar saqlanadi. Avval to‘langan maoshlar o‘z tarixiy hisoblash qoidasi bilan qoladi; tuzatishlar moliya tasdig‘isiz qo‘llanmaydi.

## Ruxsatlar

CRM holatini olish va davomat yozishda rol foydalanuvchilar jadvalidan qayta tekshiriladi. Ustoz faqat loginiga bog‘langan yagona faol HR profili va o‘ziga biriktirilgan o‘quvchilar bilan ishlaydi. Server ustozga moliyaviy ma’lumot, o‘quvchi paroli, boshqa ustozning HR kartochkasi yoki baholarini bermaydi. Umumiy holatni PATCH qilish taqiqlangan; faqat alohida davomat endpointi orqali yozish mumkin.

Yordamchi davomatning yozuvi va audit bitta tranzaksiyada. Parallel yozuvlar o‘quvchi qatori orqali qulflanadi; noto‘g‘ri sana, rol, til va biriktirishlar rad etiladi. Muvaffaqiyatsiz saqlash interfeysda xato ko‘rsatadi va mahalliy davomatni o‘zgartirmaydi.

## Tekshirish

`node --test scripts/teacher-dual-role.test.cjs` — havzalar, ruxsatlar, ikki roldagi hisob va tarixiy siyosat.

`node scripts/run-payroll-postgres.cjs` — faqat vaqtinchalik localhost PostgreSQL bazalarida KPI, to‘lovlar va dual-role integratsiyasi. Production bazaga ulanmaydi.

Brauzer tekshiruvi 390 px mobil va 1440 px desktop alohida test oynasida haqiqiy UI kodi, test ma’lumotlari va mock API bilan bajarildi. Production o‘quvchilarning davomati test uchun o‘zgartirilmadi.
