# Talablar hujjati

## 1. Ilova haqida umumiy ma'lumot

### 1.1 Ilova nomi
NetDC Orders - Boshqaruv paneli

### 1.2 Ilova tavsifi
NetDC Orders - bu savdo nuqtalari uchun to'liq boshqaruv paneli veb-ilovasi bo'lib, mahsulotlar, buyurtmalar, qarzlar, ombor harakatlari va hisobotlarni boshqarish imkonini beradi. Ilova PIN kod orqali autentifikatsiya va rol asosidagi kirish nazoratini qo'llab-quvvatlaydi.

**API Base URL:** https://orders.netdc.uz

**Autentifikatsiya:** JWT Bearer token (PIN kod orqali)

**Rollar:**
- SUPER_ADMIN - barcha funksiyalarga to'liq kirish
- ADMIN - foydalanuvchilar boshqaruvidan tashqari barcha funksiyalar
- KASSIR - asosiy savdo operatsiyalari

## 2. Foydalanuvchilar va foydalanish stsenariylari

### 2.1 Maqsadli foydalanuvchilar
- SUPER_ADMIN: Tizim ma'muri, barcha sozlamalar va foydalanuvchilarni boshqaradi
- ADMIN: Do'kon menejeri, mahsulotlar va hisobotlarni boshqaradi
- KASSIR: Sotuvchi, buyurtmalar va qarzlarni qayd etadi

### 2.2 Asosiy foydalanish stsenariylari
- Kassir kundalik savdo operatsiyalarini amalga oshiradi
- Admin mahsulotlar va ombor holatini nazorat qiladi
- Super admin foydalanuvchilar va tizim sozlamalarini boshqaradi
- Barcha rollar hisobotlarni ko'radi va eksport qiladi

## 3. Sahifalar tuzilmasi va funksiyalar

### 3.1 Sahifalar tuzilmasi

```
├── Login sahifasi
├── Asosiy panel (autentifikatsiyadan keyin)
│   ├── Bosh sahifa (Dashboard)
│   ├── Foydalanuvchilar (faqat SUPER_ADMIN)
│   │   ├── Foydalanuvchilar ro'yxati
│   │   ├── Yangi foydalanuvchi yaratish
│   │   └── Foydalanuvchini tahrirlash
│   ├── Mahsulotlar
│   │   ├── Mahsulotlar ro'yxati
│   │   ├── Yangi mahsulot qo'shish
│   │   ├── Mahsulotni tahrirlash
│   │   ├── Ombor to'ldirish (Restock)
│   │   ├── Tovar qabul qilish (Receive)
│   │   └── Restock tarixi
│   ├── Buyurtmalar
│   │   ├── Buyurtmalar ro'yxati
│   │   └── Yangi buyurtma yaratish
│   ├── Qarzlar
│   │   ├── Qarzlar ro'yxati
│   │   ├── Yangi qarz yaratish
│   │   ├── Qarzni tahrirlash
│   │   └── Qarzni to'lash
│   ├── Ombor harakatlari
│   │   └── Harakatlar ro'yxati
│   ├── Hisobotlar
│   │   ├── Kunlik hisobot
│   │   ├── Sana oralig'i hisoboti
│   │   ├── Kunlar bo'yicha hisobot
│   │   └── Kassirlar bo'yicha hisobot
│   ├── SMS
│   │   ├── Kampaniyalar ro'yxati
│   │   ├── SMS yuborish
│   │   └── Balans tekshirish
│   └── Sozlamalar
│       └── Sozlamalarni ko'rish va tahrirlash
```

### 3.2 Sahifalar va funksiyalar tavsifi

#### 3.2.1 Login sahifasi

**Maqsad:** Foydalanuvchi PIN kod orqali tizimga kiradi

**Funksiyalar:**
- PIN kod kiritish maydoni
- Kirish tugmasi
- PIN kod yuboriladi (POST /api/auth/login)
- Muvaffaqiyatli autentifikatsiyada JWT token, rol va username qaytariladi
- Token localStorage'ga saqlanadi
- Foydalanuvchi asosiy panelga yo'naltiriladi

