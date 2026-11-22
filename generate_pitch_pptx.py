import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    BG_COLOR = RGBColor(2, 24, 36)        # Deep Caspian Navy #021824
    CARD_BG = RGBColor(4, 34, 52)         # #042234
    ACCENT_CYAN = RGBColor(6, 182, 212)   # #06B6D4
    ACCENT_EMERALD = RGBColor(16, 185, 129)# #10B981
    ACCENT_AMBER = RGBColor(245, 158, 11) # #F59E0B
    ACCENT_ROSE = RGBColor(244, 63, 94)   # #F43F5E
    TEXT_WHITE = RGBColor(255, 255, 255)
    TEXT_MUTED = RGBColor(161, 161, 170)
    BORDER_COLOR = RGBColor(30, 58, 82)

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category_text="WELLPERF · CASPIAN INTELLIGENCE · SOCAR HACKATHON 2026"):
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.4))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = ACCENT_CYAN

        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.7), Inches(0.8))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.size = Pt(24)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE

    # SLIDE 1: COVER
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)
    
    badge_box = s1.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.3), Inches(0.5))
    p1 = badge_box.text_frame.paragraphs[0]
    p1.text = "WELLPERF · CASPIAN INTELLIGENCE · SOCAR HACKATHON 2026 · KOMANDA RUBRA"
    p1.font.size = Pt(13)
    p1.font.bold = True
    p1.font.color.rgb = ACCENT_CYAN

    hero_box = s1.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(11.3), Inches(2.2))
    tf_h = hero_box.text_frame
    tf_h.word_wrap = True
    ph1 = tf_h.paragraphs[0]
    ph1.text = "WellPerf: Ağıllı Quyu Analizi"
    ph1.font.size = Pt(48)
    ph1.font.bold = True
    ph1.font.color.rgb = TEXT_WHITE

    ph2 = tf_h.add_paragraph()
    ph2.text = "Xam sensor datasından Virtual Axın Ölçməsinə (VFM) və Təzyiq Bərpa Analizinə (PTA) — vahid platformada"
    ph2.font.size = Pt(18)
    ph2.font.color.rgb = TEXT_MUTED

    stats = [
        ("10 QAZ-LİFT QUYUSU", "14,246 bbl/gün", ACCENT_CYAN),
        ("VFM DƏQİQLİYİ", "MAPE: 3.72%", ACCENT_EMERALD),
        ("QAZ-LİFT YENİDƏN BÖLGÜSÜ", "+$485,000 / il", ACCENT_AMBER),
    ]
    for i, (label, val, color) in enumerate(stats):
        x = Inches(1.0 + i * 3.8)
        card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(4.8), Inches(3.5), Inches(1.6))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_l = tf.paragraphs[0]
        p_l.text = label
        p_l.font.size = Pt(11)
        p_l.font.bold = True
        p_l.font.color.rgb = TEXT_MUTED
        p_v = tf.add_paragraph()
        p_v.text = val
        p_v.font.size = Pt(24)
        p_v.font.bold = True
        p_v.font.color.rgb = color

    # SLIDE 2: PROBLEM TƏHLİLİ
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "Problem Təhlili: 29 Günlük Kor Nöqtə")

    desc_box = s2.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(11.7), Inches(1.2))
    p_d = desc_box.text_frame.paragraphs[0]
    p_d.text = "10 qaz-lift quyusu üzrə sahə hasilatı ≈ 14,246 barel/gün neftdir. Hər quyu test separatorunda ayda cəmi 1 dəfə ölçülür. Qalan ~29 gün: su basması, ştuser problemi və qaz-lift qeyri-sabitliyi gec aşkar olunur."
    p_d.font.size = Pt(16)
    p_d.font.color.rgb = TEXT_MUTED

    p_cards = [
        ("10 QUYU", "Sahə üzrə qaz-lift quyuları\nBütün quyular fasiləsiz telemetriya qeyd edir."),
        ("14,246 bbl/gün", "Sahə üzrə orta hasilat həcmi\nOptimal idarəetmə üçün dəqiq monitorinq zəruridir."),
        ("Ayda 1 Dəfə", "Test separatorunda tək ölçmə\n29 gün boyunca debitlər yalnız təxmin edilir."),
    ]
    for i, (title, text) in enumerate(p_cards):
        x = Inches(0.8 + i * 3.9)
        card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(3.2), Inches(3.7), Inches(3.4))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_ROSE
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(22)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(13)
        p_b.font.color.rgb = TEXT_MUTED

    # SLIDE 3: HƏLL ARXİTEKTURASI (5 ADDIM)
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Həll Arxitekturası: 5 Addımlı İş Axını")

    steps = [
        ("1. Xam Data Qəbulu", "1-dəqiqəlik yüksək tezlikli SCADA sensor telemetriyası"),
        ("2. QC & Hadisələr", "-999.25 təmizlənməsi, donma və 14 İyun kəsintisi"),
        ("3. VFM Modeli", "BoundedRidge ilə gündəlik Neft / Su / Qaz proqnozu"),
        ("4. PTA Analizi", "Bourdet törəməsi və Horner ilə k, skin, ΔPskin"),
        ("5. İnteraktiv UI", "Vahid mühəndis platforması və audit hesabatları"),
    ]
    for i, (st, desc) in enumerate(steps):
        x = Inches(0.8 + i * 2.38)
        card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(2.2), Inches(2.25), Inches(4.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_CYAN
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = st
        p_t.font.size = Pt(14)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_CYAN
        p_b = tf.add_paragraph()
        p_b.text = desc
        p_b.font.size = Pt(12)
        p_b.font.color.rgb = TEXT_MUTED

    # SLIDE 4: KEYFİYYƏT NƏZARƏTİ (QC)
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "Keyfiyyət Nəzarəti: Datanı kor-koranə qəbul etmədik")

    qc_cards = [
        ("Sensor Datası & Hadisələr",
         "• -999.25 boş kodları, ~2,500 dublikat və ~7,000 ardıcıllığı pozulmuş qeyd təmizləndi.\n• 2–3 dəq sıçrayışlar və donmuş sensorlar (≥60 dəq) silindi.\n• 6 quyu bağlanması (shut-in) avtomatik aşkarlandı.\n• 14 İyun 2025 (10:20–15:02) bütün 10 quyuda sahəvi qaz-lift kəsintisi aşkarlandı və analitik üstünlüyə çevrildi."),
        ("Quyu Testləri Düzəlişləri (23 Düzəliş)",
         "• 23 səhv dəyər aşkarlanıb düzəldildi.\n• 5 ədəd işarə xətası düzəldildi.\n• GL-06 qaz debiti Sm³/gün ilə yazılmışdı, ÷28.317 ilə Mscf/gün-ə çevrildi və GOR ilə təsdiqləndi.\n• Hər bir düzəliş Excel çıxışında tam auditlə qeydə alınıb."),
    ]
    for i, (title, text) in enumerate(qc_cards):
        x = Inches(0.8 + i * 5.9)
        card = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(1.8), Inches(5.6), Inches(4.8))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_EMERALD
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(16)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_EMERALD
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(13)
        p_b.font.color.rgb = TEXT_WHITE

    # SLIDE 5: VFM METODOLOGİYASI
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "Virtual Flow Meter: Fiziki Modelləşdirmə & Test Separator Tələsi")

    vfm_cards = [
        ("Log-Xətti Bounded Ridge",
         "• Maye debiti sensorlardan: Pwf, temperatur, annulus təzyiqi, qaz-lift debiti, ştuser ölçüsü.\n• Fiziki məhdudiyyət: hər quyuda Pwf artanda debit mütləq azalmalıdır (mənfi əmsal məcburidir).\n• Su payı: zaman trendi; GOR: test ortalaması.\n• neft = maye × (1 − WC), su = maye × WC, qaz = neft × GOR."),
        ("Test Separator Tələsinin Həlli",
         "• Test zamanı quyuağzı təzyiq (WHP) 4%, aşağı axın təzyiqi 12% düşür, quyudibi təzyiq isə cəmi 0.3% dəyişir.\n• Səth təzyiqləri modelə daxil edilsəydi, süni routing bias yaranacaqdı.\n• Səth təzyiqlərini modeldən çıxardıq → test günü ilə normal gün arasındakı fərq cəmi +0.7%-ə endi!"),
    ]
    for i, (title, text) in enumerate(vfm_cards):
        x = Inches(0.8 + i * 5.9)
        card = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(1.8), Inches(5.6), Inches(4.8))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_CYAN
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(16)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_CYAN
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(13)
        p_b.font.color.rgb = TEXT_WHITE

    # SLIDE 6: VFM DƏQİQLİYİ
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "VFM Dəqiqliyi: Forward Validasiya & Neft Xətasında 38% Azalma")

    vfm_metrics = [
        ("Neft Xətası 38% Azaldı", "Baza metoduna nisbətən neft debiti xətası 38% azaldıldı (3.7% vs 6.0%). Ən yüksək qərarvermə etibarlılığı."),
        ("R² ≥ 0.994 | P10–P90", "Bütün 3 faza üzrə R² ≥ 0.994. Hər quyu üçün gündəlik P10–P90 qeyri-müəyyənlik zolağı təmin edilir."),
        ("Forward Validasiya (55 Test)", "Hər test yalnız ondan ƏVVƏLKİ testlərlə yoxlanılıb:\n• Neft: MAPE 3.7% | Baza 6.0% | R² = 0.997\n• Su: MAPE 4.4% | Baza 5.9% | R² = 0.994\n• Qaz: MAPE 6.6% | Baza 9.2% | R² = 0.996"),
        ("Held-Out LOTO (85 Test)", "Bütün quyu sınaqları üzrə LOTO nəticələri:\n• Neft: MAPE 2.7%\n• Su: MAPE 3.5%\n• Qaz: MAPE 5.8%"),
    ]
    for i, (title, text) in enumerate(vfm_metrics):
        row = i // 2
        col = i % 2
        x = Inches(0.8 + col * 5.9)
        y = Inches(1.8 + row * 2.5)
        card = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_EMERALD
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_EMERALD
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(12)
        p_b.font.color.rgb = TEXT_WHITE

    # SLIDE 7: PTA METODOLOGİYASI
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "PTA Metodologiyası: Bourdet Törəməsi & Horner Analizi")

    pta_m_cards = [
        ("VFM ilə Dinamik Əlaqələndirmə",
         "• Tapşırığa uyğun: Yalnız VFM proqnozlaşdırdığı gündəlik neft debiti ilə təkfazalı neft modeli.\n• q = Bağlanmadan əvvəlki son 3 tam günün orta neft debiti.\n• Dəqiq hasilat müddəti: tp = 24 · Np / q.\n• Qrafik yerləri: Log-log (Bourdet), Horner və MDH diaqramları."),
        ("Bourdet & Keyfiyyət Reytinqi",
         "• Bourdet törəməsi (Agarwal ekvivalent vaxtı) ilə radial axın (IARF) pəncərəsinin avtomatik tapılması.\n• Horner düz xətti: k = 162.6 · q · B · μ / (m · h); ΔPskin = 0.869 · m · s.\n• Tolerans 0.08–0.20 arasında təkrar hesablama aparılır — nəticə stabil deyilsə 'indicative' bayrağı qoyulur."),
    ]
    for i, (title, text) in enumerate(pta_m_cards):
        x = Inches(0.8 + i * 5.9)
        card = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(1.8), Inches(5.6), Inches(4.8))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_CYAN
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(16)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_CYAN
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(13)
        p_b.font.color.rgb = TEXT_WHITE

    # SLIDE 8: PTA NƏTİCƏLƏRİ CƏDVƏLİ
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "PTA Nəticələri: 6 Quyu Bağlanmasının Dəqiq Təhlili")

    pta_results = [
        ("GL-01", "109.15 md", "+5.73", "115.69 psi", "23.25", "🔴 Göstərici (Indicative)", "Törəmə düzləşmədi (saxlama effekti)"),
        ("GL-02", "58.17 md", "−0.70", "−32.97 psi", "54.04", "🟢 Təsdiqlənib (Radial Flow)", "Stabil IARF horizontal xətti"),
        ("GL-04", "53.11 md", "−1.38", "−178.04 psi", "148.42", "🟢 Təsdiqlənib (Radial Flow)", "Stabil IARF horizontal xətti"),
        ("GL-06", "291.74 md", "+1.74", "23.29 psi", "15.43", "🟢 Təsdiqlənib (Radial Flow)", "Yüksək keçiricilik + zədələnmə"),
        ("GL-08", "41.95 md", "−1.72", "−141.65 psi", "94.62", "🟢 Təsdiqlənib (Radial Flow)", "Stabil IARF horizontal xətti"),
        ("GL-10", "188.23 md", "+2.00", "50.05 psi", "28.86", "🔴 Göstərici (Indicative)", "Faza yenidən paylanması artefaktı"),
    ]
    for i, (w, k, s, dp, m, qual, note) in enumerate(pta_results):
        y = Inches(1.8 + i * 0.85)
        card = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), y, Inches(11.7), Inches(0.75))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_EMERALD if "🟢" in qual else ACCENT_ROSE
        card.line.width = Pt(1.0)
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = f"{w}  |  k = {k}  |  Skin = {s}  |  ΔPskin = {dp}  |  Horner m = {m}  |  {qual} ({note})"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = TEXT_WHITE

    # SLIDE 9: ƏSAS TAPINTI: GL-06 STİMULYASİYA
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9)
    add_header(s9, "Əsas Tapıntı: GL-06 Quyu Stimulyasiyası Namizədi")

    gl6_desc = s9.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(11.7), Inches(1.2))
    p_6 = gl6_desc.text_frame.paragraphs[0]
    p_6.text = "GL-06 quyusu stimulyasiya üçün 1 nömrəli sahə namizədidir. Keçiricilik sahə üzrə ən yüksəkdir (k ≈ 292 md), lakin müsbət Skin (+1.74) quyudibi zonanın zədələndiyini göstərir. Təsdiqlənmiş radial axın nəticənin 100% etibarlı olduğunu sübut edir."
    p_6.font.size = Pt(15)
    p_6.font.color.rgb = TEXT_WHITE

    gl6_cards = [
        ("k ≈ 292 md", "Yüksək Keçiricilik\nRadial axın tam təsdiqlənib. Rezervuar əla potensiala malikdir."),
        ("Skin +1.74", "Quyudibi Zədələnməsi\nΔP skin ≈ 23.3 psi təzyiq itkisi mövcuddur."),
        ("Tövsiyə", "Turşulama / Təkrar Perforasiya\nQuyudibinin təmizlənməsi hasilatı dərhal artıracaq."),
    ]
    for i, (title, text) in enumerate(gl6_cards):
        x = Inches(0.8 + i * 3.9)
        card = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(3.2), Inches(3.7), Inches(3.4))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_AMBER
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(22)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_AMBER
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(13)
        p_b.font.color.rgb = TEXT_WHITE

    # SLIDE 10: QAZ-LİFT OPTİMİZASİYASI
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10)
    add_header(s10, "Qaz-Lift Yenidən Bölgüsü: +19 bbl/gün ($0 CAPEX · +$485k/il)")

    gl_exp_cards = [
        ("14 İyun Təbii Eksperimenti",
         "14 İyun 2025 sahə miqyaslı qaz kəsintisi təbii eksperiment kimi istifadə olundu:\n• Qaz təchizatı 50% azaldıldı\n• Hər quyunun canlı Pwf cavabı qeydə alındı\n• Canlı sahə qaz-lift əyriləri kalibrləndi"),
        ("Quyu Həssaslıqları",
         "• GL-01: 100 Mscf/gün qaz → ≈ +26.5 bbl/gün neft (Ölçülmüş yüksək PI)\n• GL-04: 100 Mscf/gün qaz → ≈ +7.5 bbl/gün neft (Doymuş qaz-lift zonası)"),
        ("Xalis Artım ($0 CAPEX)",
         "• 100 Mscf/gün qazı GL-04-dən GL-01-ə yönləndirmək:\n\nXalis Artım: +19 bbl/gün\nİllik Xalis Gəlir: +$485,000 / il\nƏlavə Xərc: $0 CAPEX!"),
    ]
    for i, (title, text) in enumerate(gl_exp_cards):
        x = Inches(0.8 + i * 3.9)
        card = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(1.8), Inches(3.7), Inches(5.0))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_EMERALD
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(16)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_EMERALD
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(13)
        p_b.font.color.rgb = TEXT_WHITE

    # SLIDE 11: İNTERAKTİV PLATFORMA
    s11 = prs.slides.add_slide(blank_layout)
    set_slide_background(s11)
    add_header(s11, "WellPerf Mühəndis İnterfeysi: 4 Əsas Modul")

    plat_mods = [
        ("1. Data Qəbulu & QC", "Real-vaxt SCADA axını, xam CSV qəbulu, min/max zərfi, bağlanmalar qırmızı, qaz-lift kəsintiləri narıncı ilə vurğulanır."),
        ("2. Virtual Axın Ölçməsi (VFM)", "Log-xətti bounded ridge reqressiya, model statusu, MAPE & R² xəta qrafikləri və gündəlik P10–P90 zolağı."),
        ("3. Təzyiq Bərpa Analizi (PTA)", "Hər bağlanma üçün avtomatlaşdırılmış keyfiyyət nişanı, Bourdet, Horner və MDH diaqnostik qrafikləri və audit jurnalı."),
        ("4. Hesabatlar və İxrac", "Excel ixracı: 2,730 sətirlik proqnozlar, rezervuar xassələri, tam audit hesabatı və oflayn interaktiv HTML."),
    ]
    for i, (title, text) in enumerate(plat_mods):
        row = i // 2
        col = i % 2
        x = Inches(0.8 + col * 5.9)
        y = Inches(1.8 + row * 2.5)
        card = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = ACCENT_CYAN
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p_t = tf.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(15)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_CYAN
        p_b = tf.add_paragraph()
        p_b.text = text
        p_b.font.size = Pt(12)
        p_b.font.color.rgb = TEXT_WHITE

    # SLIDE 12: YEKUN DƏYƏR XÜLASƏSİ
    s12 = prs.slides.add_slide(blank_layout)
    set_slide_background(s12)
    add_header(s12, "Yekun Dəyər Xülasəsi: Ayda bir ölçmədən — hər gün etibarlı qərara")

    summary_box = s12.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(11.3), Inches(4.8))
    tfs = summary_box.text_frame
    tfs.word_wrap = True

    sum_items = [
        ("Neft MAPE 3.7%", "Baza metodundan 38% daha dəqiq gündəlik hasilat proqnozlaşdırılması."),
        ("6 / 6 Bağlanma Analiz Edildi", "Bourdet və Horner ilə tam təsdiqlənmiş etibarlı rezervuar nəticələri."),
        ("GL-06: Stimulyasiya Namizədi", "k ≈ 292 md, skin +1.74 quyudibi təmizlənmə və hasilat artımı potensialı."),
        ("Qaz-Lift Optimizasiyası", "+19 bbl/gün xalis neft artımı və +$485,000/il əlavə gəlir ($0 CAPEX)."),
    ]
    for title, desc in sum_items:
        p_t = tfs.add_paragraph()
        p_t.text = f"✓ {title}: {desc}"
        p_t.font.size = Pt(18)
        p_t.font.bold = True
        p_t.font.color.rgb = ACCENT_EMERALD

    p_end = tfs.add_paragraph()
    p_end.text = "\nDiqqətinizə görə təşəkkür edirik! · Suallar və Müzakirə\nKomanda Rubra · SOCAR Hackathon 2026"
    p_end.font.size = Pt(16)
    p_end.font.color.rgb = ACCENT_CYAN

    # Save to all target paths
    out_paths = [
        "SOCAR_HACKATHON_PITCH_DECK.pptx",
        "wellperf-Platform/client/public/SOCAR_HACKATHON_PITCH_DECK.pptx",
        "C:/Users/User/Desktop/SOCAR_HACKATHON_PITCH_DECK.pptx",
        "socar_eval_repo/SOCAR_HACKATHON_PITCH_DECK.pptx"
    ]
    for p in out_paths:
        prs.save(p)
        print(f"Saved: {p}")

if __name__ == "__main__":
    create_deck()
