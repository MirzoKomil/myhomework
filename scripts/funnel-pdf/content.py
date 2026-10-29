# -*- coding: utf-8 -*-
"""Content for Domwork lead-magnet PDFs.

Russian text uses "+" before the stressed vowel (e.g. "Здр+авствуйте").
make.py turns it into a combining acute accent (U+0301) for display and
builds an Uzbek-Latin pronunciation line automatically.
Each phrase: (russian, uzbek)  — text in (...) at the end of uzbek is shown as a muted note.
"""

# ---------------------------------------------------------------------------
# 1. SOVGA — 40 ta eng kerakli gap
# ---------------------------------------------------------------------------
SOVGA = dict(
    fname="sovga.pdf",
    kicker="SOVG‘A",
    title="40 ta eng kerakli gap",
    title_ru="40 с+амых н+ужных фраз",
    short="40 ta eng kerakli gap",
    subtitle="Rus tilini endi boshlayotgan yoki unutib qo‘ygan kattalar uchun. "
             "Salomlashish, tanishuv, do‘kon, transport, telefon va favqulodda vaziyatlarda "
             "kerak bo‘ladigan gaplar — talaffuzi va o‘zbekcha tarjimasi bilan.",
    chips=[("40", "ta gap"), ("8", "ta mavzu"), ("3", "qatlam: rus · talaffuz · tarjima")],
    sections=[
        dict(uz="Salomlashish va xayrlashish", ru="Приве́тствие и проща́ние", items=[
            ("Здр+авствуйте!", "Assalomu alaykum! (rasmiy, notanish odamga)"),
            ("Прив+ет!", "Salom! (do‘st va tanishlarga)"),
            ("Д+оброе +утро!", "Xayrli tong!"),
            ("Как дел+а?", "Ishlaringiz qalay?"),
            ("Хорош+о, спас+ибо. А у вас?", "Yaxshi, rahmat. O‘zingizda-chi?"),
            ("До свид+ания!", "Xayr, ko‘rishguncha!"),
        ], tip=("«Вы» yoki «ты»?",
                "Notanish odamga, yoshi kattaga va ishda doim «вы» deng. «Ты» — faqat yaqin do‘st, "
                "oila a’zosi yoki o‘zi taklif qilgan odamga.")),
        dict(uz="Tanishuv", ru="Знако́мство", items=[
            ("Мен+я зов+ут Аз+из.", "Mening ismim Aziz."),
            ("Как вас зов+ут?", "Ismingiz nima?"),
            ("+Очень при+ятно!", "Tanishganimdan xursandman!"),
            ("Я из Узбекист+ана.", "Men O‘zbekistondanman."),
            ("Я немн+ого говор+ю по-р+усски.", "Men ozroq ruscha gapiraman."),
            ("Кем вы раб+отаете?", "Kim bo‘lib ishlaysiz?"),
        ]),
        dict(uz="Tushunish va so‘rash", ru="Как переспроси́ть", items=[
            ("Повтор+ите, пож+алуйста.", "Iltimos, takrorlang."),
            ("Говор+ите помедл+еннее, пож+алуйста.", "Iltimos, sekinroq gapiring."),
            ("Я не п+онял. / Я не понял+а.", "Tushunmadim. (erkak / ayol)"),
            ("Что +это зн+ачит?", "Bu nimani anglatadi?"),
            ("Как +это по-р+усски?", "Buni ruschada qanday deyiladi?"),
            ("М+ожно вопр+ос?", "Savol bersam maylimi?"),
        ], tip=("Eng foydali gap",
                "Tushunmasangiz, uyalmang — «Повтор+ите, пож+алуйста» deng. Bu odobsizlik emas, "
                "aksincha, suhbatdoshingiz sizga ko‘proq e’tibor beradi.")),
        dict(uz="Do‘konda", ru="В магази́не", items=[
            ("Ск+олько +это ст+оит?", "Bu qancha turadi?"),
            ("У вас есть хлеб?", "Sizlarda non bormi?"),
            ("Д+айте, пож+алуйста, вот +это.", "Iltimos, mana buni bering."),
            ("М+ожно оплат+ить к+артой?", "Karta bilan to‘lasam bo‘ladimi?"),
            ("Вам пак+ет н+ужен?", "Paket kerakmi? (kassir so‘raydi)"),
            ("Спас+ибо, +это всё.", "Rahmat, boshqa narsa kerak emas."),
        ], tip=("Sonlarni ham mashq qiling",
                "Narxni eshitib tushunish uchun sonlarni alohida yodlang: сто (100), дв+ести (200), "
                "пятьс+от (500), т+ысяча (1000).")),
        dict(uz="Transport va yo‘l", ru="Тра́нспорт и доро́га", items=[
            ("Как дойт+и до метр+о?", "Metroga qanday borsa bo‘ladi? (piyoda)"),
            ("Где остан+овка авт+обуса?", "Avtobus bekati qayerda?"),
            ("+Этот авт+обус ид+ёт до ц+ентра?", "Bu avtobus markazgacha boradimi?"),
            ("Останов+ите здесь, пож+алуйста.", "Iltimos, shu yerda to‘xtating. (taksida)"),
            ("Где здесь в+ыход?", "Chiqish qayerda?"),
            ("Я заблуд+ился. / Я заблуд+илась.", "Adashib qoldim. (erkak / ayol)"),
        ]),
        dict(uz="Telefonda", ru="По телефо́ну", items=[
            ("Алл+о, сл+ушаю.", "Allo, eshitaman."),
            ("Позов+ите, пож+алуйста, Аз+иза.", "Iltimos, Azizni chaqirib bering."),
            ("Я вам перезвон+ю.", "Sizga keyinroq qo‘ng‘iroq qilaman."),
            ("Вас пл+охо сл+ышно.", "Ovozingiz yaxshi eshitilmayapti."),
        ]),
        dict(uz="Muloyim iltimos", ru="Ве́жливые про́сьбы", items=[
            ("Извин+ите, пож+алуйста…", "Kechirasiz… (biror narsa so‘rashdan oldin)"),
            ("Помог+ите, пож+алуйста.", "Iltimos, yordam bering."),
            ("Больш+ое спас+ибо! — Не за что.", "Katta rahmat! — Arzimaydi."),
        ]),
        dict(uz="Favqulodda vaziyat", ru="Экстренная ситуа́ция", items=[
            ("В+ызовите ск+орую!", "Tez yordam chaqiring!"),
            ("Мне пл+охо.", "Ahvolim yomon."),
            ("Позвон+ите в пол+ицию!", "Politsiyaga qo‘ng‘iroq qiling!"),
        ], tip=("Yodda tuting",
                "Rossiyada barcha favqulodda xizmatlar uchun yagona raqam — 112. "
                "U mobil telefondan ham ishlaydi.")),
    ],
    dialogues=[],
)

# ---------------------------------------------------------------------------
# 2. UMUMIY — Ishda kerak 50 ibora
# ---------------------------------------------------------------------------
UMUMIY = dict(
    fname="qollanma_umumiy.pdf",
    kicker="QO‘LLANMA",
    title="Ishda kerak 50 ibora",
    title_ru="50 фраз для раб+оты",
    short="Ishda kerak 50 ibora",
    subtitle="Rusiyzabon jamoada ishlayotgan yoki shunday ishga kirmoqchi bo‘lganlar uchun. "
             "Majlis, rahbar va hamkasblar bilan suhbat, mijozlar, telefon va yozishmalarda "
             "kerak bo‘ladigan tayyor iboralar.",
    chips=[("50", "ta ibora"), ("7", "ta ish vaziyati"), ("3", "qatlam: rus · talaffuz · tarjima")],
    sections=[
        dict(uz="Majlis va yig‘ilishlar", ru="Совеща́ния", items=[
            ("Дав+айте начнём.", "Keling, boshlaymiz."),
            ("М+ожно я доб+авлю?", "Qo‘shimcha qilsam maylimi?"),
            ("Я согл+асен. / Я согл+асна.", "Roziman. (erkak / ayol)"),
            ("Я не совс+ем согл+асен.", "Men bunga unchalik qo‘shilmayman. (ayol: согл+асна)"),
            ("У мен+я есть предлож+ение.", "Mening bir taklifim bor."),
            ("Дав+айте обсуд+им +это п+озже.", "Buni keyinroq muhokama qilaylik."),
            ("Как+ие ср+оки?", "Muddatlar qanday?"),
            ("Кто за +это отвеч+ает?", "Bunga kim javobgar?"),
            ("Подведём ит+оги.", "Xulosa qilaylik."),
        ]),
        dict(uz="Rahbar bilan", ru="С руководи́телем", items=[
            ("М+ожно к вам на мин+уту?", "Bir daqiqaga kirsam maylimi?"),
            ("У мен+я вопр+ос по пр+оекту.", "Loyiha bo‘yicha savolim bor."),
            ("Я всё сд+елал. / Я всё сд+елала.", "Hammasini bajardim. (erkak / ayol)"),
            ("Мне н+ужно чуть б+ольше вр+емени.", "Menga biroz ko‘proq vaqt kerak."),
            ("Когд+а н+ужно сдать отчёт?", "Hisobotni qachon topshirish kerak?"),
            ("Что сд+елать в п+ервую +очередь?", "Birinchi navbatda nima qilay?"),
            ("М+ожно мне сег+одня уйт+и пор+аньше?", "Bugun ertaroq ketsam bo‘ladimi?"),
            ("Я возьм+у +это на себ+я.", "Buni o‘z zimmamga olaman."),
            ("Спас+ибо за обр+атную связь.", "Fikr-mulohazangiz uchun rahmat."),
        ]),
        dict(uz="Hamkasblar bilan", ru="С колле́гами", items=[
            ("Есть мин+утка?", "Bir daqiqang bormi?"),
            ("М+ожешь пом+очь?", "Yordam bera olasanmi?"),
            ("Подскаж+и, как +это сд+елать?", "Buni qanday qilishni aytib bermaysanmi?"),
            ("Пойдём пооб+едаем?", "Tushlikka boramizmi?"),
            ("Хорош+о, я перед+ам.", "Xo‘p, yetkazib qo‘yaman."),
            ("Ск+инь, пож+алуйста, файл.", "Iltimos, faylni tashlab yubor."),
            ("Спас+ибо, в+ыручил!", "Rahmat, katta yordam berding! (ayolga: в+ыручила)"),
            ("Хор+оших выходн+ых!", "Dam olish kunlaring yaxshi o‘tsin!"),
        ], tip=("«Ты» yoki «вы»?",
                "Hamkasblar orasida ko‘pincha «ты» ishlatiladi. Lekin birinchi bo‘lib «вы» deng — "
                "kerak bo‘lsa, ular o‘zlari «Дав+ай на ты» deb taklif qilishadi.")),
        dict(uz="Mijozlar bilan", ru="С клие́нтами", items=[
            ("Чем мог+у пом+очь?", "Qanday yordam bera olaman?"),
            ("Одн+у мин+уту, сейч+ас уточн+ю.", "Bir daqiqa, hozir aniqlab beraman."),
            ("Дав+айте я вам объясн+ю.", "Keling, sizga tushuntirib beraman."),
            ("Вам уд+обно з+автра в д+есять?", "Ertaga soat o‘nda sizga qulaymi?"),
            ("Извин+ите за ожид+ание.", "Kutib qolganingiz uchun uzr."),
            ("Мы реш+им +этот вопр+ос.", "Bu masalani hal qilamiz."),
            ("Ост+авьте, пож+алуйста, ваш н+омер.", "Iltimos, raqamingizni qoldiring."),
            ("Спас+ибо, что обрат+ились к нам.", "Bizga murojaat qilganingiz uchun rahmat."),
        ]),
        dict(uz="Telefon qo‘ng‘iroqlari", ru="Телефо́нные звонки́", items=[
            ("Д+обрый д+ень! +Это Аз+из, комп+ания «+Альфа».", "Xayrli kun! Bu Aziz, «Alfa» kompaniyasidan."),
            ("Вам уд+обно говор+ить?", "Gaplashishga qulaymisiz?"),
            ("Соедин+ите, пож+алуйста, с бухгалт+ерией.", "Iltimos, buxgalteriya bilan ulab bering."),
            ("Я перезвон+ю вам ч+ерез час.", "Bir soatdan keyin sizga qayta qo‘ng‘iroq qilaman."),
            ("Продикт+уйте, пож+алуйста, н+омер.", "Iltimos, raqamni aytib turing — yozib olaman."),
            ("Вас не сл+ышно.", "Ovozingiz eshitilmayapti."),
        ]),
        dict(uz="Email va messenjerlar", ru="Пи́сьма и мессенджеры", items=[
            ("Направл+яю вам догов+ор.", "Sizga shartnomani yuboryapman."),
            ("Во влож+ении — отчёт за май.", "Ilovada — may oyi hisoboti."),
            ("Прош+у подтверд+ить получ+ение.", "Olganingizni tasdiqlashingizni so‘rayman."),
            ("Жду в+ашего отв+ета.", "Javobingizni kutaman."),
            ("С уваж+ением, Аз+из.", "Hurmat bilan, Aziz."),
            ("Пр+инято, спас+ибо!", "Qabul qilindi, rahmat!"),
        ]),
        dict(uz="Uzr so‘rash va qayta so‘rash", ru="Извине́ния и уточне́ния", items=[
            ("Извин+ите, я опозд+ал.", "Kechirasiz, kechikdim. (ayol: опозд+ала)"),
            ("Прост+ите, +это мо+я ош+ибка. Испр+авлю.", "Kechirasiz, bu mening aybim. Tuzataman."),
            ("Не могл+и бы вы повтор+ить?", "Takrorlab yubora olmaysizmi?"),
            ("Пр+авильно ли я п+онял, что…?", "To‘g‘ri tushundimmi: …?"),
        ]),
    ],
    dialogues=[],
)

