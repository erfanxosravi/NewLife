# زندگینامه (Zendegi-Nameh)

شبیه‌ساز متنی زندگی ایرانی از تولد تا پایان عمر؛ کاملاً آفلاین، راست‌به‌چپ (RTL) و داده‌محور.

## اجرا و تست

```bash
npm install
npm run dev           # اجرای سرور توسعه روی پورت 3000 (مسیر /styleguide برای مشاهده کامپوننت‌ها)
npm run validate:data # اعتبارسنجی تمام فایل‌های JSON با Zod
npm test              # اجرای تست‌های واحد و شبیه‌سازی ۱۰۰۰ زندگی
npm run build         # اعتبارسنجی داده‌ها + بیلد نسخه PWA
```

## مجوزهای کتابخانه‌های متن‌باز

- **Lucide Icons (`lucide-react`)**: تحت مجوز **ISC License** (آیکون‌های خطی متن‌باز، تنظیم‌شده با `strokeWidth={1.75}`).
- **Vazirmatn Font**: تحت مجوز **SIL Open Font License (OFL 1.1)**.
- **jalaali-js**: تحت مجوز **MIT License**.
