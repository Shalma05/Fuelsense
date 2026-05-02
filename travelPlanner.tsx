import React, { useEffect, useState } from "react";
import {
  clearTripHistory,
  getTripHistory,
  getUserProfile,
  saveTripHistory,
  TripRecord,
} from "../../utils/storage";

// then in your fuel cost formula, replace hardcoded mileage with mileageKmL
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getHistoricalData, predictFuelPrice } from "../../utils/mlService";
import {
  calculateCityScore,
  calculateSmartScoreWithBreakdown,
} from "../../utils/scoring";

type CityData = {
  lat: number;
  lon: number;
  petrol: number;
  diesel: number;
  state: string;
};

const CITY_DATABASE: { [key: string]: CityData } = {
  chennai: {
    lat: 13.0827,
    lon: 80.2707,
    petrol: 102.63,
    diesel: 94.24,
    state: "Tamil Nadu",
  },
  coimbatore: {
    lat: 11.0168,
    lon: 76.9558,
    petrol: 102.63,
    diesel: 89.47,
    state: "Tamil Nadu",
  },
  madurai: {
    lat: 9.9252,
    lon: 78.1198,
    petrol: 102.71,
    diesel: 89.53,
    state: "Tamil Nadu",
  },
  trichy: {
    lat: 10.7905,
    lon: 78.7047,
    petrol: 102.58,
    diesel: 89.41,
    state: "Tamil Nadu",
  },
  salem: {
    lat: 11.6643,
    lon: 78.146,
    petrol: 102.55,
    diesel: 89.38,
    state: "Tamil Nadu",
  },
  tirunelveli: {
    lat: 8.7139,
    lon: 77.7567,
    petrol: 102.68,
    diesel: 89.5,
    state: "Tamil Nadu",
  },
  vellore: {
    lat: 12.9165,
    lon: 79.1325,
    petrol: 102.6,
    diesel: 89.44,
    state: "Tamil Nadu",
  },
  erode: {
    lat: 11.341,
    lon: 77.7172,
    petrol: 102.57,
    diesel: 89.4,
    state: "Tamil Nadu",
  },
  bangalore: {
    lat: 12.9716,
    lon: 77.5946,
    petrol: 102.86,
    diesel: 88.94,
    state: "Karnataka",
  },
  mysore: {
    lat: 12.2958,
    lon: 76.6394,
    petrol: 102.74,
    diesel: 88.82,
    state: "Karnataka",
  },
  hubli: {
    lat: 15.3647,
    lon: 75.124,
    petrol: 102.61,
    diesel: 88.7,
    state: "Karnataka",
  },
  mangalore: {
    lat: 12.9141,
    lon: 74.856,
    petrol: 102.53,
    diesel: 88.63,
    state: "Karnataka",
  },
  kochi: {
    lat: 9.9312,
    lon: 76.2673,
    petrol: 107.66,
    diesel: 96.22,
    state: "Kerala",
  },
  thiruvananthapuram: {
    lat: 8.5241,
    lon: 76.9366,
    petrol: 107.71,
    diesel: 96.27,
    state: "Kerala",
  },
  kozhikode: {
    lat: 11.2588,
    lon: 75.7804,
    petrol: 107.58,
    diesel: 96.14,
    state: "Kerala",
  },
  hyderabad: {
    lat: 17.385,
    lon: 78.4867,
    petrol: 107.41,
    diesel: 95.65,
    state: "Telangana",
  },
  warangal: {
    lat: 17.9784,
    lon: 79.5941,
    petrol: 107.28,
    diesel: 95.52,
    state: "Telangana",
  },
  visakhapatnam: {
    lat: 17.6868,
    lon: 83.2185,
    petrol: 108.12,
    diesel: 96.34,
    state: "Andhra Pradesh",
  },
  vijayawada: {
    lat: 16.5062,
    lon: 80.648,
    petrol: 107.95,
    diesel: 96.18,
    state: "Andhra Pradesh",
  },
  mumbai: {
    lat: 19.076,
    lon: 72.8777,
    petrol: 103.44,
    diesel: 89.97,
    state: "Maharashtra",
  },
  pune: {
    lat: 18.5204,
    lon: 73.8567,
    petrol: 103.57,
    diesel: 90.03,
    state: "Maharashtra",
  },
  nagpur: {
    lat: 21.1458,
    lon: 79.0882,
    petrol: 103.12,
    diesel: 89.72,
    state: "Maharashtra",
  },
  nashik: {
    lat: 19.9975,
    lon: 73.7898,
    petrol: 103.28,
    diesel: 89.85,
    state: "Maharashtra",
  },
  delhi: {
    lat: 28.7041,
    lon: 77.1025,
    petrol: 94.77,
    diesel: 87.67,
    state: "Delhi",
  },
  noida: {
    lat: 28.5355,
    lon: 77.391,
    petrol: 94.83,
    diesel: 87.72,
    state: "Uttar Pradesh",
  },
  gurgaon: {
    lat: 28.4595,
    lon: 77.0266,
    petrol: 95.12,
    diesel: 87.94,
    state: "Haryana",
  },
  ahmedabad: {
    lat: 23.0225,
    lon: 72.5714,
    petrol: 96.63,
    diesel: 92.38,
    state: "Gujarat",
  },
  surat: {
    lat: 21.1702,
    lon: 72.8311,
    petrol: 96.71,
    diesel: 92.45,
    state: "Gujarat",
  },
  vadodara: {
    lat: 22.3072,
    lon: 73.1812,
    petrol: 96.58,
    diesel: 92.32,
    state: "Gujarat",
  },
  jaipur: {
    lat: 26.9124,
    lon: 75.7873,
    petrol: 104.88,
    diesel: 90.36,
    state: "Rajasthan",
  },
  jodhpur: {
    lat: 26.2389,
    lon: 73.0243,
    petrol: 104.76,
    diesel: 90.24,
    state: "Rajasthan",
  },
  udaipur: {
    lat: 24.5854,
    lon: 73.7125,
    petrol: 104.92,
    diesel: 90.4,
    state: "Rajasthan",
  },
  chandigarh: {
    lat: 30.7333,
    lon: 76.7794,
    petrol: 94.24,
    diesel: 82.4,
    state: "Punjab",
  },
  ludhiana: {
    lat: 30.901,
    lon: 75.8573,
    petrol: 96.12,
    diesel: 83.58,
    state: "Punjab",
  },
  amritsar: {
    lat: 31.634,
    lon: 74.8723,
    petrol: 96.24,
    diesel: 83.7,
    state: "Punjab",
  },
  lucknow: {
    lat: 26.8467,
    lon: 80.9462,
    petrol: 94.65,
    diesel: 87.5,
    state: "Uttar Pradesh",
  },
  kanpur: {
    lat: 26.4499,
    lon: 80.3319,
    petrol: 94.58,
    diesel: 87.43,
    state: "Uttar Pradesh",
  },
  agra: {
    lat: 27.1767,
    lon: 78.0081,
    petrol: 94.72,
    diesel: 87.57,
    state: "Uttar Pradesh",
  },
  varanasi: {
    lat: 25.3176,
    lon: 82.9739,
    petrol: 94.81,
    diesel: 87.66,
    state: "Uttar Pradesh",
  },
  bhopal: {
    lat: 23.2599,
    lon: 77.4126,
    petrol: 108.65,
    diesel: 93.48,
    state: "Madhya Pradesh",
  },
  indore: {
    lat: 22.7196,
    lon: 75.8577,
    petrol: 108.72,
    diesel: 93.55,
    state: "Madhya Pradesh",
  },
  jabalpur: {
    lat: 23.1815,
    lon: 79.9864,
    petrol: 108.58,
    diesel: 93.41,
    state: "Madhya Pradesh",
  },
  kolkata: {
    lat: 22.5726,
    lon: 88.3639,
    petrol: 104.95,
    diesel: 91.76,
    state: "West Bengal",
  },
  patna: {
    lat: 25.5941,
    lon: 85.1376,
    petrol: 105.59,
    diesel: 92.4,
    state: "Bihar",
  },
  bhubaneswar: {
    lat: 20.2961,
    lon: 85.8189,
    petrol: 101.05,
    diesel: 93.37,
    state: "Odisha",
  },
  guwahati: {
    lat: 26.1445,
    lon: 91.7362,
    petrol: 96.01,
    diesel: 83.94,
    state: "Assam",
  },
  ranchi: {
    lat: 23.3441,
    lon: 85.3096,
    petrol: 99.84,
    diesel: 94.17,
    state: "Jharkhand",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCitiesAlongRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) {
  const results: any[] = [];
  const dx = toLon - fromLon;
  const dy = toLat - fromLat;
  const routeLen = Math.sqrt(dx * dx + dy * dy);
  for (const [key, city] of Object.entries(CITY_DATABASE)) {
    const cx = city.lon - fromLon;
    const cy = city.lat - fromLat;
    const t = (cx * dx + cy * dy) / (routeLen * routeLen);
    if (t < 0 || t > 1) continue;
    const perpX = cx - t * dx;
    const perpY = cy - t * dy;
    const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
    if (perpDist < 2.5) {
      results.push({
        cityKey: key,
        data: city,
        distFromStart: t * routeLen * 111,
        perpDistKm: perpDist * 111,
      });
    }
  }
  return results.sort((a, b) => a.distFromStart - b.distFromStart);
}

function resolveCity(input: string) {
  const key = input.toLowerCase().trim();
  if (CITY_DATABASE[key]) return { key, data: CITY_DATABASE[key] };
  const partialKey = Object.keys(CITY_DATABASE).find(
    (k) => k.includes(key) || key.includes(k),
  );
  if (partialKey) return { key: partialKey, data: CITY_DATABASE[partialKey] };
  return null;
}

function getNextDates(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      index: i,
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d.toLocaleDateString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
              }),
      full: d.toLocaleDateString("en-IN", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    };
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getStateBorderCrossings(
  citiesInOrder: any[],
  fuelType: "petrol" | "diesel",
) {
  const crossings: any[] = [];
  for (let i = 1; i < citiesInOrder.length; i++) {
    const prev = citiesInOrder[i - 1];
    const curr = citiesInOrder[i];
    if (prev.data.state !== curr.data.state) {
      const prevPrice =
        fuelType === "petrol" ? prev.data.petrol : prev.data.diesel;
      const currPrice =
        fuelType === "petrol" ? curr.data.petrol : curr.data.diesel;
      crossings.push({
        fromState: prev.data.state,
        toState: curr.data.state,
        fromCity: prev.cityKey,
        toCity: curr.cityKey,
        priceDiff: currPrice - prevPrice,
        newPrice: currPrice,
        oldPrice: prevPrice,
      });
    }
  }
  return crossings;
}