# ---------------------------------------------------------------------------
# 3. OFFICE — ish suhbati
# ---------------------------------------------------------------------------
OFFICE = dict(
    fname="qollanma_office.pdf",
    kicker="QO‘LLANMA",
    title="Rus tilida ish suhbati: 15 savol va javob namunasi",
    title_ru="Собес+едование на р+усском язык+е",
    short="Ish suhbati: 15 savol",
    subtitle="Rus tilida suhbatdan o‘tmoqchi bo‘lganlar uchun. Eng ko‘p beriladigan 15 savol, "
             "har biriga qisqa javob namunasi, tarjima va amaliy maslahat — "
             "javobingizni o‘zingizga moslab tayyorlab oling.",
    chips=[("15", "ta savol"), ("15", "ta javob namunasi"), ("+5", "ta yordamchi ibora")],
    interview=[
        dict(q="Расскаж+ите о себ+е.", q_uz="O‘zingiz haqingizda gapirib bering.",
             a="Мен+я зов+ут Аз+из, мне дв+адцать в+осемь лет. Я эконом+ист, пять лет раб+отаю в фин+ансах. "
               "Сейч+ас ищ+у раб+оту, где смог+у раст+и.",
             a_uz="Ismim Aziz, 28 yoshdaman. Iqtisodchiman, besh yildan beri moliya sohasida ishlayman. "
                  "Hozir o‘sishim mumkin bo‘lgan ish qidiryapman.",
             tip="1 daqiqada gapiring: ism → kasb → tajriba → nega aynan shu ish. Shaxsiy hayot haqida uzoq gapirmang."),
        dict(q="Почем+у вы х+отите раб+отать у нас?", q_uz="Nega aynan bizda ishlamoqchisiz?",
             a="В+аша комп+ания раст+ёт, и мне интер+есно раст+и вм+есте с в+ами. Мой +опыт подх+одит для +этой д+олжности.",
             a_uz="Kompaniyangiz rivojlanmoqda va siz bilan birga o‘sish menga qiziq. Tajribam bu lavozimga mos keladi.",
             tip="Suhbatdan oldin kompaniya haqida 2–3 ta faktni o‘qib boring va javobda bittasini eslating."),
        dict(q="Как+ой у вас +опыт раб+оты?", q_uz="Ish tajribangiz qanday?",
             a="Я три г+ода раб+отал м+енеджером по прод+ажам: вёл кли+ентов и гот+овил отчёты.",
             a_uz="Uch yil savdo menejeri bo‘lib ishladim: mijozlar bilan ishladim va hisobotlar tayyorladim.",
             tip="Faqat lavozimni emas, natijani ham ayting: nima qildingiz va nimaga erishdingiz. Ayol: раб+отала, вел+а, гот+овила."),
        dict(q="Почем+у вы ушл+и с пр+ошлой раб+оты?", q_uz="Oldingi ishingizdan nega ketdingiz?",
             a="Я хоч+у развив+аться д+альше, а там не б+ыло возм+ожности для р+оста.",
             a_uz="Men yanada rivojlanmoqchiman, u yerda esa o‘sish imkoniyati yo‘q edi.",
             tip="Oldingi rahbar yoki jamoani hech qachon yomonlamang — bu suhbatdagi eng katta xatolardan biri."),
        dict(q="Как+ие у вас с+ильные стор+оны?", q_uz="Kuchli tomonlaringiz qanday?",
             a="Я отв+етственный, б+ыстро уч+усь и ум+ею раб+отать в ком+анде.",
             a_uz="Men mas’uliyatliman, tez o‘rganaman va jamoada ishlay olaman.",
             tip="Har bir sifatga qisqa misol keltiring: «Masalan, yangi dasturni bir haftada o‘rganib oldim». Ayol: отв+етственная."),
        dict(q="А как+ие у вас сл+абые стор+оны?", q_uz="Zaif tomonlaringiz-chi?",
             a="Иногд+а я сл+ишком д+олго провер+яю дет+али. Сейч+ас уч+усь л+учше планиров+ать вр+емя.",
             a_uz="Ba’zan tafsilotlarni juda uzoq tekshiraman. Hozir vaqtni yaxshiroq rejalashtirishni o‘rganyapman.",
             tip="Ishga jiddiy xalal bermaydigan haqiqiy kamchilikni ayting va uni qanday tuzatayotganingizni qo‘shing."),
        dict(q="Кем вы в+идите себ+я ч+ерез пять лет?", q_uz="5 yildan keyin o‘zingizni kim sifatida ko‘rasiz?",
             a="Я хоч+у стать +опытным специал+истом и, возм+ожно, руковод+ить небольш+ой ком+андой.",
             a_uz="Tajribali mutaxassis bo‘lishni va, ehtimol, kichik jamoaga rahbarlik qilishni xohlayman.",
             tip="Rejangizni shu kompaniya bilan bog‘lang — ish beruvchi uzoq muddat qoladigan xodimni qidiradi."),
        dict(q="Как вы раб+отаете в ком+анде?", q_uz="Jamoada qanday ishlaysiz?",
             a="Мне нр+авится раб+отать в ком+анде. Я всегд+а гот+ов пом+очь колл+егам и не бо+юсь попрос+ить п+омощи.",
             a_uz="Jamoada ishlash menga yoqadi. Hamkasblarga doim yordam berishga tayyorman va o‘zim ham yordam so‘rashdan tortinmayman.",
             tip="Ayol bo‘lsangiz: «гот+ова». Fe’l va sifatlarning jinsiga e’tibor bering — bu darajangizni ko‘rsatadi."),
        dict(q="Как вы спр+авляетесь со стр+ессом?", q_uz="Stress bilan qanday kurashasiz?",
             a="Я составл+яю план и реш+аю зад+ачи по +очереди. +Это помог+ает сохран+ять спок+ойствие.",
             a_uz="Reja tuzaman va vazifalarni navbat bilan hal qilaman. Bu xotirjamlikni saqlashga yordam beradi.",
             tip="Umumiy gap emas, aniq usulingizni ayting: ro‘yxat, reja, qisqa tanaffus."),
        dict(q="Расскаж+ите о сл+ожной ситу+ации на раб+оте.", q_uz="Ishdagi qiyin vaziyat haqida gapirib bering.",
             a="Одн+ажды кли+ент был недов+олен зак+азом. Я его в+ыслушал, б+ыстро нашёл реш+ение, и он ост+ался с н+ами.",
             a_uz="Bir kuni mijoz buyurtmadan norozi bo‘ldi. Uni tinglab, tezda yechim topdim va u biz bilan qoldi.",
             tip="STAR usuli: vaziyat → vazifa → harakat → natija. Hikoya 4–5 gapdan oshmasin."),
        dict(q="Как хорош+о вы говор+ите по-р+усски?", q_uz="Ruschani qanchalik yaxshi bilasiz?",
             a="Я поним+аю почт+и всё и мог+у общ+аться на раб+очие т+емы. Сейч+ас продолж+аю уч+ить яз+ык.",
             a_uz="Deyarli hammasini tushunaman va ish mavzularida muloqot qila olaman. Hozir tilni o‘rganishda davom etyapman.",
             tip="Darajangizni oshirib ko‘rsatmang — suhbatning o‘zi buni tekshiradi. Halol javob ishonch uyg‘otadi."),
        dict(q="Как+ую зарпл+ату вы ожид+аете?", q_uz="Qancha maosh kutyapsiz?",
             a="Я ориент+ируюсь на +уровень р+ынка для так+ой д+олжности. Гот+ов обсуд+ить.",
             a_uz="Bunday lavozim uchun bozordagi darajaga qarayman. Muhokama qilishga tayyorman.",
             tip="Oldindan shu lavozim bo‘yicha bozordagi maosh oralig‘ini o‘rganing. Aniq so‘rashsa — bitta raqam emas, oraliq ayting."),
        dict(q="Когд+а вы гот+овы приступ+ить к раб+оте?", q_uz="Qachondan ishga kirisha olasiz?",
             a="Я мог+у нач+ать ч+ерез две нед+ели.",
             a_uz="Ikki haftadan keyin boshlay olaman.",
             tip="Hozirgi ishingizdan ketish muddatini hisobga olib, real muddatni ayting."),
        dict(q="Почем+у мы должн+ы в+ыбрать +именно вас?", q_uz="Nega aynan sizni tanlashimiz kerak?",
             a="У мен+я есть н+ужный +опыт, я б+ыстро уч+усь и отвеч+аю за результ+ат.",
             a_uz="Menda kerakli tajriba bor, tez o‘rganaman va natija uchun javob beraman.",
             tip="Vakansiya talablaridan 2–3 tasini oling va har biriga o‘z tajribangizdan misol bering."),
        dict(q="У вас есть вопр+осы к нам?", q_uz="Bizga savollaringiz bormi?",
             a="Да. Как в+ыглядит об+ычный раб+очий день? И как вы оц+ениваете результ+аты раб+оты?",
             a_uz="Ha. Odatdagi ish kuni qanday o‘tadi? Ish natijalarini qanday baholaysiz?",
             tip="Doim 1–2 ta savol bering — bu qiziqishingizni ko‘rsatadi."),
    ],
    extra=dict(uz="Suhbatda yordam beradigan iboralar", ru="Поле́зные фра́зы", items=[
        ("М+ожно я немн+ого под+умаю?", "Biroz o‘ylab olsam maylimi?"),
        ("Извин+ите, не могл+и бы вы переформул+ировать вопр+ос?", "Kechirasiz, savolni boshqacha qilib bera olasizmi?"),
        ("Спас+ибо за приглаш+ение.", "Taklif uchun rahmat."),
        ("Когд+а мне ждать отв+ета?", "Javobni qachon kutsam bo‘ladi?"),
        ("Б+ыло при+ятно познак+омиться.", "Tanishganimdan xursand bo‘ldim."),
    ]),
    sections=[],
    dialogues=[],
)

