# الخطوط المضمّنة في الموقع

تم اختيار خطّين عربيين متناسقين مع التصميم وتجهيز نسخ WOFF2 محلية، لذلك لا يحتاج الموقع إلى الاتصال بخدمة Google Fonts أو أي CDN لتحميل الخطوط.

## الاستخدام

- **Amiri** للعناوين الرئيسية والفرعية.
- **Noto Sans Arabic** للنصوص وعناصر الواجهة والأزرار والحقول.

## الملفات

- `Amiri-Regular.woff2`
- `Amiri-Bold.woff2`
- `NotoSansArabic-Regular.woff2`
- `NotoSansArabic-Bold.woff2`
- `LICENSE-Amiri.txt` — بيانات حقوق النشر ورخصة SIL OFL 1.1 لخط Amiri.
- `LICENSE-Noto.txt` — بيانات حقوق النشر ورخصة SIL OFL 1.1 لخط Noto Sans Arabic.

## التخصيص

تُعرّف ملفات الخطوط في `style.css` باستخدام `@font-face`. لتغيير نوع الخط، عدّل المتغيرين `--font-ui` و`--font-display` في نهاية ملف CSS. احتفظ بملفات الرخصة عند توزيع الموقع.
