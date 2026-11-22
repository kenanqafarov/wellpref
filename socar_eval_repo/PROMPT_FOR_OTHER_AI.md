# 🤖 AI Prompt Guide: Intelligent Well Performance Analysis (SOCAR Hackathon 2026)

> **Təlimat:** Bu faylın məzmununu bütövlüklə kopyalayıb istənilən başqa AI-a (məsələn: **ChatGPT Plus (o1/o3/GPT-4o)**, **Claude 3.7 Sonnet**, **DeepSeek-R1**, **Gemini 1.5/2.0 Pro**) göndərə bilərsiniz.

---

```markdown
You are an expert Petroleum Reservoir Engineer, Production Data Scientist, and Python Specialist.

I am participating in the SOCAR Hackathon 2026, focused on "Intelligent Well Performance Analysis". 
I have a complete codebase that solves the challenge, and I want you to evaluate my methodology, verify my assumptions, inspect edge cases, and propose actionable improvements or alternative formulations.

---

### 1. CHALLENGE CONTEXT & OBJECTIVES

The dataset comprises 10 offshore gas-lifted oil wells over several months with 1-minute high-frequency sensor readings, periodic well tests, choke adjustments, and PVT/completion data.

The competition has two primary deliverables:
1. **Virtual Flow Metering (VFM):**
   - Goal: Predict daily per-well allocation rates: `oil_rate_stbd`, `water_rate_stbd`, `gas_rate_mscfd`.
   - Challenge: No multiphase flow meters (MPFM). Only periodic well-tests (~85 tests across 10 wells) and continuous downhole/surface sensor streams (P_wf, P_wh, T_dh, choke %, lift gas injection rate).
   - Evaluation metric: Mean Absolute Percentage Error (MAPE) against held-out and forward-in-time well tests.

2. **Pressure Transient Analysis (PTA):**
   - Goal: For every valid well shut-in (build-up), identify Infinite Acting Radial Flow (IARF) and compute:
     - Effective oil permeability $k$ [mD]
     - Skin factor $s$ [-]
     - Pressure drop due to skin $\Delta P_{skin}$ [psi]
     - Horner slope $m$ [psi/cycle]
   - Challenge: Distinguishing true shut-ins (choke = 0% with pressure build-up) from gas-lift compressor upsets (field-wide trips where wells continue producing or experience slugging), and ensuring wellbore storage (WBS) effects have ceased.

---

### 2. MY CURRENT IMPLEMENTATION DETAILS

Here is how my pipeline currently works:

#### A. Data Cleansing & Event Detection:
- Replaced null markers (`-999.25`), removed ~2,500 duplicate and ~7,000 disordered timestamps.
- Applied rolling-median spike filter and detected sensor freezing (>= 60 identical minutes).
- **Shut-ins vs Gas-Lift Upsets:** Identified 6 real shut-ins from choke events. Separated them strictly from a field-wide gas-lift compressor trip on 14 Jun 2025 (where lift gas dropped <70% for all wells but choke remained open).

#### B. VFM (Virtual Flow Metering):
- Features are aggregated over producing minutes only (uptime > 0).
- **Why Surface Pressures are Excluded:** During well tests, wells route to the test separator, dropping WHP by ~12% and downstream WHP by ~4%, while downhole flowing pressure changes by only ~0.3%. Including WHP caused severe test-manifold leakage/bias in cross-validation (+9% over-prediction on normal days). Excluding WHP eliminated this bias (+0.7% normal vs test day difference).
- **Model:** Log-linear ridge regression fitted via bounded least squares (`scipy.optimize.lsq_linear`):
  - Per well: Intercept, well-centred downhole flowing pressure ($P_{wf}$ constrained with negative slope $\le -1/5000$ psi$^{-1}$ from physical $d\ln q / dP_{wf} = -1/(P_r - P_{wf})$), and time trend.
  - Shared: Downhole temperature, annulus pressure, $\ln(\text{lift gas})$, $\ln(\text{choke})$.
  - Water Cut is modeled as a per-well time trend, and GOR is per-well test mean.
- **Current Performance:**
  - Held-out MAPE: Oil 2.7%, Water 3.5%, Gas 5.8%, Liquid 2.1%
  - Forward MAPE: Oil 3.7%, Water 4.4%, Gas 6.6%, Liquid 3.1%

#### C. PTA (Pressure Transient Analysis):
- Horner analysis equation:
  $$m = \frac{162.6 \cdot q \cdot B_o \cdot \mu_o}{k \cdot h}$$
  $$s = 1.151 \cdot \left[ \frac{P_{1hr} - P_{wf(\Delta t=0)}}{m} - \log_{10}\left(\frac{k}{\phi \cdot \mu_o \cdot c_t \cdot r_w^2}\right) + 3.23 \right]$$
  $$\Delta P_{skin} = 0.869 \cdot m \cdot s$$
- Uses producing time $t_p = 24 \cdot V_{cum} / q_{last}$.
- Evaluates radial flow window using Bourdet logarithmic pressure derivative $t \cdot dP/dt$ (identifying the zero-slope horizontal derivative plateau).

---

### 3. WHAT I NEED YOU TO DO (TASKS FOR YOU)

Please conduct a thorough review and answer the following:

1. **PTA Interpretation Critique:**
   - Are there nuances in gas-lifted wells during shut-in that Horner analysis might distort (e.g. gas-liquid segregation, fallback in the tubing)? How should we account for phase redistribution in the early build-up?
   - How can we make the automated IARF detection more robust against boundary effects or remaining wellbore storage?
   - Could Agarwal Equivalent Time or MDH be more appropriate for any of these shut-in durations?

2. **VFM Modeling Improvements:**
   - Is our physical constraint on $dP_{wf}$ slope ($\le -1/5000$) mathematically sound and physically representative for these reservoir conditions?
   - How can we better capture transient gas-lift rate variations without overfitting the noise?
   - Would an ensemble with a physics-informed choke model (e.g., Perkins, Gilbert, or Sachdeva orifice correlation) improve oil allocation error beyond 2.7% MAPE?

3. **Potential Hidden Pitfalls / Sanity Checks:**
   - What data anomalies or leakage could artificially inflate our high test scores (e.g. temporal correlation between consecutive well test days)?
   - Recommend 3 specific stress-tests or validation checks I should run on the submission deliverables.
```