# ---------------------------------------------------------------------------
# 4. BANK
# ---------------------------------------------------------------------------
BANK = dict(
    fname="qollanma_bank.pdf",
    kicker="QO‘LLANMA · BANK VA MOLIYA",
    title="Bank va moliya: mijoz bilan rus tilida",
    title_ru="Банк и фин+ансы",
    short="Bank va moliya",
    subtitle="Bank, kassa va moliya sohasida ishlaydiganlar uchun. Mijozni kutib olish, hisob va kartalar, "
             "kredit va omonat, hujjatlar va shikoyatlar bo‘yicha iboralar hamda 2 ta namunaviy dialog.",
    chips=[None, ("5", "ta mavzu"), ("2", "ta dialog")],
    sections=[
        dict(uz="Mijozni kutib olish", ru="Встре́ча клие́нта", items=[
            ("Д+обрый д+ень! Чем мог+у пом+очь?", "Xayrli kun! Qanday yordam bera olaman?"),
            ("Присаж+ивайтесь, пож+алуйста.", "Marhamat, o‘tiring."),
            ("Ваш п+аспорт, пож+алуйста.", "Pasportingizni bering, iltimos."),
            ("Как к вам обращ+аться?", "Sizga qanday murojaat qilay?"),
            ("Одн+у мин+уту, я пров+ерю.", "Bir daqiqa, tekshirib ko‘raman."),
            ("Возьм+ите тал+он и подожд+ите, вас в+ызовут.", "Talon oling va kuting, sizni chaqirishadi."),
        ], tip=("Hurmat belgisi",
                "Rus tilida mijozga ism va otasining ismi bilan murojaat qilish hurmat hisoblanadi: "
                "«+Анна Серг+еевна», «Иг+орь Петр+ович».")),
        dict(uz="Hisob va kartalar", ru="Счета́ и ка́рты", items=[
            ("Вы х+отите откр+ыть счёт?", "Hisob raqam ochmoqchimisiz?"),
            ("К+арта б+удет гот+ова ч+ерез три дня.", "Karta uch kundan keyin tayyor bo‘ladi."),
            ("Введ+ите ПИН-код, пож+алуйста.", "Iltimos, PIN-kodni kiriting."),
            ("В+аша к+арта заблок+ирована.", "Kartangiz bloklangan."),
            ("Вы х+отите снять нал+ичные?", "Naqd pul yechmoqchimisiz?"),
            ("Перев+од придёт в теч+ение дня.", "O‘tkazma bir kun ichida keladi."),
            ("Пров+ерьте, пож+алуйста, д+анные.", "Iltimos, ma’lumotlarni tekshiring."),
            ("Пополн+ить счёт м+ожно в прилож+ении.", "Hisobni ilovada to‘ldirish mumkin."),
        ]),
        dict(uz="Kredit va omonat", ru="Креди́ты и вкла́ды", items=[
            ("Как+ая с+умма вам нужн+а?", "Sizga qancha summa kerak?"),
            ("На как+ой срок?", "Qancha muddatga?"),
            ("Ст+авка зав+исит от ср+ока.", "Foiz stavkasi muddatga bog‘liq."),
            ("Нужн+а спр+авка о дох+одах.", "Daromad haqida ma’lumotnoma kerak."),
            ("Ежем+есячный платёж б+удет ук+азан в догов+оре.", "Oylik to‘lov shartnomada ko‘rsatiladi."),
            ("Вклад м+ожно пополн+ять.", "Omonatni to‘ldirib borish mumkin."),
            ("Доср+очное погаш+ение возм+ожно.", "Muddatidan oldin to‘lash mumkin."),
            ("Реш+ение по за+явке б+удет з+автра.", "Ariza bo‘yicha qaror ertaga bo‘ladi."),
        ]),
        dict(uz="Hujjatlar va imzo", ru="Докуме́нты и по́дпись", items=[
            ("Зап+олните, пож+алуйста, заявл+ение.", "Iltimos, arizani to‘ldiring."),
            ("Подпиш+ите здесь и здесь.", "Mana shu yerga va shu yerga imzo qo‘ying."),
            ("Прочит+айте, пож+алуйста, вним+ательно.", "Iltimos, diqqat bilan o‘qib chiqing."),
            ("+Это ваш экземпл+яр догов+ора.", "Bu shartnomaning sizdagi nusxasi."),
            ("Нужн+а к+опия п+аспорта.", "Pasport nusxasi kerak."),
            ("Вот ваш чек.", "Mana chekingiz."),
        ]),
        dict(uz="Muammo va shikoyatlar", ru="Пробле́мы и жа́лобы", items=[
            ("Я поним+аю в+аше беспок+ойство.", "Xavotiringizni tushunaman."),
            ("Дав+айте разберёмся.", "Keling, birga aniqlab olaylik."),
            ("Я перед+ам в+аше обращ+ение специал+исту.", "Murojaatingizni mutaxassisga yetkazaman."),
            ("Мы вам перезвон+им сег+одня.", "Bugun sizga qayta qo‘ng‘iroq qilamiz."),
            ("Прин+осим извин+ения за неуд+обства.", "Noqulaylik uchun uzr so‘raymiz."),
            ("Ником+у не сообщ+айте код из СМС.", "SMS orqali kelgan kodni hech kimga aytmang."),
        ]),
    ],
    dialogues=[
        dict(title="Kassada: pul o‘tkazmasi", context="Mijoz Toshkentga pul jo‘natmoqchi.",
             roles=("Xodim", "Mijoz"), lines=[
            (0, "Д+обрый д+ень! Чем мог+у пом+очь?", "Xayrli kun! Qanday yordam bera olaman?"),
            (1, "Здр+авствуйте. Я хоч+у отпр+авить д+еньги в Ташк+ент.", "Assalomu alaykum. Toshkentga pul jo‘natmoqchiman."),
            (0, "Хорош+о. Ваш п+аспорт, пож+алуйста. Как+ая с+умма?", "Yaxshi. Pasportingizni bering. Qancha summa?"),
            (1, "Вот п+аспорт. С+умму я напис+ал здесь.", "Mana pasport. Summani shu yerga yozdim."),
            (0, "Пров+ерьте д+анные получ+ателя и подпиш+ите здесь.", "Qabul qiluvchining ma’lumotlarini tekshiring va shu yerga imzo qo‘ying."),
            (1, "Всё пр+авильно. Когд+а д+еньги прид+ут?", "Hammasi to‘g‘ri. Pul qachon yetib boradi?"),
            (0, "Об+ычно в теч+ение ч+аса. Вот ваш чек.", "Odatda bir soat ichida. Mana chekingiz."),
            (1, "Спас+ибо! До свид+ания.", "Rahmat! Xayr."),
        ]),
        dict(title="Xizmatni tushuntirish: omonat", context="Mijoz omonat ochmoqchi, xodim farqini tushuntiradi.",
             roles=("Xodim", "Mijoz"), lines=[
            (1, "Я хоч+у откр+ыть вклад. Что вы м+ожете предлож+ить?", "Omonat ochmoqchiman. Nima taklif qila olasiz?"),
            (0, "У нас есть два вари+анта: вклад с пополн+ением и вклад без пополн+ения.", "Bizda ikki variant bor: to‘ldiriladigan va to‘ldirilmaydigan omonat."),
            (1, "А в чём р+азница?", "Farqi nimada?"),
            (0, "В п+ервый м+ожно добавл+ять д+еньги в л+юбое вр+емя. Во втор+ом ст+авка в+ыше, но пополн+ять нельз+я.",
             "Birinchisiga istalgan vaqtda pul qo‘shish mumkin. Ikkinchisida stavka yuqoriroq, lekin to‘ldirib bo‘lmaydi."),
            (1, "А +если мне н+ужно б+удет снять д+еньги р+аньше?", "Agar pulni muddatidan oldin yechishim kerak bo‘lsa-chi?"),
            (0, "Тогд+а проц+енты пересчит+ают. Все усл+овия ук+азаны в догов+оре — дав+айте посм+отрим вм+есте.",
             "Unda foizlar qayta hisoblanadi. Barcha shartlar shartnomada ko‘rsatilgan — keling, birga ko‘rib chiqamiz."),
            (1, "Хорош+о, дав+айте.", "Yaxshi, ko‘raylik."),
        ]),
    ],
)