**Ma'lumotlar:**
- LoginRequest: {pin: string}
- LoginResponse: {token: string, role: string, username: string}

#### 3.2.2 Bosh sahifa (Dashboard)

**Maqsad:** Asosiy ko'rsatkichlar va tezkor ma'lumotlarni ko'rsatish

**Funksiyalar:**
- Foydalanuvchi nomi va rolini ko'rsatish
- Navigatsiya menyusi (barcha modullar)
- Chiqish tugmasi

#### 3.2.3 Foydalanuvchilar (faqat SUPER_ADMIN)

##### 3.2.3.1 Foydalanuvchilar ro'yxati

**Funksiyalar:**
- Barcha foydalanuvchilarni ko'rsatish (GET /api/users?page=X&size=Y)
- Sahifalash (pagination)
- Har bir foydalanuvchi uchun: username, rol, holat (faol/nofaol), yaratilgan sana
- Tahrirlash tugmasi
- O'chirish tugmasi (DELETE /api/users/{id})
- Holat o'zgartirish tugmasi (PUT /api/users/{id}/toggle-status)
- Yangi foydalanuvchi qo'shish tugmasi

**Ma'lumotlar:**
- UserResponse: {id, username, role, active, createdAt}

##### 3.2.3.2 Yangi foydalanuvchi yaratish

**Funksiyalar:**
- Forma: username, PIN kod, rol tanlash (SUPER_ADMIN/ADMIN/KASSIR)
- Saqlash tugmasi (POST /api/users)
- Bekor qilish tugmasi

**Ma'lumotlar:**
- UserRequest: {username, pin, role}

##### 3.2.3.3 Foydalanuvchini tahrirlash

**Funksiyalar:**
- Mavjud ma'lumotlarni ko'rsatish
- Forma: username, PIN kod, rol
- Yangilash tugmasi (PUT /api/users/{id})
- Bekor qilish tugmasi

#### 3.2.4 Mahsulotlar

##### 3.2.4.1 Mahsulotlar ro'yxati

