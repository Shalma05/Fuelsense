# ⛽ FuelSense

> *An AI-powered fuel assistant that finds nearby petrol pumps, compares prices, and predicts future fuel costs using a 3-component ML ensemble.*

## 📱 About

FuelSense is a cross-platform mobile application built with React Native and Expo. It goes beyond a simple petrol pump finder — it is a complete smart fuel assistant that helps users find nearby stations, compare prices across cities, predict upcoming price trends using machine learning, plan trips with fuel cost estimates, and log personal fuel usage history.

---

## ✨ Features

| Tab | Feature | Description |
|-----|---------|-------------|
| 🏠 Home | Nearby Pumps | GPS-based detection of petrol stations with smart scoring |
| 🗺️ Explore | City Explorer | Compare fuel prices across major Indian cities |
| 🧭 Trip Plan | Travel Planner | Estimate fuel cost and optimal stops for any journey |
| ⚡ EV | EV Comparison | Compare fuel savings vs electric vehicle range |
| 🤖 AI Predict | ML Prediction | Predict petrol & diesel prices for next 7–30 days |
| 📋 Fuel Log | Usage Tracker | Log personal refuelling history and spending |
| ℹ️ About | How It Works | Understand the ML model and data sources |
| ⚙️ Settings | Preferences | Customise vehicle type, city, and alert thresholds |

---

## 🤖 ML Engine — FuelSense v3.0

FuelSense uses a **3-component ensemble model** for fuel price prediction:

```
Ensemble Prediction = (0.35 × Linear Regression)
                    + (0.40 × Weighted Moving Average)
                    + (0.25 × Crude Oil Correlation)
```

### Data Sources
- **Fuel Prices** → PPAC Retail Selling Price bulletins (ppac.gov.in), cross-validated with GoodReturns.in
- **Crude Oil** → EIA Brent Crude daily series (eia.gov)
- **Training Window** → Dec 2025 – Mar 2026 (90 days)
- **Train/Test Split** → 67% train / 33% test
- **Evaluation Metrics** → MAE, RMSE, MAPE

---

## 🏆 Smart Scoring Algorithm

FuelSense ranks nearby petrol pumps using a **Survey-Validated Dual-Mode MCDM** (Multi-Criteria Decision Making) system.

Weights derived from a **Google Forms survey (n=70 participants, March 2026)**:

| Criterion | Weight |
|-----------|--------|
| Fuel Price | 25.7% |
| Distance | 24.2% |
| Quality / Service Rating | 25.8% |
| Amenities | 24.3% |
| **Cronbach's α** | **0.725** |

> **Key Innovation:** Dual-mode auto-detection — within a single city where government-regulated prices are the same, price weight is redistributed to the remaining criteria for more meaningful rankings.

---

## 📡 3-Tier Data System

```
Tier 1 → Live scrape from GoodReturns.in     (updated daily 6am IST)
Tier 2 → PPAC official government dataset    (always available fallback)
Tier 3 → Hardcoded static prices             (absolute last resort)
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React Native 0.81 | Cross-platform mobile UI |
| Expo SDK 54 | Build toolchain and device APIs |
| TypeScript | Type-safe development |
| Expo Router | File-based tab navigation |
| Expo Location | GPS and location services |
| React Native Maps | Interactive map rendering |
| Regression.js | Linear regression ML model |
| Axios + Cheerio | Live data fetching and scraping |
| AsyncStorage | Local fuel log persistence |

---

## 📂 Project Structure

```
FuelSense/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Home — nearby pumps
│   │   ├── explore.tsx        # City price explorer
│   │   ├── travelPlanner.tsx  # Trip fuel calculator
│   │   ├── ev.tsx             # EV comparison tab
│   │   ├── mlPredict.tsx      # AI price prediction
│   │   ├── fuelLog.tsx        # Personal fuel log
│   │   ├── howItWorks.tsx     # About the ML model
│   │   ├── settings.tsx       # User preferences
│   │   └── _layout.tsx        # Tab navigation layout
│   └── _layout.tsx            # Root layout
├── utils/
│   ├── mlService.ts           # ML ensemble engine
│   ├── locationService.ts     # GPS with fallback strategies
│   ├── services.ts            # 3-tier data fetching system
│   ├── scoring.ts             # Smart pump scoring algorithm
│   └── storage.ts             # Fuel log and alerts storage
├── components/                # Reusable UI components
├── constants/                 # Theme and design tokens
├── assets/                    # Icons and images
├── package.json
└── app.json
```



## 👩‍💻 Author

**Shalma WM**
- GitHub: [@Shalma05](https://github.com/Shalma05)
- Institution: Karunya Institute of Technology and Sciences

---