# ---------------------------------------------------------------------------
# 5. MED
# ---------------------------------------------------------------------------
MED = dict(
    fname="qollanma_med.pdf",
    kicker="QO‘LLANMA · TIBBIYOT",
    title="Tibbiyot xodimlari uchun ruscha iboralar",
    title_ru="Р+усский для мед+иков",
    short="Tibbiyot",
    subtitle="Shifokor, hamshira va tibbiyot sohasida ishlaydiganlar uchun. Bemor shikoyatlarini tushunish, "
             "savol berish, tavsiya tushuntirish va hamkasblar bilan gaplashish — hamda 2 ta namunaviy dialog.",
    chips=[None, ("5", "ta mavzu"), ("2", "ta dialog")],
    sections=[
        dict(uz="Bemorni qabul qilish", ru="Приём пацие́нта", items=[
            ("Проход+ите, сад+итесь.", "Kiring, o‘tiring."),
            ("На что жал+уетесь?", "Nimadan shikoyat qilyapsiz?"),
            ("Что вас беспок+оит?", "Sizni nima bezovta qilyapti?"),
            ("Как давн+о +это начал+ось?", "Bu qachondan beri boshlandi?"),
            ("Где бол+ит?", "Qayeringiz og‘riyapti?"),
            ("Покаж+ите, где +именно.", "Aynan qayerda ekanini ko‘rsating."),
        ]),
        dict(uz="Bemor shikoyatlari", ru="Жа́лобы пацие́нта", items=[
            ("У мен+я бол+ит голов+а.", "Boshim og‘riyapti."),
            ("У мен+я выс+окая температ+ура.", "Isitmam baland."),
            ("Мен+я тошн+ит.", "Ko‘nglim aynayapti."),
            ("У мен+я к+ашель и н+асморк.", "Yo‘talim va tumovim bor."),
            ("Бол+ит жив+от.", "Qornim og‘riyapti."),
            ("Кр+ужится голов+а.", "Boshim aylanyapti."),
            ("Мне тр+удно дыш+ать.", "Nafas olishim qiyin."),
            ("Я пл+охо сплю.", "Yomon uxlayapman."),
        ], tip=("Tinglab tushunish muhim",
                "Bemorlar ko‘pincha so‘zlashuv tilida gapiradi: «колет» (sanchiyapti), «ноет» (zirqirayapti), "
                "«ж+ёт» (achishyapti). Bu so‘zlarni ham yodlab oling.")),
        dict(uz="Shifokor savollari", ru="Вопро́сы врача́", items=[
            ("У вас есть аллерг+ия?", "Sizda allergiya bormi?"),
            ("Как+ие лек+арства вы приним+аете?", "Qanday dorilar qabul qilyapsiz?"),
            ("Есть хрон+ические заболев+ания?", "Surunkali kasalliklar bormi?"),
            ("Дав+айте изм+ерим давл+ение.", "Keling, qon bosimini o‘lchaymiz."),
            ("Откр+ойте рот, скаж+ите «а».", "Og‘zingizni oching, «a» deng."),
            ("Глубок+о вдохн+ите. Не дыш+ите.", "Chuqur nafas oling. Nafasingizni ushlab turing."),
            ("Здесь бол+ит, когд+а я наж+имаю?", "Bossam shu yer og‘riyaptimi?"),
        ]),
        dict(uz="Tavsiyalar", ru="Рекоменда́ции", items=[
            ("Приним+айте по одн+ой табл+етке три р+аза в день.", "Kuniga uch marta bittadan tabletka iching."),
            ("П+осле ед+ы.", "Ovqatdan keyin."),
            ("Н+ужно сдать ан+ализ кр+ови.", "Qon tahlili topshirish kerak."),
            ("Вот направл+ение на УЗИ.", "Mana UZI ga yo‘llanma."),
            ("П+ейте б+ольше вод+ы.", "Ko‘proq suv iching."),
            ("Прид+ите на повт+орный приём ч+ерез нед+елю.", "Bir haftadan keyin qayta qabulga keling."),
            ("+Если ст+анет х+уже, ср+азу звон+ите.", "Ahvolingiz yomonlashsa, darhol qo‘ng‘iroq qiling."),
        ]),
        dict(uz="Hamkasblar bilan", ru="С колле́гами", items=[
            ("Как состо+яние паци+ента?", "Bemorning ahvoli qanday?"),
            ("Давл+ение в н+орме, температ+ура норм+альная.", "Qon bosimi me’yorida, harorat normal."),
            ("Паци+ент жал+уется на боль в груд+и.", "Bemor ko‘krakdagi og‘riqdan shikoyat qilyapti."),
            ("Нужн+а консульт+ация кардиол+ога.", "Kardiolog maslahati kerak."),
            ("Запиш+ите, пож+алуйста, в к+арту.", "Iltimos, kasallik kartasiga yozib qo‘ying."),
            ("Я на обх+оде, б+уду ч+ерез д+есять мин+ут.", "Palatalarni aylanyapman, 10 daqiqada kelaman."),
        ]),
    ],
    dialogues=[
        dict(title="Terapevt qabulida", context="Bemor tomoq og‘rig‘i va isitma bilan keldi.",
             roles=("Shifokor", "Bemor"), lines=[
            (0, "Здр+авствуйте, проход+ите. На что жал+уетесь?", "Assalomu alaykum, kiring. Nimadan shikoyat qilyapsiz?"),
            (1, "У мен+я три дня бол+ит г+орло и температ+ура.", "Uch kundan beri tomog‘im og‘riyapti va isitmam bor."),
            (0, "Как+ая температ+ура?", "Harorat qancha?"),
            (1, "Тр+идцать в+осемь и пять.", "O‘ttiz sakkiz yarim."),
            (0, "Откр+ойте рот… Г+орло кр+асное. Аллерг+ия на лек+арства есть?", "Og‘zingizni oching… Tomog‘ingiz qizargan. Dorilarga allergiyangiz bormi?"),
            (1, "Нет.", "Yo‘q."),
            (0, "Я в+ыпишу вам лек+арство. П+ейте б+ольше тёплой вод+ы. +Если ч+ерез три дня не ст+анет л+учше, прих+одите сн+ова.",
             "Sizga dori yozib beraman. Ko‘proq iliq suv iching. Uch kunda yaxshilanmasa, yana keling."),
            (1, "Спас+ибо, д+октор!", "Rahmat, doktor!"),
        ]),
        dict(title="Hamkasbga bemor haqida xabar", context="Hamshira shifokorga yangi bemor haqida aytadi.",
             roles=("Hamshira", "Shifokor"), lines=[
            (0, "+Анна Серг+еевна, в пят+ой пал+ате н+овый паци+ент.", "Anna Sergeyevna, beshinchi palatada yangi bemor bor."),
            (1, "Что с ним?", "Unga nima bo‘lgan?"),
            (0, "Жал+уется на боль в груд+и. Давл+ение сто с+орок на девян+осто.", "Ko‘krak og‘rig‘idan shikoyat qilyapti. Qon bosimi 140 ga 90."),
            (1, "Сд+елайте ЭКГ и в+ызовите кардиол+ога.", "EKG qiling va kardiologni chaqiring."),
            (0, "Хорош+о. Запис+ать в к+арту?", "Xo‘p. Kartaga yozaymi?"),
            (1, "Да, и сообщ+ите мне результ+аты. Я на обх+оде, б+уду ч+ерез д+есять мин+ут.",
             "Ha, natijalarni menga xabar qiling. Palatalarni aylanyapman, 10 daqiqada kelaman."),
        ]),
    ],
)

