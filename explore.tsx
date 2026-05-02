import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { calculateSmartScoreWithBreakdown } from "../../utils/scoring";
import {
  CNG_PRICES,
  getCityFuelPrices,
  getNearbyPetrolPumps,
} from "../../utils/services";
import { getUserProfile } from "../../utils/storage";

interface PetrolPump {
  id: any;
  name: string;
  brand: string;
  petrolPrice: number;
  dieselPrice: number;
  cngPrice?: number;
  currentPrice: number;
  distance: number;
  latitude: number;
  longitude: number;
  rating: number;
  isOpen: boolean;
  waitTime: string;
  waitTimeMinutes: number;
  hasAmenities: boolean;
  hasAirFilling: boolean;
  hasRestroom: boolean;
  hasATM: boolean;
  hasCarWash: boolean;
  amenities: string[];
  tripCost: number;
  litersNeeded: number;
  utilityScore?: number;
  breakdown?: any;
  isRealLocation?: boolean;
  cityName?: string;
}

function LoadingScreen() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <View style={styles.loadingContainer}>
      <Animated.Text
        style={[styles.loadingEmoji, { transform: [{ scale: pulseAnim }] }]}
      >
        🗺️
      </Animated.Text>
      <Text style={styles.loadingTitle}>Finding Stations</Text>
      <Text style={styles.loadingSubtitle}>Scanning OpenStreetMap data...</Text>
    </View>
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
    };
  });
};

