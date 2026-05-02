import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DEFAULT_PROFILE,
  UserProfile,
  getUserProfile,
  saveUserProfile,
} from "../../utils/storage";

const VEHICLE_TYPES = [
  {
    key: "2-wheeler",
    label: "🏍️ 2-Wheeler",
    defaultMileage: 45,
    defaultTank: 12,
  },
  { key: "car", label: "🚗 Car", defaultMileage: 15, defaultTank: 40 },
  { key: "suv", label: "🚙 SUV", defaultMileage: 11, defaultTank: 55 },
  { key: "truck", label: "🚚 Truck", defaultMileage: 7, defaultTank: 80 },
  { key: "ev", label: "⚡ EV", defaultMileage: 0, defaultTank: 0 },
] as const;

const FUEL_TYPES = [
  { key: "petrol", label: "⛽ Petrol" },
  { key: "diesel", label: "🛢️ Diesel" },
  { key: "cng", label: "🟢 CNG" },
] as const;

const POPULAR_CITIES = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Chennai",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Coimbatore",
  "Nagpur",
  "Indore",
  "Bhopal",
  "Chandigarh",
];

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function RowInput({
  label,
  value,
  onChangeText,
  suffix,
  hint,
  keyboardType = "decimal-pad",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  suffix?: string;
  hint?: string;
  keyboardType?: "decimal-pad" | "numeric";
}) {
  return (
    <View style={styles.rowInput}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <View style={styles.rowInputRight}>
        <TextInput
          style={styles.numericInput}
          value={value}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  useEffect(() => {
    getUserProfile().then(setProfile);
  }, []);

  const update = (patch: Partial<UserProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    setSaved(false);
  };

  const handleVehicleType = (type: UserProfile["vehicleType"]) => {
    const v = VEHICLE_TYPES.find((x) => x.key === type);
    if (!v) return;
    const patch: Partial<UserProfile> = { vehicleType: type };
    // Auto-fill sensible defaults when switching vehicle type
    if (type === "ev") {
      patch.fuelType = "petrol"; // EV owners still might want petrol prices for comparison
    } else {
      if (v.defaultMileage > 0) patch.mileageKmPerL = v.defaultMileage;
      if (v.defaultTank > 0) patch.tankCapacityL = v.defaultTank;
    }
    update(patch);
  };

  const handleSave = async () => {
    const ok = await saveUserProfile(profile);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      Alert.alert("Error", "Could not save settings. Please try again.");
    }
  };

  const handleReset = () => {
    Alert.alert("Reset Settings", "Reset all settings to defaults?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          setProfile(DEFAULT_PROFILE);
          setSaved(false);
        },
      },
    ]);
  };

  const filteredCities =
    citySearch.length > 0
      ? POPULAR_CITIES.filter((c) =>
          c.toLowerCase().startsWith(citySearch.toLowerCase()),
        )
      : POPULAR_CITIES;

  const isEV = profile.vehicleType === "ev";

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚙️ Settings</Text>
        <Text style={styles.headerSubtitle}>
          Vehicle profile · Alert thresholds · Preferences
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Vehicle Type ─────────────────────────────────────────────── */}
        <SectionHeader
          title="🚗 Your Vehicle"
          subtitle="Used for trip cost estimates and the fuel log mileage tracker"
        />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Vehicle type</Text>
          <View style={styles.chipRow}>
            {VEHICLE_TYPES.map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[
                  styles.chip,
                  profile.vehicleType === v.key && styles.chipActive,
                ]}
                onPress={() => handleVehicleType(v.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    profile.vehicleType === v.key && styles.chipTextActive,
                  ]}
                >
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!isEV && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                Fuel type
              </Text>
              <View style={styles.chipRow}>
                {FUEL_TYPES.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.chip,
                      profile.fuelType === f.key && styles.chipActive,
                    ]}
                    onPress={() => update({ fuelType: f.key })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        profile.fuelType === f.key && styles.chipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.fieldGroup, { marginTop: 14 }]}>
                <RowInput
                  label="Tank capacity"
                  value={String(profile.tankCapacityL)}
                  onChangeText={(v) =>
                    update({
                      tankCapacityL: parseFloat(v) || profile.tankCapacityL,
                    })
                  }
                  suffix="L"
                  hint="Full tank size in litres"
                />
                <RowInput
                  label="Your mileage"
                  value={String(profile.mileageKmPerL)}
                  onChangeText={(v) =>
                    update({
                      mileageKmPerL: parseFloat(v) || profile.mileageKmPerL,
                    })
                  }
                  suffix="km/L"
                  hint="Used in travel planner fuel cost"
                />
              </View>
            </>
          )}

          {isEV && (
            <View style={[styles.fieldGroup, { marginTop: 14 }]}>
              <RowInput
                label="Battery capacity"
                value={String(profile.evBatteryKwh)}
                onChangeText={(v) =>
                  update({
                    evBatteryKwh: parseFloat(v) || profile.evBatteryKwh,
                  })
                }
                suffix="kWh"
                hint="Auto-fills EV charging cost estimate"
              />
              <RowInput
                label="Range per charge"
                value={String(profile.evRangeKm)}
                onChangeText={(v) =>
                  update({ evRangeKm: parseFloat(v) || profile.evRangeKm })
                }
                suffix="km"
                hint="Manufacturer-rated range"
              />
            </View>
          )}
        </View>

        {/* ── Default City ─────────────────────────────────────────────── */}
        <SectionHeader
          title="📍 Default City"
          subtitle="Pre-fills city field in Home and ML Predict tabs"
        />
        <View style={styles.card}>
          <TextInput
            style={styles.citySearch}
            placeholder="Search city..."
            placeholderTextColor="#aaa"
            value={citySearch}
            onChangeText={setCitySearch}
          />
          <View style={styles.cityGrid}>
            {filteredCities.map((city) => (
              <TouchableOpacity
                key={city}
                style={[
                  styles.cityChip,
                  profile.defaultCity === city && styles.cityChipActive,
                ]}
                onPress={() => {
                  update({ defaultCity: city });
                  setCitySearch("");
                }}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    profile.defaultCity === city && styles.cityChipTextActive,
                  ]}
                >
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {profile.defaultCity ? (
            <View style={styles.selectedCity}>
              <Text style={styles.selectedCityText}>
                ✅ Default city: {profile.defaultCity}
              </Text>
              <TouchableOpacity onPress={() => update({ defaultCity: "" })}>
                <Text style={styles.clearBtn}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ── Price Alerts ─────────────────────────────────────────────── */}
        <SectionHeader
          title="🔔 Price Alert Thresholds"
          subtitle="Get alerted when fuel drops to or below these prices"
        />
        <View style={styles.card}>
          <View style={styles.alertToggleRow}>
            <Text style={styles.fieldLabel}>Enable price alerts</Text>
            <Switch
              value={profile.alertsEnabled}
              onValueChange={(v) => update({ alertsEnabled: v })}
              trackColor={{ false: "#ccc", true: "#0066cc" }}
              thumbColor={profile.alertsEnabled ? "#fff" : "#fff"}
            />
          </View>

          {profile.alertsEnabled && (
            <View style={[styles.fieldGroup, { marginTop: 12 }]}>
              <RowInput
                label="Petrol alert price"
                value={String(profile.petrolAlertPrice)}
                onChangeText={(v) =>
                  update({
                    petrolAlertPrice: parseFloat(v) || profile.petrolAlertPrice,
                  })
                }
                suffix="₹/L"
                hint="Alert fires when petrol ≤ this price"
              />
              <RowInput
                label="Diesel alert price"
                value={String(profile.dieselAlertPrice)}
                onChangeText={(v) =>
                  update({
                    dieselAlertPrice: parseFloat(v) || profile.dieselAlertPrice,
                  })
                }
                suffix="₹/L"
                hint="Alert fires when diesel ≤ this price"
              />
              <RowInput
                label="CNG alert price"
                value={String(profile.cngAlertPrice)}
                onChangeText={(v) =>
                  update({
                    cngAlertPrice: parseFloat(v) || profile.cngAlertPrice,
                  })
                }
                suffix="₹/kg"
                hint="Alert fires when CNG ≤ this price"
              />
            </View>
          )}

          <View style={styles.alertNote}>
            <Text style={styles.alertNoteText}>
              💡 Alerts are checked each time you open the app and shown as
              banners on the Home screen. Indian fuel prices are
              government-regulated and rarely change — alerts are most useful
              for cross-city trips.
            </Text>
          </View>
        </View>

        {/* ── About the scoring ───────────────────────────────────────── */}
        <SectionHeader
          title="📊 Scoring Mode Indicator"
          subtitle="FuelSense auto-detects which scoring mode applies when you compare pumps"
        />
        <View style={styles.card}>
          <View style={styles.modeRow}>
            <View style={[styles.modeBadge, { backgroundColor: "#e8f0fe" }]}>
              <Text style={styles.modeBadgeTitle}>Same-City Mode</Text>
              <Text style={styles.modeBadgeDesc}>
                Active when all pumps differ by ≤ ₹1/L. Price excluded from
                scoring (regulated market). Distance (32.5%) · Quality (34.8%) ·
                Amenities (32.7%)
              </Text>
            </View>
          </View>
          <View style={[styles.modeRow, { marginTop: 8 }]}>
            <View style={[styles.modeBadge, { backgroundColor: "#fff8e1" }]}>
              <Text style={[styles.modeBadgeTitle, { color: "#b85c00" }]}>
                Cross-City Mode
              </Text>
              <Text style={styles.modeBadgeDesc}>
                Active on trip planner or when prices differ by &gt; ₹1/L. All
                four survey weights apply. Price (25.7%) · Distance (24.2%) ·
                Quality (25.8%) · Amenities (24.3%)
              </Text>
            </View>
          </View>
          <Text style={styles.scoringNote}>
            Survey-validated weights · n=70 · Cronbach{"'"}s α=0.725
          </Text>
        </View>

        {/* ── App version ─────────────────────────────────────────────── */}
        <View style={styles.versionRow}>
          <Text style={styles.versionText}>
            FuelSense v3.0 · Paper-Ready Build
          </Text>
          <Text style={styles.versionSub}>
            Data: PPAC · GoodReturns · EIA Brent Crude
          </Text>
        </View>

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Reset Defaults</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnSuccess]}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>
              {saved ? "✅ Saved!" : "Save Settings"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
        {/* ── Research Mode ──────────────────────────────────────────── */}
        <SectionHeader
          title="🔬 Research Mode"
          subtitle="For demos — shows only live OSM stations, hides fallback data"
        />
        <View style={styles.card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.fieldLabel}>Enable Research Mode</Text>
              <Text style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
                Only real OSM-verified stations shown. Ideal for screenshots and
                paper demos.
              </Text>
            </View>
            <Switch
              value={profile.researchMode ?? false}
              onValueChange={(v) => update({ researchMode: v })}
              trackColor={{ false: "#ddd", true: "#0066cc" }}
              thumbColor="#fff"
            />
          </View>
          {(profile.researchMode ?? false) && (
            <View
              style={{
                backgroundColor: "#e8f0fe",
                borderRadius: 10,
                padding: 10,
                marginTop: 10,
              }}
            >
              <Text
                style={{ fontSize: 11, color: "#1a3a6e", fontWeight: "700" }}
              >
                🔬 Active — only OSM-verified stations are shown
              </Text>
            </View>
          )}
        </View>
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 3,
  },
  headerSubtitle: { fontSize: 12, color: "#aaa" },
  content: { padding: 16 },
  sectionHeader: { marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#1a1a2e" },
  sectionSubtitle: { fontSize: 11, color: "#888", marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f8f8f8",
  },
  chipActive: { backgroundColor: "#0066cc", borderColor: "#0066cc" },
  chipText: { fontSize: 12, color: "#555", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  fieldGroup: { gap: 12 },
  rowInput: { flexDirection: "row", alignItems: "center" },
  rowLabel: { fontSize: 13, color: "#333", fontWeight: "500" },
  rowHint: { fontSize: 10, color: "#aaa", marginTop: 1 },
  rowInputRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  numericInput: {
    width: 72,
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
  inputSuffix: { fontSize: 12, color: "#666", fontWeight: "600", width: 36 },
  citySearch: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  cityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f8f8f8",
  },
  cityChipActive: { backgroundColor: "#0066cc", borderColor: "#0066cc" },
  cityChipText: { fontSize: 12, color: "#555", fontWeight: "500" },
  cityChipTextActive: { color: "#fff" },
  selectedCity: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    padding: 10,
  },
  selectedCityText: { fontSize: 13, color: "#0066cc", fontWeight: "600" },
  clearBtn: { fontSize: 12, color: "#cc3300", fontWeight: "600" },
  alertToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alertNote: {
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#0066cc",
  },
  alertNoteText: { fontSize: 11, color: "#555", lineHeight: 17 },
  modeRow: {},
  modeBadge: { borderRadius: 12, padding: 12 },
  modeBadgeTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#0044aa",
    marginBottom: 4,
  },
  modeBadgeDesc: { fontSize: 11, color: "#555", lineHeight: 17 },
  scoringNote: {
    fontSize: 10,
    color: "#aaa",
    marginTop: 10,
    textAlign: "center",
  },
  versionRow: { alignItems: "center", paddingVertical: 16 },
  versionText: { fontSize: 12, color: "#aaa", fontWeight: "600" },
  versionSub: { fontSize: 10, color: "#bbb", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 12 },
  resetBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  resetBtnText: { fontSize: 14, color: "#888", fontWeight: "600" },
  saveBtn: {
    flex: 2,
    backgroundColor: "#0066cc",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  saveBtnSuccess: { backgroundColor: "#00875a" },
  saveBtnText: { fontSize: 14, color: "#fff", fontWeight: "bold" },
});
