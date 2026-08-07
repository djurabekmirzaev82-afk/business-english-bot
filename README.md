# Business English in Surkhandarya Region — Telegram Bot (MVP)

Surxondaryo viloyati uchun Business English ta'lim platformasining Telegram bot MVP versiyasi.

## Bu bosqichda nima ishlaydi

- ✅ `/start` — foydalanuvchini ro'yxatdan o'tkazadi (PostgreSQL'da avtomatik)
- ✅ **📝 Placement Test** — 20 ta savol (A1→C1, grammar/vocabulary/reading), natija bo'yicha CEFR darajasini aniqlaydi va bazaga yozadi
- ✅ **👨‍🎓 Mening kabinetim** — profil, joriy daraja, so'nggi test natijasi, urinishlar soni
- ✅ **💼 Business English** — 12 ta modul (Meetings, Negotiation, Finance, HR va h.k.), har birida lug'at, foydali iboralar, namuna dialog
- ✅ **📅 Schedule** va **☎ Contact** — statik ma'lumot (`src/config/orgInfo.js` faylida tahrirlanadi)
- ✅ **✍ Writing** — matn turini tanlaysiz (Formal Email, CV, Report va h.k.), ingliz tilida yozib yuborasiz, **Claude AI** ball va batafsil feedback beradi (Uzbek tilida)
- ✅ **🎤 Speaking Club** — AI bilan matnli (text) rolli o'yin: Negotiation, Interview, Telephone English va h.k. Suhbat oxirida AI qisqa feedback beradi
- 🚧 **📚 Courses** — hali "tez orada" javobini qaytaradi, keyingi bosqichda to'ldiriladi
- ⚠️ **Writing va Speaking Club ishlashi uchun `ANTHROPIC_API_KEY` kerak** — quyidagi "AI Tutor sozlash" bo'limiga qarang. Kalit bo'lmasa, bu ikki bo'lim foydalanuvchiga tushunarli xabar bilan to'xtaydi (bot yiqilib qolmaydi).

## Texnologiyalar

- Node.js + [Telegraf.js](https://telegraf.js.org/) v4
- PostgreSQL (`pg` driver, connection pool)
- `dotenv` konfiguratsiya uchun

## O'rnatish

### 1. Talablar
- Node.js 18+
- PostgreSQL 13+ (lokal yoki Railway/Render/Supabase kabi hosted xizmat)
- Telegram bot tokeni ([@BotFather](https://t.me/BotFather) orqali oling)

### 2. Loyihani sozlash

```bash
cd business-english-bot
npm install
cp .env.example .env
```

`.env` faylini oching va to'ldiring:

```
BOT_TOKEN=<BotFather bergan token>
DATABASE_URL=postgres://user:password@host:5432/dbname
DATABASE_SSL=false   # hosted Postgres (Railway/Supabase) uchun true qiling
ANTHROPIC_API_KEY=   # keyingi bosqich uchun, hozircha bo'sh qoldirsa ham bo'ladi
```

### 3. Bazani tayyorlash

```bash
npm run migrate   # jadvallarni yaratadi: users, test_questions, test_attempts, test_answers
npm run seed       # 20 ta placement test savolini yuklaydi
```

### 4. Botni ishga tushirish

```bash
npm start          # production
npm run dev         # avtomatik qayta yuklash bilan (Node 18+ --watch)
```

Konsolda quyidagini ko'rasiz:
```
✅ Business English Surxondaryo bot ishga tushdi (polling mode).
```

Telegram'da botingizni oching va `/start` bosing.

## AI Tutor sozlash (Writing va Speaking Club uchun)

Bu ikki bo'lim [Anthropic Claude API](https://console.anthropic.com/) orqali ishlaydi. Kalitsiz qolgan bo'limlar (Placement Test, Kabinet, Business English, Schedule, Contact) bunga muhtoj emas.

### API kalitini olish

1. [console.anthropic.com](https://console.anthropic.com/) saytida ro'yxatdan o'ting
2. Chap menyudan **"API Keys"** bo'limiga o'ting
3. **"Create Key"** tugmasini bosing, nom bering (masalan `business-english-bot`)
4. Yaratilgan kalitni (`sk-ant-...` bilan boshlanadi) nusxalab oling — **faqat bir marta to'liq ko'rsatiladi**
5. Hisobingizga to'lov usuli (karta) qo'shish kerak bo'ladi — Claude Haiku modeli juda arzon (bir nechta test uchun bir necha sentga to'g'ri keladi)

### `.env` fayliga qo'shish

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

Saqlang va botni qayta ishga tushiring (`Ctrl+C`, keyin `npm start`).

## Loyiha tuzilishi

```
business-english-bot/
├── src/
│   ├── bot/
│   │   ├── index.js              # Bot bootstrap — barcha handlerlar shu yerda bog'lanadi
│   │   ├── keyboards.js          # Asosiy menyu, inline tugmalar
│   │   ├── middleware/
│   │   │   └── ensureUser.js     # Har bir update'da foydalanuvchini DB'da topadi/yaratadi
│   │   └── handlers/
│   │       ├── start.js          # /start
│   │       ├── placementTest.js  # Test oqimi (savol → javob → natija)
│   │       ├── cabinet.js        # Mening kabinetim
│   │       ├── businessEnglish.js# Business English modullari menyusi
│   │       ├── orgInfo.js        # Schedule / Contact
│   │       ├── writing.js        # Writing + AI tekshiruvi
│   │       ├── speaking.js       # Speaking Club + AI roleplay
│   │       └── comingSoon.js     # Hali qurilmagan bo'limlar uchun placeholder
│   ├── services/
│   │   ├── userService.js        # Foydalanuvchi CRUD, kabinet ma'lumotlari
│   │   ├── testEngine.js         # Test urinishlarini boshqarish, ballarni CEFR'ga aylantirish
│   │   └── aiTutor.js            # Claude API wrapper (writing check, roleplay)
│   ├── db/
│   │   ├── schema.sql            # Jadval strukturasi
│   │   ├── migrate.js            # Schema'ni bazaga qo'llaydi
│   │   ├── seed.js               # Test savollarini yuklaydi
│   │   └── pool.js               # PostgreSQL connection pool
│   ├── data/
│   │   ├── questions.json        # 20 ta placement test savoli
│   │   └── businessModules.json  # 12 ta Business English modul kontenti
│   ├── config/
│   │   ├── index.js              # .env'ni o'qiydi, validatsiya qiladi
│   │   └── orgInfo.js            # Schedule/Contact matnlari — shu yerni tahrirlang
│   └── index.js                  # Kirish nuqtasi (bot.launch())
├── .env.example
└── package.json
```

## Ma'lumotlar bazasi sxemasi

| Jadval | Vazifasi |
|---|---|
| `users` | Telegram foydalanuvchilari, ism, til, CEFR darajasi, rol (student/teacher/admin) |
| `test_questions` | Placement test savol banki (level, skill, options, to'g'ri javob) |
| `test_attempts` | Har bir test urinishi (boshlanish/tugash vaqti, ball, natija darajasi) |
| `test_answers` | Har bir urinishdagi har bir savolga berilgan javob |

`role` ustuni `users` jadvalida allaqachon mavjud — keyingi bosqichda Teacher/Admin panel shu ustun ustiga quriladi.

## Keyingi bosqichlar (roadmap)

Loyihaning to'liq ko'lami (asl texnik topshiriqdan):

1. ✅ ~~**AI Tutor** (Claude API) — asosiy ulanish~~ — Writing va Speaking Club orqali ishlayapti
2. ✅ ~~**Business English modullari**~~ — 12 ta modul kontent bilan tayyor
3. ✅ ~~**Writing baholash**~~ — AI orqali ball va feedback ishlayapti
4. ✅ ~~**Speaking Club**~~ — matnli AI roleplay ishlayapti (ovozli xabar/pronunciation baholash hali yo'q — quyiga qarang)
5. 🚧 **Ovozli Speaking** — foydalanuvchi voice message yuborsa, talaffuzni AI baholashi (nutqni matnga aylantirish — masalan Whisper API — qo'shimcha xizmat kerak bo'ladi)
6. 🚧 **Courses** — kurslar ro'yxati va Placement Test natijasiga qarab tavsiya
7. 🚧 **Gamification** — XP, coins, Bronze→Platinum darajalar, leaderboard
8. 🚧 **Teacher panel** — talabalar ro'yxati, davomat, uy vazifasi, baholar
9. 🚧 **Admin panel** (alohida React/Next.js) — statistika, guruhlar, to'lovlar
10. 🚧 **To'lov integratsiyasi** — Click, Payme, Uzum Bank
11. 🚧 **Sertifikatlar** — PDF + QR kod + tekshiruv tizimi
12. 🚧 **Ko'p tillilik** — hozir `users.language` ustuni tayyor (uz/ru/en), UI matnlarini shunga qarab almashtirish kerak

### Xarajat haqida eslatma (AI qismi)

Writing tekshiruvi va Speaking Club har bir so'rov uchun Claude API'ga murojaat qiladi — bu pullik (lekin Haiku modeli juda arzon, bir necha so'rov uchun sentning ulushi). Ko'p talaba faol foydalansa, [console.anthropic.com](https://console.anthropic.com/) dagi **Billing** bo'limidan xarajatni kuzatib turing va limit qo'ying.

Har bir bosqich mavjud `users`/`role` va modulli fayl strukturasi ustiga qurilishi mumkin — asosiy skelet buzilmaydi.

## Botni doim ishlab turadigan qilish (bepul, Render.com)

Bot avtomatik ravishda ikki rejimda ishlaydi:
- **Lokal kompyuterda** (`RENDER_EXTERNAL_URL` yo'q bo'lsa) → polling rejimi, hozirgidek
- **Render'da** (`RENDER_EXTERNAL_URL` avtomatik mavjud bo'lsa) → webhook rejimi + kichik HTTP server (`/health` bilan)

Bosqichlar uchun quyidagi bo'limga qarang (chat orqali birga bajariladi):
1. GitHub'da loyihani yuklash
2. Render'da Web Service yaratish, environment variable'larni qo'shish
3. UptimeRobot bilan botni "uxlab qolishdan" saqlash (har 5 daqiqada `/health`ga so'rov yuboradi)

## Eslatma: Production uchun

- Hozirgi session (`telegraf session()`) xotirada saqlanadi — bot qayta ishga tushsa, tugallanmagan testlar yo'qoladi. Ko'p instance yoki doimiy uptime kerak bo'lsa, Postgres/Redis session store'ga o'tkazish tavsiya etiladi.
- Bot hozir **polling** rejimida ishlaydi (`bot.launch()`). VPS/Railway'da doimiy ishlaydigan process sifatida joylashtiring (masalan, `pm2` yoki systemd bilan), yoki webhook rejimiga o'tkazing.
