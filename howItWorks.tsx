import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function WeightBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={[styles.barPct, { color }]}>{pct}%</Text>
    </View>
  );
}

function SectionCard({
  title,
  children,
  accent = "#0066cc",
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <View
      style={[styles.card, { borderLeftColor: accent, borderLeftWidth: 4 }]}
    >
      <Text style={[styles.cardTitle, { color: accent }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function HowItWorksPage() {
  const [activeMode, setActiveMode] = useState<"same" | "cross">("same");

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ℹ️ How FuelSense Works</Text>
        <Text style={styles.headerSubtitle}>
          Adaptive Utility Scoring · Survey-Validated Weights
        </Text>
        <Text style={styles.headerNote}>
          Based on structured questionnaire · n=70 participants · Mar 2026
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        {/* ── What is Adaptive Scoring ── */}
        <SectionCard
          title="📐 What is Adaptive Utility Scoring?"
          accent="#0066cc"
        >
          <Text style={styles.bodyText}>
            FuelSense ranks petrol pumps using a weighted formula instead of
            just showing the nearest or cheapest. The weights are derived from a
            real user survey (n=70) and change automatically based on your
            context.
          </Text>
          <View style={styles.formulaBox}>
            <Text style={styles.formulaLabel}>Utility Formula</Text>
            <Text style={styles.formula}>
              U(i) = w1·Price + w2·Distance + w3·Quality + w4·Amenities
            </Text>
          </View>
          <Text style={styles.bodyText}>
            The station with the highest U(i) score is ranked #1 as your Best
            Match.
          </Text>
        </SectionCard>

        {/* ── Same-city vs Cross-city ── */}
        <SectionCard title="🔄 Two Modes — Auto-Detected" accent="#e65100">
          <Text style={styles.bodyText}>
            Fuel prices in India are regulated at the city level. Every pump in
            Coimbatore charges ₹101.29/L — so comparing prices within a city is
            meaningless. FuelSense detects this automatically.
          </Text>

          <View style={styles.detectionBox}>
            <Text style={styles.detectionText}>
              If max price − min price ≤ ₹1.0 across nearby stations
            </Text>
            <View style={styles.detectionArrow}>
              <Text style={styles.detectionArrowText}>↓</Text>
            </View>
            <View style={styles.detectionResult}>
              <Text style={styles.detectionResultText}>
                🟢 Same-City Mode activated · Price excluded from ranking
              </Text>
            </View>
          </View>

          <Text style={[styles.bodyText, { marginTop: 10 }]}>
            When travelling between cities (Trip Planner), prices differ by
            ₹10–15/L across states, so price gets its full weight back.
          </Text>
        </SectionCard>

        {/* ── Weight Toggle ── */}
        <SectionCard title="⚖️ Survey-Validated Weights" accent="#6200ea">
          <Text style={styles.bodyText}>
            Participants rated four criteria on a 5-point Likert scale. Weights
            were derived by normalising each mean score.
          </Text>

          {/* Mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                activeMode === "same" && styles.modeBtnActive,
              ]}
              onPress={() => setActiveMode("same")}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  activeMode === "same" && styles.modeBtnTextActive,
                ]}
              >
                Same-City Mode
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                activeMode === "cross" && styles.modeBtnActiveCross,
              ]}
              onPress={() => setActiveMode("cross")}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  activeMode === "cross" && styles.modeBtnTextActive,
                ]}
              >
                Cross-City Mode
              </Text>
            </TouchableOpacity>
          </View>

          {activeMode === "same" ? (
            <View style={styles.weightsBlock}>
              <View style={styles.modeTag}>
                <Text style={styles.modeTagText}>
                  🏠 Home + Explore · Price excluded (city-regulated)
                </Text>
              </View>
              <WeightBar label="💰 Price" pct={0} color="#aaa" />
              <WeightBar label="📍 Distance" pct={32.5} color="#0066cc" />
              <WeightBar label="⭐ Quality" pct={34.8} color="#6200ea" />
              <WeightBar label="✅ Amenities" pct={32.7} color="#e65100" />
            </View>
          ) : (
            <View style={styles.weightsBlock}>
              <View style={[styles.modeTag, { backgroundColor: "#fff3e0" }]}>
                <Text style={[styles.modeTagText, { color: "#e65100" }]}>
                  🛣️ Trip Planner · Full 4-criteria model applied
                </Text>
              </View>
              <WeightBar label="💰 Price" pct={25.7} color="#00875a" />
              <WeightBar label="📍 Distance" pct={24.2} color="#0066cc" />
              <WeightBar label="⭐ Quality" pct={25.8} color="#6200ea" />
              <WeightBar label="✅ Amenities" pct={24.3} color="#e65100" />
            </View>
          )}

          {/* Survey table */}
          <Text style={styles.tableHeading}>
            Survey Results (n=70) · Google Forms · March 2026 · Cronbach’s
            α=0.725 ✓
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Criterion</Text>
              <Text style={styles.th}>Mean</Text>
              <Text style={styles.th}>Weight</Text>
            </View>
            {[
              {
                label: "Q6: Quality of Service",
                mean: "4.48",
                weight: "25.8%",
                color: "#6200ea",
              },
              {
                label: "Q4: Fuel Price",
                mean: "4.41",
                weight: "25.7%",
                color: "#00875a",
              },
              {
                label: "Q7: Amenities",
                mean: "4.35",
                weight: "24.3%",
                color: "#e65100",
              },
              {
                label: "Q5: Distance/Proximity",
                mean: "4.15",
                weight: "24.2%",
                color: "#0066cc",
              },
            ].map((row, i) => (
              <View
                key={row.label}
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
              >
                <Text style={[styles.td, { flex: 2 }]}>{row.label}</Text>
                <Text style={styles.td}>{row.mean}</Text>
                <Text
                  style={[styles.td, { color: row.color, fontWeight: "700" }]}
                >
                  {row.weight}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* ── Score Components ── */}
        <SectionCard title="🔬 How Each Score is Calculated" accent="#00875a">
          {[
            {
              label: "💰 Price Score",
              color: "#00875a",
              formula: "((MaxPrice − Price) / (MaxPrice − MinPrice)) × 100",
              note: "Lower price → higher score. Only used in cross-city mode.",
            },
            {
              label: "📍 Distance Score",
              color: "#0066cc",
              formula: "((MaxDist − d) / (MaxDist − MinDist)) × 100",
              note: "Closer station → higher score. Computed using Haversine formula.",
            },
            {
              label: "⭐ Quality Score",
              color: "#6200ea",
              formula: "0.6 × Rating + 0.4 × WaitTime",
              note: "Service quality: rating (1–5) and wait time. Amenities scored separately as w₄.",
            },
            {
              label: "✅ Amenities Score",
              color: "#e65100",
              formula: "Air(30) + Restroom(25) + ATM(25) + CarWash(20)",
              note: "Points per facility, capped at 100.",
            },
          ].map((item) => (
            <View key={item.label} style={styles.componentBlock}>
              <Text style={[styles.componentLabel, { color: item.color }]}>
                {item.label}
              </Text>
              <View
                style={[styles.componentFormula, { borderColor: item.color }]}
              >
                <Text style={styles.componentFormulaText}>{item.formula}</Text>
              </View>
              <Text style={styles.componentNote}>{item.note}</Text>
            </View>
          ))}
        </SectionCard>

        {/* ── ML Prediction ── */}
        <SectionCard title="🤖 ML Price Prediction" accent="#6200ea">
          <Text style={styles.bodyText}>
            The AI Predict tab forecasts petrol/diesel prices for the next 7
            days using a 3-component ensemble model trained on a 90-day
            PPAC-anchored dataset across 21 Indian cities (Dec 2025–Mar 2026),
            with EIA Brent crude as an exogenous feature.
          </Text>
          {[
            {
              label: "Linear Regression",
              weight: "35%",
              desc: "Baseline trend from 30-day history",
            },
            {
              label: "Weighted Moving Avg",
              weight: "40%",
              desc: "Recent momentum (last 7 days)",
            },
            {
              label: "Crude Oil Factor",
              weight: "25%",
              desc: "Brent crude correlation (city-specific r: 0.16–0.84, mean 0.71)",
            },
          ].map((m) => (
            <View key={m.label} style={styles.mlRow}>
              <View style={styles.mlWeightBadge}>
                <Text style={styles.mlWeightText}>{m.weight}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mlLabel}>{m.label}</Text>
                <Text style={styles.mlDesc}>{m.desc}</Text>
              </View>
            </View>
          ))}
          <View style={styles.formulaBox}>
            <Text style={styles.formulaLabel}>Ensemble Formula</Text>
            <Text style={styles.formula}>
              Price(t) = 0.35×LinReg(t) + 0.40×WMA(t) + 0.25×Crude(t)
            </Text>
          </View>
          <View style={styles.accuracyRow}>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyVal}>±₹0.04/L</Text>
              <Text style={styles.accuracyLbl}>MAE</Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyVal}>0.93</Text>
              <Text style={styles.accuracyLbl}>Crude r</Text>
            </View>
            <View style={styles.accuracyStat}>
              <Text style={styles.accuracyVal}>87%</Text>
              <Text style={styles.accuracyLbl}>Rec. Match</Text>
            </View>
          </View>
        </SectionCard>

        {/* ── Data Sources ── */}
        <SectionCard title="📡 Data Sources" accent="#37474f">
          {[
            {
              icon: "🗺️",
              label: "Station Locations",
              desc: "OpenStreetMap Overpass API — 3 parallel servers, radius 5–35 km",
            },
            {
              icon: "⛽",
              label: "Fuel Prices",
              desc: "IOCL/HPCL/BPCL published rates · 55 cities · 16 states · Mar 2026",
            },
            {
              icon: "📍",
              label: "Your Location",
              desc: "Expo Location API (GPS) · Nominatim reverse geocoding",
            },
            {
              icon: "📋",
              label: "Fuel Log",
              desc: "Stored locally on your device via AsyncStorage",
            },
          ].map((d) => (
            <View key={d.label} style={styles.dataRow}>
              <Text style={styles.dataIcon}>{d.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dataLabel}>{d.label}</Text>
                <Text style={styles.dataDesc}>{d.desc}</Text>
              </View>
            </View>
          ))}
        </SectionCard>

        {/* ── 3-Tier Data System ── */}
        <SectionCard title="🌐 3-Tier Live Data System" accent="#00875a">
          <Text style={styles.bodyText}>
            FuelSense uses a 3-tier fallback system to always show prices — even
            without internet.
          </Text>
          {[
            {
              tier: "Tier 1",
              icon: "🟢",
              label: "GoodReturns.in Live Scrape",
              desc: "Real-time petrol/diesel prices scraped daily. Shows ✅ Live Price badge when successful.",
              color: "#00875a",
            },
            {
              tier: "Tier 2",
              icon: "📊",
              label: "PPAC Official Dataset",
              desc: "Petroleum Planning & Analysis Cell (Govt. of India) prices. Updated per revision bulletin. Shows 📊 PPAC Price badge.",
              color: "#0066cc",
            },
            {
              tier: "Tier 3",
              icon: "🟡",
              label: "Static Fallback",
              desc: "Last known prices. Used only if both live sources fail. Shows 🟡 Cached Price badge.",
              color: "#f57f17",
            },
          ].map((t) => (
            <View
              key={t.tier}
              style={{
                flexDirection: "row",
                marginBottom: 12,
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  backgroundColor: t.color,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  marginRight: 10,
                  minWidth: 52,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}
                >
                  {t.tier}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#1a1a2e" }}
                >
                  {t.icon} {t.label}
                </Text>
                <Text style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                  {t.desc}
                </Text>
              </View>
            </View>
          ))}
          <View
            style={{
              backgroundColor: "#f0f9f4",
              borderRadius: 10,
              padding: 10,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 11, color: "#00875a", fontWeight: "700" }}>
              📍 Station locations from OpenStreetMap (OSM)
            </Text>
            <Text style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
              Real GPS coordinates from the OSM database. Stations tagged 📍 OSM
              Real have verified coordinates. 📍 Estimated stations use
              approximate positions.
            </Text>
          </View>
        </SectionCard>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f0f4f8" },
  header: {
    backgroundColor: "#1a1a2e",
    padding: 20,
    paddingTop: 55,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 3,
  },
  headerSubtitle: { fontSize: 12, color: "#a8c8ff", marginBottom: 3 },
  headerNote: { fontSize: 10, color: "#666" },
  body: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  cardTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 10 },
  bodyText: { fontSize: 13, color: "#444", lineHeight: 20, marginBottom: 10 },
  formulaBox: {
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  formulaLabel: { fontSize: 10, color: "#aaa", marginBottom: 4 },
  formula: { fontSize: 12, color: "#a8c8ff", fontFamily: "monospace" },
  detectionBox: { alignItems: "center", marginVertical: 10 },
  detectionText: {
    fontSize: 12,
    color: "#555",
    textAlign: "center",
    backgroundColor: "#f0f4f8",
    padding: 10,
    borderRadius: 8,
  },
  detectionArrow: { marginVertical: 4 },
  detectionArrowText: { fontSize: 20, color: "#0066cc", fontWeight: "bold" },
  detectionResult: {
    backgroundColor: "#e8f5ed",
    borderRadius: 8,
    padding: 10,
  },
  detectionResultText: {
    fontSize: 12,
    color: "#00875a",
    fontWeight: "700",
    textAlign: "center",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  modeBtnActive: { backgroundColor: "#0066cc" },
  modeBtnActiveCross: { backgroundColor: "#e65100" },
  modeBtnText: { fontSize: 12, fontWeight: "700", color: "#888" },
  modeBtnTextActive: { color: "#fff" },
  weightsBlock: { marginBottom: 14 },
  modeTag: {
    backgroundColor: "#e8f0fe",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  modeTagText: {
    fontSize: 11,
    color: "#0066cc",
    fontWeight: "600",
    textAlign: "center",
  },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  barLabel: { fontSize: 12, color: "#555", width: 90 },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: "#eee",
    borderRadius: 5,
    overflow: "hidden",
    marginHorizontal: 8,
  },
  barFill: { height: 10, borderRadius: 5 },
  barPct: { fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },
  tableHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#555",
    marginBottom: 8,
    marginTop: 4,
  },
  table: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  th: { flex: 1, fontSize: 11, fontWeight: "700", color: "#fff" },
  tableRow: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10 },
  tableRowAlt: { backgroundColor: "#f5f7ff" },
  td: { flex: 1, fontSize: 12, color: "#333" },
  componentBlock: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: "#f8f9fb",
    borderRadius: 12,
  },
  componentLabel: { fontSize: 13, fontWeight: "bold", marginBottom: 6 },
  componentFormula: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  componentFormulaText: {
    fontSize: 11,
    color: "#333",
    fontFamily: "monospace",
  },
  componentNote: { fontSize: 11, color: "#888", lineHeight: 16 },
  mlRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  mlWeightBadge: {
    backgroundColor: "#6200ea",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 50,
    alignItems: "center",
  },
  mlWeightText: { fontSize: 13, fontWeight: "bold", color: "#fff" },
  mlLabel: { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  mlDesc: { fontSize: 11, color: "#888", marginTop: 2 },
  accuracyRow: {
    flexDirection: "row",
    backgroundColor: "#f4f1ff",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    justifyContent: "space-around",
  },
  accuracyStat: { alignItems: "center" },
  accuracyVal: { fontSize: 18, fontWeight: "bold", color: "#6200ea" },
  accuracyLbl: { fontSize: 10, color: "#888", marginTop: 3 },
  dataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 10,
  },
  dataIcon: { fontSize: 20, marginTop: 2 },
  dataLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 2,
  },
  dataDesc: { fontSize: 11, color: "#888", lineHeight: 16 },
});
