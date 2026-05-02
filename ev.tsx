import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getNearbyEVStations } from "../../utils/services";
import { getUserProfile } from "../../utils/storage";

interface EVStation {
  id: any;
  name: string;
  operator: string;
  latitude: number;
  longitude: number;
  distance: number;
  chargingSpeed: string;
  chargingPower: string;
  pricePerUnit: number;
  connectors: string[];
  estimatedTime: string;
  isAvailable: boolean;
  totalPorts: number;
  availablePorts: number;
  rating: number;
}

// ─── Break-even calculation helpers ───────────────────────────────────────────
// Calculates km needed to recover EV premium over petrol car
// Based on: EV price premium / (petrol cost/km − EV cost/km)
function calcBreakEven(
  petrolPricePerL: number,
  petrolMileageKmL: number,
  evPricePerKwh: number,
  evEfficiencyKmKwh: number,
  evPremiumRs: number,
): {
  kmToBreakEven: number;
  petrolCostPerKm: number;
  evCostPerKm: number;
  annualSavings: number;
} {
  const petrolCostPerKm = petrolPricePerL / petrolMileageKmL;
  const evCostPerKm = evPricePerKwh / evEfficiencyKmKwh;
  const savingsPerKm = petrolCostPerKm - evCostPerKm;
  const kmToBreakEven =
    savingsPerKm > 0 ? evPremiumRs / savingsPerKm : Infinity;
  const annualSavings = savingsPerKm * 15000; // assuming 15,000 km/year avg Indian driver
  return {
    kmToBreakEven: Math.round(kmToBreakEven),
    petrolCostPerKm: parseFloat(petrolCostPerKm.toFixed(2)),
    evCostPerKm: parseFloat(evCostPerKm.toFixed(2)),
    annualSavings: parseFloat(annualSavings.toFixed(0)),
  };
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = "stations" | "compare" | "breakeven";

export default function EVPage() {
  const [activeTab, setActiveTab] = useState<Tab>("stations");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evStations, setEvStations] = useState<EVStation[]>([]);
  const [filterSpeed, setFilterSpeed] = useState<"All" | "Fast" | "Slow">(
    "All",
  );
  const [dataError, setDataError] = useState(false);
  const [evIsLocalData, setEvIsLocalData] = useState(false);

  // Battery / vehicle inputs (sync from profile on load)
  const [batteryKwh, setBatteryKwh] = useState(30);
  const [evEfficiency, setEvEfficiency] = useState(6.5); // km per kWh — typical Indian EV

  // Compare tab inputs
  const [petrolPrice, setPetrolPrice] = useState("104");
  const [petrolMileage, setPetrolMileage] = useState("15");
  const [evRate, setEvRate] = useState("8"); // ₹/kWh
  const [monthlyKm, setMonthlyKm] = useState("1500"); // km/month

  // Break-even tab inputs
  const [evPremium, setEvPremium] = useState("200000"); // extra cost over petrol car (₹)
  const [beEvRate, setBeEvRate] = useState("8");
  const [beEvEfficiency, setBeEvEfficiency] = useState("6.5");
  const [bePetrolPrice, setBePetrolPrice] = useState("104");
  const [bePetrolMileage, setBePetrolMileage] = useState("15");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setDataError(false);
    try {
      // Load profile defaults
      const profile = await getUserProfile();
      if (profile.evBatteryKwh) setBatteryKwh(profile.evBatteryKwh);
      if (profile.mileageKmPerL) {
        setPetrolMileage(String(profile.mileageKmPerL));
        setBePetrolMileage(String(profile.mileageKmPerL));
      }

      let lat = 21.1458;
      let lon = 79.0882;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = current.coords.latitude;
          lon = current.coords.longitude;
        }
      } catch {
        console.log("Using default location for EV stations");
      }

      const stations = await getNearbyEVStations(lat, lon);
      setEvStations(stations || []);
      // Detect if data came from local fallback (local db uses ids 9000-9004)
      const isLocal =
        stations?.length > 0 &&
        stations.every((s: EVStation) => s.id >= 9000 && s.id < 9010);
      setEvIsLocalData(isLocal);

      // Auto-fill ev rate from nearest fast-charge station if available
      if (stations && stations.length > 0) {
        const fastStation = stations.find(
          (s: EVStation) =>
            s.chargingSpeed === "Fast" || s.chargingSpeed === "Ultra-Fast",
        );
        if (fastStation && fastStation.pricePerUnit > 0) {
          setEvRate(String(fastStation.pricePerUnit.toFixed(1)));
          setBeEvRate(String(fastStation.pricePerUnit.toFixed(1)));
        }
      }
    } catch (error) {
      console.error("EV load error:", error);
      setDataError(true);
      setEvStations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const navigateToStation = (station: EVStation) => {
    const { latitude: lat, longitude: lon, name } = station;
    if (Platform.OS === "android") {
      Linking.openURL(`google.navigation:q=${lat},${lon}&mode=d`).catch(() =>
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`,
        ),
      );
    } else {
      Linking.openURL(`maps://?daddr=${lat},${lon}&dirflg=d`).catch(() =>
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`,
        ),
      );
    }
  };

  const filteredStations = evStations.filter((s) => {
    if (filterSpeed === "All") return true;
    if (filterSpeed === "Fast")
      return s.chargingSpeed === "Fast" || s.chargingSpeed === "Ultra-Fast";
    return s.chargingSpeed === "Slow" || s.chargingSpeed === "Standard";
  });

  // ── Compare tab calculations ───────────────────────────────────────────────
  const pPrice = parseFloat(petrolPrice) || 104;
  const pMileage = parseFloat(petrolMileage) || 15;
  const eRate = parseFloat(evRate) || 8;
  const mKm = parseFloat(monthlyKm) || 1500;

  const petrolCostPerKm = pPrice / pMileage;
  const evCostPerKm = eRate / evEfficiency;
  const petrolMonthlyCost = petrolCostPerKm * mKm;
  const evMonthlyCost = evCostPerKm * mKm;
  const monthlySaving = petrolMonthlyCost - evMonthlyCost;
  const annualSaving = monthlySaving * 12;
  const evCheaper = evCostPerKm < petrolCostPerKm;

  // ── Break-even tab calculations ────────────────────────────────────────────
  const be = calcBreakEven(
    parseFloat(bePetrolPrice) || 104,
    parseFloat(bePetrolMileage) || 15,
    parseFloat(beEvRate) || 8,
    parseFloat(beEvEfficiency) || 6.5,
    parseFloat(evPremium) || 200000,
  );
  const yearsToBreakEven = be.kmToBreakEven / 15000;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00875a" />
        <Text style={styles.loadingText}>Loading EV Data...</Text>
        <Text style={styles.loadingSubText}>
          Scanning stations & building comparisons
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ EV Hub</Text>
        <Text style={styles.headerSubtitle}>
          Charging stations · Cost comparison · Break-even analysis
        </Text>
        {/* Tab bar */}
        <View style={styles.tabRow}>
          {(["stations", "compare", "breakeven"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === t && styles.tabTextActive,
                ]}
              >
                {t === "stations"
                  ? "⚡ Stations"
                  : t === "compare"
                    ? "📊 Compare"
                    : "📈 Break-even"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {dataError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            ⚠️ Could not load live data. Showing nearby known stations.
          </Text>
          <TouchableOpacity onPress={loadAll} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {evIsLocalData && !dataError && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            backgroundColor: "#fff3e0",
            borderRadius: 12,
            padding: 12,
            borderLeftWidth: 4,
            borderLeftColor: "#ff9800",
          }}
        >
          <Text style={{ fontSize: 12, color: "#e65100", fontWeight: "600" }}>
            🟡 EV charging data on Indian OSM is sparse — showing estimated
            nearby stations. Locations and availability are indicative only.
          </Text>
        </View>
      )}

      {/* ── STATIONS TAB ── */}
      {activeTab === "stations" && (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Speed filter */}
          <View style={styles.filterRow}>
            {(["All", "Fast", "Slow"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterBtn,
                  filterSpeed === f && styles.filterBtnActive,
                ]}
                onPress={() => setFilterSpeed(f)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filterSpeed === f && styles.filterTextActive,
                  ]}
                >
                  {f === "Fast" ? "⚡ Fast" : f === "Slow" ? "🔋 Slow" : "All"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Battery selector */}
          <View style={styles.batteryCard}>
            <Text style={styles.batteryTitle}>🔋 Your Battery Size</Text>
            <Text style={styles.batterySubtitle}>
              Used to estimate full-charge cost
            </Text>
            <View style={styles.batteryRow}>
              {[20, 30, 40, 60, 75].map((kwh) => (
                <TouchableOpacity
                  key={kwh}
                  style={[
                    styles.batteryChip,
                    batteryKwh === kwh && styles.batteryChipActive,
                  ]}
                  onPress={() => setBatteryKwh(kwh)}
                >
                  <Text
                    style={[
                      styles.batteryChipText,
                      batteryKwh === kwh && styles.batteryChipTextActive,
                    ]}
                  >
                    {kwh} kWh
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.batteryCustomRow}>
              <Text style={styles.batteryCustomLabel}>Custom (kWh):</Text>
              <TextInput
                style={styles.batteryInput}
                value={String(batteryKwh)}
                keyboardType="numeric"
                onChangeText={(v) => {
                  const n = parseInt(v);
                  if (!isNaN(n) && n > 0 && n <= 200) setBatteryKwh(n);
                }}
              />
            </View>
          </View>

          {filteredStations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>⚡</Text>
              <Text style={styles.emptyText}>No EV stations found nearby</Text>
              <Text style={styles.emptySubText}>
                Try changing filters or pull down to refresh
              </Text>
              <TouchableOpacity style={styles.retryLargeBtn} onPress={loadAll}>
                <Text style={styles.retryLargeBtnText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredStations.map((station) => (
              <View key={station.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stationName}>
                      {station.name || "EV Charging Station"}
                    </Text>
                    <Text style={styles.stationOperator}>
                      {station.operator || "Independent"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.availBadge,
                      {
                        backgroundColor: station.isAvailable
                          ? "#e8f5ed"
                          : "#fdecea",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.availText,
                        { color: station.isAvailable ? "#00875a" : "#cc0000" },
                      ]}
                    >
                      {station.isAvailable ? "✅ Available" : "❌ Occupied"}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>📍 DIST</Text>
                    <Text style={styles.statValue}>
                      {station.distance?.toFixed(1)} km
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>⚡ SPEED</Text>
                    <Text style={styles.statValue}>
                      {station.chargingSpeed}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>🔌 POWER</Text>
                    <Text style={styles.statValue}>
                      {station.chargingPower}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>⭐ RATING</Text>
                    <Text style={styles.statValue}>
                      {station.rating?.toFixed(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Available Ports</Text>
                    <Text style={styles.infoValue}>
                      {station.availablePorts}/{station.totalPorts}
                    </Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Price/Unit</Text>
                    <Text style={styles.infoValue}>
                      ₹{station.pricePerUnit?.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Est. Time</Text>
                    <Text style={styles.infoValue}>
                      {station.estimatedTime}
                    </Text>
                  </View>
                </View>

                {station.connectors && station.connectors.length > 0 && (
                  <View style={styles.connectorRow}>
                    {station.connectors.map((c, i) => (
                      <View key={i} style={styles.connectorTag}>
                        <Text style={styles.connectorText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.costBox}>
                  <Text style={styles.costTitle}>
                    ⚡ Full Charge Cost Estimate
                  </Text>
                  <View style={styles.costRow}>
                    <View style={styles.costItem}>
                      <Text style={styles.costLabel}>Total Cost</Text>
                      <Text style={styles.costValue}>
                        ₹{(station.pricePerUnit * batteryKwh).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.costDivider} />
                    <View style={styles.costItem}>
                      <Text style={styles.costLabel}>Battery</Text>
                      <Text style={styles.costValue}>{batteryKwh} kWh</Text>
                    </View>
                    <View style={styles.costDivider} />
                    <View style={styles.costItem}>
                      <Text style={styles.costLabel}>Rate</Text>
                      <Text style={styles.costValue}>
                        ₹{station.pricePerUnit}/unit
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => navigateToStation(station)}
                >
                  <Text style={styles.navText}>🧭 Navigate to Station</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* ── COMPARE TAB ── */}
      {activeTab === "compare" && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>⛽ Petrol Car</Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Fuel price (₹/L)</Text>
                <TextInput
                  style={styles.input}
                  value={petrolPrice}
                  keyboardType="decimal-pad"
                  onChangeText={setPetrolPrice}
                  placeholder="104"
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Mileage (km/L)</Text>
                <TextInput
                  style={styles.input}
                  value={petrolMileage}
                  keyboardType="decimal-pad"
                  onChangeText={setPetrolMileage}
                  placeholder="15"
                />
              </View>
            </View>
          </View>

          <View style={[styles.sectionCard, { borderLeftColor: "#00875a" }]}>
            <Text style={[styles.sectionTitle, { color: "#00875a" }]}>
              ⚡ Electric Vehicle
            </Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Charging rate (₹/kWh)</Text>
                <TextInput
                  style={[styles.input, { borderColor: "#00875a" }]}
                  value={evRate}
                  keyboardType="decimal-pad"
                  onChangeText={setEvRate}
                  placeholder="8"
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Efficiency (km/kWh)</Text>
                <TextInput
                  style={[styles.input, { borderColor: "#00875a" }]}
                  value={String(evEfficiency)}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => {
                    const n = parseFloat(v);
                    if (!isNaN(n) && n > 0) setEvEfficiency(n);
                  }}
                  placeholder="6.5"
                />
              </View>
            </View>
          </View>

          <View style={[styles.sectionCard, { borderLeftColor: "#6200ea" }]}>
            <Text style={[styles.sectionTitle, { color: "#6200ea" }]}>
              📍 Usage
            </Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Monthly distance (km)</Text>
                <TextInput
                  style={[styles.input, { borderColor: "#6200ea" }]}
                  value={monthlyKm}
                  keyboardType="numeric"
                  onChangeText={setMonthlyKm}
                  placeholder="1500"
                />
              </View>
            </View>
          </View>

          {/* Results */}
          <View style={styles.compareResultCard}>
            <Text style={styles.compareResultTitle}>📊 Cost Comparison</Text>

            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Text style={styles.compareColLabel}>⛽ Petrol</Text>
                <Text style={styles.compareColPrice}>
                  ₹{petrolCostPerKm.toFixed(2)}/km
                </Text>
                <Text style={styles.compareColSub}>
                  ₹{petrolMonthlyCost.toFixed(0)}/month
                </Text>
              </View>
              <View style={styles.compareVs}>
                <Text style={styles.compareVsText}>VS</Text>
              </View>
              <View
                style={[
                  styles.compareCol,
                  evCheaper && styles.compareColWinner,
                ]}
              >
                <Text
                  style={[
                    styles.compareColLabel,
                    evCheaper && { color: "#00875a" },
                  ]}
                >
                  ⚡ EV
                </Text>
                <Text
                  style={[
                    styles.compareColPrice,
                    evCheaper && { color: "#00875a" },
                  ]}
                >
                  ₹{evCostPerKm.toFixed(2)}/km
                </Text>
                <Text style={styles.compareColSub}>
                  ₹{evMonthlyCost.toFixed(0)}/month
                </Text>
              </View>
            </View>

            <View style={styles.savingsBanner}>
              {evCheaper ? (
                <>
                  <Text style={styles.savingsTitle}>✅ EV saves you</Text>
                  <Text style={styles.savingsAmount}>
                    ₹{Math.abs(monthlySaving).toFixed(0)}/month
                  </Text>
                  <Text style={styles.savingsSub}>
                    ₹{Math.abs(annualSaving).toFixed(0)} per year at {monthlyKm}{" "}
                    km/month
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.savingsTitle, { color: "#e65100" }]}>
                    ⚠️ Petrol is cheaper in your area
                  </Text>
                  <Text style={[styles.savingsAmount, { color: "#e65100" }]}>
                    ₹{Math.abs(monthlySaving).toFixed(0)}/month difference
                  </Text>
                  <Text style={styles.savingsSub}>
                    Try lowering EV charging rate or increasing efficiency
                  </Text>
                </>
              )}
            </View>

            {/* Visual cost bar */}
            <View style={styles.barContainer}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>
                  ⛽ Petrol: ₹{petrolMonthlyCost.toFixed(0)}
                </Text>
                <Text style={[styles.barLabel, { color: "#00875a" }]}>
                  ⚡ EV: ₹{evMonthlyCost.toFixed(0)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barSegment,
                    { flex: petrolMonthlyCost, backgroundColor: "#0066cc" },
                  ]}
                />
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barSegment,
                    { flex: evMonthlyCost, backgroundColor: "#00875a" },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* ── BREAK-EVEN TAB ── */}
      {activeTab === "breakeven" && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoCallout}>
            <Text style={styles.infoCalloutText}>
              💡 EV cars cost more upfront. This calculator tells you how many
              km you need to drive before the fuel savings pay back that extra
              cost.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🚗 EV Price Premium</Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>
                  Extra cost over petrol car (₹)
                </Text>
                <TextInput
                  style={styles.input}
                  value={evPremium}
                  keyboardType="numeric"
                  onChangeText={setEvPremium}
                  placeholder="200000"
                />
              </View>
            </View>
            <Text style={styles.inputHint}>
              e.g. Tata Nexon EV ≈ ₹14.5L vs petrol variant ≈ ₹9.5L → premium
              ₹5L = 500000
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>⛽ Your Petrol Car</Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Petrol price (₹/L)</Text>
                <TextInput
                  style={styles.input}
                  value={bePetrolPrice}
                  keyboardType="decimal-pad"
                  onChangeText={setBePetrolPrice}
                  placeholder="104"
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Mileage (km/L)</Text>
                <TextInput
                  style={styles.input}
                  value={bePetrolMileage}
                  keyboardType="decimal-pad"
                  onChangeText={setBePetrolMileage}
                  placeholder="15"
                />
              </View>
            </View>
          </View>

          <View style={[styles.sectionCard, { borderLeftColor: "#00875a" }]}>
            <Text style={[styles.sectionTitle, { color: "#00875a" }]}>
              ⚡ EV Running Costs
            </Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Charging rate (₹/kWh)</Text>
                <TextInput
                  style={[styles.input, { borderColor: "#00875a" }]}
                  value={beEvRate}
                  keyboardType="decimal-pad"
                  onChangeText={setBeEvRate}
                  placeholder="8"
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>EV efficiency (km/kWh)</Text>
                <TextInput
                  style={[styles.input, { borderColor: "#00875a" }]}
                  value={beEvEfficiency}
                  keyboardType="decimal-pad"
                  onChangeText={setBeEvEfficiency}
                  placeholder="6.5"
                />
              </View>
            </View>
          </View>

          {/* Break-even result */}
          <View style={styles.breakEvenResult}>
            <Text style={styles.breakEvenTitle}>📈 Break-Even Point</Text>

            <View style={styles.breakEvenMetrics}>
              <View style={styles.breakEvenMetric}>
                <Text style={styles.breakEvenValue}>
                  {be.kmToBreakEven === Infinity
                    ? "∞"
                    : `${(be.kmToBreakEven / 1000).toFixed(0)}k`}
                </Text>
                <Text style={styles.breakEvenLabel}>km to break even</Text>
              </View>
              <View style={styles.breakEvenDivider} />
              <View style={styles.breakEvenMetric}>
                <Text style={styles.breakEvenValue}>
                  {yearsToBreakEven === Infinity
                    ? "∞"
                    : yearsToBreakEven.toFixed(1)}
                </Text>
                <Text style={styles.breakEvenLabel}>years (15k km/yr)</Text>
              </View>
              <View style={styles.breakEvenDivider} />
              <View style={styles.breakEvenMetric}>
                <Text style={[styles.breakEvenValue, { color: "#00875a" }]}>
                  ₹{(be.annualSavings / 1000).toFixed(1)}k
                </Text>
                <Text style={styles.breakEvenLabel}>savings/year</Text>
              </View>
            </View>

            <View style={styles.breakEvenCostRow}>
              <View style={styles.breakEvenCostBox}>
                <Text style={styles.breakEvenCostLabel}>⛽ Petrol cost/km</Text>
                <Text style={styles.breakEvenCostVal}>
                  ₹{be.petrolCostPerKm}
                </Text>
              </View>
              <View style={styles.breakEvenCostBox}>
                <Text style={[styles.breakEvenCostLabel, { color: "#00875a" }]}>
                  ⚡ EV cost/km
                </Text>
                <Text style={[styles.breakEvenCostVal, { color: "#00875a" }]}>
                  ₹{be.evCostPerKm}
                </Text>
              </View>
              <View style={styles.breakEvenCostBox}>
                <Text style={styles.breakEvenCostLabel}>💰 Saving/km</Text>
                <Text
                  style={[
                    styles.breakEvenCostVal,
                    {
                      color:
                        be.petrolCostPerKm - be.evCostPerKm > 0
                          ? "#00875a"
                          : "#cc3300",
                    },
                  ]}
                >
                  ₹{(be.petrolCostPerKm - be.evCostPerKm).toFixed(2)}
                </Text>
              </View>
            </View>

            {be.kmToBreakEven !== Infinity && (
              <View style={styles.breakEvenInsight}>
                <Text style={styles.breakEvenInsightText}>
                  {yearsToBreakEven <= 5
                    ? `✅ At 15,000 km/year, you'll recover the EV premium in ${yearsToBreakEven.toFixed(1)} years. Good investment.`
                    : yearsToBreakEven <= 10
                      ? `⚠️ Break-even at ${yearsToBreakEven.toFixed(1)} years. Consider negotiating a better EV deal or wait for prices to drop.`
                      : `❌ Break-even takes ${yearsToBreakEven.toFixed(1)} years. EV may not be financially worthwhile at current prices.`}
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f0f4f8" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginTop: 16,
  },
  loadingSubText: { fontSize: 13, color: "#666", marginTop: 6 },
  header: {
    backgroundColor: "#00875a",
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
  headerSubtitle: { fontSize: 12, color: "#b2dfdb", marginBottom: 14 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: "#fff" },
  tabText: { color: "#b2dfdb", fontWeight: "600", fontSize: 11 },
  tabTextActive: { color: "#00875a" },
  errorBanner: {
    margin: 15,
    backgroundColor: "#fff3e0",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ff9800",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorBannerText: {
    fontSize: 12,
    color: "#e65100",
    fontWeight: "600",
    flex: 1,
  },
  retryBtn: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 10,
  },
  retryBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  listContent: { padding: 15 },
  filterRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    gap: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  filterBtnActive: { backgroundColor: "#00875a" },
  filterText: { color: "#666", fontWeight: "600", fontSize: 13 },
  filterTextActive: { color: "#fff" },
  emptyContainer: { alignItems: "center", marginTop: 80 },
  emptyEmoji: { fontSize: 50, marginBottom: 15 },
  emptyText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 8,
  },
  emptySubText: { fontSize: 13, color: "#999", marginBottom: 20 },
  retryLargeBtn: {
    backgroundColor: "#00875a",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryLargeBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  stationName: { fontSize: 17, fontWeight: "bold", color: "#1a1a2e" },
  stationOperator: { color: "#00875a", fontSize: 13, marginTop: 2 },
  availBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  availText: { fontSize: 12, fontWeight: "700" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f0faf5",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  statItem: { alignItems: "center", flex: 1 },
  statLabel: {
    fontSize: 9,
    color: "#888",
    fontWeight: "bold",
    marginBottom: 3,
  },
  statValue: { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  infoBox: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  infoLabel: { fontSize: 10, color: "#888", marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: "bold", color: "#00875a" },
  connectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  connectorTag: {
    backgroundColor: "#e8f5ed",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  connectorText: { fontSize: 11, color: "#00875a", fontWeight: "600" },
  costBox: {
    backgroundColor: "#f0faf5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#00875a",
  },
  costTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#00875a",
    marginBottom: 8,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  costItem: { alignItems: "center" },
  costLabel: { fontSize: 10, color: "#666" },
  costValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#00875a",
    marginTop: 2,
  },
  costDivider: { width: 1, height: 28, backgroundColor: "#b2dfdb" },
  navBtn: {
    backgroundColor: "#00875a",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  navText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  batteryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
  },
  batteryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 3,
  },
  batterySubtitle: { fontSize: 11, color: "#888", marginBottom: 10 },
  batteryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },
  batteryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ccc",
    backgroundColor: "#f9f9f9",
  },
  batteryChipActive: { backgroundColor: "#00875a", borderColor: "#00875a" },
  batteryChipText: { fontSize: 12, color: "#666", fontWeight: "600" },
  batteryChipTextActive: { color: "#fff" },
  batteryCustomRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  batteryCustomLabel: { fontSize: 12, color: "#555", fontWeight: "600" },
  batteryInput: {
    width: 70,
    backgroundColor: "#f0faf5",
    borderRadius: 8,
    padding: 7,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    color: "#00875a",
    borderWidth: 1.5,
    borderColor: "#00875a",
  },
  // Compare tab
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#0066cc",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0066cc",
    marginBottom: 12,
  },
  inputGroup: { gap: 10 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputLabel: { fontSize: 13, color: "#444", flex: 1 },
  input: {
    width: 90,
    backgroundColor: "#f0f4ff",
    borderRadius: 8,
    padding: 8,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    color: "#0066cc",
    borderWidth: 1.5,
    borderColor: "#0066cc",
  },
  inputHint: { fontSize: 11, color: "#999", marginTop: 8, fontStyle: "italic" },
  compareResultCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  compareResultTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 16,
  },
  compareRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  compareCol: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f0f4ff",
    borderRadius: 12,
    padding: 14,
  },
  compareColWinner: { backgroundColor: "#e8f5ed" },
  compareColLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  compareColPrice: { fontSize: 20, fontWeight: "bold", color: "#0066cc" },
  compareColSub: { fontSize: 11, color: "#888", marginTop: 3 },
  compareVs: { marginHorizontal: 10, alignItems: "center" },
  compareVsText: { fontSize: 14, fontWeight: "bold", color: "#aaa" },
  savingsBanner: {
    backgroundColor: "#f0faf5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  savingsTitle: {
    fontSize: 13,
    color: "#00875a",
    fontWeight: "600",
    marginBottom: 4,
  },
  savingsAmount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00875a",
    marginBottom: 2,
  },
  savingsSub: { fontSize: 11, color: "#666", textAlign: "center" },
  barContainer: { gap: 6 },
  barLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 11, color: "#666" },
  barTrack: {
    height: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "row",
  },
  barSegment: { height: 12 },
  // Break-even tab
  infoCallout: {
    backgroundColor: "#e8f5ed",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#00875a",
  },
  infoCalloutText: { fontSize: 13, color: "#1a5c3a", lineHeight: 19 },
  breakEvenResult: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  breakEvenTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 16,
  },
  breakEvenMetrics: {
    flexDirection: "row",
    backgroundColor: "#f8f9fb",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
  },
  breakEvenMetric: { flex: 1, alignItems: "center" },
  breakEvenValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0066cc",
    marginBottom: 4,
  },
  breakEvenLabel: { fontSize: 10, color: "#888", textAlign: "center" },
  breakEvenDivider: { width: 1, height: 40, backgroundColor: "#e0e0e0" },
  breakEvenCostRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  breakEvenCostBox: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  breakEvenCostLabel: {
    fontSize: 10,
    color: "#888",
    marginBottom: 4,
    textAlign: "center",
  },
  breakEvenCostVal: { fontSize: 16, fontWeight: "bold", color: "#0066cc" },
  breakEvenInsight: {
    backgroundColor: "#f0faf5",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#00875a",
  },
  breakEvenInsightText: { fontSize: 13, color: "#1a5c3a", lineHeight: 20 },
});