// ── Survey-validated scoring for stations within a city (same-city mode) ──────
// Since city prices are regulated, price is excluded (weight = 0)
// Distance 32.5% | Quality 34.8% | Amenities 32.7%
// Returns estimated (PPAC-anchored) station quality for corridor cities.
// Ratings and amenities are deterministically seeded from city key — disclosed in UI.
function getEstimatedStationsForCity(
  cityKey: string,
  cityData: CityData,
  fuelType: "petrol" | "diesel",
) {
  const brands = ["Indian Oil", "HP", "BPCL", "Shell", "Reliance"];
  const basePrice = fuelType === "petrol" ? cityData.petrol : cityData.diesel;

  const allPrices = brands.map(() => basePrice); // uniform within city — government regulated
  const allDistances = brands.map((_, i) =>
    parseFloat((0.4 + i * 0.5).toFixed(1)),
  );

  return brands
    .map((brand, i) => {
      const seed = cityKey.charCodeAt(0) + i * 7;
      const variation = (((Math.sin(seed) * 10000) % 1) + 1) % 1;
      const price = basePrice; // same price across all stations in this city
      const distance = parseFloat((0.4 + i * 0.5 + variation * 0.3).toFixed(1));
      const rating = parseFloat((3.2 + variation * 1.8).toFixed(1));
      const waitMins = Math.floor(2 + variation * 10);
      const hasAir = variation > 0.4;
      const hasATM = variation > 0.5;
      const hasRestroom = variation > 0.35;
      const hasCarWash = variation > 0.6;

      const pump = {
        currentPrice: price,
        distance,
        rating,
        waitTimeMinutes: waitMins,
        hasAirFilling: hasAir,
        hasATM,
        hasRestroom,
        hasCarWash,
      };

      // same-city mode: price excluded, Distance 32.5% | Quality 34.8% | Amenities 32.7%
      const breakdown = calculateSmartScoreWithBreakdown(
        pump,
        Math.min(...allPrices),
        Math.max(...allPrices),
        Math.max(...allDistances),
        Math.min(...allDistances),
        true,
      );

      return {
        name: `${brand} — ${cityKey.charAt(0).toUpperCase() + cityKey.slice(1)}`,
        brand,
        price,
        distance,
        rating,
        waitMins,
        hasAir,
        hasATM,
        hasRestroom,
        hasCarWash,
        score: breakdown.finalScore,
        priceScore: breakdown.priceScore,
        distanceScore: breakdown.distanceScore,
        qualityScore: breakdown.qualityScore,
        amenitiesScore: breakdown.amenitiesScore,
        mode: breakdown.mode,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Navigate to Google Maps: origin → fuel stop city → destination ─────────
async function openRouteInMaps(
  fromData: CityData,
  fromName: string,
  stopData: CityData,
  stopName: string,
  toData: CityData,
  toName: string,
) {
  const origin = `${fromData.lat},${fromData.lon}`;
  const destination = `${toData.lat},${toData.lon}`;
  const waypoint = `${stopData.lat},${stopData.lon}`;
  // Labels used for future deep-link support (Google Maps label param)
  void fromName;
  void stopName;
  void toName;

  // Always use web URL — most reliable cross-platform, coords-anchored
  const webNav = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoint}&travelmode=driving`;
  if (Platform.OS === "android") {
    // Try native Google Maps intent first (coords-anchored, most accurate)
    const nativeNav = `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&waypoints=${waypoint}`;
    try {
      await Linking.openURL(nativeNav);
      return;
    } catch {}
    Linking.openURL(webNav);
    return;
  } else {
    // Try Google Maps app first on iOS
    const googleApp = `comgooglemaps://?saddr=${origin}&daddr=${destination}&waypoints=${waypoint}&directionsmode=driving`;
    const canGoogle = await Linking.canOpenURL(googleApp);
    if (canGoogle) {
      Linking.openURL(googleApp);
      return;
    }
    // Fallback to Apple Maps
    const appleMaps = `maps://?saddr=${origin}&daddr=${destination}`;
    const canApple = await Linking.canOpenURL(appleMaps);
    if (canApple) {
      Linking.openURL(appleMaps);
      return;
    }
  }
  // Universal fallback — works on any device
  Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoint}&travelmode=driving`,
  );
}

// ── Open Maps just for petrol pumps near a city ───────────────────────────
async function openPumpsInMaps(city: CityData, name: string) {
  const label = encodeURIComponent(name + " Petrol Pump");
  const { lat, lon } = city;
  if (Platform.OS === "android") {
    // Use coords-anchored search — more reliable than name-only on Android
    const geoUri = `geo:${lat},${lon}?q=petrol+pump&zoom=15`;
    try {
      await Linking.openURL(geoUri);
      return;
    } catch {}
  } else {
    const appleUrl = `maps://?q=${label}&ll=${lat},${lon}`;
    const can = await Linking.canOpenURL(appleUrl);
    if (can) {
      Linking.openURL(appleUrl);
      return;
    }
  }
  Linking.openURL(
    `https://www.google.com/maps/search/petrol+pump+near+${lat},${lon}`,
  );
}

