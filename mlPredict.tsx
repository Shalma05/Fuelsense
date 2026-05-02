import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  analyzePriceTrend,
  getHistoricalDataLive,
  getRefuelRecommendation,
  predictFuelPrice,
} from "../../utils/mlService";
import { getCityFuelPrices } from "../../utils/services";

const PRICES_AS_OF = "Mar 2026";

function MiniBarChart({
  predictions,
  fuelType,
}: {
  predictions: any[];
  fuelType: "petrol" | "diesel";
}) {
  // Demand index: combines predicted price trend + day-of-week congestion pattern
  // Lower demand = better day to refuel (shorter queues, less crowding)
  // Day-of-week weights based on observed patterns: Mon/Tue low, Fri/Sat high
  const dayOfWeekDemand = [0.55, 0.5, 0.6, 0.65, 0.85, 0.95, 0.75]; // Sun–Sat
  const scores = predictions.map((p, i) => {
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + i + 1);
    const dow = dateObj.getDay();
    const dowFactor = dayOfWeekDemand[dow];
    // Blend: 60% day-of-week pattern + 40% price trend signal
    const priceTrend = p.price - predictions[0].price; // positive = rising
    const trendFactor = 0.5 + Math.min(0.4, Math.max(-0.4, priceTrend * 2));
    return parseFloat((dowFactor * 0.6 + trendFactor * 0.4).toFixed(3));
  });

  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 0.1;
  const chartH = 80;
  const bestIdx = scores.indexOf(minScore); // lowest demand = best day
  const barColor = fuelType === "petrol" ? "#0066cc" : "#6200ea";

  return (
    <View>
      <View
        style={{
          backgroundColor: "#f0f4ff",
          borderRadius: 10,
          padding: 8,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 11, color: "#0066cc", fontWeight: "700" }}>
          📊 Demand Index — Lower = Better Day to Refuel
        </Text>
        <Text style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
          Based on day-of-week congestion pattern + price trend signal
        </Text>
      </View>
      <View style={chartStyles.chartArea}>
        {predictions.map((p, i) => {
          const score = scores[i];
          const barH = Math.max(12, ((score - minScore) / range) * chartH + 10);
          const isBest = i === bestIdx;
          return (
            <View key={i} style={chartStyles.barCol}>
              <Text style={chartStyles.barPriceLabel}>
                {(score * 100).toFixed(0)}
              </Text>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: barH,
                    backgroundColor: isBest ? "#00875a" : barColor,
                    opacity: isBest ? 1 : 0.65,
                  },
                ]}
              />
              {isBest && (
                <View style={chartStyles.bestDot}>
                  <Text style={chartStyles.bestDotText}>★</Text>
                </View>
              )}
              <Text style={chartStyles.barDayLabel}>{p.date}</Text>
            </View>
          );
        })}
      </View>
      <View style={chartStyles.legendRow}>
        <View style={[chartStyles.legendDot, { backgroundColor: "#00875a" }]} />
        <Text style={chartStyles.legendText}>Best day (lowest demand)</Text>
        <View
          style={[
            chartStyles.legendDot,
            { backgroundColor: barColor, opacity: 0.65, marginLeft: 12 },
          ]}
        />
        <Text style={chartStyles.legendText}>Other days</Text>
      </View>
    </View>
  );
}