# ---------------------------------------------------------------------------
# 6. GOV
# ---------------------------------------------------------------------------
GOV = dict(
    fname="qollanma_gov.pdf",
    kicker="QO‘LLANMA · DAVLAT XIZMATI",
    title="Davlat xizmati: fuqarolar bilan rus tilida",
    title_ru="Р+абота с гражд+анами",
    short="Davlat xizmati",
    subtitle="Davlat idoralari, xizmat ko‘rsatish markazlari va fuqarolar bilan ishlaydiganlar uchun. "
             "Qabul, hujjatlar, tushuntirish, qiyin vaziyatlar va telefon — hamda 2 ta namunaviy dialog.",
    chips=[None, ("5", "ta mavzu"), ("2", "ta dialog")],
    sections=[
        dict(uz="Fuqaroni qabul qilish", ru="Приём гра́ждан", items=[
            ("Здр+авствуйте! По как+ому вопр+осу?", "Assalomu alaykum! Qaysi masala bo‘yicha?"),
            ("Проход+ите, в+аша +очередь.", "Kiring, navbatingiz keldi."),
            ("Предъяв+ите, пож+алуйста, п+аспорт.", "Iltimos, pasportingizni ko‘rsating."),
            ("Присаж+ивайтесь.", "O‘tiring."),
            ("Кто сл+едующий?", "Keyingi kim?"),
            ("Подожд+ите, пож+алуйста, вас приглас+ят.", "Iltimos, kuting, sizni chaqirishadi."),
        ]),
        dict(uz="Hujjatlar bilan ishlash", ru="Докуме́нты", items=[
            ("Зап+олните, пож+алуйста, заявл+ение.", "Iltimos, arizani to‘ldiring."),
            ("Вот обр+азец заполн+ения.", "Mana to‘ldirish namunasi."),
            ("Не хват+ает одн+ого докум+ента.", "Bitta hujjat yetishmayapti."),
            ("Нужн+ы оригин+ал и к+опия.", "Asl nusxasi va nusxasi kerak."),
            ("Распиш+итесь здесь, пож+алуйста.", "Iltimos, shu yerga imzo qo‘ying."),
            ("Укаж+ите +адрес и н+омер телеф+она.", "Manzil va telefon raqamini ko‘rsating."),
            ("Докум+енты б+удут гот+овы ч+ерез пять раб+очих дней.", "Hujjatlar besh ish kunida tayyor bo‘ladi."),
            ("Под+ать заявл+ение м+ожно онл+айн.", "Arizani onlayn ham topshirish mumkin."),
        ]),
        dict(uz="Tushuntirish", ru="Объясне́ние", items=[
            ("Дав+айте я объясн+ю по пор+ядку.", "Keling, tartib bilan tushuntiraman."),
            ("Снач+ала зап+олните ф+орму, пот+ом подойд+ите к окн+у н+омер три.", "Avval shaklni to‘ldiring, keyin 3-oynaga keling."),
            ("+Этим заним+ается друг+ой отд+ел.", "Bu bilan boshqa bo‘lim shug‘ullanadi."),
            ("Вам н+ужно в каб+инет н+омер пять.", "Sizga 5-xona kerak."),
            ("Приём с девят+и до шест+и.", "Qabul soat 9 dan 18 gacha."),
            ("Перер+ыв с ч+асу до двух.", "Tanaffus soat 13 dan 14 gacha."),
            ("Уточн+ите, пож+алуйста, в+ашу ситу+ацию.", "Iltimos, vaziyatingizni aniqroq aytib bering."),
        ]),
        dict(uz="Qiyin vaziyatlar", ru="Сло́жные ситуа́ции", items=[
            ("Я поним+аю, что +это неуд+обно.", "Bu noqulay ekanini tushunaman."),
            ("Дав+айте спок+ойно разберёмся.", "Keling, xotirjam holda aniqlab olaylik."),
            ("Я сд+елаю всё, что в мо+их с+илах.", "Qo‘limdan kelganini qilaman."),
            ("К сожал+ению, +это не вх+одит в мо+и полном+очия.", "Afsuski, bu mening vakolatimga kirmaydi."),
            ("Вы м+ожете ост+авить п+исьменное обращ+ение.", "Siz yozma murojaat qoldirishingiz mumkin."),
            ("Дав+айте найдём реш+ение вм+есте.", "Keling, birga yechim topaylik."),
        ], tip=("Ohang muhim",
                "Fuqaro asabiy bo‘lsa, avval uning his-tuyg‘usini tan oling («Я поним+аю…»), "
                "keyin aniq keyingi qadamni ayting. Tinch ovoz — eng yaxshi javob.")),
        dict(uz="Telefon va yozma javob", ru="Телефо́н и пи́сьма", items=[
            ("В+аше обращ+ение зарегистр+ировано.", "Murojaatingiz ro‘yxatga olindi."),
            ("Отв+ет прид+ёт вам на п+очту.", "Javob pochtangizga keladi."),
            ("Вам перезвон+ит специал+ист.", "Sizga mutaxassis qayta qo‘ng‘iroq qiladi."),
            ("Обращ+айтесь, +если б+удут вопр+осы.", "Savollar bo‘lsa, murojaat qiling."),
            ("Всег+о д+оброго!", "Hammasi yaxshi bo‘lsin! (xayrlashuv)"),
        ]),
    ],
    dialogues=[
        dict(title="Hujjat topshirish", context="Fuqaro ma’lumotnoma uchun hujjat topshirmoqchi, bitta hujjat yetishmaydi.",
             roles=("Xodim", "Fuqaro"), lines=[
            (0, "Здр+авствуйте! По как+ому вопр+осу?", "Assalomu alaykum! Qaysi masala bo‘yicha?"),
            (1, "Я хоч+у под+ать докум+енты на спр+авку.", "Ma’lumotnoma olish uchun hujjat topshirmoqchiman."),
            (0, "Предъяв+ите п+аспорт и заявл+ение, пож+алуйста.", "Pasport va arizangizni ko‘rsating."),
            (1, "Вот, пож+алуйста.", "Mana, marhamat."),
            (0, "Не хват+ает к+опии свид+етельства о рожд+ении.", "Tug‘ilganlik haqidagi guvohnoma nusxasi yetishmayapti."),
            (1, "А где м+ожно сд+елать к+опию?", "Nusxani qayerda qilsa bo‘ladi?"),
            (0, "На п+ервом этаж+е. Пот+ом подойд+ите ко мне без +очереди.", "Birinchi qavatda. Keyin navbatsiz menga keling."),
            (1, "Спас+ибо больш+ое!", "Katta rahmat!"),
        ]),
        dict(title="Norozi fuqaro bilan xotirjam suhbat", context="Fuqaro uchinchi marta keldi va asabiylashyapti.",
             roles=("Fuqaro", "Xodim"), lines=[
            (0, "Я уж+е тр+етий раз прихож+у! Почем+у ничег+о не гот+ово?", "Uchinchi marta kelyapman! Nega hech narsa tayyor emas?"),
            (1, "Я поним+аю, что +это неуд+обно. Дав+айте спок+ойно разберёмся. Как+ой н+омер у в+ашего заявл+ения?",
             "Bu noqulay ekanini tushunaman. Keling, xotirjam aniqlab olaylik. Arizangiz raqami qanday?"),
            (0, "Вот, на квит+анции.", "Mana, kvitansiyada."),
            (1, "В+аши докум+енты на пров+ерке. Он+и б+удут гот+овы в п+ятницу. Я запиш+у ваш телеф+он, и вам позвон+ят.",
             "Hujjatlaringiz tekshiruvda. Juma kuni tayyor bo‘ladi. Telefoningizni yozib olaman, sizga qo‘ng‘iroq qilishadi."),
            (0, "Хорош+о, спас+ибо.", "Yaxshi, rahmat."),
            (1, "Всег+о д+оброго!", "Hammasi yaxshi bo‘lsin!"),
        ]),
    ],
)

# ---------------------------------------------------------------------------
# 7. SALES
# ---------------------------------------------------------------------------
SALES = dict(
    fname="qollanma_sales.pdf",
    kicker="QO‘LLANMA · SAVDO",
    title="Savdo va mijozlar: rus tilida sotish",
    title_ru="Прод+ажи и кли+енты",
    short="Savdo va mijozlar",
    subtitle="Sotuvchi, menejer va mijozlar bilan ishlaydiganlar uchun. Ehtiyojni aniqlash, mahsulotni "
             "taqdim qilish, narx va shartlar, e’tirozlarga javob va bitimni yakunlash — hamda 2 ta dialog.",
    chips=[None, ("5", "ta mavzu"), ("2", "ta dialog")],
    sections=[
        dict(uz="Ehtiyojni aniqlash", ru="Выявле́ние потре́бностей", items=[
            ("Здр+авствуйте! Вам что-то подсказ+ать?", "Assalomu alaykum! Biror narsada yordam beraymi?"),
            ("Что вы ищ+ете?", "Nima qidiryapsiz?"),
            ("Для ког+о выбир+аете?", "Kim uchun tanlayapsiz?"),
            ("Для чег+о вам +это н+ужно?", "Bu sizga nima uchun kerak?"),
            ("Что для вас с+амое в+ажное?", "Siz uchun eng muhimi nima?"),
            ("На как+ую с+умму рассч+итываете?", "Qancha summaga mo‘ljallayapsiz?"),
            ("Пр+авильно я поним+аю, что вам н+ужно…?", "To‘g‘ri tushunyapmanmi, sizga … kerak?"),
        ]),
        dict(uz="Mahsulot taqdimoti", ru="Презента́ция това́ра", items=[
            ("Обрат+ите вним+ание на +эту мод+ель.", "Mana bu modelga e’tibor bering."),
            ("Гл+авное преим+ущество — к+ачество.", "Asosiy afzalligi — sifati."),
            ("+Это вам подойдёт, потом+у что…", "Bu sizga mos keladi, chunki…"),
            ("Дав+айте пок+ажу, как +это раб+отает.", "Keling, qanday ishlashini ko‘rsataman."),
            ("Хот+ите попр+обовать?", "Sinab ko‘rmoqchimisiz?"),
            ("Гар+антия — од+ин год.", "Kafolat — bir yil."),
            ("+Эту мод+ель ч+асто бер+ут для д+ома.", "Bu modelni ko‘pincha uy uchun olishadi."),
        ]),
        dict(uz="Narx va shartlar", ru="Цена́ и усло́вия", items=[
            ("Сейч+ас д+ействует ск+идка.", "Hozir chegirma amalda."),
            ("М+ожно оплат+ить в расср+очку.", "Bo‘lib to‘lash mumkin."),
            ("Вам уд+обнее к+артой +или нал+ичными?", "Karta bilan qulayroqmi yoki naqd?"),
            ("Дост+авка — в теч+ение двух дней.", "Yetkazib berish — ikki kun ichida."),
            ("+Если возьмёте два, б+удет в+ыгоднее.", "Ikkita olsangiz, foydaliroq bo‘ladi."),
            ("Предлож+ение д+ействует до п+ятницы.", "Taklif jumagacha amal qiladi."),
            ("Цен+а ук+азана с НДС.", "Narx QQS bilan ko‘rsatilgan."),
        ]),
        dict(uz="E’tirozlarga javob", ru="Рабо́та с возраже́ниями", items=[
            ("— Д+орого. — Поним+аю. Дав+айте сравн+им, что вы получ+аете за +эти д+еньги.",
             "— Qimmat. — Tushunaman. Keling, bu pulga nima olishingizni solishtiramiz."),
            ("— Я под+умаю. — Кон+ечно. Скаж+ите, что вас смущ+ает?",
             "— O‘ylab ko‘raman. — Albatta. Ayting-chi, sizni nima o‘ylantiryapti?"),
            ("— У друг+их деш+евле. — Возм+ожно. Но у нас гар+антия и серв+ис.",
             "— Boshqalarda arzonroq. — Bo‘lishi mumkin. Lekin bizda kafolat va servis bor."),
            ("— Мне не н+адо. — Поним+аю. М+ожно од+ин вопр+ос?",
             "— Menga kerak emas. — Tushunaman. Bitta savol bersam maylimi?"),
            ("— Я посов+етуюсь с жен+ой. — Хор+ошая ид+ея. Дав+айте я всё запиш+у, чт+обы вам б+ыло пр+още.",
             "— Xotinim bilan maslahatlashaman. — Yaxshi fikr. Keling, hammasini yozib beraman — sizga oson bo‘ladi."),
        ], tip=("Bahslashmang",
                "E’tirozga qarshi chiqmang. Avval «Поним+аю» deng, keyin savol bering yoki dalil keltiring. "
                "Mijoz o‘zini eshitilgan his qilsa, gapni davom ettiradi.")),
        dict(uz="Bitimni yakunlash", ru="Заверше́ние сде́лки", items=[
            ("Оформл+яем?", "Rasmiylashtiramizmi?"),
            ("Как+ой вари+ант вам б+ольше нр+авится?", "Qaysi variant sizga ko‘proq yoqyapti?"),
            ("Дав+айте я запиш+у ваш н+омер.", "Keling, raqamingizni yozib olay."),
            ("Спас+ибо за пок+упку!", "Xaridingiz uchun rahmat!"),
            ("+Если б+удут вопр+осы — звон+ите.", "Savollar bo‘lsa — qo‘ng‘iroq qiling."),
            ("Приход+ите ещё!", "Yana keling!"),
        ]),
    ],
    dialogues=[
        dict(title="Do‘konda: changyutgich tanlash", context="Xaridor kvartira uchun changyutgich qidiryapti.",
             roles=("Sotuvchi", "Xaridor"), lines=[
            (0, "Здр+авствуйте! Вам что-то подсказ+ать?", "Assalomu alaykum! Yordam kerakmi?"),
            (1, "Да, я ищ+у пылес+ос для кварт+иры.", "Ha, kvartira uchun changyutgich qidiryapman."),
            (0, "Что для вас с+амое в+ажное?", "Siz uchun eng muhimi nima?"),
            (1, "Чт+обы был т+ихим и лёгким.", "Ovozi past va yengil bo‘lsin."),
            (0, "Тогд+а обрат+ите вним+ание на +эту мод+ель. Он+а в+есит три килогр+амма и раб+отает т+ихо.",
             "Unda mana bu modelga e’tibor bering. U uch kilogramm keladi va ovozsiz ishlaydi."),
            (1, "Д+орого…", "Qimmat-ku…"),
            (0, "Поним+аю. Зат+о гар+антия два г+ода, и м+ожно оплат+ить в расср+очку.",
             "Tushunaman. Buning o‘rniga kafolati ikki yil va bo‘lib to‘lash mumkin."),
            (1, "Хорош+о, оформл+яем.", "Yaxshi, rasmiylashtiramiz."),
        ]),
        dict(title="Telefonda: mijozga qayta qo‘ng‘iroq", context="Kecha divan ko‘rib ketgan mijozga sotuvchi qo‘ng‘iroq qiladi.",
             roles=("Sotuvchi", "Mijoz"), lines=[
            (0, "Д+обрый д+ень, Ир+ина! +Это Аз+из из маг+азина «У+ют».", "Xayrli kun, Irina! Bu Aziz, «Uyut» do‘konidan."),
            (1, "Да, здр+авствуйте.", "Ha, assalomu alaykum."),
            (0, "Вы вчер+а смотр+ели див+ан. Ост+ались вопр+осы?", "Kecha divan ko‘rgan edingiz. Savollaringiz qoldimi?"),
            (1, "Я ещё д+умаю. Хот+ела посов+етоваться с м+ужем.", "Hali o‘ylayapman. Erim bilan maslahatlashmoqchi edim."),
            (0, "Кон+ечно. Ск+идка на +этот див+ан д+ействует до п+ятницы. Присл+ать вам ф+ото и усл+овия в Телегр+ам?",
             "Albatta. Bu divanga chegirma jumagacha amal qiladi. Rasm va shartlarni Telegramga yuboraymi?"),
            (1, "Да, присыл+айте.", "Ha, yuboring."),
            (0, "Отпр+авил. Спас+ибо, хор+ошего дня!", "Yubordim. Rahmat, kuningiz yaxshi o‘tsin!"),
        ]),
    ],
)

