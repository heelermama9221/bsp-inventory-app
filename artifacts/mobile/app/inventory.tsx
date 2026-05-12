import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useStorage } from "@/hooks/useStorage";
import { exportToCsv } from "@/utils/exportCsv";

// Bar & Service categories included here for ordering reference.
// Alcohol sales are excluded from kitchen sales reports (see sales.tsx).
const CATEGORIES = [
  "Produce",
  "Protein",
  "Dairy",
  "Dry Goods",
  "Non-Alcoholic Beverages",
  "Bar & Spirits",
  "Beer & Wine",
  "Service Supplies",
  "Packaging",
  "Cleaning",
];

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  currentStock: string;
  parLevel: string;
  unit: string;
  unitsPerCase: string;
  location: string;
  lastCounted: string;
  cost: string;
};

const UNITS = ["lbs", "oz", "each", "case", "gallon", "bottle", "keg", "bag", "box"];
const LOCATIONS = ["Walk-in Cooler", "Freezer", "Dry Storage", "Bar", "Line", "Prep Area", "Service Station"];

function stockStatus(item: InventoryItem): "ok" | "low" | "critical" {
  const cur = parseFloat(item.currentStock) || 0;
  const par = parseFloat(item.parLevel) || 0;
  if (par === 0) return "ok";
  if (cur <= par * 0.25) return "critical";
  if (cur <= par * 0.6) return "low";
  return "ok";
}

const STATUS_COLOR = { ok: "#10b981", low: "#f59e0b", critical: "#ef4444" };
const STATUS_LABEL = { ok: "OK", low: "Low", critical: "Critical" };

type PriceSyncEntry = {
  id: string; item: string; distributor: string; category: string;
  unit: string; currentPrice: string; previousPrice: string;
  lastUpdated: string; sku: string; notes: string;
};

type WalkCount = { cases: string; loose: string };