export default function ExplorePage() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fuelType, setFuelType] = useState<"petrol" | "diesel" | "cng">(
    "petrol",
  );
  const [filterAir, setFilterAir] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "distance" | "price">("score");
  const [petrolPumps, setPetrolPumps] = useState<PetrolPump[]>([]);
  const [expandedId, setExpandedId] = useState<any>(null);
  const [researchMode, setResearchMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load research mode preference
      const profile = await getUserProfile();
      setResearchMode(profile.researchMode ?? false);
      const isResearch = profile.researchMode ?? false;

      let lat = 11.0183;
      let lon = 76.9644;
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
        console.log("Using default location");
      }

      // Show fallback pumps immediately so the page is never blank
      const cityPrices = await getCityFuelPrices(lat, lon).catch(() => ({
        petrol: 104,
        diesel: 89,
        cng: 74,
        cityName: "Your City",
        source: "static" as const,
      }));
      const fallback = buildFallbackPumps(lat, lon, cityPrices);
      setPetrolPumps(fallback);
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Then replace with real OSM data when it arrives (pass cityPrices to avoid double fetch)
      const pumps = await getNearbyPetrolPumps(lat, lon, cityPrices);
      if (!pumps || pumps.length === 0) return;

      const prices = pumps.map(
        (p: any) => p.currentPrice || p.petrolPrice || 104,
      );
      const distances = pumps.map((p: any) => p.distance || 0);

      const scoredPumps = pumps.map((pump: any) => {
        const breakdown = calculateSmartScoreWithBreakdown(
          pump,
          Math.min(...prices),
          Math.max(...prices),
          Math.max(...distances),
          Math.min(...distances),
        );
        const cityKey = (pump.cityName || "").toLowerCase();
        const cngPrice =
          pump.cngPrice ||
          CNG_PRICES[cityKey] ||
          CNG_PRICES[cityKey.split(" ")[0]] ||
          74.0;
        return {
          ...pump,
          cngPrice,
          utilityScore: breakdown.finalScore,
          breakdown,
        };
      });

      scoredPumps.sort((a: any, b: any) => b.utilityScore - a.utilityScore);
      // Research Mode: only show stations with real OSM locations
      const finalPumps = isResearch
        ? scoredPumps.filter((p: any) => p.isRealLocation === true)
        : scoredPumps;
      setPetrolPumps(finalPumps.length > 0 ? finalPumps : scoredPumps);
    } catch (error) {
      console.error("Explore load error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATE — uses name + coords together so Google Maps opens the correct
  // station. Raw coords alone can silently snap to a different nearby pump
  // when multiple OSM entries share the same forecourt (the root cause of the
  // "Indian Oil card → HP navigation" bug).
  //
  // Strategy:
  //   • Real location  → name-anchored deep-link  (q=NAME&ll=LAT,LON)
  //                      falls back to web URL with destination=LAT,LON&query=NAME
  //   • Fallback/mock  → Maps search for petrol pumps near the coords
  // ─────────────────────────────────────────────────────────────────────────
  const navigateToMap = async (pump: PetrolPump) => {
    const lat = pump.latitude;
    const lon = pump.longitude;
    const isReal = pump.isRealLocation !== false;

    // Prefer the station's specific name; fall back to brand so the Maps pin
    // label is always meaningful and matches what the user sees on the card.
    const displayName =
      pump.name && pump.name !== "Petrol Pump"
        ? pump.name
        : pump.brand
          ? `${pump.brand} Petrol Station`
          : "Petrol Station";

    const encodedName = encodeURIComponent(displayName);

    // ── Confirmation alert so the user always sees which station they're
    //    navigating to — catches any remaining mismatch at a glance.
    const doNavigate = () =>
      new Promise<boolean>((resolve) => {
        Alert.alert("🧭 Navigate", `Open directions to:\n${displayName}`, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Go", onPress: () => resolve(true) },
        ]);
      });

    const confirmed = await doNavigate();
    if (!confirmed) return;

    if (!isReal) {
      // Fallback / mock data — search for petrol pumps near the coords
      Linking.openURL(
        `https://www.google.com/maps/search/petrol+pump/@${lat},${lon},15z`,
      );
      return;
    }

    // ── Real OSM location ──────────────────────────────────────────────────
    // Use name-anchored URLs so Google Maps pins the correct station, not just
    // the nearest fuel node at those coordinates.
    // COORDS-ANCHORED navigation — prevents snapping to wrong station.
    // All URLs use lat,lon as primary destination. Name is label only.
    // Web URL is the most reliable cross-platform fallback.
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;

    if (Platform.OS === "android") {
      // Priority 1: geo intent with exact coords + name label
      // geo:LAT,LON?q=LAT,LON(NAME) pins the exact point, not a name search
      const geoUri = `geo:${lat},${lon}?q=${lat},${lon}(${encodedName})`;
      try {
        await Linking.openURL(geoUri);
        return;
      } catch {}
      // Priority 2: web URL with coords as destination
      Linking.openURL(webUrl);
    } else {
      // iOS Priority 1: Google Maps app with coords as destination
      const googleApp = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`;
      // iOS Priority 2: Apple Maps with coords
      const appleApp = `maps://?daddr=${lat},${lon}&dirflg=d`;
      try {
        const canGoogle = await Linking.canOpenURL(googleApp);
        if (canGoogle) {
          await Linking.openURL(googleApp);
          return;
        }
        const canApple = await Linking.canOpenURL(appleApp);
        if (canApple) {
          await Linking.openURL(appleApp);
          return;
        }
      } catch {}
      Linking.openURL(webUrl);
    }
  };

  let displayPumps = petrolPumps.filter((p) => {
    const matchSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchAir = filterAir ? p.hasAirFilling : true;
    return matchSearch && matchAir;
  });

  if (sortBy === "distance")
    displayPumps = [...displayPumps].sort((a, b) => a.distance - b.distance);
  else if (sortBy === "price")
    displayPumps = [...displayPumps].sort(
      (a, b) =>
        (a.currentPrice || a.petrolPrice) - (b.currentPrice || b.petrolPrice),
    );

  if (loading) return <LoadingScreen />;

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Explore Stations</Text>
        <Text style={styles.headerSubtitle}>
          {displayPumps.length} stations found
        </Text>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchBar}
            placeholder="Search station or brand..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#aaa"
          />
        </View>
        <View style={styles.toggleRow}>
          {[
            { key: "petrol", label: "🟢 Petrol" },
            { key: "diesel", label: "🔵 Diesel" },
            { key: "cng", label: "🟡 CNG" },
          ].map((fuel) => (
            <TouchableOpacity
              key={fuel.key}
              style={[
                styles.toggleBtn,
                fuelType === fuel.key && styles.toggleActive,
              ]}
              onPress={() => setFuelType(fuel.key as any)}
            >
              <Text
                style={[
                  styles.toggleText,
                  fuelType === fuel.key && styles.toggleTextActive,
                ]}
              >
                {fuel.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Filter Bar ── */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.airFilterBtn, filterAir && styles.airFilterActive]}
          onPress={() => setFilterAir(!filterAir)}
        >
          <Text style={styles.airFilterText}>
            🌬️ {filterAir ? "Air Filling ✓" : "Air Filling"}
          </Text>
        </TouchableOpacity>
        <View style={styles.sortRow}>
          {[
            { key: "score", label: "🎯 Score" },
            { key: "distance", label: "📍 Near" },
            { key: "price", label: "💰 Price" },
          ].map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sortBtn, sortBy === s.key && styles.sortBtnActive]}
              onPress={() => setSortBy(s.key as any)}
            >
              <Text
                style={[
                  styles.sortText,
                  sortBy === s.key && styles.sortTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {displayPumps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>{filterAir ? "🌬️" : "📍"}</Text>
            <Text style={styles.emptyText}>
              {filterAir
                ? "No stations with air filling found"
                : "No stations found"}
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => {
                setFilterAir(false);
                setSearchQuery("");
              }}
            >
              <Text style={styles.emptyBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          displayPumps.map((pump, index) => {
            const price =
              fuelType === "petrol"
                ? pump.petrolPrice || 0
                : fuelType === "diesel"
                  ? pump.dieselPrice || 0
                  : pump.cngPrice ||
                    CNG_PRICES[pump.cityName?.toLowerCase() ?? ""] ||
                    74.0;
            const expanded = expandedId === pump.id;
            const isReal = pump.isRealLocation !== false;

            return (
              <View
                key={pump.id}
                style={[styles.card, index === 0 && styles.topCard]}
              >
                {/* Best pick banner */}
                {index === 0 && (
                  <View style={styles.bestBanner}>
                    <Text style={styles.bestBannerText}>
                      🏆 BEST PICK — Highest Smart Score
                    </Text>
                  </View>
                )}

                {/* Fallback warning — shown only when OSM data unavailable */}
                {!isReal && (
                  <View style={styles.fallbackBanner}>
                    <Text style={styles.fallbackBannerText}>
                      ⚠️ Live data unavailable — tap Navigate to search nearby
                      pumps
                    </Text>
                  </View>
                )}

                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.pumpName}>
                        {pump.name || "Fuel Station"}
                      </Text>
                      {pump.hasAirFilling && (
                        <View style={styles.airBadge}>
                          <Text style={styles.airBadgeText}>🌬️ Air</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.pumpBrand}>
                      {pump.brand || "Independent"}
                    </Text>
                  </View>
                  <View style={styles.priceBox}>
                    <Text style={styles.priceText}>₹{price.toFixed(2)}</Text>
                    <Text style={styles.priceLabel}>
                      {fuelType === "cng" ? "/kg" : "/litre"}
                    </Text>
                  </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>📍 DIST</Text>
                    <Text style={styles.statValue}>
                      {pump.distance.toFixed(1)} km
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>⭐ RATING</Text>
                    <Text style={styles.statValue}>
                      {pump.rating?.toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>⏱️ WAIT</Text>
                    <Text style={styles.statValue}>Est. {pump.waitTime}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>🎯 SCORE</Text>
                    <Text style={[styles.statValue, styles.scoreText]}>
                      {pump.utilityScore}%
                    </Text>
                  </View>
                </View>

                {/* Score Breakdown Toggle */}
                <TouchableOpacity
                  style={styles.breakdownToggle}
                  onPress={() => setExpandedId(expanded ? null : pump.id)}
                >
                  <Text style={styles.breakdownToggleText}>
                    📊 Score Breakdown {expanded ? "▲" : "▼"}
                  </Text>
                  <View style={styles.miniScoreRow}>
                    <Text
                      style={[
                        styles.miniChip,
                        { backgroundColor: "#e8f5ed", color: "#00875a" },
                      ]}
                    >
                      P:{pump.breakdown?.priceScore}
                    </Text>
                    <Text
                      style={[
                        styles.miniChip,
                        { backgroundColor: "#e8f0fe", color: "#0066cc" },
                      ]}
                    >
                      D:{pump.breakdown?.distanceScore}
                    </Text>
                    <Text
                      style={[
                        styles.miniChip,
                        { backgroundColor: "#f4f1ff", color: "#6200ea" },
                      ]}
                    >
                      Q:{pump.breakdown?.qualityScore}
                    </Text>
                    <Text
                      style={[
                        styles.miniChip,
                        { backgroundColor: "#fff3e0", color: "#e65100" },
                      ]}
                    >
                      A:{pump.breakdown?.amenitiesScore}
                    </Text>
                  </View>
                </TouchableOpacity>

                {expanded && pump.breakdown && (
                  <View style={styles.breakdownBox}>
                    <ScoreBar
                      label="Price"
                      value={pump.breakdown.priceScore}
                      color="#00875a"
                    />
                    <ScoreBar
                      label="Distance"
                      value={pump.breakdown.distanceScore}
                      color="#0066cc"
                    />
                    <ScoreBar
                      label="Quality"
                      value={pump.breakdown.qualityScore}
                      color="#6200ea"
                    />
                    <View style={styles.qualityDetail}>
                      <Text style={styles.qualityDetailText}>
                        Quality = 0.6×Rating ({pump.breakdown.ratingComponent}
                        pt) + 0.4×WaitTime ({pump.breakdown.waitTimeComponent}
                        pt)
                      </Text>
                    </View>
                    <ScoreBar
                      label="Amenities"
                      value={pump.breakdown.amenitiesScore}
                      color="#e65100"
                    />
                    <View style={styles.qualityDetail}>
                      <Text style={styles.qualityDetailText}>
                        Amenities: Air Filling 30pt · Restroom 25pt · ATM 25pt ·
                        Car Wash 20pt
                      </Text>
                    </View>
                  </View>
                )}

                {/* Trip Fuel Cost */}
                <View style={styles.tripBox}>
                  <Text style={styles.tripTitle}>⛽ Trip Fuel Cost</Text>
                  <View style={styles.tripRow}>
                    <View style={styles.tripItem}>
                      <Text style={styles.tripLabel}>Cost to Reach</Text>
                      <Text style={styles.tripValue}>
                        ₹{pump.tripCost?.toFixed(2) || "0.00"}
                      </Text>
                    </View>
                    <View style={styles.tripDivider} />
                    <View style={styles.tripItem}>
                      <Text style={styles.tripLabel}>Fuel Needed</Text>
                      <Text style={styles.tripValue}>
                        {pump.litersNeeded?.toFixed(2) || "0.00"} L
                      </Text>
                    </View>
                    <View style={styles.tripDivider} />
                    <View style={styles.tripItem}>
                      <Text style={styles.tripLabel}>Mileage</Text>
                      <Text style={styles.tripValue}>Set in My Log</Text>
                    </View>
                  </View>
                </View>

                {/* Amenities */}
                <View style={styles.amenitiesRow}>
                  {pump.amenities?.map((a, i) => (
                    <View key={i} style={styles.amenityTag}>
                      <Text style={styles.amenityText}>{a}</Text>
                    </View>
                  ))}
                </View>

                {/* Navigate + Copy Coords row */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.navButton,
                      !isReal && styles.navButtonSearch,
                      { flex: 1 },
                    ]}
                    onPress={() => navigateToMap(pump)}
                  >
                    <Text style={styles.navText}>
                      {isReal ? "🧭 Navigate" : "📍 Find Nearby Pumps"}
                    </Text>
                  </TouchableOpacity>
                  {isReal && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#f0f4ff",
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                        justifyContent: "center",
                        alignItems: "center",
                        borderWidth: 1.5,
                        borderColor: "#c7d8ff",
                      }}
                      onPress={async () => {
                        const coords = `${pump.latitude.toFixed(6)}, ${pump.longitude.toFixed(6)}`;
                        try {
                          await Share.share({
                            message: `${pump.name}\n${coords}\n\nCoordinates for ${pump.name}`,
                            title: "Station Coordinates",
                          });
                        } catch {
                          Alert.alert(
                            "📋 Coordinates",
                            `${pump.name}\n${coords}\n\nCopy these coordinates manually.`,
                            [{ text: "OK" }],
                          );
                        }
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#0066cc",
                          fontWeight: "700",
                        }}
                      >
                        📋
                      </Text>
                      <Text
                        style={{ fontSize: 9, color: "#0066cc", marginTop: 2 }}
                      >
                        Coords
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#f0f4ff",
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: "#c7d8ff",
                    }}
                    onPress={async () => {
                      const price = pump.petrolPrice ?? pump.currentPrice;
                      const amenities = [
                        pump.hasAirFilling && "Air",
                        pump.hasATM && "ATM",
                        pump.hasRestroom && "Restroom",
                      ]
                        .filter(Boolean)
                        .join(", ");
                      await Share.share({
                        message: `⛽ ${pump.name}\n💰 ₹${price?.toFixed(2)}/L · ${pump.distance?.toFixed(1)}km away\n⭐ ${pump.rating?.toFixed(1)} · ✅ ${amenities || "Water"}\n\nFound via FuelSense`,
                      });
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#0066cc",
                        fontWeight: "700",
                      }}
                    >
                      📤
                    </Text>
                    <Text
                      style={{ fontSize: 9, color: "#0066cc", marginTop: 2 }}
                    >
                      Share
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </Animated.View>
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
  loadingEmoji: { fontSize: 60, marginBottom: 16 },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 6,
  },
  loadingSubtitle: { fontSize: 13, color: "#666" },
  header: {
    backgroundColor: "#0066cc",
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
  headerSubtitle: { fontSize: 12, color: "#cce0ff", marginBottom: 14 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    elevation: 2,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchBar: { flex: 1, paddingVertical: 12, fontSize: 14, color: "#333" },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleActive: { backgroundColor: "#fff" },
  toggleText: { color: "#cce0ff", fontWeight: "600", fontSize: 13 },
  toggleTextActive: { color: "#0066cc" },
  filterBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  airFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#0066cc",
    backgroundColor: "#fff",
  },
  airFilterActive: { backgroundColor: "#e3f2fd", borderColor: "#0066cc" },
  airFilterText: { fontSize: 12, color: "#0066cc", fontWeight: "700" },
  sortRow: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
  },
  sortBtnActive: { backgroundColor: "#0066cc" },
  sortText: { fontSize: 11, color: "#666", fontWeight: "600" },
  sortTextActive: { color: "#fff" },
  listContent: { padding: 15 },
  emptyContainer: { alignItems: "center", marginTop: 60 },
  emptyEmoji: { fontSize: 50, marginBottom: 15 },
  emptyText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#555",
    marginBottom: 15,
  },
  emptyBtn: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: "#fff", fontWeight: "bold" },
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
  topCard: { borderWidth: 2, borderColor: "#0066cc", elevation: 6 },
  bestBanner: {
    backgroundColor: "#0066cc",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  bestBannerText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  fallbackBanner: {
    backgroundColor: "#fff3e0",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ff9800",
  },
  fallbackBannerText: { fontSize: 11, color: "#e65100", fontWeight: "600" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  pumpName: { fontSize: 17, fontWeight: "bold", color: "#1a1a2e" },
  airBadge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  airBadgeText: { fontSize: 11, color: "#0066cc", fontWeight: "700" },
  pumpBrand: {
    color: "#0066cc",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  priceBox: { alignItems: "flex-end" },
  priceText: { fontSize: 22, fontWeight: "bold", color: "#00875a" },
  priceLabel: { fontSize: 10, color: "#999" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8faff",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  statItem: { alignItems: "center", flex: 1 },
  statLabel: {
    fontSize: 9,
    color: "#8E8E93",
    fontWeight: "bold",
    marginBottom: 3,
  },
  statValue: { fontSize: 13, fontWeight: "700", color: "#3A3A3C" },
  scoreText: { color: "#0066cc" },
  breakdownToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    marginBottom: 4,
  },
  breakdownToggleText: { fontSize: 12, fontWeight: "700", color: "#6200ea" },
  miniScoreRow: { flexDirection: "row", gap: 5 },
  miniChip: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  breakdownBox: {
    backgroundColor: "#f9f7ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  barLabel: { fontSize: 11, color: "#555", width: 62 },
  barTrack: {
    flex: 1,
    height: 7,
    backgroundColor: "#e0d9f7",
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  barFill: { height: 7, borderRadius: 4 },
  barValue: { fontSize: 12, fontWeight: "700", width: 28, textAlign: "right" },
  qualityDetail: {
    backgroundColor: "#ede9ff",
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  qualityDetailText: { fontSize: 10, color: "#5c35a8", lineHeight: 15 },
  tripBox: {
    backgroundColor: "#fff8e1",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#ffc107",
  },
  tripTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#856404",
    marginBottom: 8,
  },
  tripRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tripItem: { alignItems: "center" },
  tripLabel: { fontSize: 10, color: "#856404" },
  tripValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#e65100",
    marginTop: 2,
  },
  tripDivider: { width: 1, height: 28, backgroundColor: "#ffd54f" },
  amenitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  amenityTag: {
    backgroundColor: "#f0f4ff",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  amenityText: { fontSize: 11, color: "#0066cc", fontWeight: "600" },
  navButton: {
    backgroundColor: "#0066cc",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  navButtonSearch: { backgroundColor: "#ff9800" },
  navText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