# ---------------------------------------------------------------------------
# 8. DAILY
# ---------------------------------------------------------------------------
DAILY = dict(
    fname="qollanma_daily.pdf",
    kicker="QO‘LLANMA · KUNDALIK MULOQOT",
    title="Kundalik muloqot: har kuni kerak bo‘ladigan ruscha",
    title_ru="Повседн+евное общ+ение",
    short="Kundalik muloqot",
    subtitle="Ruscha gaplashishni kundalik hayotdan boshlamoqchi bo‘lgan kattalar uchun. Tanishuv, do‘kon va bozor, "
             "transport, telefon, kafe va mehmondorchilik — hamda 2 ta namunaviy dialog.",
    chips=[None, ("5", "ta mavzu"), ("2", "ta dialog")],
    sections=[
        dict(uz="Tanishuv", ru="Знако́мство", items=[
            ("Дав+айте познак+омимся!", "Keling, tanishaylik!"),
            ("Мен+я зов+ут Аз+из. А вас?", "Ismim Aziz. Sizniki-chi?"),
            ("Отк+уда вы?", "Qayerliksiz?"),
            ("Чем вы заним+аетесь?", "Nima ish bilan shug‘ullanasiz?"),
            ("Вы давн+о здесь живёте?", "Bu yerda ancha vaqtdan beri yashaysizmi?"),
            ("Рад познак+омиться! / Р+ада познак+омиться!", "Tanishganimdan xursandman! (erkak / ayol)"),
            ("М+ожно на «ты»?", "«Sen» deb gaplashsak bo‘ladimi?"),
        ]),
        dict(uz="Do‘kon va bozor", ru="Магази́н и ры́нок", items=[
            ("Почём помид+оры?", "Pomidor qanchadan? (bozorda)"),
            ("Взв+есьте, пож+алуйста, килогр+амм.", "Iltimos, bir kilogramm tortib bering."),
            ("М+ожно посмотр+еть?", "Ko‘rsam bo‘ladimi?"),
            ("Есть разм+ер поб+ольше?", "Kattaroq o‘lcham bormi?"),
            ("Где прим+ерочная?", "Kiyib ko‘rish xonasi qayerda?"),
            ("М+ожно деш+евле?", "Arzonroq bo‘lmaydimi? (bozorda)"),
            ("Сд+ачи не н+адо.", "Qaytimi kerak emas."),
        ]),
        dict(uz="Transport", ru="Тра́нспорт", items=[
            ("Как до+ехать до вокз+ала?", "Vokzalga qanday borsa bo‘ladi? (transportda)"),
            ("Ск+олько ст+оит пр+оезд?", "Yo‘l haqi qancha?"),
            ("На как+ой остан+овке выход+ить?", "Qaysi bekatda tushish kerak?"),
            ("Вы вых+одите на сл+едующей?", "Keyingi bekatda tushasizmi?"),
            ("Отвез+ите мен+я по +этому +адресу.", "Meni shu manzilga olib boring. (taksida)"),
            ("Ск+олько +ехать?", "Yo‘l qancha vaqt oladi?"),
            ("Где м+ожно куп+ить бил+ет?", "Chiptani qayerdan olsa bo‘ladi?"),
        ]),
        dict(uz="Telefonda", ru="По телефо́ну", items=[
            ("Алл+о, сл+ушаю вас.", "Allo, eshitaman."),
            ("М+ожно Аз+иза к телеф+ону?", "Azizni telefonga chaqirib yuborasizmi?"),
            ("Я сейч+ас не мог+у говор+ить.", "Hozir gaplasha olmayman."),
            ("Перезвон+ите мне, пож+алуйста, п+озже.", "Iltimos, keyinroq qo‘ng‘iroq qiling."),
            ("Напиш+ите мне в Телегр+ам.", "Menga Telegramda yozing."),
            ("Плох+ая связь, вас не сл+ышно.", "Aloqa yomon, ovozingiz eshitilmayapti."),
        ]),
        dict(uz="Kafe va mehmonda", ru="В кафе́ и в гостя́х", items=[
            ("М+ожно мен+ю?", "Menyuni bersangiz?"),
            ("Что вы посов+етуете?", "Nima tavsiya qilasiz?"),
            ("+Это без св+инины?", "Bu cho‘chqa go‘shtisizmi?"),
            ("Счёт, пож+алуйста.", "Hisobni olib keling, iltimos."),
            ("+Очень вк+усно, спас+ибо!", "Juda mazali, rahmat!"),
            ("Угощ+айтесь!", "Oling, marhamat! (mehmonga)"),
        ]),
    ],
    dialogues=[
        dict(title="Qo‘shni bilan tanishuv", context="Aziz yangi uyga ko‘chib keldi, zinada qo‘shnisini uchratdi.",
             roles=("Qo‘shni", "Aziz"), lines=[
            (0, "Здр+авствуйте! Вы наш н+овый сос+ед?", "Assalomu alaykum! Yangi qo‘shnimizmisiz?"),
            (1, "Да, я вчер+а пере+ехал.", "Ha, kecha ko‘chib keldim."),
            (0, "+Очень при+ятно! Мен+я зов+ут +Ольга.", "Juda xursandman! Ismim Olga."),
            (1, "Аз+из. Я из Узбекист+ана, раб+отаю инжен+ером.", "Aziz. O‘zbekistondanman, muhandis bo‘lib ishlayman."),
            (0, "Вы хорош+о говор+ите по-р+усски!", "Ruschani yaxshi gapirar ekansiz!"),
            (1, "Спас+ибо, я уч+у яз+ык.", "Rahmat, tilni o‘rganyapman."),
            (0, "+Если что-то н+ужно — стуч+ите, я в дв+адцать п+ятой кварт+ире.", "Biror narsa kerak bo‘lsa — eshikni taqillating, men 25-xonadonda yashayman."),
            (1, "Спас+ибо больш+ое!", "Katta rahmat!"),
        ]),
        dict(title="Bozorda", context="Aziz bozorda pomidor va ko‘kat olyapti.",
             roles=("Aziz", "Sotuvchi"), lines=[
            (0, "Здр+авствуйте! Почём помид+оры?", "Assalomu alaykum! Pomidor qanchadan?"),
            (1, "+Эти — подеш+евле, а +эти — с+амые сл+адкие.", "Bular arzonroq, bular esa eng shirini."),
            (0, "Д+айте сл+адкие. Взв+есьте, пож+алуйста, два кил+о.", "Shirinidan bering. Iltimos, ikki kilo torting."),
            (1, "Что-нибудь ещё?", "Yana biror narsa kerakmi?"),
            (0, "Да, з+елень. А м+ожно немн+ого деш+евле?", "Ha, ko‘kat ham. Biroz arzonroq qilsangiz bo‘ladimi?"),
            (1, "Л+адно, з+елень — в под+арок!", "Mayli, ko‘kati — sovg‘a!"),
            (0, "Договор+ились! Спас+ибо!", "Kelishdik! Rahmat!"),
        ]),
    ],
)