export default function InventoryScreen() {
  const colors = useColors();
  const [items, setItems, loaded] = useStorage<InventoryItem[]>("inventory_items", []);
  const [pricingItems, setPricingItems] = useStorage<PriceSyncEntry[]>("pricing_items", []);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState<"all" | "ok" | "low" | "critical">("all");
  const [form, setForm] = useState({
    name: "", category: "Produce", currentStock: "", parLevel: "",
    unit: "each", unitsPerCase: "", location: "Dry Storage", cost: "",
  });
  const [walkVisible, setWalkVisible] = useState(false);
  const [walkCounts, setWalkCounts] = useState<Record<string, WalkCount>>({});

  if (!loaded) return null;

  function resetForm() {
    setForm({ name: "", category: "Produce", currentStock: "", parLevel: "", unit: "each", unitsPerCase: "", location: "Dry Storage", cost: "" });
    setEditItem(null);
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setForm({ name: item.name, category: item.category, currentStock: item.currentStock, parLevel: item.parLevel, unit: item.unit, unitsPerCase: item.unitsPerCase ?? "", location: item.location, cost: item.cost });
    setModalVisible(true);
  }

  function save() {
    if (!form.name.trim()) {
      Alert.alert("Required", "Item name is required.");
      return;
    }
    if (editItem) {
      setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, ...form, lastCounted: new Date().toLocaleDateString() } : i));
    } else {
      const item: InventoryItem = {
        id: Date.now().toString(),
        lastCounted: new Date().toLocaleDateString(),
        ...form,
        name: form.name.trim(),
      };
      setItems((prev) => [item, ...prev]);
    }
    setModalVisible(false);
    resetForm();

    // Auto-sync cost to Distributor Pricing
    if (form.cost.trim()) {
      const name = form.name.trim();
      setPricingItems((prev) => {
        const existing = prev.find((p) => p.item.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (existing.currentPrice !== form.cost) {
            return prev.map((p) =>
              p.id === existing.id
                ? { ...p, previousPrice: p.currentPrice, currentPrice: form.cost, lastUpdated: new Date().toLocaleDateString() }
                : p
            );
          }
          return prev;
        }
        return [
          {
            id: `inv_${Date.now()}`,
            item: name,
            distributor: "",
            category: form.category,
            unit: form.unit,
            currentPrice: form.cost,
            previousPrice: "",
            lastUpdated: new Date().toLocaleDateString(),
            sku: "",
            notes: "Synced from Inventory",
          },
          ...prev,
        ];
      });
    }
  }

  function deleteItem(id: string) {
    Alert.alert("Delete", "Remove this item?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setItems((prev) => prev.filter((i) => i.id !== id)) },
    ]);
  }

  function openWalk() {
    const init: Record<string, WalkCount> = {};
    items.forEach((item) => {
      init[item.id] = { cases: "", loose: item.currentStock || "" };
    });
    setWalkCounts(init);
    setWalkVisible(true);
  }

  function walkTotal(item: InventoryItem): number {
    const wc = walkCounts[item.id];
    if (!wc) return 0;
    const upc = parseFloat(item.unitsPerCase) || 0;
    const cases = parseFloat(wc.cases) || 0;
    const loose = parseFloat(wc.loose) || 0;
    return upc > 0 ? cases * upc + loose : loose;
  }

  function walkTouched(item: InventoryItem): boolean {
    const wc = walkCounts[item.id];
    if (!wc) return false;
    return wc.cases !== "" || wc.loose !== "";
  }

  function saveWalkCounts() {
    const today = new Date().toLocaleDateString();
    setItems((prev) =>
      prev.map((item) => {
        if (!walkTouched(item)) return item;
        return { ...item, currentStock: String(walkTotal(item)), lastCounted: today };
      })
    );
    Alert.alert("Count Saved", "Inventory updated from walk count.");
    setWalkVisible(false);
  }

  const filtered = items.filter((i) => {
    const matchCat = filterCat === "All" || i.category === filterCat;
    const matchStatus = filterStatus === "all" || stockStatus(i) === filterStatus;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchStatus && matchSearch;
  });

  const criticalCount = items.filter((i) => stockStatus(i) === "critical").length;
  const lowCount = items.filter((i) => stockStatus(i) === "low").length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Alerts summary */}
        {(criticalCount > 0 || lowCount > 0) && (
          <View style={[styles.alertBanner, { backgroundColor: "#fef2f2", borderColor: "#ef444440" }]}>
            {criticalCount > 0 && (
              <Text style={[styles.alertText, { color: "#ef4444" }]}>🔴 {criticalCount} critical item{criticalCount !== 1 ? "s" : ""}</Text>
            )}
            {lowCount > 0 && (
              <Text style={[styles.alertText, { color: "#f59e0b" }]}>🟡 {lowCount} low-stock item{lowCount !== 1 ? "s" : ""}</Text>
            )}
          </View>
        )}

        <TextInput
          style={[styles.searchInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="Search inventory..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />

        {/* Status filter */}
        <View style={styles.statusRow}>
          {(["all", "ok", "low", "critical"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.statusChip, filterStatus === s && { backgroundColor: s === "all" ? "#ef4444" : STATUS_COLOR[s], borderColor: "transparent" }, { borderColor: colors.border }]}
              onPress={() => setFilterStatus(s)}
            >
              <Text style={[styles.statusChipText, { color: filterStatus === s ? "#fff" : colors.foreground }]}>
                {s === "all" ? "All" : STATUS_LABEL[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {["All", ...CATEGORIES].map((cat) => (
            <TouchableOpacity key={cat} style={[styles.filterChip, { borderColor: colors.border }, filterCat === cat && { backgroundColor: "#ef4444", borderColor: "#ef4444" }]} onPress={() => setFilterCat(cat)}>
              <Text style={[styles.filterChipText, { color: filterCat === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#ef4444", flex: 1 }]} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.walkBtn, { borderColor: "#ef4444" }]} onPress={openWalk}>
            <Text style={[styles.walkBtnText, { color: "#ef4444" }]}>🚶 Walk</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: "#ef4444" }]}
            onPress={() =>
              exportToCsv(
                "Inventory",
                items.map((i) => ({
                  Name: i.name,
                  Category: i.category,
                  "Current Stock": i.currentStock,
                  "Par Level": i.parLevel,
                  Unit: i.unit,
                  "Units Per Case": i.unitsPerCase || "",
                  Location: i.location,
                  "Cost Per Unit ($)": i.cost,
                  "Cost Per Case ($)": i.unitsPerCase && i.cost
                    ? (parseFloat(i.unitsPerCase) * parseFloat(i.cost)).toFixed(2)
                    : "",
                  Status: STATUS_LABEL[stockStatus(i)],
                  "Last Counted": i.lastCounted,
                }))
              )
            }
          >
            <Text style={[styles.exportBtnText, { color: "#ef4444" }]}>⬆ Export</Text>
          </TouchableOpacity>
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No inventory items yet.</Text>
          </View>
        )}

        {filtered.map((item) => {
          const status = stockStatus(item);
          const statusColor = STATUS_COLOR[status];
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: statusColor, borderLeftWidth: 4 }]}
              onPress={() => openEdit(item)}
              onLongPress={() => deleteItem(item.id)}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {item.category} · {item.location}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    Stock: {item.currentStock} {item.unit} · Par: {item.parLevel || "—"}{item.unitsPerCase ? ` · ${item.unitsPerCase}/case` : ""} · Counted: {item.lastCounted}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{STATUS_LABEL[status]}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Tap to edit · Long press to delete</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Inventory Walk Modal ────────────────────────────────────────── */}
      <Modal visible={walkVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setWalkVisible(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Inventory Walk</Text>
            <TouchableOpacity onPress={saveWalkCounts}>
              <Text style={[styles.saveBtn, { color: "#ef4444" }]}>Save All</Text>
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          {(() => {
            const total = items.length;
            const counted = items.filter(walkTouched).length;
            const pct = total > 0 ? counted / total : 0;
            return (
              <View style={[styles.walkProgressBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={styles.walkProgressRow}>
                  <Text style={[styles.walkProgressLabel, { color: colors.mutedForeground }]}>
                    {counted} of {total} items counted
                  </Text>
                  <Text style={[styles.walkProgressPct, { color: "#ef4444" }]}>{Math.round(pct * 100)}%</Text>
                </View>
                <View style={[styles.walkProgressTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.walkProgressFill, { backgroundColor: "#ef4444", width: `${pct * 100}%` as any }]} />
                </View>
              </View>
            );
          })()}

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {items.length === 0 && (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No inventory items yet. Add items first.</Text>
              </View>
            )}
            {LOCATIONS.map((loc) => {
              const locItems = items.filter((i) => i.location === loc);
              if (locItems.length === 0) return null;
              return (
                <View key={loc}>
                  <View style={[styles.walkLocHeader, { backgroundColor: colors.card, borderBottomColor: colors.border, borderTopColor: colors.border }]}>
                    <Text style={[styles.walkLocTitle, { color: colors.foreground }]}>{loc}</Text>
                    <Text style={[styles.walkLocCount, { color: colors.mutedForeground }]}>
                      {locItems.filter(walkTouched).length}/{locItems.length}
                    </Text>
                  </View>
                  {locItems.map((item) => {
                    const wc = walkCounts[item.id] || { cases: "", loose: "" };
                    const upc = parseFloat(item.unitsPerCase) || 0;
                    const total = walkTotal(item);
                    const touched = walkTouched(item);
                    const status = stockStatus(item);
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.walkCard,
                          { backgroundColor: colors.background, borderBottomColor: colors.border },
                          touched && { borderLeftColor: "#ef4444", borderLeftWidth: 3 },
                        ]}
                      >
                        <View style={styles.walkCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.walkItemName, { color: colors.foreground }]}>{item.name}</Text>
                            <Text style={[styles.walkItemMeta, { color: colors.mutedForeground }]}>
                              {item.category} · par {item.parLevel || "—"} {item.unit}
                              {upc > 0 ? ` · ${upc}/case` : ""}
                            </Text>
                          </View>
                          <View style={[styles.walkStatusDot, { backgroundColor: STATUS_COLOR[status] + "30" }]}>
                            <Text style={[styles.walkStatusDotText, { color: STATUS_COLOR[status] }]}>
                              {STATUS_LABEL[status]}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.walkInputRow}>
                          {upc > 0 && (
                            <View style={styles.walkField}>
                              <Text style={[styles.walkFieldLabel, { color: colors.mutedForeground }]}>CASES</Text>
                              <TextInput
                                style={[styles.walkInput, { borderColor: wc.cases ? "#ef4444" : colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                                placeholder="0"
                                placeholderTextColor={colors.mutedForeground}
                                value={wc.cases}
                                onChangeText={(v) =>
                                  setWalkCounts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], cases: v } }))
                                }
                                keyboardType="decimal-pad"
                              />
                              {wc.cases ? (
                                <Text style={[styles.walkFieldSub, { color: colors.mutedForeground }]}>
                                  = {(parseFloat(wc.cases) || 0) * upc} {item.unit}
                                </Text>
                              ) : null}
                            </View>
                          )}

                          <View style={styles.walkField}>
                            <Text style={[styles.walkFieldLabel, { color: colors.mutedForeground }]}>
                              {upc > 0 ? "LOOSE" : "COUNT"} ({item.unit})
                            </Text>
                            <TextInput
                              style={[styles.walkInput, { borderColor: wc.loose ? "#ef4444" : colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                              placeholder="0"
                              placeholderTextColor={colors.mutedForeground}
                              value={wc.loose}
                              onChangeText={(v) =>
                                setWalkCounts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], loose: v } }))
                              }
                              keyboardType="decimal-pad"
                            />
                          </View>

                          <View style={[styles.walkTotalBox, { backgroundColor: touched ? "#ef444415" : colors.card, borderColor: touched ? "#ef4444" : colors.border }]}>
                            <Text style={[styles.walkTotalLabel, { color: colors.mutedForeground }]}>TOTAL</Text>
                            <Text style={[styles.walkTotalValue, { color: touched ? "#ef4444" : colors.mutedForeground }]}>
                              {touched ? total : "—"}
                            </Text>
                            <Text style={[styles.walkTotalUnit, { color: colors.mutedForeground }]}>{item.unit}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Items with unknown/no location */}
            {(() => {
              const others = items.filter((i) => !LOCATIONS.includes(i.location));
              if (others.length === 0) return null;
              return (
                <View>
                  <View style={[styles.walkLocHeader, { backgroundColor: colors.card, borderBottomColor: colors.border, borderTopColor: colors.border }]}>
                    <Text style={[styles.walkLocTitle, { color: colors.foreground }]}>Other</Text>
                    <Text style={[styles.walkLocCount, { color: colors.mutedForeground }]}>
                      {others.filter(walkTouched).length}/{others.length}
                    </Text>
                  </View>
                  {others.map((item) => {
                    const wc = walkCounts[item.id] || { cases: "", loose: "" };
                    const upc = parseFloat(item.unitsPerCase) || 0;
                    const total = walkTotal(item);
                    const touched = walkTouched(item);
                    const status = stockStatus(item);
                    return (
                      <View
                        key={item.id}
                        style={[styles.walkCard, { backgroundColor: colors.background, borderBottomColor: colors.border }, touched && { borderLeftColor: "#ef4444", borderLeftWidth: 3 }]}
                      >
                        <View style={styles.walkCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.walkItemName, { color: colors.foreground }]}>{item.name}</Text>
                            <Text style={[styles.walkItemMeta, { color: colors.mutedForeground }]}>
                              {item.category} · par {item.parLevel || "—"} {item.unit}
                            </Text>
                          </View>
                          <View style={[styles.walkStatusDot, { backgroundColor: STATUS_COLOR[status] + "30" }]}>
                            <Text style={[styles.walkStatusDotText, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
                          </View>
                        </View>
                        <View style={styles.walkInputRow}>
                          {upc > 0 && (
                            <View style={styles.walkField}>
                              <Text style={[styles.walkFieldLabel, { color: colors.mutedForeground }]}>CASES</Text>
                              <TextInput
                                style={[styles.walkInput, { borderColor: wc.cases ? "#ef4444" : colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                                placeholder="0"
                                placeholderTextColor={colors.mutedForeground}
                                value={wc.cases}
                                onChangeText={(v) => setWalkCounts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], cases: v } }))}
                                keyboardType="decimal-pad"
                              />
                            </View>
                          )}
                          <View style={styles.walkField}>
                            <Text style={[styles.walkFieldLabel, { color: colors.mutedForeground }]}>
                              {upc > 0 ? "LOOSE" : "COUNT"} ({item.unit})
                            </Text>
                            <TextInput
                              style={[styles.walkInput, { borderColor: wc.loose ? "#ef4444" : colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                              placeholder="0"
                              placeholderTextColor={colors.mutedForeground}
                              value={wc.loose}
                              onChangeText={(v) => setWalkCounts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], loose: v } }))}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={[styles.walkTotalBox, { backgroundColor: touched ? "#ef444415" : colors.card, borderColor: touched ? "#ef4444" : colors.border }]}>
                            <Text style={[styles.walkTotalLabel, { color: colors.mutedForeground }]}>TOTAL</Text>
                            <Text style={[styles.walkTotalValue, { color: touched ? "#ef4444" : colors.mutedForeground }]}>{touched ? total : "—"}</Text>
                            <Text style={[styles.walkTotalUnit, { color: colors.mutedForeground }]}>{item.unit}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editItem ? "Edit Item" : "Add Item"}</Text>
            <TouchableOpacity onPress={save}>
              <Text style={[styles.saveBtn, { color: "#ef4444" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM NAME</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Chicken Thighs" placeholderTextColor={colors.mutedForeground} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY</Text>
            <View style={styles.chipGroup}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, { borderColor: colors.border }, form.category === c && { backgroundColor: "#ef4444", borderColor: "#ef4444" }]} onPress={() => setForm((f) => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, { color: form.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>CURRENT STOCK</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={form.currentStock} onChangeText={(v) => setForm((f) => ({ ...f, currentStock: v }))} keyboardType="decimal-pad" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>PAR LEVEL</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={form.parLevel} onChangeText={(v) => setForm((f) => ({ ...f, parLevel: v }))} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT</Text>
            <View style={styles.chipGroup}>
              {UNITS.map((u) => (
                <TouchableOpacity key={u} style={[styles.chip, { borderColor: colors.border }, form.unit === u && { backgroundColor: "#ef4444", borderColor: "#ef4444" }]} onPress={() => setForm((f) => ({ ...f, unit: u }))}>
                  <Text style={[styles.chipText, { color: form.unit === u ? "#fff" : colors.foreground }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>UNITS PER CASE</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. 12 (leave blank if sold individually)"
              placeholderTextColor={colors.mutedForeground}
              value={form.unitsPerCase}
              onChangeText={(v) => setForm((f) => ({ ...f, unitsPerCase: v }))}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>STORAGE LOCATION</Text>
            <View style={styles.chipGroup}>
              {LOCATIONS.map((l) => (
                <TouchableOpacity key={l} style={[styles.chip, { borderColor: colors.border }, form.location === l && { backgroundColor: "#ef4444", borderColor: "#ef4444" }]} onPress={() => setForm((f) => ({ ...f, location: l }))}>
                  <Text style={[styles.chipText, { color: form.location === l ? "#fff" : colors.foreground }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>COST PER UNIT ($)</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} value={form.cost} onChangeText={(v) => setForm((f) => ({ ...f, cost: v }))} keyboardType="decimal-pad" />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 12 },
  alertBanner: { borderRadius: 8, borderWidth: 1, padding: 10, gap: 4 },
  alertText: { fontSize: 14, fontWeight: "600" },
  searchInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  statusRow: { flexDirection: "row", gap: 8 },
  statusChip: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: "center" },
  statusChipText: { fontSize: 13, fontWeight: "500" },
  filterScroll: { marginBottom: 4 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  btnRow: { flexDirection: "row", gap: 10 },
  addBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  walkBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, justifyContent: "center", alignItems: "center" },
  walkBtnText: { fontWeight: "700", fontSize: 14 },
  exportBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  exportBtnText: { fontWeight: "700", fontSize: 14 },
  walkProgressBar: { padding: 12, borderBottomWidth: 1 },
  walkProgressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  walkProgressLabel: { fontSize: 13 },
  walkProgressPct: { fontSize: 13, fontWeight: "700" },
  walkProgressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  walkProgressFill: { height: 6, borderRadius: 3 },
  walkLocHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, marginTop: 8 },
  walkLocTitle: { fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  walkLocCount: { fontSize: 13 },
  walkCard: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  walkCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  walkItemName: { fontSize: 15, fontWeight: "600" },
  walkItemMeta: { fontSize: 12, marginTop: 2 },
  walkStatusDot: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  walkStatusDotText: { fontSize: 11, fontWeight: "700" },
  walkInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  walkField: { flex: 1, gap: 4 },
  walkFieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  walkInput: { borderWidth: 1.5, borderRadius: 8, padding: 10, fontSize: 16, fontWeight: "600", textAlign: "center" },
  walkFieldSub: { fontSize: 10, textAlign: "center" },
  walkTotalBox: { width: 72, borderWidth: 1.5, borderRadius: 8, padding: 8, alignItems: "center", gap: 2 },
  walkTotalLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  walkTotalValue: { fontSize: 18, fontWeight: "800" },
  walkTotalUnit: { fontSize: 10 },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 15 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  hint: { fontSize: 12, textAlign: "center", marginTop: 4 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  modalContent: { padding: 16 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  row: { flexDirection: "row" },
});
