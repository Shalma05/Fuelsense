import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getHistoricalDataLive,
  getRefuelRecommendation,
  predictFuelPrice,
} from "../../utils/mlService";
import { calculateSmartScoreWithBreakdown } from "../../utils/scoring";
import { getCityFuelPrices, getNearbyPetrolPumps } from "../../utils/services";
import {
  checkFuelAlerts,
  getFuelStats,
  getUserProfile,
} from "../../utils/storage";

const PRICES_AS_OF = "Mar 2026";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

function LoadingScreen() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
      <Animated.Text
        style={[styles.loadingEmoji, { transform: [{ scale: pulseAnim }] }]}
      >
        ⛽
      </Animated.Text>
      <Text style={styles.loadingTitle}>FuelSense</Text>
      <Text style={styles.loadingSubtitle}>Analyzing nearby stations...</Text>
      <View style={styles.loadingDotsRow}>
        {[0, 1, 2].map((i) => (
          <LoadingDot key={i} delay={i * 200} />
        ))}
      </View>
    </Animated.View>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        styles.loadingDot,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${value}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.barValue, { color }]}>{value}</Text>
    </View>
  );
}

// ── Data Source Badge ──────────────────────────────────────────────────────
// Shows per-pump whether location came from OSM (real) or seeded (estimated),
// and whether fuel price came from live scrape, PPAC dataset, or static.
// Useful for paper: lets you screenshot exactly which stations have real data.
function DataSourceBadge({ dataSource }: { dataSource: any }) {
  if (!dataSource) return null;
  const isRealLocation = Object.values(dataSource).some((v) => v === "osm");
  const priceLabel =
    dataSource.fuelPrice === "live_scrape"
      ? { text: "🟢 Live Price", color: "#00875a", bg: "#e8f5ed" }
      : dataSource.fuelPrice === "ppac_dataset"
        ? { text: "📊 PPAC Price", color: "#0066cc", bg: "#e8f0fe" }
        : { text: "🟡 Cached Price", color: "#f57f17", bg: "#fffde7" };
  const locationLabel = isRealLocation
    ? { text: "📍 OSM Real", color: "#00875a", bg: "#e8f5ed" }
    : { text: "📍 Estimated", color: "#888", bg: "#f5f5f5" };
  return (
    <View
      style={{ flexDirection: "row", gap: 5, marginTop: 5, flexWrap: "wrap" }}
    >
      <View
        style={{
          backgroundColor: locationLabel.bg,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 6,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            color: locationLabel.color,
            fontWeight: "700",
          }}
        >
          {locationLabel.text}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: priceLabel.bg,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 6,
        }}
      >
        <Text
          style={{ fontSize: 10, color: priceLabel.color, fontWeight: "700" }}
        >
          {priceLabel.text}
        </Text>
      </View>
    </View>
  );
}

// ── Instant fallback pumps — shown immediately while Overpass loads ──────────
// Uses the same seeded logic as services.ts so scores are consistent.
const seededRandom = (seed: number, min: number, max: number) => {
  const x = Math.sin(seed + 1) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
};
const buildFallbackPumps = (lat: number, lon: number, cityPrices: any) => {
  const brands = [
    { name: "Indian Oil", brand: "Indian Oil", hasAir: true },
    { name: "HP Petrol Bunk", brand: "HP", hasAir: true },
    { name: "Bharat Petroleum", brand: "BPCL", hasAir: true },
    { name: "Shell", brand: "Shell", hasAir: false },
    { name: "Reliance Fuel", brand: "Reliance", hasAir: false },
    { name: "Essar Fuel Station", brand: "Essar", hasAir: true },
    { name: "Indian Oil Express", brand: "Indian Oil", hasAir: false },
  ];
  return brands.map((pump, index) => {
    const id = index + 5000;
    const petrolPrice = parseFloat(cityPrices.petrol.toFixed(2));
    const dieselPrice = parseFloat(cityPrices.diesel.toFixed(2));
    const cngPrice = parseFloat((cityPrices.cng ?? 74.0).toFixed(2));
    const dist = parseFloat(((index + 1) * 0.6).toFixed(1));
    const mileage = 15;
    return {
      id,
      name: `${pump.name} — ${cityPrices.cityName}`,
      brand: pump.brand,
      latitude: lat,
      longitude: lon,
      petrolPrice,
      dieselPrice,
      cngPrice,
      currentPrice: petrolPrice,
      distance: dist,
      rating: parseFloat(seededRandom(id, 3.2, 5.0).toFixed(1)),
      reviews: Math.floor(seededRandom(id * 6, 20, 150)),
      isOpen: true,
      waitTime: `${Math.floor(seededRandom(id * 3, 2, 12))} mins`,
      waitTimeMinutes: Math.floor(seededRandom(id * 3, 2, 12)),
      hasAmenities: true,
      hasAirFilling: pump.hasAir,
      hasRestroom: seededRandom(id * 2, 0, 1) > 0.4,
      hasATM: seededRandom(id * 5, 0, 1) > 0.5,
      hasCarWash: seededRandom(id * 7, 0, 1) > 0.65,
      amenities: [
        pump.hasAir && "🌬️ Air",
        "💧 Water",
        seededRandom(id * 2, 0, 1) > 0.4 && "🚻 Restroom",
        seededRandom(id * 5, 0, 1) > 0.5 && "🏧 ATM",
      ].filter(Boolean) as string[],
      tripCost: parseFloat(((dist / mileage) * petrolPrice).toFixed(2)),
      litersNeeded: parseFloat((dist / mileage).toFixed(2)),
      cityName: cityPrices.cityName,
      isRealLocation: false,
      dataSource: {
        rating: "seeded",
        hasRestroom: "seeded",
        hasATM: "seeded",
        hasCarWash: "seeded",
        hasAirFilling: "seeded",
        fuelPrice: cityPrices.source,
      },
    };
  });
};