**Funksiyalar:**
- Barcha mahsulotlarni ko'rsatish (GET /api/products?search=X)
- Qidiruv maydoni (nomi yoki shtrix-kod bo'yicha)
- Har bir mahsulot uchun: nomi, shtrix-kod, narxi, miqdori, o'lchov birligi, minimal miqdor
- Tahrirlash tugmasi
- O'chirish tugmasi (DELETE /api/products/{id})
- Yangi mahsulot qo'shish tugmasi
- Ombor to'ldirish tugmasi
- Tovar qabul qilish tugmasi
- Restock tarixi tugmasi

**Ma'lumotlar:**
- ProductResponse: {id, name, barcode, price, quantity, unit, minQuantity, createdAt}

##### 3.2.4.2 Yangi mahsulot qo'shish

**Funksiyalar:**
- Forma: nomi, shtrix-kod, narxi, miqdori, o'lchov birligi, minimal miqdor
- Saqlash tugmasi (POST /api/products)
- Bekor qilish tugmasi

**Ma'lumotlar:**
- ProductRequest: {name, barcode, price, quantity, unit, minQuantity}

##### 3.2.4.3 Mahsulotni tahrirlash

**Funksiyalar:**
- Mavjud ma'lumotlarni ko'rsatish
- Forma: nomi, shtrix-kod, narxi, miqdori, o'lchov birligi, minimal miqdor
- Yangilash tugmasi (PUT /api/products/{id})
- Bekor qilish tugmasi

##### 3.2.4.4 Ombor to'ldirish (Restock)

**Funksiyalar:**
- Mahsulot tanlash
- Miqdor kiritish
- Izoh (ixtiyoriy)
- Saqlash tugmasi (POST /api/products/{id}/restock)

**Ma'lumotlar:**
- RestockRequest: {quantity, note?}

##### 3.2.4.5 Tovar qabul qilish (Receive)

**Funksiyalar:**
- Shtrix-kod kiritish
- Nomi (ixtiyoriy)
- Miqdor
- Narxi (ixtiyoriy)
- O'lchov birligi (ixtiyoriy)
- Saqlash tugmasi (POST /api/products/receive)

**Ma'lumotlar:**
- StockReceiveRequest: {barcode, name?, quantity, price?, unit?}

##### 3.2.4.6 Restock tarixi

**Funksiyalar:**
- Mahsulot tanlash
- Restock tarixini ko'rsatish (GET /api/products/{id}/restock-history)
- Har bir yozuv: sana, miqdor, izoh

#### 3.2.5 Buyurtmalar

##### 3.2.5.1 Buyurtmalar ro'yxati

**Funksiyalar:**
- Barcha buyurtmalarni ko'rsatish (GET /api/orders)
- Har bir buyurtma uchun: ID, mahsulotlar, umumiy narx, to'lov turi, kassir, sana
- Tafsilotlarni ko'rish

**Ma'lumotlar:**
- OrderResponse: {id, items, totalPrice, paymentType, cashierName, createdAt}

##### 3.2.5.2 Yangi buyurtma yaratish

**Funksiyalar:**
- Mahsulot qo'shish (qidiruv yoki shtrix-kod orqali)
- Har bir mahsulot uchun miqdor kiritish
- To'lov turi tanlash (CASH/CARD/DEBT)
- Agar DEBT tanlansa: mijoz ismi va telefon raqami kiritish
- Saqlash tugmasi (POST /api/orders)
- Bekor qilish tugmasi

**Ma'lumotlar:**
- OrderRequest: {items: [{productId, quantity}], paymentType, customerName?, customerPhone?}

#### 3.2.6 Qarzlar

##### 3.2.6.1 Qarzlar ro'yxati

**Funksiyalar:**
- Barcha qarzlarni ko'rsatish (GET /api/debts)
- Har bir qarz uchun: mijoz ismi, telefon, umumiy summa, to'langan summa, qolgan summa, holat, sana
- Tahrirlash tugmasi
- O'chirish tugmasi (DELETE /api/debts/{id})
- To'lash tugmasi
- Yangi qarz yaratish tugmasi

**Ma'lumotlar:**
- DebtResponse: {id, customerName, customerPhone, amount, paidAmount, remainingAmount, status, createdAt}

##### 3.2.6.2 Yangi qarz yaratish

**Funksiyalar:**
- Forma: mijoz ismi, telefon raqami, summa, tavsif (ixtiyoriy)
- Saqlash tugmasi (POST /api/debts)
- Bekor qilish tugmasi

**Ma'lumotlar:**
- DebtRequest: {customerName, customerPhone, amount, description?}

##### 3.2.6.3 Qarzni tahrirlash

**Funksiyalar:**
- Mavjud ma'lumotlarni ko'rsatish
- Forma: mijoz ismi, telefon raqami, summa, tavsif
- Yangilash tugmasi (PUT /api/debts/{id})
- Bekor qilish tugmasi

##### 3.2.6.4 Qarzni to'lash

**Funksiyalar:**
- To'lov summasini kiritish
- Saqlash tugmasi (POST /api/debts/{id}/pay)

**Ma'lumotlar:**
- DebtPayRequest: {amount}

#### 3.2.7 Ombor harakatlari

##### 3.2.7.1 Harakatlar ro'yxati

**Funksiyalar:**
- Barcha harakatlarni ko'rsatish (GET /api/stock-movements?startDate=X&endDate=Y&type=Z)
- Filtrlar: vaqt oralig'i (boshlanish va tugash sanasi), harakat turi (IN/OUT/SALE/ADJUSTMENT)
- Har bir harakat uchun: mahsulot nomi, tur, miqdor, izoh, sana

**Ma'lumotlar:**
- StockMovementResponse: {id, productName, type, quantity, note, createdAt}

#### 3.2.8 Hisobotlar

##### 3.2.8.1 Kunlik hisobot

**Funksiyalar:**
- Bugungi kun hisobotini ko'rsatish (GET /api/reports/daily)
- Umumiy buyurtmalar soni, umumiy daromad, sotilgan mahsulotlar soni
- Naqd, karta va qarz bo'yicha summalar
- CSV eksport tugmasi (GET /api/reports/daily/export)

**Ma'lumotlar:**
- SalesReportResponse: {totalOrders, totalRevenue, totalItems, cashAmount, cardAmount, debtAmount}

##### 3.2.8.2 Sana oralig'i hisoboti

**Funksiyalar:**
- Boshlanish va tugash sanasini tanlash
- Hisobotni ko'rsatish (GET /api/reports/range?startDate=X&endDate=Y)
- Umumiy buyurtmalar soni, umumiy daromad, sotilgan mahsulotlar soni
- Naqd, karta va qarz bo'yicha summalar
- CSV eksport tugmasi (GET /api/reports/range/export?startDate=X&endDate=Y)

##### 3.2.8.3 Kunlar bo'yicha hisobot

**Funksiyalar:**
- Boshlanish va tugash sanasini tanlash
- Har bir kun uchun hisobotni ko'rsatish (GET /api/reports/daily-breakdown?startDate=X&endDate=Y)
- Har bir kun: sana, buyurtmalar soni, daromad
- CSV eksport tugmasi (GET /api/reports/daily-breakdown/export?startDate=X&endDate=Y)

**Ma'lumotlar:**
- DailySalesResponse: {date, totalOrders, totalRevenue}

##### 3.2.8.4 Kassirlar bo'yicha hisobot

**Funksiyalar:**
- Boshlanish va tugash sanasini tanlash
- Har bir kassir uchun hisobotni ko'rsatish (GET /api/reports/by-user?startDate=X&endDate=Y)
- Har bir kassir: username, buyurtmalar soni, daromad
- CSV eksport tugmasi (GET /api/reports/by-user/export?startDate=X&endDate=Y)

**Ma'lumotlar:**
- UserSalesResponse: {username, totalOrders, totalRevenue}

#### 3.2.9 SMS

##### 3.2.9.1 Kampaniyalar ro'yxati

**Funksiyalar:**
- Barcha SMS kampaniyalarini ko'rsatish (GET /api/sms/campaigns)
- Har bir kampaniya uchun: nomi, xabar matni, yuborilgan sana
- Yangi SMS yuborish tugmasi

##### 3.2.9.2 SMS yuborish

**Funksiyalar:**
- Forma: kampaniya nomi, xabar matni, qabul qiluvchilar ro'yxati
- Yuborish tugmasi (POST /api/sms/send)
- Bekor qilish tugmasi

##### 3.2.9.3 Balans tekshirish

**Funksiyalar:**
- SMS balansini ko'rsatish (GET /api/sms/balance)

#### 3.2.10 Sozlamalar

##### 3.2.10.1 Sozlamalarni ko'rish va tahrirlash

**Funksiyalar:**
- Joriy sozlamalarni ko'rsatish (GET /api/settings)
- Forma: do'kon nomi, valyuta, soliq stavkasi va boshqa sozlamalar
- Yangilash tugmasi (PUT /api/settings)

**Ma'lumotlar:**
- SettingsRequest/Response: {storeName, currency, taxRate, ...}

## 4. Biznes qoidalari va mantiq

### 4.1 Autentifikatsiya va avtorizatsiya

- Foydalanuvchi PIN kod orqali tizimga kiradi
- JWT token localStorage'da saqlanadi
- Har bir API so'rovida token Bearer Authentication orqali yuboriladi
- Token amal qilish muddati tugaganda foydalanuvchi login sahifasiga yo'naltiriladi

### 4.2 Rol asosidagi kirish nazorati

- **SUPER_ADMIN:**
  - Barcha funksiyalarga to'liq kirish
  - Foydalanuvchilarni boshqarish
  - Sozlamalarni o'zgartirish

- **ADMIN:**
  - Foydalanuvchilar boshqaruvidan tashqari barcha funksiyalar
  - Mahsulotlar, buyurtmalar, qarzlar, hisobotlar

- **KASSIR:**
  - Buyurtmalar yaratish
  - Qarzlarni ko'rish va to'lash
  - Mahsulotlarni ko'rish
  - Asosiy hisobotlarni ko'rish

### 4.3 Mahsulotlar boshqaruvi

- Mahsulot yaratilganda barcha majburiy maydonlar to'ldirilishi kerak
- Shtrix-kod noyob bo'lishi kerak
- Mahsulot miqdori minimal miqdordan kam bo'lganda ogohlantirish ko'rsatiladi
- Restock operatsiyasi mahsulot miqdorini oshiradi
- Tovar qabul qilish yangi mahsulot yaratadi yoki mavjud mahsulot miqdorini oshiradi

### 4.4 Buyurtmalar

- Buyurtma kamida bitta mahsulotni o'z ichiga olishi kerak
- Har bir mahsulot uchun miqdor musbat son bo'lishi kerak
- To'lov turi CASH, CARD yoki DEBT bo'lishi mumkin
- DEBT to'lov turida mijoz ismi va telefon raqami majburiy
- Buyurtma yaratilganda mahsulot miqdori avtomatik kamayadi
- Buyurtma yaratilganda ombor harakati (SALE) qayd etiladi

### 4.5 Qarzlar boshqaruvi

- Qarz yaratilganda mijoz ismi, telefon va summa majburiy
- Qarz to'langanda to'langan summa qo'shiladi
- Qolgan summa avtomatik hisoblanadi: amount - paidAmount
- Qarz to'liq to'langanda holat o'zgaradi

### 4.6 Ombor harakatlari

- Har bir mahsulot operatsiyasi ombor harakatini yaratadi
- Harakat turlari: IN (kirish), OUT (chiqish), SALE (sotish), ADJUSTMENT (tuzatish)
- Restock operatsiyasi IN harakatini yaratadi
- Buyurtma yaratish SALE harakatini yaratadi

### 4.7 Hisobotlar

- Barcha hisobotlar real vaqt ma'lumotlariga asoslanadi
- Sana oralig'i hisobotlari tanlangan vaqt oralig'idagi ma'lumotlarni ko'rsatadi
- CSV eksport barcha hisobotlar uchun mavjud

## 5. Istisno va chegara holatlari

| Holat | Xatti-harakat |
|-------|---------------|
| Noto'g'ri PIN kod | Xato xabari ko'rsatiladi |
| Token amal qilish muddati tugagan | Foydalanuvchi login sahifasiga yo'naltiriladi |
| Ruxsat etilmagan sahifaga kirish | Xato xabari yoki bosh sahifaga yo'naltirish |
| Mahsulot topilmadi | Xato xabari ko'rsatiladi |
| Mahsulot miqdori yetarli emas | Buyurtma yaratishda ogohlantirish |
| Noyob shtrix-kod takrorlanishi | Xato xabari ko'rsatiladi |
| Bo'sh forma yuborish | Validatsiya xatolari ko'rsatiladi |
| API xatosi | Xato xabari ko'rsatiladi |
| Tarmoq xatosi | Xato xabari va qayta urinish imkoniyati |
| Qarz to'lovi qolgan summadan oshib ketishi | Xato xabari ko'rsatiladi |
| Foydalanuvchi o'chirish (o'zini) | Xato xabari ko'rsatiladi |

## 6. Qabul qilish mezonlari

1. Foydalanuvchi PIN kod kiritib tizimga kiradi
2. Foydalanuvchi mahsulotlar ro'yxatini ko'radi va yangi mahsulot qo'shadi
3. Foydalanuvchi yangi buyurtma yaratadi (mahsulot tanlash, miqdor kiritish, to'lov turi tanlash)
4. Foydalanuvchi buyurtmalar ro'yxatida yangi buyurtmani ko'radi
5. Foydalanuvchi kunlik hisobotni ko'radi va CSV formatda eksport qiladi
6. Foydalanuvchi tizimdan chiqadi

## 7. Ushbu bosqichda amalga oshirilmaydigan funksiyalar

- Mobil ilova versiyasi
- Offline rejimda ishlash
- Real vaqtda bildirishnomalar
- Mahsulot rasmlari yuklash
- Mijozlar bazasi boshqaruvi
- Inventarizatsiya funksiyasi
- Chegirmalar va aksiyalar tizimi
- Xodimlar ish vaqti hisobi
- Integratsiya boshqa tizimlar bilan
- Ko'p tilli interfeys
- Mahsulot kategoriyalari
- Ombor joylashuvi boshqaruvi