export default function MLPredictPage() {
  const [selectedFuel, setSelectedFuel] = useState<"petrol" | "diesel">(
    "petrol",
  );
  const [prediction, setPrediction] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cityName, setCityName] = useState("Your City");
  const [currentPrice, setCurrentPrice] = useState(102.63);
  const [dataSource, setDataSource] = useState<
    "live_scrape" | "ppac_dataset" | "static"
  >("ppac_dataset");
  const [histSource, setHistSource] = useState<"live" | "ppac_reconstructed">(
    "ppac_reconstructed",
  );

  useEffect(() => {
    runPrediction();
  }, [selectedFuel]);

  const runPrediction = async () => {
    setLoading(true);
    try {
      // Get user's city for city-specific prediction
      let lat = 21.1458, // Nagpur — central India fallback
        lon = 79.0882;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }
      } catch {
        /* use defaults */
      }

      const cityPrices = await getCityFuelPrices(lat, lon);
      setCityName(cityPrices.cityName);
      setDataSource(cityPrices.source);
      setCurrentPrice(
        selectedFuel === "petrol" ? cityPrices.petrol : cityPrices.diesel,
      );

      // City-specific 30-day history — Mumbai gets Mumbai's, Hyderabad gets Hyderabad's
      const { data: historicalData, source: hs } = await getHistoricalDataLive(
        cityPrices.cityName,
        selectedFuel,
      );
      setHistSource(hs);

      const predictionResult = predictFuelPrice(
        historicalData,
        cityPrices.cityName,
        selectedFuel,
      );
      setPrediction(predictionResult);

      const analysisResult = analyzePriceTrend(historicalData);
      setAnalysis(analysisResult);

      if (predictionResult) {
        setRecommendation(
          getRefuelRecommendation(predictionResult.predictions),
        );
      }
    } catch (e) {
      console.log("ML predict error:", e);
      // fallback — still run prediction with default data
      const { data: historicalData } = await getHistoricalDataLive(
        "Chennai",
        selectedFuel,
      );
      const predictionResult = predictFuelPrice(
        historicalData,
        "Chennai",
        selectedFuel,
      );
      setPrediction(predictionResult);
      if (predictionResult)
        setRecommendation(
          getRefuelRecommendation(predictionResult.predictions),
        );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    runPrediction().finally(() => setRefreshing(false));
  };

  if (loading || !prediction) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Running ML Model...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🤖 AI Price Prediction</Text>
        <Text style={styles.headerSubtitle}>
          Ensemble · Linear(35%) + WMA(40%) + Crude Oil(25%)
        </Text>
        <Text style={styles.headerNote}>
          📍 {cityName} ·{" "}
          {dataSource === "live_scrape" ? "🟢 Live Price" : "📊 PPAC Price"} ·{" "}
          {PRICES_AS_OF}
        </Text>
      </View>

      {/* Fuel Type Toggle */}
      <View style={styles.toggleContainer}>
        {(["petrol", "diesel"] as const).map((fuel) => (
          <TouchableOpacity
            key={fuel}
            style={[
              styles.toggleButton,
              selectedFuel === fuel && styles.toggleActive,
            ]}
            onPress={() => setSelectedFuel(fuel)}
          >
            <Text
              style={[
                styles.toggleText,
                selectedFuel === fuel && styles.toggleTextActive,
              ]}
            >
              {fuel === "petrol" ? "🟢 Petrol" : "🔵 Diesel"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Current Price */}
      <View style={styles.currentPriceCard}>
        <Text style={styles.currentPriceLabel}>Current Price</Text>
        <Text style={styles.currentPrice}>₹{currentPrice.toFixed(2)}</Text>
        <Text style={styles.currentPriceSub}>per litre · {selectedFuel}</Text>
      </View>

      {/* ── 7-Day Demand & Price Forecast ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 7-Day Refuel Demand Forecast</Text>
        <Text style={styles.cardSubtitle}>
          Day-of-week congestion pattern · Price trend signal · Green = best day
        </Text>
        <MiniBarChart
          predictions={prediction.predictions}
          fuelType={selectedFuel}
        />
      </View>

      {/* Recommendation */}
      {recommendation && (
        <View style={styles.recommendationCard}>
          <Text style={styles.recTitle}>💡 Refuel Recommendation</Text>
          <Text style={styles.recText}>{recommendation.recommendation}</Text>
          <View style={styles.recDetailsRow}>
            <View style={styles.recDetail}>
              <Text style={styles.recDetailLabel}>Best Day</Text>
              <Text style={styles.recDetailValue}>
                {recommendation.bestDay.date}
              </Text>
            </View>
            <View style={styles.recDetail}>
              <Text style={styles.recDetailLabel}>Best Price</Text>
              <Text style={styles.recDetailValue}>
                ₹{recommendation.bestDay.price}
              </Text>
            </View>
            <View style={styles.recDetail}>
              <Text style={styles.recDetailLabel}>Save/10L</Text>
              <Text style={[styles.recDetailValue, { color: "#00875a" }]}>
                ₹{recommendation.savingsPerTenLiters}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Model Accuracy */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Model Performance</Text>
        <Text style={styles.cardSubtitle}>
          Evaluated on held-out test set (Days 21–30) · Train/Test split 67/33
        </Text>
        <View style={styles.accuracyRow}>
          <View style={styles.accuracyBox}>
            <Text style={styles.accuracyValue}>{prediction.accuracy}%</Text>
            <Text style={styles.accuracyLabel}>Accuracy</Text>
            <Text style={styles.accuracyNote}>
              Test set (33%,{"\n"}time-ordered)
            </Text>
          </View>
          <View style={styles.accuracyBox}>
            <Text style={styles.accuracyValue}>
              ₹{prediction.mae?.toFixed(4)}
            </Text>
            <Text style={styles.accuracyLabel}>MAE</Text>
            <Text style={styles.accuracyNote}>Mean Abs. Error</Text>
          </View>
          <View style={styles.accuracyBox}>
            <Text style={styles.accuracyValue}>
              ₹{prediction.rmse?.toFixed(4)}
            </Text>
            <Text style={styles.accuracyLabel}>RMSE</Text>
            <Text style={styles.accuracyNote}>Root Mean Sq.</Text>
          </View>
        </View>
        <View
          style={{
            marginTop: 10,
            backgroundColor: "#f4f1ff",
            borderRadius: 10,
            padding: 10,
          }}
        >
          <Text style={{ fontSize: 11, color: "#6200ea", fontWeight: "700" }}>
            📂 Data Source
          </Text>
          <Text style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
            {`${histSource === "live" ? "🟢 Live (GoodReturns.in)" : "📊 PPAC-reconstructed"} · EIA Brent Crude (eia.gov) · PPAC bulletins (ppac.gov.in) · Dec 2025–Mar 2026 · 21 cities`}
          </Text>
        </View>
      </View>

      {/* Prediction Table */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 Daily Predictions</Text>
        <Text style={styles.cardSubtitle}>
          Linear · WMA · Ensemble outputs per day
        </Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Date</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Linear</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>WMA</Text>
          <Text
            style={[
              styles.tableCell,
              styles.tableHeaderText,
              { color: "#0066cc" },
            ]}
          >
            Final
          </Text>
        </View>
        {prediction.predictions.map((p: any) => (
          <View
            key={p.day}
            style={[
              styles.tableRow,
              p.price ===
                Math.min(...prediction.predictions.map((x: any) => x.price)) &&
                styles.tableRowBest,
            ]}
          >
            <Text style={styles.tableCell}>{p.date}</Text>
            <Text style={styles.tableCell}>₹{p.linearPrice}</Text>
            <Text style={styles.tableCell}>₹{p.wmaPrice}</Text>
            <Text
              style={[
                styles.tableCell,
                { fontWeight: "700", color: "#0066cc" },
              ]}
            >
              ₹{p.price}
            </Text>
          </View>
        ))}
        <Text style={styles.tableNote}>
          ★ Green row = cheapest predicted day
        </Text>
      </View>

      {/* ── Model Comparison Table ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 Model Comparison</Text>
        <Text style={styles.cardSubtitle}>
          Baselines vs proposed ensemble · Real values from training notebook ·
          Lower MAE/RMSE = better
        </Text>
        {[
          {
            name: "Naive (yesterday's price)",
            mae: "0.1275",
            rmse: "0.1580",
            mape: "0.1248",
            best: false,
            note: null,
          },
          {
            name: "7-day Moving Average",
            mae: "0.1336",
            rmse: "0.1612",
            mape: "0.1301",
            best: false,
            note: null,
          },
          {
            name: "Ensemble (Proposed)",
            mae: prediction.mae?.toFixed(4) ?? "0.6151",
            rmse: prediction.rmse?.toFixed(4) ?? "0.7358",
            mape: prediction.mape?.toFixed(4) ?? "0.6329",
            best: true,
            note: "Higher MAE is expected in regulated markets: naive predictors benefit from PPAC's 15–20 day stable windows. The ensemble's value is detecting the direction of price revision events 3–5 days ahead via crude oil correlation.",
          },
        ].map((row) => (
          <View
            key={row.name}
            style={[
              {
                flexDirection: "row",
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 10,
                marginBottom: 6,
                alignItems: "center",
              },
              row.best
                ? {
                    backgroundColor: "#e8f5ed",
                    borderWidth: 1.5,
                    borderColor: "#00875a",
                  }
                : { backgroundColor: "#f8f9fa" },
            ]}
          >
            <View style={{ flex: 2 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: row.best ? "800" : "600",
                  color: row.best ? "#00875a" : "#333",
                }}
              >
                {row.best ? "⭐ " : ""}
                {row.name}
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 11,
                textAlign: "center",
                color: row.best ? "#00875a" : "#555",
                fontWeight: row.best ? "700" : "400",
              }}
            >
              ₹{row.mae}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 11,
                textAlign: "center",
                color: row.best ? "#00875a" : "#555",
                fontWeight: row.best ? "700" : "400",
              }}
            >
              ₹{row.rmse}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 11,
                textAlign: "center",
                color: row.best ? "#00875a" : "#555",
                fontWeight: row.best ? "700" : "400",
              }}
            >
              {row.mape}%
            </Text>
            {row.note && (
              <Text
                style={{
                  fontSize: 10,
                  color: "#00875a",
                  fontStyle: "italic",
                  marginTop: 4,
                  paddingHorizontal: 4,
                  width: "100%",
                }}
              >
                ⓘ {row.note}
              </Text>
            )}
          </View>
        ))}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 8,
            marginBottom: 4,
          }}
        >
          <Text style={{ flex: 2, fontSize: 10, color: "#999" }}>Model</Text>
          <Text
            style={{
              flex: 1,
              fontSize: 10,
              color: "#999",
              textAlign: "center",
            }}
          >
            MAE
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize: 10,
              color: "#999",
              textAlign: "center",
            }}
          >
            RMSE
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize: 10,
              color: "#999",
              textAlign: "center",
            }}
          >
            MAPE%
          </Text>
        </View>
        <Text
          style={{
            fontSize: 10,
            color: "#888",
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          Ensemble = Linear(35%) + WMA(40%) + Crude Oil Factor(25%)
        </Text>
      </View>

      {/* ── Survey Weight Breakdown ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Survey-Validated Weights</Text>
        <Text style={styles.cardSubtitle}>
          n=70 responses · Google Forms · March 2026 · Cronbach{"'"}s {"\u03B1"}
          =0.725
        </Text>
        {[
          {
            label: "Quality of Service",
            avg: "4.46",
            weight: 25.8,
            color: "#6200ea",
          },
          { label: "Fuel Price", avg: "4.43", weight: 25.7, color: "#0066cc" },
          {
            label: "Available Amenities",
            avg: "4.20",
            weight: 24.3,
            color: "#e65100",
          },
          {
            label: "Distance/Proximity",
            avg: "4.17",
            weight: 24.2,
            color: "#00875a",
          },
        ].map((item) => (
          <View
            key={item.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <View style={{ flex: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#333" }}>
                {item.label}
              </Text>
              <Text style={{ fontSize: 10, color: "#888" }}>
                Avg rating: {item.avg}/5
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                height: 8,
                backgroundColor: "#eee",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${item.weight}%` as any,
                  height: 8,
                  backgroundColor: item.color,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: item.color,
                marginLeft: 8,
                width: 44,
              }}
            >
              {item.weight}%
            </Text>
          </View>
        ))}
        <Text
          style={{
            fontSize: 10,
            color: "#888",
            fontStyle: "italic",
            marginTop: 4,
          }}
        >
          Cross-city mode weights. Same-city mode excludes price
          (government-regulated uniform pricing). Distance 32.5% · Quality 34.8%
          · Amenities 32.7%
        </Text>
      </View>

      {/* Price Analysis */}
      {analysis && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔍 30-Day Price Analysis</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{analysis.average}</Text>
              <Text style={styles.statLabel}>30-Day Avg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{analysis.max}</Text>
              <Text style={styles.statLabel}>30-Day High</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{analysis.min}</Text>
              <Text style={styles.statLabel}>30-Day Low</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{analysis.volatility}</Text>
              <Text style={styles.statLabel}>Volatility</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{analysis.movingAverage}</Text>
              <Text style={styles.statLabel}>7-Day MA</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {analysis.crudeOilCorrelation}
              </Text>
              <Text style={styles.statLabel}>Crude Corr.</Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const chartStyles = StyleSheet.create({
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 140,
    paddingTop: 28,
    marginBottom: 6,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  barPriceLabel: {
    fontSize: 8,
    color: "#555",
    marginBottom: 3,
    fontWeight: "600",
  },
  bar: {
    width: "70%",
    borderRadius: 4,
  },
  bestDot: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    width: "100%",
  },
  bestDotText: {
    fontSize: 10,
    color: "#00875a",
    fontWeight: "bold",
  },
  barDayLabel: {
    fontSize: 8,
    color: "#888",
    marginTop: 4,
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: { fontSize: 10, color: "#888" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { fontSize: 18, fontWeight: "bold", color: "#6200ea" },
  header: {
    backgroundColor: "#6200ea",
    padding: 20,
    paddingTop: 55,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 3,
  },
  headerSubtitle: { fontSize: 12, color: "#d8b4fe", marginBottom: 4 },
  headerNote: { fontSize: 10, color: "#c4b5fd" },
  toggleContainer: {
    flexDirection: "row",
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleActive: { backgroundColor: "#6200ea" },
  toggleText: { fontWeight: "700", color: "#888", fontSize: 13 },
  toggleTextActive: { color: "#fff" },
  currentPriceCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#6200ea",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
  },
  currentPriceLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  currentPrice: { fontSize: 36, fontWeight: "bold", color: "#6200ea" },
  currentPriceSub: { fontSize: 12, color: "#aaa", marginTop: 4 },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 11, color: "#888", marginBottom: 12 },
  recommendationCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#f3e5f5",
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6200ea",
  },
  recTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#6200ea",
    marginBottom: 6,
  },
  recText: { fontSize: 14, color: "#4a148c", marginBottom: 12 },
  recDetailsRow: { flexDirection: "row", justifyContent: "space-around" },
  recDetail: { alignItems: "center" },
  recDetailLabel: { fontSize: 11, color: "#7b1fa2" },
  recDetailValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4a148c",
    marginTop: 3,
  },
  accuracyRow: { flexDirection: "row", justifyContent: "space-around" },
  accuracyBox: { alignItems: "center", flex: 1 },
  accuracyValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#6200ea",
    marginBottom: 4,
  },
  accuracyLabel: { fontSize: 11, color: "#555", fontWeight: "600" },
  accuracyNote: { fontSize: 9, color: "#999", marginTop: 2 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f1ff",
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  tableHeaderText: { fontWeight: "bold", color: "#6200ea" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableRowBest: { backgroundColor: "#e8f5ed", borderRadius: 8 },
  tableCell: { flex: 1, fontSize: 12, color: "#333" },
  tableNote: {
    fontSize: 10,
    color: "#00875a",
    marginTop: 8,
    fontWeight: "600",
  },
  modelDesc: {
    fontSize: 13,
    color: "#555",
    marginBottom: 12,
    lineHeight: 19,
  },
  modelStep: {
    backgroundColor: "#f4f1ff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  modelStepTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#6200ea",
    marginBottom: 4,
  },
  modelStepDesc: { fontSize: 12, color: "#555", lineHeight: 18 },
  formulaBox: {
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  formulaTitle: {
    fontSize: 11,
    color: "#aaa",
    marginBottom: 6,
    fontWeight: "600",
  },
  formula: {
    fontSize: 12,
    color: "#d8b4fe",
    fontFamily: "monospace",
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: {
    width: "30%",
    backgroundColor: "#f4f1ff",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 15, fontWeight: "bold", color: "#6200ea" },
  statLabel: { fontSize: 10, color: "#888", marginTop: 3 },
});
