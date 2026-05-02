import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import {
  FuelEntry,
  addFuelEntry,
  deleteFuelEntry,
  getFuelEntries,
  getFuelStats,
  updateFuelEntry,
} from "../../utils/storage";

// ─── Stat Box ───
function StatBox({
  label,
  value,
  sub,
  color = "#0066cc",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Empty State ───
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>⛽</Text>
      <Text style={styles.emptyTitle}>No fill-ups logged yet</Text>
      <Text style={styles.emptySubtitle}>
        Track every fill-up to see your spending, mileage and savings over time
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd}>
        <Text style={styles.emptyBtnText}>+ Log Your First Fill-Up</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FuelLogPage() {
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FuelEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"log" | "stats">("log");

  // ── Form state ──
  const [fuelType, setFuelType] = useState<"petrol" | "diesel">("petrol");
  const [litres, setLitres] = useState("");
  const [pricePerLitre, setPricePerLitre] = useState("");
  const [pumpName, setPumpName] = useState("");
  const [city, setCity] = useState("");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [e, s] = await Promise.all([getFuelEntries(), getFuelStats()]);
    setEntries(e);
    setStats(s);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const exportCSV = async () => {
    if (entries.length === 0) {
      Alert.alert("No data", "Add some fill-ups first to export.");
      return;
    }
    const header =
      "Date,Fuel Type,Litres,Price/L,Total Cost,Pump,City,Odometer,Notes";
    const rows = entries.map((e: any) =>
      [
        e.dateLabel,
        e.fuelType,
        e.litres,
        e.pricePerLitre,
        e.totalCost,
        `"${e.pumpName}"`,
        `"${e.city}"`,
        e.odometer,
        `"${e.notes}"`,
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    try {
      await Share.share({ message: csv, title: "FuelSense Fuel Log Export" });
    } catch (err) {
      Alert.alert("Export failed", "Could not share the file.");
    }
  };

  const resetForm = () => {
    setFuelType("petrol");
    setLitres("");
    setPricePerLitre("");
    setPumpName("");
    setCity("");
    setOdometer("");
    setNotes("");
    setEditingEntry(null);
  };

  const openEdit = (entry: FuelEntry) => {
    setEditingEntry(entry);
    setFuelType(entry.fuelType);
    setLitres(String(entry.litres));
    setPricePerLitre(String(entry.pricePerLitre));
    setPumpName(entry.pumpName);
    setCity(entry.city);
    setOdometer(entry.odometer > 0 ? String(entry.odometer) : "");
    setNotes(entry.notes);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!litres || !pricePerLitre) {
      Alert.alert(
        "Required",
        "Please enter litres filled and price per litre.",
      );
      return;
    }
    const l = parseFloat(litres);
    const p = parseFloat(pricePerLitre);
    const o = parseFloat(odometer) || 0;

    if (isNaN(l) || l <= 0 || isNaN(p) || p <= 0) {
      Alert.alert(
        "Invalid",
        "Please enter valid numbers for litres and price.",
      );
      return;
    }

    if (editingEntry) {
      // ── Update existing entry ──
      const success = await updateFuelEntry(editingEntry.id, {
        fuelType,
        litres: l,
        pricePerLitre: p,
        totalCost: parseFloat((l * p).toFixed(2)),
        pumpName: pumpName.trim() || "Unknown Pump",
        city: city.trim() || "Unknown City",
        odometer: o,
        notes: notes.trim(),
      });
      if (success) {
        setModalVisible(false);
        resetForm();
        loadData();
      } else {
        Alert.alert("Error", "Could not update entry. Please try again.");
      }
    } else {
      // ── Add new entry ──
      const now = new Date();
      const entry: FuelEntry = {
        id: `${Date.now()}`,
        date: now.toISOString(),
        dateLabel: now.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        fuelType,
        litres: l,
        pricePerLitre: p,
        totalCost: parseFloat((l * p).toFixed(2)),
        pumpName: pumpName.trim() || "Unknown Pump",
        city: city.trim() || "Unknown City",
        odometer: o,
        notes: notes.trim(),
      };

      const success = await addFuelEntry(entry);
      if (success) {
        setModalVisible(false);
        resetForm();
        loadData();
      } else {
        Alert.alert("Error", "Could not save entry. Please try again.");
      }
    }
  };

  const handleDelete = (id: string, pumpName: string) => {
    Alert.alert("Delete Entry", `Remove fill-up at ${pumpName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFuelEntry(id);
          loadData();
        },
      },
    ]);
  };

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={styles.headerTitle}>📋 Fuel Log</Text>
            <Text style={styles.headerSubtitle}>
              Track every fill-up · Monitor spending
            </Text>
          </View>
          {entries.length > 0 && (
            <TouchableOpacity
              onPress={exportCSV}
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                📤 Export CSV
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {(["log", "stats"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === t && styles.tabBtnTextActive,
                ]}
              >
                {t === "log" ? "📝 Fill-Up Log" : "📊 Statistics"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── STATISTICS TAB ── */}
        {activeTab === "stats" && stats && (
          <>
            {/* This Month */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📅 This Month</Text>
              <View style={styles.statsGrid}>
                <StatBox
                  label="Spent"
                  value={`₹${stats.thisMonthSpend}`}
                  color="#e65100"
                />
                <StatBox
                  label="Litres"
                  value={`${stats.thisMonthLitres}L`}
                  color="#0066cc"
                />
                <StatBox
                  label="Fill-Ups"
                  value={`${stats.totalFillUps}`}
                  color="#6200ea"
                />
              </View>
            </View>

            {/* All Time */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏆 All Time</Text>
              <View style={styles.statsGrid}>
                <StatBox
                  label="Total Spent"
                  value={`₹${stats.totalSpend}`}
                  color="#e65100"
                />
                <StatBox
                  label="Total Litres"
                  value={`${stats.totalLitres}L`}
                  color="#0066cc"
                />
                <StatBox
                  label="Avg Price/L"
                  value={`₹${stats.avgPricePerLitre}`}
                  color="#00875a"
                />
              </View>
            </View>

            {/* Mileage */}
            {stats.avgMileage > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🚗 Vehicle Efficiency</Text>
                <View style={styles.mileageBox}>
                  <Text style={styles.mileageBig}>
                    {stats.avgMileage > 0
                      ? `${stats.avgMileage} km/L`
                      : "Need 2+ fill-ups"}
                  </Text>
                  <Text style={styles.mileageSub}>
                    Average mileage calculated from your odometer readings
                  </Text>
                </View>
              </View>
            )}

            {/* Best & Worst fill-up */}
            {stats.cheapestFillUp && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  💰 Best vs Worst Fill-Up
                  {stats.comparisonFuelType !== "mixed" && (
                    <Text
                      style={{ fontSize: 12, color: "#888", fontWeight: "400" }}
                    >
                      {" "}
                      ·{" "}
                      {stats.comparisonFuelType === "petrol"
                        ? "🟢 Petrol only"
                        : "🔵 Diesel only"}
                    </Text>
                  )}
                </Text>
                <View style={styles.compareRow}>
                  <View style={[styles.compareBox, { borderColor: "#00875a" }]}>
                    <Text style={styles.compareTag}>✅ Cheapest</Text>
                    <Text style={styles.comparePrice}>
                      ₹{stats.cheapestFillUp.pricePerLitre}/L
                    </Text>
                    <Text style={styles.comparePump}>
                      {stats.cheapestFillUp.pumpName}
                    </Text>
                    <Text style={styles.compareDate}>
                      {stats.cheapestFillUp.dateLabel}
                    </Text>
                  </View>
                  <View style={[styles.compareBox, { borderColor: "#cc0000" }]}>
                    <Text style={[styles.compareTag, { color: "#cc0000" }]}>
                      ❌ Costliest
                    </Text>
                    <Text style={[styles.comparePrice, { color: "#cc0000" }]}>
                      ₹{stats.mostExpensiveFillUp.pricePerLitre}/L
                    </Text>
                    <Text style={styles.comparePump}>
                      {stats.mostExpensiveFillUp.pumpName}
                    </Text>
                    <Text style={styles.compareDate}>
                      {stats.mostExpensiveFillUp.dateLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.savingsBanner}>
                  <Text style={styles.savingsText}>
                    {`💡 You could have saved ₹${((stats.mostExpensiveFillUp.pricePerLitre - stats.cheapestFillUp.pricePerLitre) * stats.totalLitres).toFixed(0)} if you always filled at the cheapest price`}
                  </Text>
                </View>
              </View>
            )}

            {entries.length === 0 && (
              <EmptyState onAdd={() => setModalVisible(true)} />
            )}
          </>
        )}

        {/* ── LOG TAB ── */}
        {activeTab === "log" && (
          <>
            {entries.length === 0 ? (
              <EmptyState onAdd={() => setModalVisible(true)} />
            ) : (
              entries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  {/* Top row */}
                  <View style={styles.entryTop}>
                    <View style={styles.entryLeft}>
                      <View
                        style={[
                          styles.fuelTypeBadge,
                          {
                            backgroundColor:
                              entry.fuelType === "petrol"
                                ? "#e8f5ed"
                                : "#e8f0fe",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.fuelTypeBadgeText,
                            {
                              color:
                                entry.fuelType === "petrol"
                                  ? "#00875a"
                                  : "#0066cc",
                            },
                          ]}
                        >
                          {entry.fuelType === "petrol"
                            ? "🟢 Petrol"
                            : "🔵 Diesel"}
                        </Text>
                      </View>
                      <Text style={styles.entryPump}>{entry.pumpName}</Text>
                      <Text style={styles.entryCity}>
                        📍 {entry.city} · {entry.dateLabel}
                      </Text>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={styles.entryTotal}>
                        ₹{entry.totalCost.toFixed(0)}
                      </Text>
                      <Text style={styles.entryTotalLabel}>Total</Text>
                    </View>
                  </View>

                  {/* Stats row */}
                  <View style={styles.entryStats}>
                    <View style={styles.entryStat}>
                      <Text style={styles.entryStatValue}>{entry.litres}L</Text>
                      <Text style={styles.entryStatLabel}>Filled</Text>
                    </View>
                    <View style={styles.entryStatDivider} />
                    <View style={styles.entryStat}>
                      <Text style={styles.entryStatValue}>
                        ₹{entry.pricePerLitre}
                      </Text>
                      <Text style={styles.entryStatLabel}>Per Litre</Text>
                    </View>
                    <View style={styles.entryStatDivider} />
                    <View style={styles.entryStat}>
                      <Text style={styles.entryStatValue}>
                        {entry.odometer > 0 ? `${entry.odometer}` : "—"}
                      </Text>
                      <Text style={styles.entryStatLabel}>Odometer</Text>
                    </View>
                  </View>

                  {/* Notes */}
                  {entry.notes ? (
                    <Text style={styles.entryNotes}>📝 {entry.notes}</Text>
                  ) : null}

                  {/* Action row — Edit + Delete */}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[
                        styles.deleteBtn,
                        {
                          flex: 1,
                          backgroundColor: "#e8f0fe",
                          borderColor: "#0066cc",
                        },
                      ]}
                      onPress={() => openEdit(entry)}
                    >
                      <Text
                        style={[styles.deleteBtnText, { color: "#0066cc" }]}
                      >
                        ✏️ Edit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteBtn, { flex: 1 }]}
                      onPress={() => handleDelete(entry.id, entry.pumpName)}
                    >
                      <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB — Add entry */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+ Log Fill-Up</Text>
      </TouchableOpacity>

      {/* ── ADD ENTRY MODAL ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalWrapper}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⛽ Log Fill-Up</Text>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Fuel Type */}
            <Text style={styles.fieldLabel}>Fuel Type *</Text>
            <View style={styles.toggleRow}>
              {(["petrol", "diesel"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.toggleBtn,
                    fuelType === f && styles.toggleActive,
                  ]}
                  onPress={() => setFuelType(f)}
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

            {/* Litres */}
            <Text style={styles.fieldLabel}>Litres Filled *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10.5"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
              value={litres}
              onChangeText={setLitres}
            />

            {/* Price per litre */}
            <Text style={styles.fieldLabel}>Price Per Litre (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 102.63"
              placeholderTextColor="#aaa"
              keyboardType="decimal-pad"
              value={pricePerLitre}
              onChangeText={setPricePerLitre}
            />

            {/* Live total cost preview */}
            {litres && pricePerLitre ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  {`💰 Total Cost: `}
                  <Text style={styles.previewAmount}>
                    {`₹${(parseFloat(litres || "0") * parseFloat(pricePerLitre || "0")).toFixed(2)}`}
                  </Text>
                </Text>
              </View>
            ) : null}

            {/* Pump Name */}
            <Text style={styles.fieldLabel}>Pump Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Indian Oil — Coimbatore South"
              placeholderTextColor="#aaa"
              value={pumpName}
              onChangeText={setPumpName}
            />

            {/* City */}
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Coimbatore"
              placeholderTextColor="#aaa"
              value={city}
              onChangeText={setCity}
            />

            {/* Odometer */}
            <Text style={styles.fieldLabel}>Odometer Reading (km)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 24500"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={odometer}
              onChangeText={setOdometer}
            />
            <Text style={styles.fieldHint}>
              Used to calculate your vehicle{"'"}s real-world mileage
            </Text>

            {/* Notes */}
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="e.g. Long highway drive, AC on"
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Save button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>✅ Save Fill-Up</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  headerSubtitle: { fontSize: 12, color: "#aaa", marginBottom: 16 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: "#fff" },
  tabBtnText: { fontSize: 12, fontWeight: "700", color: "#aaa" },
  tabBtnTextActive: { color: "#1a1a2e" },
  scrollContent: { padding: 16 },
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
    fontSize: 15,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statBox: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#888" },
  statSub: { fontSize: 10, color: "#bbb", marginTop: 2 },
  mileageBox: {
    backgroundColor: "#f0faf5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#00875a",
  },
  mileageBig: { fontSize: 32, fontWeight: "bold", color: "#00875a" },
  mileageSub: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
    marginTop: 6,
  },
  compareRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  compareBox: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  compareTag: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#00875a",
    marginBottom: 6,
  },
  comparePrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00875a",
    marginBottom: 4,
  },
  comparePump: {
    fontSize: 11,
    color: "#555",
    textAlign: "center",
    marginBottom: 2,
  },
  compareDate: { fontSize: 10, color: "#aaa" },
  savingsBanner: {
    backgroundColor: "#fff8e1",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
  },
  savingsText: { fontSize: 12, color: "#856404", fontWeight: "600" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 30,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  entryCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
  },
  entryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  entryLeft: { flex: 1 },
  fuelTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  fuelTypeBadgeText: { fontSize: 11, fontWeight: "700" },
  entryPump: { fontSize: 15, fontWeight: "bold", color: "#1a1a2e" },
  entryCity: { fontSize: 11, color: "#888", marginTop: 3 },
  entryRight: { alignItems: "flex-end" },
  entryTotal: { fontSize: 22, fontWeight: "bold", color: "#e65100" },
  entryTotalLabel: { fontSize: 10, color: "#aaa" },
  entryStats: {
    flexDirection: "row",
    backgroundColor: "#f8f9fb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  entryStat: { flex: 1, alignItems: "center" },
  entryStatValue: { fontSize: 15, fontWeight: "bold", color: "#1a1a2e" },
  entryStatLabel: { fontSize: 10, color: "#888", marginTop: 3 },
  entryStatDivider: { width: 1, backgroundColor: "#e0e0e0" },
  entryNotes: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
    fontStyle: "italic",
  },
  deleteBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fdecea",
  },
  deleteBtnText: { fontSize: 12, color: "#cc0000", fontWeight: "600" },
  fab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  fabText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  modalWrapper: { flex: 1, backgroundColor: "#f0f4f8" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 24,
    backgroundColor: "#1a1a2e",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  modalClose: { fontSize: 20, color: "#aaa", fontWeight: "bold" },
  modalScroll: { padding: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
    marginTop: 14,
  },
  fieldHint: { fontSize: 11, color: "#aaa", marginTop: 4 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e8eaf0",
    elevation: 1,
  },
  notesInput: { height: 90, textAlignVertical: "top" },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e8eaf0",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleActive: { backgroundColor: "#1a1a2e" },
  toggleText: { fontWeight: "700", color: "#888", fontSize: 13 },
  toggleTextActive: { color: "#fff" },
  previewBox: {
    backgroundColor: "#e8f5ed",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#00875a",
  },
  previewText: { fontSize: 13, color: "#555" },
  previewAmount: { fontWeight: "bold", color: "#00875a", fontSize: 16 },
  saveBtn: {
    backgroundColor: "#1a1a2e",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