# ---------------------------------------------------------------------------
# 9. SMENA — migrantlar: ish va smena
# ---------------------------------------------------------------------------
SMENA = dict(
    fname="qollanma_smena.pdf",
    kicker="QO‘LLANMA · ROSSIYADA ISH",
    title="Ish va smena: brigadir, grafik va maosh haqida ruscha",
    title_ru="Раб+ота и см+ены",
    short="Ish va smena",
    subtitle="Rossiyada ishlayotgan yoki ishga ketmoqchi bo‘lgan yurtdoshlarimiz uchun. Brigadir bilan gaplashish, "
             "ish grafigi, maosh savollari, xavfsizlik va hamkasblar bilan muloqot — hamda 2 ta dialog.",
    chips=[None, ("5", "ta mavzu"), ("2", "ta dialog")],
    sections=[
        dict(uz="Brigadir bilan", ru="С бригади́ром", items=[
            ("Здр+авствуйте! Я н+овенький. К ком+у мне подойт+и?", "Assalomu alaykum! Men yangi kelganman. Kimga murojaat qilay?"),
            ("Что мне сег+одня д+елать?", "Bugun nima qilay?"),
            ("Покаж+ите, пож+алуйста, как +это д+елается.", "Iltimos, bu qanday qilinishini ko‘rsating."),
            ("Я зак+ончил. Что д+альше?", "Tugatdim. Endi nima qilay? (ayol: зак+ончила)"),
            ("Где взять инструм+ент?", "Asbobni qayerdan olsam bo‘ladi?"),
            ("М+ожно сд+елать перер+ыв?", "Tanaffus qilsam bo‘ladimi?"),
            ("П+онял, сд+елаю.", "Tushundim, qilaman."),
            ("Повтор+ите, пож+алуйста, помедл+еннее.", "Iltimos, sekinroq takrorlang."),
        ]),
        dict(uz="Grafik va smena", ru="Гра́фик и сме́ны", items=[
            ("Во ск+олько начин+ается см+ена?", "Smena soat nechada boshlanadi?"),
            ("Я раб+отаю в ночн+ую см+ену.", "Tungi smenada ishlayman."),
            ("Как+ой у мен+я гр+афик?", "Mening ish grafigim qanday?"),
            ("У нас гр+афик два ч+ерез два.", "Bizda grafik: ikki kun ish, ikki kun dam."),
            ("М+ожно помен+яться см+енами?", "Smenalarni almashtirsak bo‘ladimi?"),
            ("З+автра у мен+я выходн+ой?", "Ertaga dam olish kunimmi?"),
            ("Я заб+олел, сег+одня не смог+у в+ыйти.", "Kasal bo‘lib qoldim, bugun ishga chiqa olmayman. (ayol: заб+олела)"),
        ]),
        dict(uz="Ish haqi", ru="Зарпла́та", items=[
            ("Когд+а б+удет зарпл+ата?", "Maosh qachon beriladi?"),
            ("Ск+олько пл+атят за час?", "Bir soatga qancha to‘lashadi?"),
            ("За перераб+отку допл+ачивают?", "Qo‘shimcha ish uchun ustama to‘lanadimi?"),
            ("М+ожно расчётный л+исток?", "Hisob varaqasini olsam bo‘ladimi?"),
            ("Мне не заплат+или за две см+ены.", "Ikki smena uchun menga pul to‘lanmadi."),
            ("Зарпл+ата на к+арту +или нал+ичными?", "Maosh kartagami yoki naqdmi?"),
        ]),
        dict(uz="Xavfsizlik", ru="Те́хника безопа́сности", items=[
            ("Где к+аска и перч+атки?", "Kaska va qo‘lqoplar qayerda?"),
            ("Остор+ожно!", "Ehtiyot bo‘ling!"),
            ("Стой! Не включ+ай!", "To‘xta! Yoqma!"),
            ("Здесь оп+асно, не подход+и.", "Bu yer xavfli, yaqinlashma."),
            ("Я пор+анился. Где апт+ечка?", "Jarohatlandim. Aptechka qayerda? (ayol: пор+анилась)"),
            ("В+ызовите ск+орую!", "Tez yordam chaqiring!"),
            ("Где запасн+ой в+ыход?", "Favqulodda chiqish qayerda?"),
        ], tip=("Bu so‘zlarni birinchi o‘rganing",
                "«Остор+ожно!», «Стой!», «Оп+асно!» — eshitishingiz bilan darhol to‘xtang va atrofga qarang. "
                "Ish joyida bu so‘zlar sog‘lig‘ingizni asraydi.")),
        dict(uz="Hamkasblar bilan", ru="С колле́гами", items=[
            ("Дав+ай помог+у.", "Kel, yordam beray."),
            ("Подерж+и, пож+алуйста.", "Iltimos, ushlab tur."),
            ("Пошл+и об+едать.", "Yur, tushlik qilamiz."),
            ("Во ск+олько авт+обус на раб+оту?", "Ishga avtobus soat nechada?"),
            ("Спас+ибо, брат!", "Rahmat, birodar!"),
        ]),
    ],
    dialogues=[
        dict(title="Birinchi ish kuni", context="Jasur omborga ishga keldi va brigadir bilan tanishyapti.",
             roles=("Jasur", "Brigadir"), lines=[
            (0, "Здр+авствуйте! Я н+овенький, мен+я зов+ут Ж+асур.", "Assalomu alaykum! Men yangiman, ismim Jasur."),
            (1, "Прив+ет, Ж+асур. Я Серг+ей, бригад+ир. Сег+одня б+удешь на скл+аде.", "Salom, Jasur. Men Sergey, brigadirman. Bugun omborda ishlaysan."),
            (0, "Что н+ужно д+елать?", "Nima qilish kerak?"),
            (1, "Разгруж+ать кор+обки и ст+авить на п+олки. Тяжёлое — вдвоём.", "Qutilarni tushirib, javonlarga qo‘yish. Og‘irini — ikki kishi bo‘lib."),
            (0, "П+онял. А где взять перч+атки?", "Tushundim. Qo‘lqopni qayerdan olay?"),
            (1, "Вон там, у вх+ода. Без перч+аток не раб+отать!", "Ana u yerda, kirish yonida. Qo‘lqopsiz ishlash mumkin emas!"),
            (0, "Хорош+о. А во ск+олько об+ед?", "Xo‘p. Tushlik soat nechada?"),
            (1, "С ч+асу до двух.", "Soat birdan ikkigacha."),
        ]),
        dict(title="Grafik va maosh haqida", context="Jasur brigadirdan ish tartibini aniqlab olyapti.",
             roles=("Jasur", "Brigadir"), lines=[
            (0, "Серг+ей, м+ожно вопр+ос? Как+ой у мен+я гр+афик?", "Sergey, savol bersam bo‘ladimi? Mening grafigim qanday?"),
            (1, "Два ч+ерез два, с восьм+и до восьм+и.", "Ikki kun ish, ikki kun dam, sakkizdan sakkizgacha."),
            (0, "А когд+а зарпл+ата?", "Maosh qachon?"),
            (1, "Два р+аза в м+есяц: ав+анс и расчёт.", "Oyiga ikki marta: avans va asosiy hisob-kitob."),
            (0, "А за перераб+отку допл+ачивают?", "Qo‘shimcha soatlar uchun ustama to‘lanadimi?"),
            (1, "Да, всё б+удет в расчётном л+истке.", "Ha, hammasi hisob varaqasida ko‘rsatiladi."),
            (0, "Спас+ибо, всё пон+ятно.", "Rahmat, hammasi tushunarli."),
        ]),
    ],
)

# ---------------------------------------------------------------------------
# 10. HUJJAT — hujjatlar va patent (axborot uchun)
# ---------------------------------------------------------------------------
HUJJAT = dict(
    fname="qollanma_hujjat.pdf",
    kicker="QO‘LLANMA · HUJJATLAR",
    title="Hujjatlar idorasida: rus tilida o‘zingizni tanishtirish",
    title_ru="В миграци+онном ц+ентре",
    short="Hujjatlar idorasida",
    subtitle="Rossiyada hujjat, patent yoki ro‘yxatdan o‘tish masalasida idoraga boradiganlar uchun til mashqi. "
             "O‘zingizni tanishtirish, beriladigan savollarni tushunish va xotirjam javob berish — hamda 2 ta dialog.",
    chips=[None, ("5", "ta mavzu"), ("2", "ta dialog")],
    disclaimer=("Axborot uchun",
                "Bu qo‘llanma faqat rus tilida muloqot mashqi uchun. U yuridik maslahat emas va hech qanday "
                "natijani kafolatlamaydi. Hujjatlar bo‘yicha talablar va tartiblar o‘zgarib turadi — "
                "aniq ma’lumotni faqat rasmiy idoralardan oling."),
    sections=[
        dict(uz="O‘zingizni tanishtirish", ru="Предста́виться", items=[
            ("Здр+авствуйте. Я граждан+ин Узбекист+ана.", "Assalomu alaykum. Men O‘zbekiston fuqarosiman. (ayol: гражд+анка)"),
            ("Мо+я фам+илия — Кар+имов, +имя — Аз+из.", "Familiyam — Karimov, ismim — Aziz."),
            ("Я при+ехал на раб+оту.", "Ishlash uchun kelganman. (ayol: при+ехала)"),
            ("Я жив+у по +адресу…", "Men … manzilida yashayman."),
            ("Мой н+омер телеф+она…", "Telefon raqamim …"),
            ("Вот мой п+аспорт.", "Mana pasportim."),
        ]),
        dict(uz="Sizga beriladigan savollar", ru="Вопро́сы, кото́рые вам зада́дут", items=[
            ("Цель при+езда?", "Kelishdan maqsadingiz?"),
            ("Где вы раб+отаете?", "Qayerda ishlaysiz?"),
            ("Где вы прожив+аете?", "Qayerda yashaysiz?"),
            ("Когд+а вы въ+ехали в Росс+ию?", "Rossiyaga qachon kirgansiz?"),
            ("Покаж+ите миграци+онную к+арту.", "Migratsiya kartangizni ko‘rsating."),
            ("Зап+олните анк+ету.", "Anketani to‘ldiring."),
            ("Распиш+итесь вот здесь.", "Mana shu yerga imzo qo‘ying."),
            ("Подожд+ите, вас в+ызовут.", "Kuting, sizni chaqirishadi."),
        ]),
        dict(uz="Savol berish", ru="Как спроси́ть", items=[
            ("Извин+ите, я не п+онял вопр+ос. Повтор+ите, пож+алуйста.", "Kechirasiz, savolni tushunmadim. Iltimos, takrorlang."),
            ("Как+ие докум+енты нужн+ы?", "Qanday hujjatlar kerak?"),
            ("В как+ое окн+о мне подойт+и?", "Qaysi oynaga borishim kerak?"),
            ("Где м+ожно сд+елать ф+ото?", "Qayerda suratga tushsa bo‘ladi?"),
            ("Где м+ожно оплат+ить?", "Qayerda to‘lasa bo‘ladi?"),
            ("Ск+олько вр+емени +это займёт?", "Bu qancha vaqt oladi?"),
            ("Есть обр+азец заполн+ения?", "To‘ldirish namunasi bormi?"),
            ("Когд+а прийт+и за докум+ентом?", "Hujjat uchun qachon kelay?"),
        ]),
        dict(uz="Navbatda", ru="В о́череди", items=[
            ("Кто посл+едний?", "Oxirgi kim? (navbatda)"),
            ("Я за в+ами.", "Men sizdan keyinman."),
            ("Где взять тал+он?", "Talonni qayerdan olsa bo‘ladi?"),
            ("Приём по з+аписи?", "Qabul oldindan yozilish orqalimi?"),
            ("Во ск+олько вы закрыв+аетесь?", "Soat nechada yopilasizlar?"),
        ]),
        dict(uz="Muloyim munosabat", ru="Ве́жливость", items=[
            ("Подскаж+ите, пож+алуйста…", "Ayting-chi, iltimos…"),
            ("Извин+ите за беспок+ойство.", "Bezovta qilganim uchun uzr."),
            ("Спас+ибо за п+омощь.", "Yordamingiz uchun rahmat."),
            ("Хор+ошего дня!", "Kuningiz yaxshi o‘tsin!"),
        ], tip=("Xotirjamlik — eng yaxshi yordamchi",
                "Tushunmasangiz, taxmin qilib javob bermang — qayta so‘rang. «Повтор+ите, пож+алуйста, медл+еннее» "
                "deyish mutlaqo normal holat.")),
    ],
    dialogues=[
        dict(title="Oynada: anketa to‘ldirish", context="Siz hujjat topshirish uchun oynaga keldingiz.",
             roles=("Xodim", "Siz"), lines=[
            (0, "Сл+едующий! Здр+авствуйте, ваш п+аспорт.", "Keyingisi! Assalomu alaykum, pasportingiz."),
            (1, "Здр+авствуйте. Вот п+аспорт и миграци+онная к+арта.", "Assalomu alaykum. Mana pasport va migratsiya kartasi."),
            (0, "Цель при+езда?", "Kelishdan maqsadingiz?"),
            (1, "Раб+ота.", "Ish."),
            (0, "Зап+олните анк+ету. Вот обр+азец.", "Anketani to‘ldiring. Mana namuna."),
            (1, "Извин+ите, я не п+онял +эту строк+у. Что н+ужно напис+ать здесь?", "Kechirasiz, bu qatorni tushunmadim. Bu yerga nima yozish kerak?"),
            (0, "Здесь — ваш +адрес в Росс+ии.", "Bu yerga — Rossiyadagi manzilingiz."),
            (1, "П+онял, спас+ибо.", "Tushundim, rahmat."),
        ]),
        dict(title="Navbatda: yo‘l-yo‘riq so‘rash", context="Siz navbatga turdingiz va pasport nusxasini qayerda qilishni so‘rayapsiz.",
             roles=("Siz", "Ayol"), lines=[
            (0, "Извин+ите, кто посл+едний?", "Kechirasiz, oxirgi kim?"),
            (1, "Я. Вы за мн+ой.", "Men. Siz mendan keyin."),
            (0, "Спас+ибо. Подскаж+ите, где м+ожно сд+елать к+опию п+аспорта?", "Rahmat. Ayting-chi, pasport nusxasini qayerda qilsa bo‘ladi?"),
            (1, "На втор+ом этаж+е, у л+естницы.", "Ikkinchi qavatda, zinapoya yonida."),
            (0, "А д+олго ждать?", "Uzoq kutiladimi?"),
            (1, "Мин+ут дв+адцать.", "Yigirma daqiqacha."),
            (0, "Спас+ибо больш+ое!", "Katta rahmat!"),
        ]),
    ],
)

