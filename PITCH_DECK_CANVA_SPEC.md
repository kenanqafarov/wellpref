# WellPerf — Pitch deck (12 slayd, 7 dəqiqə)

Komanda: Enthuzone · SOCAR Hackathon 2026
Üslub: tünd fon (#0B0F14), aksent narıncı (#FF7A1A, SOCAR təqdimatı ilə uyğun), ikinci aksent mavi (#3BA7FF), ağ mətn. Şrift: başlıq Space Grotesk Bold / Inter Bold, rəqəmlər JetBrains Mono.
Qayda: hər slaydda bir fikir, nəticə başlığı, maks. 15–20 söz mətn.

---

## 1. Hook · 00:00–00:25
**Başlıq:** 29 gün kor idarəetmə. Biz onu bitirdik.
**Alt:** WellPerf — xam sensor datasından gündəlik hasilata və rezervuar xassələrinə. Enthuzone.
**Vizual:** böyük "14,246 STB/d" rəqəmi, altında "1 test / ay / quyu".
**GIF/animasiya:** rəqəm 0-dan 14,246-ya sayğac kimi artır (Canva "Count up" / CSS, 3 san, loop yox).
**Notes:** 00:00–00:25. Sual ilə aç, fasilə ver.

## 2. Problem · 00:25–01:00
**Başlıq:** Hasilatı ayda bir dəfə bilirik, qalan vaxt təxmin edirik
**Bullets (3):** 10 qaz-lift quyusu, 85 test / 9 ay · Multifaza sayğac yoxdur · Xam data: dublikat, sıra pozuntusu, testlərdə 23 səhv dəyər
**Vizual:** təqvim zolağı — 30 gündən 1-i yaşıl (test), 29-u boz.
**GIF:** təqvimdə boz günlər bir-bir "?" ilə dolur (4 san, loop).
**Notes:** 00:25–01:00.

## 3. Həll · 01:00–01:30
**Başlıq:** Bir axın: Data → VFM → PTA → Hesabat
**Vizual:** 4 ikonlu üfüqi axın (upload · gauge · chart · file).
**GIF:** problem→həll keçidi: boz təqvim günləri soldan sağa yaşıl gündəlik debit xəttinə çevrilir (4 san).
**Notes:** 01:00–01:30.

## 4. Demo · 01:30–02:30
**Başlıq:** Canlı: 3 klikdə xam datadan reservoir xassələrinə
**Vizual:** noutbuk mockup-ı içində UI skrinşotu (VFM səhifəsi, P10–P90 bandı).
**GIF (əsas):** ekran yazısı 6 san, loop, ≤2 MB: Field data (qırmızı shut-in) → VFM bandı → PTA Horner qrafiki + yaşıl "good" badge. Alət: ScreenToGif (Windows) və ya ShareX, 12 fps, 1280px.
**Notes:** 01:30–02:30. İnternet olmasa ehtiyat video.

## 5. Necə işləyir (arxitektura) · 02:30–03:05
**Başlıq:** Fizikaya bağlı model — mühəndis hər nəticəni izah edə bilir
**Diaqram:** 
Raw CSV (1-dəq) → Cleaning (−999.25, dublikat, spike, frozen) → Events (6 shut-in, gas-lift upset) → VFM (bounded ridge, Pwf slope ≤ 0) → PTA (Bourdet + Horner, IARF quality) → Streamlit UI + Excel/HTML export
**Kiçik etiketlər:** Python 3.11 · scipy lsq_linear · Streamlit · plotly · pytest
**GIF:** data axını — nöqtələr soldan sağa bloklardan keçir (CSS/Lottie, 5 san loop).
**Notes:** 02:30–03:05. Körpü cümlə: "model fiziki cəfəngiyat deyə bilmir".

## 6. Kəşf + dəqiqlik · 03:05–03:45
**Başlıq:** Separator tələsini tapdıq — neft xətası 38% az
**Sol:** WHP test zamanı −12%, Pwf −0.3% → surface-pressure modeli adi günləri ~9% şişirdir → biz çıxardıq: fərq +0.7%
**Sağ (bar chart):** Forward oil MAPE: VFM 3.7% vs baseline 6.0% · Held-out: 2.7% vs 4.1%
**GIF:** iki bar sıfırdan böyüyür, VFM barı yaşıl (3 san).
**Notes:** 03:05–03:45. [BURA DOLDUR: leaderboard xalı, varsa]

## 7. PTA · 03:45–04:20
**Başlıq:** 6 bağlanma, 4 təsdiqlənmiş — GL-06 stimulyasiya namizədi
**Cədvəl (kompakt):** GL-02 k 58 s −0.7 good · GL-04 k 53 s −1.4 good · GL-06 k 292 s +1.7 good · GL-08 k 42 s −1.7 good · GL-01, GL-10 indicative
**Vizual:** real Horner/log-log skrinşotu (pta_report.html-dən).
**Notes:** 03:45–04:20.

## 8. Biznes dəyəri · 04:20–04:55
**Başlıq:** Eyni qaz, +19 barel/gün, $0 CAPEX
**Vizual:** GL-04 (+7 STB/d / 100 Mscf) → ox → GL-01 (+26 STB/d / 100 Mscf). Altda: ≈ $485k/il ($70/bbl fərziyyəsi).
**Kiçik qeyd:** 14 İyun 2025 sahə üzrə qaz-lift kəsintisindən ölçülüb · 10% addımlarla tətbiq
**GIF:** qaz hissəcikləri GL-04-dən GL-01-ə axır, neft sayğacı +19-a qalxır (4 san loop).
**Notes:** 04:20–04:55.

## 9. Bazar + biznes modeli · 04:55–05:30
**Başlıq:** Sayğacı olmayan hər qaz-lift quyusu bir müştəridir
**TAM/SAM/SOM dairələri:** [BURA DOLDUR: mənbəli rəqəmlər]
**Model:** quyu başına illik abunə [BURA DOLDUR: qiymət] + kalibrasiya xidməti
**Notes:** 04:55–05:30.

## 10. Rəqiblər / fərq · 05:30–05:55
**Başlıq:** Yeganə həll: VFM + PTA bir axında, etibarlılıq ilə
**2x2 və ya cədvəl:** Fiziki MPFM (bahalı, hər quyuya) · Excel interpolyasiya (ucuz, xəta 1.5×) · Ayrı PTA proqramı (VFM ilə bağlı deyil) · WellPerf (hamısı + P10–P90 + quality badge)
**Notes:** 05:30–05:55.

## 11. Komanda + yol xəritəsi · 05:55–06:35
**Sol:** [BURA DOLDUR: üzvlər, foto, rol]
**Sağ timeline:** Ay 1 — SCADA inteqrasiyası · Ay 2–3 — 1 yataqda paralel pilot · Ay 3 — qaz-lift addımlı sınaq · Sonra — sensor əsaslı su/GOR, çoxfazalı PTA
**Notes:** 05:55–06:35.

## 12. Çağırış · 06:35–07:00
**Başlıq:** Bir yataq, üç ay. Hər gün, hər quyu.
**Alt:** Pilot üçün tərəfdaşlıq istəyirik. Təşəkkürlər — Enthuzone
**Notes:** 06:35–07:00.