// ── Station Modal ─────────────────────────────────────────────────────────────
function StationModal({
  visible,
  city,
  cityData,
  fuelType,
  fromData,
  fromKey,
  toData,
  toKey,
  onClose,
}: any) {
  if (!city || !cityData) return null;
  const stations = getEstimatedStationsForCity(city, cityData, fuelType);
  const capName = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const isStop = city !== fromKey && city !== toKey;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={ms.wrapper}>
        <View style={ms.header}>
          <View>
            <Text style={ms.title}>⛽ Pumps in {capName(city)}</Text>
            <Text style={ms.sub}>
              Same-city mode · Distance 32.5% · Quality 34.8% · Amenities 32.7%
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
            <Text style={ms.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Route navigation button — shown for intermediate stops */}
        {isStop && fromData && toData && (
          <TouchableOpacity
            style={ms.routeNavBtn}
            onPress={() => {
              onClose();
              openRouteInMaps(
                fromData,
                capName(fromKey),
                cityData,
                capName(city),
                toData,
                capName(toKey),
              );
            }}
          >
            <Text style={ms.routeNavIcon}>🗺️</Text>
            <View style={{ flex: 1 }}>
              <Text style={ms.routeNavTitle}>
                Navigate: {capName(fromKey)} → {capName(city)} →{" "}
                {capName(toKey)}
              </Text>
              <Text style={ms.routeNavSub}>
                Opens Google Maps with fuel stop as waypoint
              </Text>
            </View>
            <Text style={ms.routeNavArrow}>›</Text>
          </TouchableOpacity>
        )}

        <ScrollView style={ms.scroll} showsVerticalScrollIndicator={false}>
          {stations.map((s: any, i: number) => (
            <View key={i} style={[ms.card, i === 0 && ms.cardBest]}>
              {i === 0 && (
                <View style={ms.bestBanner}>
                  <Text style={ms.bestBannerText}>
                    🏆 Best station in {capName(city)}
                  </Text>
                </View>
              )}
              <View style={ms.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={ms.stationName}>{s.name}</Text>
                  <Text style={ms.stationBrand}>{s.brand}</Text>
                  <Text style={ms.stationDist}>
                    {`${s.distance} km away · ⏱ ${s.waitMins} min wait · ⭐ ${s.rating}`}
                  </Text>
                  <View style={ms.tagRow}>
                    {s.hasAir && (
                      <View style={ms.tag}>
                        <Text style={ms.tagText}>🌬️ Air</Text>
                      </View>
                    )}
                    {s.hasATM && (
                      <View style={ms.tag}>
                        <Text style={ms.tagText}>🏧 ATM</Text>
                      </View>
                    )}
                    {s.hasRestroom && (
                      <View style={ms.tag}>
                        <Text style={ms.tagText}>🚻 WC</Text>
                      </View>
                    )}
                    {s.hasCarWash && (
                      <View style={ms.tag}>
                        <Text style={ms.tagText}>🚿 Wash</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[ms.scoreCircle, i === 0 && ms.scoreCircleBest]}>
                  <Text style={[ms.scoreVal, i === 0 && { color: "#fff" }]}>
                    {s.score}
                  </Text>
                  <Text
                    style={[ms.scoreLabel, i === 0 && { color: "#cce0ff" }]}
                  >
                    Score
                  </Text>
                </View>
              </View>

              {/* Score breakdown chips */}
              <View style={ms.breakdownRow}>
                <View style={[ms.chip, { backgroundColor: "#f0faf5" }]}>
                  <Text style={[ms.chipText, { color: "#00875a" }]}>
                    📍 Dist {s.distanceScore}
                  </Text>
                </View>
                <View style={[ms.chip, { backgroundColor: "#f4f1ff" }]}>
                  <Text style={[ms.chipText, { color: "#6200ea" }]}>
                    ⭐ Quality {s.qualityScore}
                  </Text>
                </View>
                <View style={[ms.chip, { backgroundColor: "#fff8e1" }]}>
                  <Text style={[ms.chipText, { color: "#856404" }]}>
                    ✅ Amenities {s.amenitiesScore}
                  </Text>
                </View>
              </View>

              <View style={ms.statsRow}>
                <View style={ms.stat}>
                  <Text style={ms.statVal}>{`₹${s.price.toFixed(2)}`}</Text>
                  <Text style={ms.statLbl}>Price/L</Text>
                </View>
                <View style={ms.statDiv} />
                <View style={ms.stat}>
                  <Text style={ms.statVal}>{`${s.distance} km`}</Text>
                  <Text style={ms.statLbl}>Distance</Text>
                </View>
                <View style={ms.statDiv} />
                <View style={ms.stat}>
                  <Text style={ms.statVal}>{`${s.waitMins} min`}</Text>
                  <Text style={ms.statLbl}>Wait Time</Text>
                </View>
              </View>

              {/* Navigate to this specific pump */}
              <TouchableOpacity
                style={ms.pumpNavBtn}
                onPress={() => openPumpsInMaps(cityData, s.name)}
              >
                <Text style={ms.pumpNavBtnText}>🧭 Find This Pump on Maps</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={ms.scoringNote}>
            <Text style={ms.scoringNoteText}>
              📊 Survey-validated weights (n=70, α=0.725) · Same-city mode: Est.
              quality (PPAC-anchored) · Price excluded (city-regulated) ·
              Distance 32.5% · Quality 34.8% · Amenities 32.7%
            </Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TravelPlannerPage() {
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [fuelType, setFuelType] = useState<"petrol" | "diesel">("petrol");
  const [mileage, setMileage] = useState("15");
  const [filterAmenity, setFilterAmenity] = useState<string[]>([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mlDayAdvice, setMlDayAdvice] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "route">("summary");
  const [mainTab, setMainTab] = useState<"planner" | "history">("planner");
  const [tripHistory, setTripHistory] = useState<TripRecord[]>([]);
  useEffect(() => {
    getUserProfile().then((p) => setMileage(String(p.mileageKmPerL)));
  }, []);
  const [stationModal, setStationModal] = useState<{
    city: string;
    data: CityData;
  } | null>(null);

  useEffect(() => {
    getTripHistory().then(setTripHistory);
  }, []);

  const dates = getNextDates(7);
  const capName = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const runMLAdvice = () => {
    const hist = getHistoricalData(fuelType, fromCity || "Chennai");
    const pred = predictFuelPrice(hist, fromCity || "Chennai", fuelType);
    if (!pred) return;
    const dayAdvice = pred.predictions.map((p: any, i: number) => ({
      dateIndex: i,
      dateLabel: dates[i]?.label || `Day ${i + 1}`,
      predictedPrice: p.price,
    }));
    const bestIndex = dayAdvice.reduce(
      (min: any, curr: any) =>
        curr.predictedPrice < min.predictedPrice ? curr : min,
      dayAdvice[0],
    );
    setMlDayAdvice({
      dayAdvice,
      bestIndex,
      trend: pred.trend,
      accuracy: pred.accuracy,
    });
  };

  const planTrip = async () => {
    const from = resolveCity(fromCity);
    const to = resolveCity(toCity);
    if (!from) {
      Alert.alert(
        "City Not Found",
        `"${fromCity}" not found. Try: Chennai, Mumbai, Delhi.`,
      );
      return;
    }
    if (!to) {
      Alert.alert(
        "City Not Found",
        `"${toCity}" not found. Try: Hyderabad, Bangalore, Pune.`,
      );
      return;
    }
    if (from.key === to.key) {
      Alert.alert("Same City", "Please enter different cities.");
      return;
    }

    setLoading(true);
    setResult(null);
    runMLAdvice();
    await new Promise((r) => setTimeout(r, 800));

    const routeCities = getCitiesAlongRoute(
      from.data.lat,
      from.data.lon,
      to.data.lat,
      to.data.lon,
    );
    const allCities = [
      { cityKey: from.key, data: from.data, distFromStart: 0, perpDistKm: 0 },
      ...routeCities.filter(
        (c) => c.cityKey !== from.key && c.cityKey !== to.key,
      ),
      {
        cityKey: to.key,
        data: to.data,
        distFromStart: haversine(
          from.data.lat,
          from.data.lon,
          to.data.lat,
          to.data.lon,
        ),
        perpDistKm: 0,
      },
    ];

    const straightLineKm = haversine(
      from.data.lat,
      from.data.lon,
      to.data.lat,
      to.data.lon,
    );
    // Apply 1.3x road correction factor (standard for Indian road networks)
    // Real road distance is typically 1.2–1.4× straight-line in India
    const totalKm = parseFloat((straightLineKm * 1.3).toFixed(1));
    const kmPerLitre = parseFloat(mileage) || 15;
    const litresNeeded = totalKm / kmPerLitre;
    const originPrice =
      fuelType === "petrol" ? from.data.petrol : from.data.diesel;
    const totalCostAtOrigin = litresNeeded * originPrice;

    // ── Cross-city scoring using survey-validated weights ──────────────────
    // Price 25% | Distance 24% | Quality 26% | Amenities 25%
    // Quality & Amenities estimated by averaging mock station scores per city
    const scoredCities = allCities.map((city) => {
      const stations = getEstimatedStationsForCity(
        city.cityKey,
        city.data,
        fuelType,
      );
      const avgQuality = Math.round(
        stations.reduce((s, st) => s + st.qualityScore, 0) / stations.length,
      );
      const avgAmenities = Math.round(
        stations.reduce((s, st) => s + st.amenitiesScore, 0) / stations.length,
      );
      const fuelPrice =
        fuelType === "petrol" ? city.data.petrol : city.data.diesel;
      return {
        ...city,
        fuelPrice,
        avgQualityScore: avgQuality,
        avgAmenitiesScore: avgAmenities,
      };
    });

    const cityInputsForNorm = scoredCities.map((c) => ({
      fuelPrice: c.fuelPrice,
      distFromOriginKm: c.distFromStart || 0,
    }));

    const rankedCities = scoredCities.map((city) => {
      const cityScoreResult = calculateCityScore(
        {
          fuelPrice: city.fuelPrice,
          distFromOriginKm: city.distFromStart || 0,
          avgQualityScore: city.avgQualityScore,
          avgAmenitiesScore: city.avgAmenitiesScore,
        },
        cityInputsForNorm,
      );
      return { ...city, cityScore: cityScoreResult };
    });

    // Best = highest composite score
    const bestScoredCity = rankedCities.reduce(
      (best, c) =>
        c.cityScore.finalScore > best.cityScore.finalScore ? c : best,
      rankedCities[0],
    );

    // Cheapest = lowest price (for savings calculation)
    const cheapestCity = rankedCities.reduce(
      (min, c) => (c.fuelPrice < min.fuelPrice ? c : min),
      rankedCities[0],
    );

    const cheapestPrice = cheapestCity.fuelPrice;
    const totalCostAtCheapest = litresNeeded * cheapestPrice;
    const savings = totalCostAtOrigin - totalCostAtCheapest;
    const borderCrossings = getStateBorderCrossings(rankedCities, fuelType);

    setResult({
      from,
      to,
      totalKm,
      litresNeeded,
      kmPerLitre,
      originPrice,
      totalCostAtOrigin,
      cheapestCity,
      cheapestPrice,
      totalCostAtCheapest,
      savings,
      allCities: rankedCities,
      bestScoredCity,
      fuelType,
      borderCrossings,
    });

    // Save to trip history
    const saved = await saveTripHistory({
      from: from.key,
      to: to.key,
      fuelType,
      totalKm,
      litresNeeded: parseFloat(litresNeeded.toFixed(2)),
      originPrice,
      totalCost: parseFloat(totalCostAtOrigin.toFixed(2)),
      bestCity: bestScoredCity.cityKey,
      savings: parseFloat(savings.toFixed(2)),
    });
    if (saved) setTripHistory((prev) => [saved, ...prev].slice(0, 20));

    setLoading(false);
    setActiveTab("summary");
  };

  const amenityOptions = ["🌬️ Air", "🚻 Restroom", "🏧 ATM", "🚿 Car Wash"];
  const toggleAmenity = (a: string) =>
    setFilterAmenity((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );

  return (
    <View style={styles.wrapper}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🛣️ Trip Fuel Planner</Text>
          <Text style={styles.headerSubtitle}>
            Find cheapest fuel cities along your route
          </Text>
        </View>
        {/* ── Main Tab: Planner / History ── */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 4,
            backgroundColor: "#fff",
            borderRadius: 14,
            padding: 4,
            elevation: 2,
          }}
        >
          {(["planner", "history"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setMainTab(tab)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  mainTab === tab
                    ? tab === "history"
                      ? "#e65100"
                      : "#0066cc"
                    : "transparent",
              }}
            >
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 13,
                  color: mainTab === tab ? "#fff" : "#888",
                }}
              >
                {tab === "planner"
                  ? "🛣️ Plan Trip"
                  : `🕐 History (${tripHistory.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* ── Trip History Tab ── */}
        {mainTab === "history" && (
          <View style={{ padding: 16 }}>
            {tripHistory.length === 0 ? (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 30,
                  alignItems: "center",
                  elevation: 2,
                }}
              >
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🛣️</Text>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#555" }}
                >
                  No trips yet
                </Text>
                <Text style={{ fontSize: 13, color: "#999", marginTop: 5 }}>
                  Plan a trip and it will appear here
                </Text>
              </View>
            ) : (
              <>
                {tripHistory.map((trip, i) => {
                  const date = new Date(trip.date);
                  const dateStr = date.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <View
                      key={trip.id}
                      style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                        elevation: 3,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                      }}
                    >
                      {/* Route header */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 10,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "800",
                              color: "#1a1a2e",
                            }}
                          >
                            {trip.from.charAt(0).toUpperCase() +
                              trip.from.slice(1)}{" "}
                            →{" "}
                            {trip.to.charAt(0).toUpperCase() + trip.to.slice(1)}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#888",
                              marginTop: 2,
                            }}
                          >
                            {dateStr} · {trip.fuelType.toUpperCase()}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: "#f0f4ff",
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: "#0066cc",
                            }}
                          >
                            {trip.totalKm} km
                          </Text>
                        </View>
                      </View>

                      {/* Stats row */}
                      <View
                        style={{
                          flexDirection: "row",
                          backgroundColor: "#f8faff",
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        <View style={{ flex: 1, alignItems: "center" }}>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: "#1a1a2e",
                            }}
                          >
                            ₹{trip.totalCost.toFixed(0)}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#888",
                              marginTop: 2,
                            }}
                          >
                            Total Cost
                          </Text>
                        </View>
                        <View
                          style={{ width: 1, backgroundColor: "#e0e0e0" }}
                        />
                        <View style={{ flex: 1, alignItems: "center" }}>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: "#1a1a2e",
                            }}
                          >
                            {trip.litresNeeded.toFixed(1)} L
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#888",
                              marginTop: 2,
                            }}
                          >
                            Fuel Needed
                          </Text>
                        </View>
                        <View
                          style={{ width: 1, backgroundColor: "#e0e0e0" }}
                        />
                        <View style={{ flex: 1, alignItems: "center" }}>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: "#1a1a2e",
                            }}
                          >
                            ₹{trip.originPrice.toFixed(2)}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#888",
                              marginTop: 2,
                            }}
                          >
                            Price/L
                          </Text>
                        </View>
                      </View>

                      {/* Best city + savings */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 12, color: "#555" }}>
                          🏆 Best stop:{" "}
                          <Text style={{ fontWeight: "700", color: "#00875a" }}>
                            {trip.bestCity.charAt(0).toUpperCase() +
                              trip.bestCity.slice(1)}
                          </Text>
                        </Text>
                        {trip.savings > 1 && (
                          <View
                            style={{
                              backgroundColor: "#e8f5ed",
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: "#00875a",
                              }}
                            >
                              💰 Saved ₹{trip.savings.toFixed(0)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Clear history button */}
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Clear History", "Delete all trip history?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: async () => {
                          await clearTripHistory();
                          setTripHistory([]);
                        },
                      },
                    ])
                  }
                  style={{
                    backgroundColor: "#fee2e2",
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "#cc0000",
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    🗑️ Clear All History
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        {/* ── Planner Tab ── */}
        {mainTab === "planner" && (
          <View style={styles.body}>
            {/* Route Input */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📍 Your Route</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🟢</Text>
                <TextInput
                  style={styles.input}
                  placeholder="From city (e.g. Chennai)"
                  placeholderTextColor="#aaa"
                  value={fromCity}
                  onChangeText={setFromCity}
                />
              </View>
              <View style={styles.routeLine} />
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔴</Text>
                <TextInput
                  style={styles.input}
                  placeholder="To city (e.g. Bangalore)"
                  placeholderTextColor="#aaa"
                  value={toCity}
                  onChangeText={setToCity}
                />
              </View>
            </View>

            {/* Travel Date */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📅 Travel Date</Text>
              <Text style={styles.cardSubtitle}>
                ML model predicts which day has cheaper fuel
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
              >
                {dates.map((d) => (
                  <TouchableOpacity
                    key={d.index}
                    style={[
                      styles.dateChip,
                      selectedDateIndex === d.index && styles.dateChipActive,
                      mlDayAdvice?.bestIndex?.dateIndex === d.index &&
                        styles.dateChipBest,
                    ]}
                    onPress={() => setSelectedDateIndex(d.index)}
                  >
                    {mlDayAdvice?.bestIndex?.dateIndex === d.index && (
                      <Text style={styles.bestDayBadge}>🏆 Best</Text>
                    )}
                    <Text
                      style={[
                        styles.dateChipText,
                        selectedDateIndex === d.index &&
                          styles.dateChipTextActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                    {mlDayAdvice && (
                      <Text
                        style={[
                          styles.dateChipPrice,
                          {
                            color:
                              mlDayAdvice.dayAdvice[d.index]?.predictedPrice <=
                              mlDayAdvice.dayAdvice[0]?.predictedPrice
                                ? "#00875a"
                                : "#cc0000",
                          },
                        ]}
                      >
                        ₹{mlDayAdvice.dayAdvice[d.index]?.predictedPrice}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {mlDayAdvice ? (
                <View style={styles.mlBanner}>
                  <Text style={styles.mlBannerText}>
                    {`🤖 ML (${mlDayAdvice.accuracy}% accuracy) · ${mlDayAdvice.trend === "increasing" ? "📈 Rising" : "📉 Falling"} · Best day: `}
                    <Text style={{ fontWeight: "bold", color: "#00875a" }}>
                      {mlDayAdvice.bestIndex.dateLabel}
                    </Text>
                    {` @ ₹${mlDayAdvice.bestIndex.predictedPrice}`}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.mlRunBtn} onPress={runMLAdvice}>
                  <Text style={styles.mlRunBtnText}>
                    🤖 Run ML Price Forecast
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Fuel & Mileage */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⛽ Fuel & Vehicle</Text>
              <View style={styles.toggleRow}>
                {["petrol", "diesel"].map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.toggleBtn,
                      fuelType === f && styles.toggleActive,
                    ]}
                    onPress={() => setFuelType(f as any)}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        fuelType === f && styles.toggleTextActive,
                      ]}
                    >
                      {f === "petrol" ? "🟢 Petrol" : "🔵 Diesel"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.mileageRow}>
                <Text style={styles.mileageLabel}>Vehicle Mileage (km/L)</Text>
                <TextInput
                  style={styles.mileageInput}
                  value={mileage}
                  onChangeText={setMileage}
                  keyboardType="numeric"
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>

            {/* Amenities */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>✅ Required Amenities</Text>
              <Text style={styles.cardSubtitle}>
                Filter route pumps that have:
              </Text>
              <View style={styles.amenityRow}>
                {amenityOptions.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[
                      styles.amenityChip,
                      filterAmenity.includes(a) && styles.amenityChipActive,
                    ]}
                    onPress={() => toggleAmenity(a)}
                  >
                    <Text
                      style={[
                        styles.amenityChipText,
                        filterAmenity.includes(a) &&
                          styles.amenityChipTextActive,
                      ]}
                    >
                      {a}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Plan Button */}
            <TouchableOpacity
              style={[styles.planBtn, loading && { opacity: 0.7 }]}
              onPress={planTrip}
              disabled={loading}
            >
              <Text style={styles.planBtnText}>
                {loading ? "⏳ Calculating Route..." : "🛣️ Plan My Trip"}
              </Text>
            </TouchableOpacity>

            {/* ── RESULTS ── */}
            {result && (
              <>
                {/* Fuel Stop Recommendation Card */}
                <View style={styles.fuelStopCard}>
                  <Text style={styles.fuelStopTitle}>
                    🎯 Fuel Stop Recommendation
                  </Text>
                  <Text style={styles.fuelStopMain}>
                    {result.savings > 1
                      ? `Fill up in ${capName(result.cheapestCity.cityKey)}`
                      : `Fill up at origin — prices are similar`}
                  </Text>
                  {result.savings > 1 && (
                    <>
                      <View style={styles.fuelStopRow}>
                        <View style={styles.fuelStopItem}>
                          <Text style={styles.fuelStopLabel}>
                            Best City Price
                          </Text>
                          <Text
                            style={styles.fuelStopValue}
                          >{`₹${result.cheapestCity.fuelPrice.toFixed(2)}/L`}</Text>
                        </View>
                        <View style={styles.fuelStopArrow}>
                          <Text style={styles.fuelStopArrowText}>vs</Text>
                        </View>
                        <View style={styles.fuelStopItem}>
                          <Text style={styles.fuelStopLabel}>Origin Price</Text>
                          <Text
                            style={[styles.fuelStopValue, { color: "#ff6b6b" }]}
                          >{`₹${result.originPrice.toFixed(2)}/L`}</Text>
                        </View>
                      </View>
                      <View style={styles.fuelStopSavings}>
                        <Text
                          style={styles.fuelStopSavingsText}
                        >{`💰 Save ₹${result.savings.toFixed(0)} vs filling up at ${capName(result.from.key)}`}</Text>
                      </View>
                      {/* Full route navigation button */}
                      <TouchableOpacity
                        style={styles.fullRouteBtn}
                        onPress={() =>
                          openRouteInMaps(
                            result.from.data,
                            capName(result.from.key),
                            result.cheapestCity.data,
                            capName(result.cheapestCity.cityKey),
                            result.to.data,
                            capName(result.to.key),
                          )
                        }
                      >
                        <Text style={styles.fullRouteBtnText}>
                          🗺️ Navigate: {capName(result.from.key)} →{" "}
                          {capName(result.cheapestCity.cityKey)} →{" "}
                          {capName(result.to.key)}
                        </Text>
                        <Text style={styles.fullRouteBtnSub}>
                          Opens Google Maps with fuel stop as waypoint
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {/* Direct route button when prices are similar */}
                  {result.savings <= 1 && (
                    <TouchableOpacity
                      style={styles.fullRouteBtn}
                      onPress={() => {
                        const origin = `${result.from.data.lat},${result.from.data.lon}`;
                        const dest = `${result.to.data.lat},${result.to.data.lon}`;
                        Linking.openURL(
                          `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`,
                        );
                      }}
                    >
                      <Text style={styles.fullRouteBtnText}>
                        🗺️ Navigate: {capName(result.from.key)} →{" "}
                        {capName(result.to.key)}
                      </Text>
                      <Text style={styles.fullRouteBtnSub}>
                        Direct route — no fuel stop needed
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tab Bar */}
                <View style={styles.tabBar}>
                  {(["summary", "route"] as const).map((tab) => (
                    <TouchableOpacity
                      key={tab}
                      style={[
                        styles.tabBtn,
                        activeTab === tab && styles.tabBtnActive,
                      ]}
                      onPress={() => setActiveTab(tab)}
                    >
                      <Text
                        style={[
                          styles.tabBtnText,
                          activeTab === tab && styles.tabBtnTextActive,
                        ]}
                      >
                        {tab === "summary" ? "📊 Summary" : "🗺️ Route"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ── SUMMARY TAB ── */}
                {activeTab === "summary" && (
                  <>
                    <View
                      style={[
                        styles.card,
                        { borderWidth: 1.5, borderColor: "#e65100" },
                      ]}
                    >
                      <Text style={styles.cardTitle}>📊 Trip Summary</Text>
                      <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryValue}>
                            {result.totalKm} km
                          </Text>
                          <Text style={styles.summaryLabel}>
                            Est. Road Distance
                          </Text>
                          <Text
                            style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}
                          >
                            1.3× road correction
                          </Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryValue}>
                            {result.litresNeeded.toFixed(1)} L
                          </Text>
                          <Text style={styles.summaryLabel}>Fuel Needed</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryValue}>
                            {result.kmPerLitre} km/L
                          </Text>
                          <Text style={styles.summaryLabel}>Mileage</Text>
                        </View>
                      </View>

                      <Text style={styles.costSectionTitle}>
                        💸 Total Trip Cost Comparison
                      </Text>
                      {result.savings <= 1 ? (
                        <View
                          style={{
                            backgroundColor: "#e8f5ed",
                            borderRadius: 12,
                            padding: 16,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 22 }}>✅</Text>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "800",
                              color: "#00875a",
                              marginTop: 6,
                            }}
                          >
                            Prices are similar across route
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#555",
                              marginTop: 4,
                              textAlign: "center",
                            }}
                          >
                            {`${capName(result.from.key)} ₹${result.originPrice.toFixed(2)}/L  ·  ${capName(result.cheapestCity.cityKey)} ₹${result.cheapestCity.fuelPrice.toFixed(2)}/L`}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#888",
                              marginTop: 4,
                            }}
                          >
                            Fill up at origin before departure
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.costCompareBlock}>
                            <View style={styles.costColumn}>
                              <Text style={styles.costColCity}>
                                {capName(result.from.key)}
                              </Text>
                              <Text style={styles.costColState}>
                                {result.from.data.state}
                              </Text>
                              <Text
                                style={styles.costColPrice}
                              >{`₹${result.originPrice.toFixed(2)}/L`}</Text>
                              <View style={styles.costColTotalBox}>
                                <Text style={styles.costColTotalLabel}>
                                  Total Cost
                                </Text>
                                <Text
                                  style={styles.costColTotal}
                                >{`₹${result.totalCostAtOrigin.toFixed(0)}`}</Text>
                              </View>
                            </View>
                            <View style={styles.costVsCol}>
                              <Text style={styles.costVsText}>VS</Text>
                              {result.savings > 1 && (
                                <View style={styles.costSaveChip}>
                                  <Text
                                    style={styles.costSaveChipText}
                                  >{`Save\n₹${result.savings.toFixed(0)}`}</Text>
                                </View>
                              )}
                            </View>
                            <View
                              style={[styles.costColumn, styles.costColumnBest]}
                            >
                              <Text
                                style={[
                                  styles.costColCity,
                                  { color: "#00875a" },
                                ]}
                              >
                                {capName(result.cheapestCity.cityKey)} 🏆
                              </Text>
                              <Text style={styles.costColState}>
                                {result.cheapestCity.data.state}
                              </Text>
                              <Text
                                style={[
                                  styles.costColPrice,
                                  { color: "#00875a" },
                                ]}
                              >{`₹${result.cheapestCity.fuelPrice.toFixed(2)}/L`}</Text>
                              <View
                                style={[
                                  styles.costColTotalBox,
                                  { backgroundColor: "#e8f5ed" },
                                ]}
                              >
                                <Text style={styles.costColTotalLabel}>
                                  Total Cost
                                </Text>
                                <Text
                                  style={[
                                    styles.costColTotal,
                                    { color: "#00875a" },
                                  ]}
                                >{`₹${result.totalCostAtCheapest.toFixed(0)}`}</Text>
                              </View>
                            </View>
                          </View>
                          {result.totalCostAtOrigin -
                            result.cheapestCity.fuelPrice *
                              result.litresNeeded >
                            0.5 && (
                            <View style={styles.savingsBanner}>
                              <Text
                                style={styles.savingsText}
                              >{`💰 Fill up in ${capName(result.cheapestCity.cityKey)} — save ₹${result.savings.toFixed(0)} vs origin!`}</Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>

                    {/* Scoring model info */}
                    <View style={styles.scoringCard}>
                      <Text style={styles.scoringCardTitle}>
                        📐 Scoring Model (Cross-City)
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        n=70 responses · Google Forms · March 2026 · Cronbach
                        {"'"}s {"\u03B1"}=0.725
                      </Text>
                      <View style={styles.scoringWeights}>
                        {[
                          { label: "💰 Price", pct: "25.7%", color: "#00875a" },
                          {
                            label: "📍 Distance",
                            pct: "24.2%",
                            color: "#0066cc",
                          },
                          {
                            label: "⭐ Quality",
                            pct: "25.8%",
                            color: "#6200ea",
                          },
                          {
                            label: "✅ Amenities",
                            pct: "24.3%",
                            color: "#e65100",
                          },
                        ].map((w) => (
                          <View key={w.label} style={styles.weightChip}>
                            <Text
                              style={[styles.weightPct, { color: w.color }]}
                            >
                              {w.pct}
                            </Text>
                            <Text style={styles.weightLabel}>{w.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* State border crossings */}
                    {result.borderCrossings &&
                      result.borderCrossings.length > 0 && (
                        <View style={styles.card}>
                          <Text style={styles.cardTitle}>
                            🚧 State Border Price Changes
                          </Text>
                          <Text style={styles.cardSubtitle}>
                            Price change per litre at each state crossing
                          </Text>
                          {result.borderCrossings.map(
                            (crossing: any, i: number) => (
                              <View key={i} style={styles.borderCrossingCard}>
                                <View style={styles.borderCrossingLeft}>
                                  <Text
                                    style={styles.borderCrossingStates}
                                  >{`${crossing.fromState} → ${crossing.toState}`}</Text>
                                  <Text
                                    style={styles.borderCrossingCities}
                                  >{`${capName(crossing.fromCity)} → ${capName(crossing.toCity)}`}</Text>
                                </View>
                                <View
                                  style={[
                                    styles.borderCrossingBadge,
                                    {
                                      backgroundColor:
                                        crossing.priceDiff > 0
                                          ? "#ffeded"
                                          : "#e8f5ed",
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.borderCrossingDiff,
                                      {
                                        color:
                                          crossing.priceDiff > 0
                                            ? "#cc0000"
                                            : "#00875a",
                                      },
                                    ]}
                                  >
                                    {crossing.priceDiff > 0
                                      ? `+₹${crossing.priceDiff.toFixed(2)}`
                                      : `-₹${Math.abs(crossing.priceDiff).toFixed(2)}`}
                                  </Text>
                                  <Text style={styles.borderCrossingPerL}>
                                    /litre
                                  </Text>
                                </View>
                              </View>
                            ),
                          )}
                        </View>
                      )}

                    {/* ML Date advice */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>
                        📅 Selected Travel Date
                      </Text>
                      <View style={styles.selectedDateBox}>
                        <Text style={styles.selectedDateLabel}>
                          {dates[selectedDateIndex]?.full}
                        </Text>
                        {mlDayAdvice && (
                          <Text style={styles.selectedDatePrice}>
                            {`Predicted ${result.fuelType} price: ₹${mlDayAdvice.dayAdvice[selectedDateIndex]?.predictedPrice}`}
                            {selectedDateIndex ===
                            mlDayAdvice.bestIndex.dateIndex
                              ? "  ✅ Best day to travel!"
                              : `\n⚠️ Travel on ${mlDayAdvice.bestIndex.dateLabel} to save ₹${((mlDayAdvice.dayAdvice[selectedDateIndex]?.predictedPrice - mlDayAdvice.bestIndex.predictedPrice) * result.litresNeeded).toFixed(0)}`}
                          </Text>
                        )}
                      </View>
                    </View>
                  </>
                )}

                {/* ── ROUTE TAB ── */}
                {activeTab === "route" && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>🗺️ Route Timeline</Text>
                    <Text style={styles.cardSubtitle}>
                      Approximate route · Cities near path (1.3× road
                      correction) · Navigation uses real roads
                    </Text>
                    <View style={styles.timeline}>
                      {result.allCities.map((city: any, idx: number) => {
                        const price =
                          result.fuelType === "petrol"
                            ? city.data.petrol
                            : city.data.diesel;
                        const isBest =
                          city.cityKey === result.cheapestCity.cityKey;
                        const isEstimated = !city.data?.hasRealStations;
                        const isOrigin = city.cityKey === result.from.key;
                        const isDest = city.cityKey === result.to.key;
                        const isLast = idx === result.allCities.length - 1;
                        const prevCity =
                          idx > 0 ? result.allCities[idx - 1] : null;
                        const hasBorderBefore =
                          prevCity && prevCity.data.state !== city.data.state;
                        const borderDiff = hasBorderBefore
                          ? price -
                            (result.fuelType === "petrol"
                              ? prevCity.data.petrol
                              : prevCity.data.diesel)
                          : 0;
                        const prevPrice = prevCity
                          ? result.fuelType === "petrol"
                            ? prevCity.data.petrol
                            : prevCity.data.diesel
                          : null;
                        const priceDir =
                          prevPrice === null
                            ? null
                            : price > prevPrice
                              ? "up"
                              : price < prevPrice
                                ? "down"
                                : "same";
                        const score = city.cityScore;

                        return (
                          <View key={city.cityKey}>
                            {/* State border line */}
                            {hasBorderBefore && (
                              <View style={styles.borderLine}>
                                <View style={styles.borderLineDash} />
                                <View style={styles.borderLineLabel}>
                                  <Text
                                    style={styles.borderLineLabelText}
                                  >{`🚧 ${prevCity.data.state} → ${city.data.state}`}</Text>
                                  <Text
                                    style={[
                                      styles.borderLinePriceDiff,
                                      {
                                        color:
                                          borderDiff > 0
                                            ? "#cc0000"
                                            : "#00875a",
                                      },
                                    ]}
                                  >
                                    {borderDiff > 0
                                      ? `▲ ₹${borderDiff.toFixed(2)}/L`
                                      : `▼ ₹${Math.abs(borderDiff).toFixed(2)}/L`}
                                  </Text>
                                </View>
                                <View style={styles.borderLineDash} />
                              </View>
                            )}

                            <View style={styles.timelineRow}>
                              {/* Left: dot + connector */}
                              <View style={styles.timelineLeft}>
                                <View
                                  style={[
                                    styles.timelineDot,
                                    isOrigin && styles.timelineDotOrigin,
                                    isDest && styles.timelineDotDest,
                                    isBest &&
                                      !isOrigin &&
                                      !isDest &&
                                      styles.timelineDotBest,
                                  ]}
                                />
                                {!isLast && (
                                  <View
                                    style={[
                                      styles.timelineConnector,
                                      hasBorderBefore &&
                                        styles.timelineConnectorDashed,
                                    ]}
                                  />
                                )}
                              </View>

                              {/* Right: city card */}
                              <View
                                style={[
                                  styles.timelineContent,
                                  isBest && styles.timelineContentBest,
                                ]}
                              >
                                {/* City name + badges */}
                                <View style={styles.timelineTop}>
                                  <View style={{ flex: 1 }}>
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 5,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <Text style={styles.timelineCity}>
                                        {capName(city.cityKey)}
                                      </Text>
                                      {isBest && (
                                        <View style={styles.bestBadge}>
                                          <Text style={styles.bestBadgeText}>
                                            🏆 Best Value
                                          </Text>
                                        </View>
                                      )}
                                      {isOrigin && (
                                        <View style={styles.tagBadge}>
                                          <Text style={styles.tagBadgeText}>
                                            Start
                                          </Text>
                                        </View>
                                      )}
                                      {isDest && (
                                        <View
                                          style={[
                                            styles.tagBadge,
                                            { backgroundColor: "#ffeded" },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.tagBadgeText,
                                              { color: "#cc0000" },
                                            ]}
                                          >
                                            End
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                    <Text style={styles.timelineState}>
                                      {city.data.state}
                                    </Text>
                                  </View>
                                  {/* Price + direction */}
                                  <View style={styles.timelinePriceBlock}>
                                    <Text
                                      style={[
                                        styles.timelinePrice,
                                        { color: isBest ? "#00875a" : "#333" },
                                      ]}
                                    >
                                      {`₹${price.toFixed(2)}`}
                                    </Text>
                                    {priceDir === "up" && (
                                      <Text style={styles.priceArrowUp}>▲</Text>
                                    )}
                                    {priceDir === "down" && (
                                      <Text style={styles.priceArrowDown}>
                                        ▼
                                      </Text>
                                    )}
                                    {priceDir === "same" && (
                                      <Text style={styles.priceArrowSame}>
                                        —
                                      </Text>
                                    )}
                                  </View>
                                </View>

                                {/* Score chips — cross-city mode */}
                                {score && (
                                  <View style={styles.scoreChipRow}>
                                    <View
                                      style={[
                                        styles.scoreChip,
                                        { backgroundColor: "#e8f5ed" },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.scoreChipText,
                                          { color: "#00875a" },
                                        ]}
                                      >
                                        💰 {score.priceScore}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.scoreChip,
                                        { backgroundColor: "#e8f0fe" },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.scoreChipText,
                                          { color: "#0066cc" },
                                        ]}
                                      >
                                        📍 {score.distanceScore}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.scoreChip,
                                        { backgroundColor: "#f4f1ff" },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.scoreChipText,
                                          { color: "#6200ea" },
                                        ]}
                                      >
                                        ⭐ {score.qualityScore}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.scoreChip,
                                        { backgroundColor: "#fff8e1" },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.scoreChipText,
                                          { color: "#856404" },
                                        ]}
                                      >
                                        ✅ {score.amenitiesScore}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.scoreChip,
                                        { backgroundColor: "#1a1a2e" },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.scoreChipText,
                                          { color: "#fff", fontWeight: "bold" },
                                        ]}
                                      >
                                        = {score.finalScore}
                                      </Text>
                                    </View>
                                  </View>
                                )}

                                <Text
                                  style={styles.timelineBothPrices}
                                >{`⛽ P: ₹${city.data.petrol} · D: ₹${city.data.diesel}`}</Text>

                                {/* Action buttons */}
                                <View style={styles.actionRow}>
                                  {/* View Pumps */}
                                  <TouchableOpacity
                                    style={styles.viewPumpsBtn}
                                    onPress={() =>
                                      setStationModal({
                                        city: city.cityKey,
                                        data: city.data,
                                      })
                                    }
                                  >
                                    <Text style={styles.viewPumpsBtnText}>
                                      🔍 Pumps
                                    </Text>
                                  </TouchableOpacity>

                                  {/* Navigate via this city — only for intermediate stops */}
                                  {!isOrigin && !isDest && (
                                    <TouchableOpacity
                                      style={styles.navViaBtn}
                                      onPress={() =>
                                        openRouteInMaps(
                                          result.from.data,
                                          capName(result.from.key),
                                          city.data,
                                          capName(city.cityKey),
                                          result.to.data,
                                          capName(result.to.key),
                                        )
                                      }
                                    >
                                      <Text style={styles.navViaBtnText}>
                                        🗺️ Route via here
                                      </Text>
                                    </TouchableOpacity>
                                  )}

                                  {/* For origin: navigate full trip */}
                                  {isOrigin && (
                                    <TouchableOpacity
                                      style={styles.navViaBtn}
                                      onPress={() => {
                                        const origin = `${result.from.data.lat},${result.from.data.lon}`;
                                        const dest = `${result.to.data.lat},${result.to.data.lon}`;
                                        Linking.openURL(
                                          `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`,
                                        );
                                      }}
                                    >
                                      <Text style={styles.navViaBtnText}>
                                        🗺️ Full Route
                                      </Text>
                                    </TouchableOpacity>
                                  )}

                                  {/* For destination: navigate directly there */}
                                  {isDest && (
                                    <TouchableOpacity
                                      style={styles.navViaBtn}
                                      onPress={() => {
                                        const origin = `${result.from.data.lat},${result.from.data.lon}`;
                                        const dest = `${result.to.data.lat},${result.to.data.lon}`;
                                        Linking.openURL(
                                          `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`,
                                        );
                                      }}
                                    >
                                      <Text style={styles.navViaBtnText}>
                                        🗺️ Navigate Here
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
        {/* end mainTab === planner */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Station Modal */}
      <StationModal
        visible={stationModal !== null}
        city={stationModal?.city}
        cityData={stationModal?.data}
        fuelType={fuelType}
        fromData={result?.from?.data}
        fromKey={result?.from?.key}
        toData={result?.to?.data}
        toKey={result?.to?.key}
        onClose={() => setStationModal(null)}
      />
    </View>
  );
}

// ── Modal Styles ───────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f0f4f8" },
  header: {
    backgroundColor: "#0066cc",
    padding: 20,
    paddingTop: 28,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  sub: { fontSize: 10, color: "#cce0ff", marginTop: 3 },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  routeNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e65100",
    margin: 12,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  routeNavIcon: { fontSize: 22 },
  routeNavTitle: { fontSize: 13, fontWeight: "bold", color: "#fff" },
  routeNavSub: { fontSize: 11, color: "#ffccbc", marginTop: 2 },
  routeNavArrow: { fontSize: 22, color: "#fff", fontWeight: "bold" },
  scroll: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  cardBest: { borderWidth: 2, borderColor: "#0066cc" },
  bestBanner: {
    backgroundColor: "#e8f0fe",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  bestBannerText: { fontSize: 12, fontWeight: "bold", color: "#0066cc" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  stationName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 2,
  },
  stationBrand: { fontSize: 12, color: "#0066cc", marginBottom: 2 },
  stationDist: { fontSize: 11, color: "#888", marginBottom: 6 },
  tagRow: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  tag: {
    backgroundColor: "#f0f4ff",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: { fontSize: 10, color: "#0066cc", fontWeight: "600" },
  scoreCircle: {
    backgroundColor: "#e8f0fe",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  scoreCircleBest: { backgroundColor: "#0066cc" },
  scoreVal: { fontSize: 18, fontWeight: "bold", color: "#0066cc" },
  scoreLabel: { fontSize: 9, color: "#888" },
  breakdownRow: {
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 10, fontWeight: "700" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#f8faff",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  stat: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 13, fontWeight: "bold", color: "#1a1a2e" },
  statLbl: { fontSize: 9, color: "#888", marginTop: 2 },
  statDiv: { width: 1, backgroundColor: "#e0e0e0" },
  pumpNavBtn: {
    backgroundColor: "#0066cc",
    borderRadius: 10,
    padding: 11,
    alignItems: "center",
  },
  pumpNavBtnText: { fontSize: 13, color: "#fff", fontWeight: "bold" },
  scoringNote: {
    backgroundColor: "#f4f1ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#6200ea",
  },
  scoringNoteText: { fontSize: 10, color: "#5c35a8", lineHeight: 16 },
});

// ── Main Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f0f4f8" },
  header: {
    backgroundColor: "#e65100",
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
  headerSubtitle: { fontSize: 12, color: "#ffccbc" },
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
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 6,
  },
  cardSubtitle: { fontSize: 11, color: "#888", marginBottom: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fb",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e8eaf0",
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: "#333" },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: "#ddd",
    marginLeft: 22,
    marginBottom: 6,
  },
  dateChip: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: "center",
    minWidth: 80,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dateChipActive: { backgroundColor: "#e65100", borderColor: "#e65100" },
  dateChipBest: { borderColor: "#00875a", borderWidth: 2 },
  dateChipText: { fontSize: 12, fontWeight: "600", color: "#555" },
  dateChipTextActive: { color: "#fff" },
  dateChipPrice: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  bestDayBadge: {
    fontSize: 9,
    color: "#00875a",
    fontWeight: "bold",
    marginBottom: 2,
  },
  mlBanner: {
    backgroundColor: "#f3e5f5",
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#6200ea",
  },
  mlBannerText: { fontSize: 11, color: "#5c35a8", lineHeight: 17 },
  mlRunBtn: {
    backgroundColor: "#6200ea",
    borderRadius: 10,
    padding: 11,
    alignItems: "center",
  },
  mlRunBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleActive: { backgroundColor: "#e65100" },
  toggleText: { fontWeight: "700", color: "#888", fontSize: 13 },
  toggleTextActive: { color: "#fff" },
  mileageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f9fb",
    borderRadius: 12,
    padding: 12,
  },
  mileageLabel: { fontSize: 13, color: "#555", fontWeight: "600" },
  mileageInput: {
    width: 70,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
    color: "#e65100",
    borderWidth: 1.5,
    borderColor: "#e65100",
  },
  amenityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenityChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ccc",
    backgroundColor: "#f9f9f9",
  },
  amenityChipActive: { backgroundColor: "#e65100", borderColor: "#e65100" },
  amenityChipText: { fontSize: 12, color: "#666", fontWeight: "600" },
  amenityChipTextActive: { color: "#fff" },
  planBtn: {
    backgroundColor: "#e65100",
    borderRadius: 16,
    padding: 17,
    alignItems: "center",
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#e65100",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  planBtnText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
  fuelStopCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
  },
  fuelStopTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#a8c8ff",
    marginBottom: 6,
  },
  fuelStopMain: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 14,
  },
  fuelStopRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  fuelStopItem: { flex: 1, alignItems: "center" },
  fuelStopLabel: { fontSize: 11, color: "#aaa", marginBottom: 4 },
  fuelStopValue: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  fuelStopArrow: { width: 36, alignItems: "center" },
  fuelStopArrowText: { fontSize: 12, color: "#666", fontWeight: "bold" },
  fuelStopSavings: {
    backgroundColor: "#00875a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  fuelStopSavingsText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  fullRouteBtn: {
    backgroundColor: "#e65100",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  fullRouteBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  fullRouteBtnSub: { fontSize: 10, color: "#ffccbc", marginTop: 4 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: "#e65100" },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#888" },
  tabBtnTextActive: { color: "#fff" },
  costSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
    marginBottom: 10,
    marginTop: 4,
  },
  costCompareBlock: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
    marginBottom: 12,
  },
  costColumn: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  costColumnBest: {
    backgroundColor: "#f0faf5",
    borderWidth: 2,
    borderColor: "#00875a",
  },
  costColCity: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a2e",
    textAlign: "center",
    marginBottom: 2,
  },
  costColState: {
    fontSize: 10,
    color: "#888",
    marginBottom: 8,
    textAlign: "center",
  },
  costColPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  costColTotalBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    width: "100%",
  },
  costColTotalLabel: { fontSize: 9, color: "#888", marginBottom: 2 },
  costColTotal: { fontSize: 20, fontWeight: "bold", color: "#e65100" },
  costVsCol: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  costVsText: { fontSize: 12, fontWeight: "bold", color: "#888" },
  costSaveChip: {
    backgroundColor: "#00875a",
    borderRadius: 8,
    padding: 6,
    alignItems: "center",
  },
  costSaveChipText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    backgroundColor: "#fff8f5",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "bold", color: "#e65100" },
  summaryLabel: { fontSize: 10, color: "#888", marginTop: 3 },
  summaryDivider: { width: 1, backgroundColor: "#ffd0bb" },
  savingsBanner: {
    backgroundColor: "#e8f5ed",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#00875a",
  },
  savingsText: { fontSize: 14, fontWeight: "bold", color: "#00875a" },
  scoringCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  scoringCardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  scoringCardSub: { fontSize: 11, color: "#aaa", marginBottom: 12 },
  scoringWeights: { flexDirection: "row", justifyContent: "space-around" },
  weightChip: { alignItems: "center" },
  weightPct: { fontSize: 18, fontWeight: "bold" },
  weightLabel: { fontSize: 10, color: "#aaa", marginTop: 2 },
  selectedDateBox: {
    backgroundColor: "#fff8f5",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#e65100",
  },
  selectedDateLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#e65100",
    marginBottom: 6,
  },
  selectedDatePrice: { fontSize: 13, color: "#555", lineHeight: 20 },
  borderCrossingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8e1",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#ffc107",
  },
  borderCrossingLeft: { flex: 1 },
  borderCrossingStates: { fontSize: 13, fontWeight: "bold", color: "#1a1a2e" },
  borderCrossingCities: { fontSize: 11, color: "#888", marginTop: 2 },
  borderCrossingBadge: {
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    minWidth: 70,
  },
  borderCrossingDiff: { fontSize: 16, fontWeight: "bold" },
  borderCrossingPerL: { fontSize: 9, color: "#888", marginTop: 1 },
  timeline: { paddingLeft: 8 },
  timelineRow: { flexDirection: "row", marginBottom: 0 },
  timelineLeft: { width: 28, alignItems: "center" },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#aaa",
    marginTop: 16,
  },
  timelineDotOrigin: {
    backgroundColor: "#00875a",
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  timelineDotDest: {
    backgroundColor: "#cc0000",
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  timelineDotBest: {
    backgroundColor: "#e65100",
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: "#ddd",
    marginTop: 2,
    marginBottom: 2,
  },
  timelineConnectorDashed: { backgroundColor: "#ffc107" },
  timelineContent: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    borderRadius: 14,
    padding: 12,
    marginLeft: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  timelineContentBest: {
    backgroundColor: "#fff3e0",
    borderColor: "#e65100",
    borderWidth: 2,
  },
  timelineTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  timelineCity: { fontSize: 15, fontWeight: "bold", color: "#1a1a2e" },
  timelineState: { fontSize: 11, color: "#888", marginTop: 2 },
  timelinePriceBlock: { alignItems: "flex-end" },
  timelinePrice: { fontSize: 18, fontWeight: "bold" },
  priceArrowUp: {
    fontSize: 12,
    color: "#cc0000",
    fontWeight: "bold",
    marginTop: 2,
  },
  priceArrowDown: {
    fontSize: 12,
    color: "#00875a",
    fontWeight: "bold",
    marginTop: 2,
  },
  priceArrowSame: { fontSize: 12, color: "#888", marginTop: 2 },
  scoreChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  scoreChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  scoreChipText: { fontSize: 10, fontWeight: "700" },
  timelineBothPrices: { fontSize: 11, color: "#555", marginBottom: 8 },
  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  viewPumpsBtn: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  viewPumpsBtnText: { fontSize: 11, color: "#fff", fontWeight: "bold" },
  navViaBtn: {
    backgroundColor: "#e65100",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flex: 1,
  },
  navViaBtnText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  borderLine: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    marginLeft: 4,
  },
  borderLineDash: { flex: 1, height: 2, backgroundColor: "#ffc107" },
  borderLineLabel: {
    backgroundColor: "#fff8e1",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffc107",
  },
  borderLineLabelText: { fontSize: 10, fontWeight: "700", color: "#856404" },
  borderLinePriceDiff: { fontSize: 11, fontWeight: "bold", marginTop: 2 },
  bestBadge: {
    backgroundColor: "#e65100",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestBadgeText: { fontSize: 9, color: "#fff", fontWeight: "bold" },
  tagBadge: {
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: { fontSize: 9, color: "#0066cc", fontWeight: "bold" },
});