# ---------------------------------------------------------------------------
# 11. KUNDALIK — migrantlar kundalik hayoti
# ---------------------------------------------------------------------------
KUNDALIK = dict(
    fname="qollanma_kundalik.pdf",
    kicker="QO‘LLANMA · ROSSIYADA HAYOT",
    title="Rossiyada kundalik hayot: shifokor, politsiya, yo‘l",
    title_ru="Повседн+евная жизнь",
    short="Kundalik hayot",
    subtitle="Rossiyada yashayotgan va ishlayotgan yurtdoshlarimiz uchun. Shifokor va dorixonada, politsiya bilan "
             "xotirjam va hurmatli muloqot, yo‘l so‘rash va maishiy masalalar — hamda 2 ta dialog.",
    chips=[None, ("4", "ta mavzu"), ("2", "ta dialog")],
    sections=[
        dict(uz="Shifokor va dorixona", ru="Врач и апте́ка", items=[
            ("Мне н+ужно к врач+у.", "Menga shifokor kerak."),
            ("Где здесь поликл+иника?", "Bu yerda poliklinika qayerda?"),
            ("У мен+я есть медиц+инская страх+овка.", "Menda tibbiy sug‘urta bor."),
            ("У мен+я бол+ит зуб.", "Tishim og‘riyapti."),
            ("У мен+я температ+ура и к+ашель.", "Isitmam va yo‘talim bor."),
            ("Где ближ+айшая апт+ека?", "Eng yaqin dorixona qayerda?"),
            ("Д+айте что-нибудь от прост+уды.", "Shamollashga qarshi biror narsa bering."),
            ("Как приним+ать +это лек+арство?", "Bu dorini qanday ichish kerak?"),
        ]),
        dict(uz="Politsiya bilan xotirjam muloqot", ru="Разгово́р с поли́цией", items=[
            ("Здр+авствуйте. Да, кон+ечно.", "Assalomu alaykum. Ha, albatta."),
            ("Вот мо+и докум+енты.", "Mana hujjatlarim."),
            ("Я пл+охо поним+аю. Говор+ите, пож+алуйста, помедл+еннее.", "Yaxshi tushunmayapman. Iltimos, sekinroq gapiring."),
            ("Я раб+отаю здесь недалек+о.", "Shu yaqin atrofda ishlayman."),
            ("М+ожно позвон+ить родств+еннику?", "Qarindoshimga qo‘ng‘iroq qilsam bo‘ladimi?"),
            ("Мне н+ужен перев+одчик.", "Menga tarjimon kerak."),
            ("Хорош+о, я п+онял.", "Xo‘p, tushundim."),
        ], tip=("Ohang hal qiladi",
                "Doim xotirjam va hurmat bilan gapiring, «вы» deng, qo‘llaringizni ko‘rinadigan joyda tuting. "
                "Tushunmasangiz — taxmin qilmang, qayta so‘rang.")),
        dict(uz="Yo‘l so‘rash va transport", ru="Как пройти́", items=[
            ("Извин+ите, как пройт+и к метр+о?", "Kechirasiz, metroga qanday o‘tsa bo‘ladi?"),
            ("+Это далек+о?", "Bu uzoqmi?"),
            ("Ид+ите пр+ямо, пот+ом напр+аво.", "To‘g‘riga yuring, keyin o‘ngga buriling."),
            ("Поверн+ите нал+ево.", "Chapga buriling."),
            ("На как+ой авт+обус мне сесть?", "Qaysi avtobusga chiqishim kerak?"),
            ("Где пополн+ить тр+анспортную к+арту?", "Transport kartasini qayerda to‘ldirsa bo‘ladi?"),
            ("Как+ая сл+едующая остан+овка?", "Keyingi bekat qaysi?"),
            ("Мне н+ужно в+ыйти здесь.", "Men shu yerda tushishim kerak."),
        ]),
        dict(uz="Maishiy masalalar", ru="Бытовы́е вопро́сы", items=[
            ("Где ближ+айший банком+ат?", "Eng yaqin bankomat qayerda?"),
            ("Где м+ожно отпр+авить д+еньги дом+ой?", "Uyga qayerdan pul jo‘natsa bo‘ladi?"),
            ("Я ищ+у к+омнату.", "Xona qidiryapman."),
            ("Ск+олько ст+оит ар+енда в м+есяц?", "Ijara oyiga qancha turadi?"),
            ("Где куп+ить сим-к+арту?", "SIM-kartani qayerdan olsa bo‘ladi?"),
            ("У мен+я слом+ался кран. Вы м+ожете посмотр+еть?", "Jo‘mrak buzildi. Qarab bera olasizmi?"),
            ("Я заблуд+ился. Помог+ите, пож+алуйста.", "Adashib qoldim. Iltimos, yordam bering."),
        ]),
    ],
    dialogues=[
        dict(title="Dorixonada", context="Tomog‘ingiz og‘riyapti va dorixonaga kirdingiz.",
             roles=("Siz", "Farmatsevt"), lines=[
            (0, "Здр+авствуйте! У мен+я бол+ит г+орло. Что вы посов+етуете?", "Assalomu alaykum! Tomog‘im og‘riyapti. Nima tavsiya qilasiz?"),
            (1, "Температ+ура есть?", "Isitmangiz bormi?"),
            (0, "Небольш+ая.", "Ozgina."),
            (1, "Вот спрей для г+орла и леденц+ы.", "Mana tomoq uchun sprey va so‘rib iste’mol qilinadigan tabletkalar."),
            (0, "Как их приним+ать?", "Ularni qanday qo‘llash kerak?"),
            (1, "Спрей — три р+аза в день, п+осле ед+ы. +Если ст+анет х+уже — обрат+итесь к врач+у.",
             "Sprey — kuniga uch marta, ovqatdan keyin. Ahvolingiz yomonlashsa — shifokorga murojaat qiling."),
            (0, "Спас+ибо! М+ожно оплат+ить к+артой?", "Rahmat! Karta bilan to‘lasam bo‘ladimi?"),
            (1, "Да, кон+ечно.", "Ha, albatta."),
        ]),
        dict(title="Ko‘chada: hujjat tekshiruvi", context="Politsiya xodimi hujjatlaringizni so‘radi. Xotirjam va muloyim gaplashing.",
             roles=("Politsiyachi", "Siz"), lines=[
            (0, "Здр+авствуйте. Серж+ант Иван+ов. В+аши докум+енты, пож+алуйста.", "Assalomu alaykum. Serjant Ivanov. Hujjatlaringizni ko‘rsating, iltimos."),
            (1, "Здр+авствуйте. Да, кон+ечно. Вот.", "Assalomu alaykum. Ha, albatta. Mana."),
            (0, "Где вы раб+отаете?", "Qayerda ishlaysiz?"),
            (1, "На скл+аде, недалек+о отс+юда.", "Omborda, shu yaqin atrofda."),
            (0, "Куд+а сейч+ас идёте?", "Hozir qayerga ketyapsiz?"),
            (1, "Дом+ой, с раб+оты.", "Uyga, ishdan."),
            (0, "Хорош+о, всё в пор+ядке. Всег+о д+оброго.", "Yaxshi, hammasi joyida. Xayr."),
            (1, "Спас+ибо, до свид+ания.", "Rahmat, xayr."),
        ]),
    ],
)

ALL = [SOVGA, UMUMIY, OFFICE, BANK, MED, GOV, SALES, DAILY, SMENA, HUJJAT, KUNDALIK]
