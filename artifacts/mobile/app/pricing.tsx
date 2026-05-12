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

type PriceEntry = {
  id: string;
  item: string;
  distributor: string;
  category: string;
  unit: string;
  currentPrice: string;
  previousPrice: string;
  lastUpdated: string;
  sku: string;
  notes: string;
};

const CATEGORIES = ["Produce", "Protein", "Dairy", "Dry Goods", "Beverages", "Bar & Spirits", "Packaging", "Cleaning", "Other"];
const UNITS = ["case", "each", "lb", "oz", "gallon", "bottle", "keg", "bag"];

export default function PricingScreen() {
  const colors = useColors();
  const [items, setItems, loaded] = useStorage<PriceEntry[]>("pricing_items", []);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<PriceEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [form, setForm] = useState({
    item: "", distributor: "", category: "Produce", unit: "case",
    currentPrice: "", sku: "", notes: "",
  });

  if (!loaded) return null;

  function resetForm() {
    setForm({ item: "", distributor: "", category: "Produce", unit: "case", currentPrice: "", sku: "", notes: "" });
    setEditItem(null);
  }

  function openEdit(p: PriceEntry) {
    setEditItem(p);
    setForm({ item: p.item, distributor: p.distributor, category: p.category, unit: p.unit, currentPrice: p.currentPrice, sku: p.sku, notes: p.notes });
    setModalVisible(true);
  }

  function save() {
    if (!form.item.trim() || !form.distributor.trim() || !form.currentPrice.trim()) {
      Alert.alert("Required", "Item name, distributor, and price are required.");
      return;
    }
    if (editItem) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === editItem.id
            ? { ...p, ...form, previousPrice: p.currentPrice, lastUpdated: new Date().toLocaleDateString() }
            : p
        )
      );
    } else {
      const entry: PriceEntry = {
        id: Date.now().toString(),
        ...form,
        previousPrice: "",
        lastUpdated: new Date().toLocaleDateString(),
        item: form.item.trim(),
        distributor: form.distributor.trim(),
      };
      setItems((prev) => [entry, ...prev]);
    }
    setModalVisible(false);
    resetForm();
  }

  function deleteItem(id: string) {
    Alert.alert("Delete", "Remove this item?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setItems((prev) => prev.filter((p) => p.id !== id)) },
    ]);
  }

  const filtered = items.filter((p) => {
    const matchCat = filterCat === "All" || p.category === filterCat;
    const matchSearch = !search || p.item.toLowerCase().includes(search.toLowerCase()) || p.distributor.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function priceChange(p: PriceEntry) {
    if (!p.previousPrice || !p.currentPrice) return null;
    const diff = parseFloat(p.currentPrice) - parseFloat(p.previousPrice);
    return diff;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          style={[styles.searchInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder="Search item or distributor..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {["All", ...CATEGORIES].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, { borderColor: colors.border }, filterCat === cat && { backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }]}
              onPress={() => setFilterCat(cat)}
            >
              <Text style={[styles.filterChipText, { color: filterCat === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#8b5cf6", flex: 1 }]} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: "#8b5cf6" }]}
            onPress={() =>
              exportToCsv(
                "Distributor_Pricing",
                items.map((p) => {
                  const change = p.previousPrice && p.currentPrice
                    ? (parseFloat(p.currentPrice) - parseFloat(p.previousPrice)).toFixed(2)
                    : "";
                  return {
                    Item: p.item,
                    Distributor: p.distributor,
                    Category: p.category,
                    "Current Price ($)": p.currentPrice,
                    "Previous Price ($)": p.previousPrice,
                    "Price Change ($)": change,
                    Unit: p.unit,
                    "SKU / Item #": p.sku,
                    "Last Updated": p.lastUpdated,
                    Notes: p.notes,
                  };
                })
              )
            }
          >
            <Text style={[styles.exportBtnText, { color: "#8b5cf6" }]}>⬆ Export</Text>
          </TouchableOpacity>
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pricing entries yet.</Text>
          </View>
        )}

        {filtered.map((p) => {
          const change = priceChange(p);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openEdit(p)}
              onLongPress={() => deleteItem(p.id)}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{p.item}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {p.distributor} · {p.category}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    per {p.unit} · Updated {p.lastUpdated}
                    {p.sku ? ` · SKU: ${p.sku}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.priceText, { color: colors.foreground }]}>
                    ${parseFloat(p.currentPrice).toFixed(2)}
                  </Text>
                  {change !== null && (
                    <Text style={[styles.changeText, { color: change > 0 ? "#ef4444" : "#10b981" }]}>
                      {change > 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Tap to edit · Long press to delete</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editItem ? "Edit Price" : "Add Item"}
            </Text>
            <TouchableOpacity onPress={save}>
              <Text style={[styles.saveBtn, { color: "#8b5cf6" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM NAME</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Chicken Breast" placeholderTextColor={colors.mutedForeground} value={form.item} onChangeText={(v) => setForm((f) => ({ ...f, item: v }))} />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>DISTRIBUTOR</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. US Foods, Sysco" placeholderTextColor={colors.mutedForeground} value={form.distributor} onChangeText={(v) => setForm((f) => ({ ...f, distributor: v }))} />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY</Text>
            <View style={styles.chipGroup}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, { borderColor: colors.border }, form.category === c && { backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }]} onPress={() => setForm((f) => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, { color: form.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>CURRENT PRICE ($)</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} value={form.currentPrice} onChangeText={(v) => setForm((f) => ({ ...f, currentPrice: v }))} keyboardType="decimal-pad" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT</Text>
                <View style={styles.chipGroup}>
                  {UNITS.map((u) => (
                    <TouchableOpacity key={u} style={[styles.chip, { borderColor: colors.border }, form.unit === u && { backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }]} onPress={() => setForm((f) => ({ ...f, unit: u }))}>
                      <Text style={[styles.chipText, { color: form.unit === u ? "#fff" : colors.foreground }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>SKU / ITEM # (optional)</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Distributor SKU" placeholderTextColor={colors.mutedForeground} value={form.sku} onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))} />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
            <TextInput style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Notes..." placeholderTextColor={colors.mutedForeground} value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={3} textAlignVertical="top" />
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
  searchInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  filterScroll: { marginBottom: 4 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  btnRow: { flexDirection: "row", gap: 10 },
  addBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  exportBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  exportBtnText: { fontWeight: "700", fontSize: 14 },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 15 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: 2 },
  priceText: { fontSize: 18, fontWeight: "700" },
  changeText: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  hint: { fontSize: 12, textAlign: "center", marginTop: 8 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  modalContent: { padding: 16 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  textarea: { minHeight: 80 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  row: { flexDirection: "row" },
});