// ── Share station helper ──────────────────────────────────────────────────────
const shareStation = async (
  pump: any,
  selectedFuel: string,
  cityName: string,
) => {
  const price =
    selectedFuel === "diesel"
      ? pump.dieselPrice
      : selectedFuel === "cng"
        ? pump.cngPrice
        : pump.petrolPrice;
  const amenities = [
    pump.hasAirFilling && "Air Filling",
    pump.hasATM && "ATM",
    pump.hasRestroom && "Restroom",
    pump.hasCarWash && "Car Wash",
  ]
    .filter(Boolean)
    .join(", ");
  const message = `⛽ ${pump.name}\n💰 ${selectedFuel.toUpperCase()} ₹${price?.toFixed(2)}/L\n📍 ${pump.distance?.toFixed(1)} km away · ${cityName}\n⭐ Rating: ${pump.rating?.toFixed(1)}\n✅ ${amenities || "Water"}\n\nFound via FuelSense App`;
  try {
    await Share.share({ message });
  } catch (e) {
    /* user cancelled */
  }
};

// ── Timestamp formatter ───────────────────────────────────────────────────────
const formatUpdatedAt = (date: Date | null): string => {
  if (!date) return "";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `Updated ${hrs} hr ago`;
};

export default function SmartDashboard() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [selectedFuel, setSelectedFuel] = useState<"petrol" | "diesel" | "cng">(
    "petrol",
  );
  const [nearbyPumps, setNearbyPumps] = useState<any[]>([]);
  const [thisMonthSpend, setThisMonthSpend] = useState(0);
  const [userMileage, setUserMileage] = useState(15);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refuelRec, setRefuelRec] = useState<any>(null);
  const [cityName, setCityName] = useState("Your City");
  const [dataError, setDataError] = useState(false);
  const [priceSource, setPriceSource] = useState<
    "live_scrape" | "ppac_dataset" | "static"
  >("ppac_dataset");
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertInput, setAlertInput] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [scoreModalPump, setScoreModalPump] = useState<any>(null);

  // ── Auto-detect same-city mode ──
  // In India, fuel prices are regulated at city level — all stations
  // in the same city charge the same base price. When price variation
  // across nearby stations is ≤ ₹1, price is not a differentiating
  // factor and ranking should focus on distance, quality, and amenities.
  const sameCity = useMemo(() => {
    if (!nearbyPumps || nearbyPumps.length < 2) return false;
    const prices = nearbyPumps
      .filter((p) => p.currentPrice || p.petrolPrice)
      .map((p) => p.currentPrice || p.petrolPrice || 104);
    return Math.max(...prices) - Math.min(...prices) <= 1.0;
  }, [nearbyPumps]);

  const rankedPumps = useMemo(() => {
    if (!nearbyPumps || nearbyPumps.length === 0) return [];
    let validPumps = nearbyPumps.filter((p) => p.currentPrice || p.petrolPrice);
    // Apply amenity filters
    if (activeFilters.includes("air"))
      validPumps = validPumps.filter((p) => p.hasAirFilling);
    if (activeFilters.includes("atm"))
      validPumps = validPumps.filter((p) => p.hasATM);
    if (activeFilters.includes("restroom"))
      validPumps = validPumps.filter((p) => p.hasRestroom);
    if (activeFilters.includes("carwash"))
      validPumps = validPumps.filter((p) => p.hasCarWash);

    const prices = validPumps.map(
      (p) => p.currentPrice || p.petrolPrice || 104,
    );
    const distances = validPumps.map((p) => p.distance || 0);

    const scored = validPumps.map((pump) => {
      const breakdown = calculateSmartScoreWithBreakdown(
        { ...pump, currentPrice: pump.currentPrice || pump.petrolPrice || 104 },
        Math.min(...prices),
        Math.max(...prices),
        Math.max(...distances),
        Math.min(...distances),
        sameCity,
      );
      return { ...pump, utilityScore: breakdown.finalScore, breakdown };
    });

    return scored.sort((a, b) => b.utilityScore - a.utilityScore);
  }, [nearbyPumps, sameCity, activeFilters]);

  const loadData = async (fuel?: "petrol" | "diesel" | "cng") => {
    const activeFuel = fuel || selectedFuel;
    // For ML prediction, use petrol or diesel (CNG maps to petrol history)
    const mlFuel: "petrol" | "diesel" =
      activeFuel === "diesel" ? "diesel" : "petrol";
    setDataError(false);
    try {
      // Load user profile — get defaultCity, mileage, researchMode
      const profile = await getUserProfile();
      if (profile.researchMode !== researchMode)
        setResearchMode(profile.researchMode);

      // City coordinates lookup — used when GPS is denied
      const CITY_COORD_MAP: Record<string, { lat: number; lon: number }> = {
        mumbai: { lat: 19.076, lon: 72.877 },
        delhi: { lat: 28.704, lon: 77.102 },
        bangalore: { lat: 12.972, lon: 77.594 },
        bengaluru: { lat: 12.972, lon: 77.594 },
        hyderabad: { lat: 17.385, lon: 78.487 },
        chennai: { lat: 13.083, lon: 80.27 },
        kolkata: { lat: 22.572, lon: 88.363 },
        pune: { lat: 18.52, lon: 73.856 },
        ahmedabad: { lat: 23.023, lon: 72.572 },
        jaipur: { lat: 26.912, lon: 75.787 },
        lucknow: { lat: 26.847, lon: 80.947 },
        chandigarh: { lat: 30.733, lon: 76.779 },
        coimbatore: { lat: 11.017, lon: 76.955 },
        nagpur: { lat: 21.145, lon: 79.088 },
        patna: { lat: 25.594, lon: 85.137 },
        bhopal: { lat: 23.259, lon: 77.412 },
        kochi: { lat: 9.931, lon: 76.267 },
        guwahati: { lat: 26.144, lon: 91.736 },
        bhubaneswar: { lat: 20.296, lon: 85.824 },
        surat: { lat: 21.17, lon: 72.831 },
        visakhapatnam: { lat: 17.686, lon: 83.218 },
        madurai: { lat: 9.925, lon: 78.12 },
        indore: { lat: 22.719, lon: 75.857 },
      };

      // Resolve default city coordinates — Coimbatore as fallback if nothing set
      const defaultKey = (profile.defaultCity || "coimbatore")
        .toLowerCase()
        .trim();
      const defaultCoords = CITY_COORD_MAP[defaultKey] ??
        CITY_COORD_MAP[
          Object.keys(CITY_COORD_MAP).find(
            (k) =>
              defaultKey.includes(k) || k.includes(defaultKey.split(" ")[0]),
          ) ?? "coimbatore"
        ] ?? { lat: 11.017, lon: 76.955 }; // Coimbatore as absolute fallback

      let currentLat = defaultCoords.lat;
      let currentLon = defaultCoords.lon;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const current = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            10000,
          );
          currentLat = current.coords.latitude;
          currentLon = current.coords.longitude;
        }
        // If GPS denied: currentLat/currentLon already set to defaultCity coords above
      } catch {
        console.log("Location unavailable, using default city coords");
      }

      const cityPrices = await withTimeout(
        getCityFuelPrices(currentLat, currentLon),
        10000,
      );
      // Simple offline detection — if prices came from static fallback, likely offline
      setIsOffline(cityPrices.source === "static");
      setCityName(cityPrices.cityName);
      setPriceSource(
        cityPrices.source as "live_scrape" | "ppac_dataset" | "static",
      );
      setPriceUpdatedAt(new Date());

      // Check fuel price alerts
      const triggered = await checkFuelAlerts(
        cityPrices.cityName,
        cityPrices.petrol,
        cityPrices.diesel,
        cityPrices.cng ?? 74,
      );
      if (triggered.length > 0) {
        triggered.forEach((alert) => {
          Alert.alert(
            "🔔 Fuel Price Alert!",
            `${alert.fuelType.toUpperCase()} in ${alert.cityName} has dropped to ₹${
              alert.fuelType === "diesel"
                ? cityPrices.diesel
                : alert.fuelType === "cng"
                  ? cityPrices.cng
                  : cityPrices.petrol
            }/L — below your target of ₹${alert.targetPrice}/L!`,
            [{ text: "Great! 🎉" }],
          );
        });
      }

      // Show fallback pumps IMMEDIATELY so home page is never empty
      const fallbackPumps = buildFallbackPumps(
        currentLat,
        currentLon,
        cityPrices,
      );
      setNearbyPumps(fallbackPumps);

      const [pumps, fuelStats] = await Promise.all([
        withTimeout(getNearbyPetrolPumps(currentLat, currentLon), 30000).catch(
          () => [],
        ),
        getFuelStats().catch(() => null),
      ]);

      // Only replace fallback if we got real pumps back
      if (pumps && pumps.length > 0) {
        setNearbyPumps(pumps);
      }
      setThisMonthSpend(fuelStats?.thisMonthSpend || 0);
      const odometMileage = fuelStats?.avgMileage ?? 0;
      const profileMileage = profile.mileageKmPerL ?? 0;
      if (odometMileage > 0) setUserMileage(odometMileage);
      else if (profileMileage > 0) setUserMileage(profileMileage);

      // Use city-specific historical data so Mumbai gets Mumbai's price history,
      // Hyderabad gets Hyderabad's, etc. — not Chennai's hardcoded array.
      const { data: hist } = await getHistoricalDataLive(
        cityPrices.cityName,
        mlFuel,
      );
      const pred = predictFuelPrice(hist);
      if (pred) setRefuelRec(getRefuelRecommendation(pred.predictions));
    } catch (e) {
      console.log("Load Error", e);
      setDataError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  useEffect(() => {
    loadData(selectedFuel);
  }, [selectedFuel]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(selectedFuel);
  };

  if (loading) return <LoadingScreen />;

  const bestPump = rankedPumps[0];

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appName}>⛽ FuelSense</Text>
            <Text style={styles.appTagline}>
              Intelligent Geo-Spatial Analytics
            </Text>
            <Text style={styles.cityName}>📍 {cityName}</Text>
            <Text style={styles.pricesNote}>
              {`Prices as of ${PRICES_AS_OF} · Updated periodically`}
            </Text>
          </View>
          <View style={styles.savingsCard}>
            <Text style={styles.savingsAmount}>₹{thisMonthSpend}</Text>
            <Text style={styles.savingsLabel}>This Month</Text>
          </View>
        </View>

        {/* ── Price Source Banner ── */}
        <View
          style={
            priceSource === "live_scrape"
              ? styles.livePriceBanner
              : styles.staticPriceBanner
          }
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={[
                priceSource === "live_scrape"
                  ? styles.livePriceText
                  : styles.staticPriceText,
                { flex: 1 },
              ]}
            >
              {priceSource === "live_scrape"
                ? `✅ Live prices · GoodReturns.in · ${cityName}`
                : priceSource === "ppac_dataset"
                  ? `📊 PPAC official prices · ${cityName}`
                  : `🟡 Using cached prices · ${cityName}`}
              {selectedFuel === "cng" ? "  ·  🟡 CNG: PPAC dataset" : ""}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setAlertInput("");
                setAlertModalVisible(true);
              }}
              style={{
                backgroundColor: "rgba(255,255,255,0.25)",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: priceSource === "live_scrape" ? "#00875a" : "#f57f17",
                }}
              >
                🔔 Alert
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Same City Mode Banner ── */}
        {sameCity && (
          <View style={styles.sameCityBanner}>
            <Text style={styles.sameCityText}>
              🏙️ Same-city mode · All stations share similar prices · Ranked by
              Distance, Quality & Amenities
            </Text>
          </View>
        )}

        {/* ── Data Error Banner ── */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              📵 Offline — showing cached prices. Connect to get live data.
            </Text>
          </View>
        )}

        {researchMode && (
          <View style={styles.researchBanner}>
            <Text style={styles.researchBannerText}>
              🔬 Research Mode — only live OSM stations shown
            </Text>
          </View>
        )}

        {dataError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              ⚠️ Live data unavailable — showing cached results. Pull down to
              retry.
            </Text>
          </View>
        )}

        {/* ── AI Refuel Recommendation Banner ── */}
        {refuelRec && (
          <View style={styles.recBanner}>
            <View style={styles.recLeft}>
              <Text style={styles.recEmoji}>
                {refuelRec.recommendation.startsWith("Refuel today")
                  ? "🔥"
                  : "⏳"}
              </Text>
              <View>
                <Text style={styles.recText}>{refuelRec.recommendation}</Text>
                <Text style={styles.recSub}>
                  {`Save up to ₹${refuelRec.savingsPerTenLiters} per 10L · Best: ${refuelRec.bestDay.date} @ ₹${refuelRec.bestDay.price}`}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/mlPredict")}
              style={styles.recBtn}
            >
              <Text style={styles.recBtnText}>Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Fuel Toggle ── */}
        <View style={styles.toggleWrapper}>
          <View style={styles.toggleContainer}>
            {(["petrol", "diesel", "cng"] as const).map((fuel) => (
              <TouchableOpacity
                key={fuel}
                style={[
                  styles.toggleBtn,
                  selectedFuel === fuel && styles.activeToggle,
                  fuel === "cng" &&
                    selectedFuel === fuel && { backgroundColor: "#00875a" },
                ]}
                onPress={() => setSelectedFuel(fuel)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    selectedFuel === fuel && styles.toggleTextActive,
                  ]}
                >
                  {fuel === "petrol"
                    ? "🟢 Petrol"
                    : fuel === "diesel"
                      ? "🔵 Diesel"
                      : "🟡 CNG"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Amenity Filters ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <Text
            style={{
              fontSize: 12,
              color: "#888",
              marginBottom: 8,
              fontWeight: "600",
            }}
          >
            🔍 Filter Stations
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "air", label: "🌬️ Air Filling" },
              { key: "atm", label: "🏧 ATM" },
              { key: "restroom", label: "🚻 Restroom" },
              { key: "carwash", label: "🚿 Car Wash" },
            ].map((f) => {
              const active = activeFilters.includes(f.key);
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() =>
                    setActiveFilters((prev) =>
                      active
                        ? prev.filter((x) => x !== f.key)
                        : [...prev, f.key],
                    )
                  }
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: active ? "#0066cc" : "#fff",
                    borderWidth: 1.5,
                    borderColor: active ? "#0066cc" : "#ddd",
                    elevation: active ? 3 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: active ? "#fff" : "#555",
                    }}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {activeFilters.length > 0 && (
              <TouchableOpacity
                onPress={() => setActiveFilters([])}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: "#fee2e2",
                  borderWidth: 1.5,
                  borderColor: "#fca5a5",
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: "#cc0000" }}
                >
                  ✕ Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {activeFilters.length > 0 && (
            <Text style={{ fontSize: 11, color: "#0066cc", marginTop: 6 }}>
              {`Showing ${rankedPumps.length} station${rankedPumps.length !== 1 ? "s" : ""} with ${activeFilters.map((f) => (f === "air" ? "Air Filling" : f === "atm" ? "ATM" : f === "restroom" ? "Restroom" : "Car Wash")).join(" + ")}`}
            </Text>
          )}
        </View>

        {/* ── Best Match Card ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏆 Best Match</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>AI Ranked</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            {sameCity
              ? "Same-city mode · U(i) = 0.325×Distance + 0.348×Quality + 0.327×Amenities"
              : "U(i) = 0.257×Price + 0.242×Distance + 0.258×Quality + 0.243×Amenities · Survey n=70"}
          </Text>

          {bestPump ? (
            <View style={styles.bestCard}>
              <View style={styles.bestCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bestPumpName}>{bestPump.name}</Text>
                  <Text style={styles.bestPumpBrand}>{bestPump.brand}</Text>
                  <DataSourceBadge dataSource={bestPump.dataSource} />
                  {bestPump.hasAirFilling && (
                    <View style={styles.airBadge}>
                      <Text style={styles.airBadgeText}>
                        🌬️ Air Filling Available
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.scoreCircle}
                  onPress={() => setScoreModalPump(bestPump)}
                >
                  <Text style={styles.scoreCircleValue}>
                    {bestPump.utilityScore}%
                  </Text>
                  <Text style={styles.scoreCircleLabel}>Tap ℹ️</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {`₹${(selectedFuel === "diesel" ? bestPump.dieselPrice : selectedFuel === "cng" ? (bestPump.cngPrice ?? 74) : bestPump.petrolPrice || 0).toFixed(2)}`}
                  </Text>
                  <Text style={styles.statLabel}>
                    Per Litre{selectedFuel === "cng" ? " (kg)" : ""}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {`${bestPump.distance?.toFixed(1)} km`}
                  </Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {`⭐ ${bestPump.rating?.toFixed(1)}`}
                  </Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </View>

              {bestPump.breakdown && (
                <View style={styles.breakdownBox}>
                  <Text style={styles.breakdownTitle}>📊 Score Breakdown</Text>
                  {!sameCity && (
                    <ScoreBar
                      label="Price"
                      value={bestPump.breakdown.priceScore}
                      color="#00875a"
                    />
                  )}
                  <ScoreBar
                    label="Distance"
                    value={bestPump.breakdown.distanceScore}
                    color="#0066cc"
                  />
                  <ScoreBar
                    label="Quality"
                    value={bestPump.breakdown.qualityScore}
                    color="#6200ea"
                  />
                  <ScoreBar
                    label="Amenities"
                    value={bestPump.breakdown.amenitiesScore}
                    color="#e65100"
                  />
                  <View style={styles.breakdownWeights}>
                    <Text style={styles.weightText}>
                      {`Rating${bestPump.dataSource?.rating === "osm" ? "" : " (Est.)"}: ${bestPump.breakdown.ratingComponent}pt`}
                    </Text>
                    <Text style={styles.weightText}>
                      {`Amenities: ${bestPump.breakdown.amenitiesScore}pt`}
                    </Text>
                    <Text style={styles.weightText}>
                      {`Wait (Est.): ${bestPump.breakdown.waitTimeComponent}pt`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.scoringInfoBtn}
                    onPress={() => router.push("/mlPredict")}
                  >
                    <Text style={styles.scoringInfoText}>
                      ℹ️ How scoring works
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.tripBox}>
                <Text style={styles.tripTitle}>⛽ Trip Fuel Cost</Text>
                <View style={styles.tripRow}>
                  <View style={styles.tripItem}>
                    <Text style={styles.tripLabel}>Cost to Reach</Text>
                    <Text style={styles.tripValue}>
                      {`₹${bestPump.tripCost?.toFixed(2) || "0.00"}`}
                    </Text>
                  </View>
                  <View style={styles.tripDivider} />
                  <View style={styles.tripItem}>
                    <Text style={styles.tripLabel}>Fuel Needed</Text>
                    <Text style={styles.tripValue}>
                      {`${bestPump.litersNeeded?.toFixed(2) || "0.00"} L`}
                    </Text>
                  </View>
                  <View style={styles.tripDivider} />
                  <View style={styles.tripItem}>
                    <Text style={styles.tripLabel}>Mileage</Text>
                    <Text
                      style={styles.tripValue}
                    >{`${userMileage} km/L`}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.amenitiesRow}>
                {bestPump.amenities?.map((a: string, i: number) => (
                  <View key={i} style={styles.amenityTag}>
                    <Text style={styles.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>

              {/* Timestamp + Share row */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                {priceUpdatedAt && (
                  <Text style={{ fontSize: 11, color: "#888" }}>
                    🕐 {formatUpdatedAt(priceUpdatedAt)}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => shareStation(bestPump, selectedFuel, cityName)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#f0f4ff",
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#0066cc",
                    }}
                  >
                    📤 Share
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => router.push("/explore")}
              >
                <Text style={styles.navText}>
                  🧭 View All Stations & Navigate
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📍</Text>
              <Text style={styles.emptyText}>No stations found nearby</Text>
              <Text style={styles.emptySubText}>Pull down to refresh</Text>
            </View>
          )}
        </View>

        {/* ── Other Stations ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Other Nearby Stations</Text>
          <Text style={styles.sectionSubtitle}>
            Sorted by Smart Utility Score
          </Text>

          {rankedPumps.slice(1).map((pump, index) => (
            <View key={pump.id} style={styles.listCard}>
              <View style={styles.listRank}>
                <Text style={styles.listRankText}>#{index + 2}</Text>
              </View>
              <View style={styles.listInfo}>
                <View style={styles.listNameRow}>
                  <Text style={styles.listName}>{pump.name}</Text>
                  {pump.hasAirFilling && (
                    <View style={styles.airMiniTag}>
                      <Text style={styles.airMiniText}>🌬️</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.listBrand}>{pump.brand}</Text>
                <Text style={styles.listSub}>
                  {`₹${(selectedFuel === "diesel" ? pump.dieselPrice : selectedFuel === "cng" ? (pump.cngPrice ?? 74) : pump.petrolPrice || 0).toFixed(2)} · ${pump.distance?.toFixed(1)} km · Trip: ₹${pump.tripCost?.toFixed(2) || "0.00"}`}
                </Text>
                <DataSourceBadge dataSource={pump.dataSource} />
                {pump.breakdown && (
                  <View style={styles.miniBreakdown}>
                    {!sameCity && (
                      <Text style={styles.miniScore}>
                        {`P:${pump.breakdown.priceScore}`}
                      </Text>
                    )}
                    <Text style={styles.miniScore}>
                      {`D:${pump.breakdown.distanceScore}`}
                    </Text>
                    <Text style={styles.miniScore}>
                      {`Q:${pump.breakdown.qualityScore}`}
                    </Text>
                    <Text style={styles.miniScore}>
                      {`A:${pump.breakdown.amenitiesScore}`}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: "center", gap: 6 }}>
                <View style={styles.listScore}>
                  <Text style={styles.listScoreValue}>
                    {pump.utilityScore}%
                  </Text>
                  <Text style={styles.listScoreLabel}>Score</Text>
                </View>
                <TouchableOpacity
                  onPress={() => shareStation(pump, selectedFuel, cityName)}
                  style={{
                    backgroundColor: "#f0f4ff",
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#0066cc",
                      fontWeight: "700",
                    }}
                  >
                    📤
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: "#0066cc" }]}
              onPress={() => router.push("/explore")}
            >
              <Text style={styles.quickEmoji}>🗺️</Text>
              <Text style={styles.quickLabel}>Explore</Text>
              <Text style={styles.quickSub}>All Stations</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: "#e65100" }]}
              onPress={() => router.push("/travelPlanner")}
            >
              <Text style={styles.quickEmoji}>🛣️</Text>
              <Text style={styles.quickLabel}>Trip Plan</Text>
              <Text style={styles.quickSub}>Route Fuel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: "#00875a" }]}
              onPress={() => router.push("/ev")}
            >
              <Text style={styles.quickEmoji}>⚡</Text>
              <Text style={styles.quickLabel}>EV Charge</Text>
              <Text style={styles.quickSub}>Green Energy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: "#6200ea" }]}
              onPress={() => router.push("/mlPredict")}
            >
              <Text style={styles.quickEmoji}>🤖</Text>
              <Text style={styles.quickLabel}>AI Predict</Text>
              <Text style={styles.quickSub}>Price Forecast</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Score Breakdown Modal ── */}
      {scoreModalPump && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📊 Score Breakdown</Text>
            <Text style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
              {sameCity
                ? "Same-city mode · Distance 32.5% · Quality 34.8% · Amenities 32.7%"
                : "Cross-city mode · Price 25.7% · Distance 24.2% · Quality 25.8% · Amenities 24.3%"}
            </Text>
            {!sameCity && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 13, color: "#555" }}>Price Score</Text>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#00875a" }}
                >
                  {scoreModalPump.breakdown?.priceScore ?? "—"}
                </Text>
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 13, color: "#555" }}>
                Distance Score
              </Text>
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: "#0066cc" }}
              >
                {scoreModalPump.breakdown?.distanceScore ?? "—"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 13, color: "#555" }}>Quality Score</Text>
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: "#6200ea" }}
              >
                {scoreModalPump.breakdown?.qualityScore ?? "—"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 13, color: "#555" }}>
                Amenities Score
              </Text>
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: "#e65100" }}
              >
                {scoreModalPump.breakdown?.amenitiesScore ?? "—"}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "#e8f0fe",
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "bold",
                  color: "#0066cc",
                  textAlign: "center",
                }}
              >
                Final Score: {scoreModalPump.utilityScore}%
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: "#555",
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                n=70 survey {"\u00b7"} Cronbach{"'"}s {"\u03b1"}=0.725
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalBtnConfirm}
              onPress={() => setScoreModalPump(null)}
            >
              <Text style={styles.modalBtnConfirmText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Price Alert Modal (replaces Alert.prompt for cross-platform) ── */}
      {alertModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🔔 Set Price Alert</Text>
            <Text style={styles.modalSubtitle}>
              {`Alert me when ${selectedFuel.toUpperCase()} in ${cityName} drops below:`}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={alertInput}
              onChangeText={setAlertInput}
              keyboardType="numeric"
              placeholder="Target price ₹"
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setAlertModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnConfirm}
                onPress={async () => {
                  const price = parseFloat(alertInput);
                  if (isNaN(price) || price <= 0) {
                    Alert.alert(
                      "Invalid price",
                      "Please enter a valid number.",
                    );
                    return;
                  }
                  const { saveFuelAlert } = require("../../utils/storage");
                  await saveFuelAlert({
                    fuelType:
                      selectedFuel === "cng"
                        ? "cng"
                        : (selectedFuel as "petrol" | "diesel"),
                    targetPrice: price,
                    cityName,
                  });
                  setAlertModalVisible(false);
                  Alert.alert(
                    "✅ Alert Set",
                    `We'll notify you when ${selectedFuel.toUpperCase()} drops below ₹${price}/L in ${cityName}.`,
                  );
                }}
              >
                <Text style={styles.modalBtnConfirmText}>Set Alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingEmoji: { fontSize: 70, marginBottom: 20 },
  loadingTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  loadingSubtitle: { fontSize: 14, color: "#666" },
  loadingDotsRow: { flexDirection: "row", marginTop: 30, gap: 8 },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0066cc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 25,
    paddingTop: 55,
    backgroundColor: "#0066cc",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerLeft: {},
  appName: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  appTagline: { fontSize: 11, color: "#cce0ff", marginTop: 3 },
  cityName: { fontSize: 12, color: "#fff", marginTop: 5, fontWeight: "600" },
  pricesNote: { fontSize: 10, color: "#a8c8ff", marginTop: 3 },
  savingsCard: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    minWidth: 70,
  },
  savingsAmount: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  savingsLabel: { fontSize: 10, color: "#cce0ff", marginTop: 2 },
  livePriceBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#e8f5ed",
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#00875a",
  },
  livePriceText: { fontSize: 12, color: "#00875a", fontWeight: "600" },
  staticPriceBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#fffde7",
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#f9a825",
  },
  staticPriceText: { fontSize: 12, color: "#f57f17", fontWeight: "600" },
  sameCityBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#e8f5ed",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#00875a",
  },
  sameCityText: { fontSize: 12, color: "#00875a", fontWeight: "600" },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#fff3e0",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ff9800",
  },
  errorBannerText: { fontSize: 12, color: "#e65100", fontWeight: "600" },
  offlineBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#f3f3f3",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#888",
  },
  offlineBannerText: { fontSize: 12, color: "#555", fontWeight: "600" },
  researchBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#e8f0fe",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#1a3a6e",
  },
  researchBannerText: { fontSize: 12, color: "#1a3a6e", fontWeight: "600" },
  recBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: "#fff8e1",
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
  },
  recLeft: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 10 },
  recEmoji: { fontSize: 22, marginTop: 1 },
  recText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#856404",
    marginBottom: 2,
  },
  recSub: { fontSize: 11, color: "#a07030", flexShrink: 1 },
  recBtn: {
    backgroundColor: "#ffc107",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 10,
  },
  recBtnText: { fontSize: 12, fontWeight: "bold", color: "#856404" },
  toggleWrapper: { paddingHorizontal: 20, marginVertical: 14 },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 4,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 12,
  },
  activeToggle: { backgroundColor: "#0066cc" },
  toggleText: { color: "#888", fontWeight: "700", fontSize: 14 },
  toggleTextActive: { color: "#fff" },
  section: { paddingHorizontal: 20, marginBottom: 15 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a2e", flex: 1 },
  sectionBadge: {
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sectionBadgeText: { fontSize: 11, color: "#0066cc", fontWeight: "700" },
  sectionSubtitle: { fontSize: 11, color: "#888", marginBottom: 14 },
  bestCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    elevation: 6,
    shadowColor: "#0066cc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e8f0fe",
  },
  bestCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  bestPumpName: { fontSize: 18, fontWeight: "bold", color: "#1a1a2e" },
  bestPumpBrand: { color: "#0066cc", fontSize: 13, marginTop: 2 },
  airBadge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  airBadgeText: { fontSize: 11, color: "#0066cc", fontWeight: "600" },
  scoreCircle: {
    backgroundColor: "#0066cc",
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  scoreCircleValue: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scoreCircleLabel: { fontSize: 9, color: "#cce0ff" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#f8faff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 15, fontWeight: "bold", color: "#1a1a2e" },
  statLabel: { fontSize: 10, color: "#888", marginTop: 3 },
  statDivider: { width: 1, backgroundColor: "#e0e0e0" },
  breakdownBox: {
    backgroundColor: "#f4f1ff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#6200ea",
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#6200ea",
    marginBottom: 10,
  },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  barLabel: { fontSize: 11, color: "#555", width: 62 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#e0d9f7",
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { fontSize: 12, fontWeight: "700", width: 28, textAlign: "right" },
  breakdownWeights: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd5f5",
  },
  weightText: { fontSize: 10, color: "#7c5cbf" },
  scoringInfoBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  scoringInfoText: {
    fontSize: 11,
    color: "#6200ea",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  tripBox: {
    backgroundColor: "#fff8e1",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
  },
  tripTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#856404",
    marginBottom: 10,
  },
  tripRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tripItem: { alignItems: "center" },
  tripLabel: { fontSize: 10, color: "#856404" },
  tripValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#e65100",
    marginTop: 3,
  },
  tripDivider: { width: 1, height: 30, backgroundColor: "#ffd54f" },
  amenitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    gap: 6,
  },
  amenityTag: {
    backgroundColor: "#f0f4ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  amenityText: { fontSize: 11, color: "#0066cc", fontWeight: "600" },
  navBtn: {
    backgroundColor: "#0066cc",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  navText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 30,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: "bold", color: "#555" },
  emptySubText: { fontSize: 13, color: "#999", marginTop: 5 },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
  },
  listRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f4ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  listRankText: { fontSize: 12, fontWeight: "bold", color: "#0066cc" },
  listInfo: { flex: 1 },
  listNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  listName: { fontSize: 15, fontWeight: "bold", color: "#1a1a2e" },
  airMiniTag: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  airMiniText: { fontSize: 10 },
  listBrand: { color: "#0066cc", fontSize: 12, marginTop: 1 },
  listSub: { fontSize: 11, color: "#888", marginTop: 3 },
  miniBreakdown: { flexDirection: "row", gap: 8, marginTop: 4 },
  miniScore: {
    fontSize: 10,
    color: "#6200ea",
    fontWeight: "700",
    backgroundColor: "#f4f1ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  listScore: { alignItems: "center", marginLeft: 10 },
  listScoreValue: { fontSize: 18, fontWeight: "bold", color: "#0066cc" },
  listScoreLabel: { fontSize: 9, color: "#888" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  quickCard: {
    width: "47%",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
  },
  quickEmoji: { fontSize: 28, marginBottom: 6 },
  quickLabel: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  quickSub: { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 2 },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  modalSubtitle: { fontSize: 13, color: "#555", marginBottom: 14 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: "#0066cc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1a1a2e",
    marginBottom: 18,
  },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  modalBtnCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  modalBtnCancelText: { color: "#555", fontWeight: "700" },
  modalBtnConfirm: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#0066cc",
    alignItems: "center",
  },
  modalBtnConfirmText: { color: "#fff", fontWeight: "700" },
});
