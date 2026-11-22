# SOCAR Hackathon 2026 — Intelligent Well Performance Analysis (Evaluation Kit)

Bu repozitoriya **SOCAR Hackathon 2026** üçün hazırlanmış həllin yoxlanılması, test edilməsi və başqa mühəndis/AI tərəfindən qiymətləndirilməsi üçün hazırlanmış təmiz paketdir.

---

## 📌 Layihə Nədir?
Bu layihə xam 1 dəqiqəlik quyu sensor məlumatlarından başlayaraq iki əsas neft-qaz mühəndisliyi problemini həll edir:
1. **Virtual Flow Metering (VFM):** Multiphase debimetr (MPFM) olmayan quyularda gündəlik neft, su və qaz hasilatını (`oil_rate_stbd`, `water_rate_stbd`, `gas_rate_mscfd`) dəqiqliklə proqnozlaşdırmaq.
2. **Pressure Transient Analysis (PTA):** Quyuların qapanma (shut-in / build-up) müddətlərində rezervuar xüsusiyyətlərini (effektiv keçiricilik $k$, skin faktoru $s$, $\Delta P_{skin}$) avtomatik Horner və radial flow analizi ilə hesablamaq.

---

## 🚀 Tez Başlama (Quick Start)

### 1. Asılılıqları quraşdırın
Python 3.10 və ya 3.11 tövsiyə olunur:
```bash
pip install -r requirements.txt
```
*(və ya `uv` istifadə edirsinizsə: `uv sync`)*

### 2. Yüksək tezlikli sensor datasını açın
GitHub-ın 100MB fayl limitinə görə 269 MB-lıq `high_freq_data.csv` faylı `high_freq_data.zip` (59 MB) olaraq sıxılmışdır. Onu dərhal açmaq üçün:
```bash
python unzip_data.py
```

### 3. Tətbiqi və ya Testləri işə salın
- **İnteraktiv Veb Tətbiq (Streamlit UI):**
  ```bash
  streamlit run app.py
  ```
  *(Brauzerdə http://localhost:8501 açılacaq: bütün sensor qrafikləri, VFM proqnozları və Horner PTA analizləri vizual görünür).*

- **Yoxlama testləri:**
  ```bash
  pytest
  python test_pta_candidates.py
  python compare_pta_tests.py
  ```

---

## 📂 Fayl Strukturu

| Qovluq / Fayl | Təyinatı |
|---|---|
| `high_freq_data.zip` | 1 dəqiqəlik sensor datası (~269MB açıldıqda). `python unzip_data.py` ilə açılır |
| `well_tests.csv` | Quyu sınaqları (Well test kalibrasiya datası) |
| `choke_events.csv` | Boğucu (choke) dəyişiklikləri və qapanma hadisələri |
| `reservoir_pvt.csv` | Rezervuar maye və qaz PVT parametrləri (Bo, μo, c_t, h, porositə) |
| `well_completion.csv` | Quyu tamamlama məlumatları (radiusi rw və s.) |
| `task.pdf` | Hackathon-un rəsmi texniki tapşırıq sənədi |
| `src/` | Bütün mühərrik: VFM regression, PTA Horner & Bourdet analizi, sensor təmizləmə |
| `reports/` | Hazır interaktiv hesabatlar (`vfm_report.html`, `pta_report.html`) |
| `submission_files/` | Təqdim ediləcək son nəticə faylları (`vfm_daily_predictions.csv`, `pta_submission.csv` və s.) |
| `artifacts/` | Təlim olunmuş model faylı (`vfm_model.joblib`) |
| `PROMPT_FOR_OTHER_AI.md` | Başqa bir AI modelinə (ChatGPT, Claude və s.) vermək üçün xüsusi prompt |

---

## 📊 Əldə Olunmuş Cari Nəticələr (Benchmarks)

### VFM Dəqiqliyi (MAPE - 85 quyu sınağı üzrə):
* **Neft (Oil):** `2.7 %` (Held-out), `3.7 %` (Forward validation)
* **Su (Water):** `3.5 %` (Held-out), `4.4 %` (Forward validation)
* **Qaz (Gas):** `5.8 %` (Held-out), `6.6 %` (Forward validation)
* **Maye (Liquid):** `2.1 %` (Held-out), `3.1 %` (Forward validation)

### PTA Nəticələri:
* 6 ədəd quyu qapanma hadisəsi (shut-in) avtomatik filtrasiya edilib (gas-lift upset-ləri shut-in-dən ayrılıb).
* Hər bir hadisə üzrə Horner meyilliyi ($m$), keçiricilik ($k$ mD), skin ($s$) və $\Delta P_{skin}$ hesablanıb.

---

## 🤖 Başqa AI ilə Test Etmək Üçün
Başqa bir AI köməkçisindən (Claude 3.7 Sonnet, ChatGPT o3-mini/GPT-4o, DeepSeek-R1 və s.) layihəni qiymətləndirməsini və ya yeni ideyalar verməsini istəyirsinizsə, repodakı **`PROMPT_FOR_OTHER_AI.md`** faylındakı mətni kopyalayıb həmin AI-a göndərin!
