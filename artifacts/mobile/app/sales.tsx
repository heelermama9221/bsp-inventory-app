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

/**
 * CRITICAL RULE:
 * Alcohol sales are COMPLETELY EXCLUDED from all kitchen sales tracking reports.
 * Bar & Service categories remain in the system for ordering only.
 * Only NON_ALCOHOL_CATEGORIES appear in this screen's records and totals.
 */

const NON_ALCOHOL_CATEGORIES = [
  "Appetizers",
  "Entrees",
  "Sides",
  "Desserts",
  "Soups & Salads",
  "Kids Menu",
  "Non-Alcoholic Beverages",
  "Specials",
  "Catering",
];

type SaleEntry = {
  id: string;
  date: string;
  shift: string;
  category: string;
  item: string;
  quantity: string;
  unitPrice: string;
  server: string;
};

const SHIFTS = ["Breakfast", "Lunch", "Dinner", "Late Night"];

export default function SalesScreen() {
  const colors = useColors();
  const [entries, setEntries, loaded] = useStorage<SaleEntry[]>("sales_entries", []);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [filterShift, setFilterShift] = useState("All");
  const [form, setForm] = useState({
    shift: "Lunch",
    category: "Entrees",
    item: "",
    quantity: "",
    unitPrice: "",
    server: "",
  });

  if (!loaded) return null;

  function resetForm() {
    setForm({ shift: "Lunch", category: "Entrees", item: "", quantity: "", unitPrice: "", server: "" });
  }

  function save() {
    if (!form.item.trim() || !form.quantity.trim() || !form.unitPrice.trim()) {
      Alert.alert("Required", "Item, quantity, and price are required.");
      return;
    }
    const entry: SaleEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      ...form,
      item: form.item.trim(),
      server: form.server.trim(),
    };
    setEntries((prev) => [entry, ...prev]);
    setModalVisible(false);
    resetForm();
  }

  const filtered = entries.filter((e) => {
    const matchCat = filterCat === "All" || e.category === filterCat;
    const matchShift = filterShift === "All" || e.shift === filterShift;
    return matchCat && matchShift;
  });

  const totalRevenue = filtered.reduce((sum, e) => {
    return sum + (parseFloat(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0);
  }, 0);

  const totalCovers = filtered.reduce((sum, e) => sum + (parseFloat(e.quantity) || 0), 0);

  const byCategory = NON_ALCOHOL_CATEGORIES.map((cat) => {
    const catEntries = filtered.filter((e) => e.category === cat);
    const revenue = catEntries.reduce((s, e) => s + (parseFloat(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0), 0);
    return { cat, revenue, count: catEntries.length };
  }).filter((c) => c.revenue > 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Alcohol exclusion notice */}
        <View style={[styles.noticeBanner, { backgroundColor: "#fef3c7", borderColor: "#f59e0b" }]}>
          <Text style={[styles.noticeText, { color: "#92400e" }]}>
            ⚠ Alcohol sales are excluded from kitchen reports. Bar & service categories are available in Ordering only.
          </Text>
        </View>

        {/* Summary */}
        <View style={[styles.summaryRow]}>
          <View style={[styles.summaryCard, { backgroundColor: "#10b98120", borderColor: "#10b98140" }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Kitchen Revenue</Text>
            <Text style={[styles.summaryAmount, { color: "#10b981" }]}>${totalRevenue.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#3b82f620", borderColor: "#3b82f640" }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Items Sold</Text>
            <Text style={[styles.summaryAmount, { color: "#3b82f6" }]}>{totalCovers}</Text>
          </View>
        </View>

        {/* By Category breakdown */}
        {byCategory.length > 0 && (
          <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.breakdownTitle, { color: colors.foreground }]}>By Category</Text>
            {byCategory.map(({ cat, revenue }) => (
              <View key={cat} style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.foreground }]}>{cat}</Text>
                <Text style={[styles.breakdownValue, { color: "#10b981" }]}>${revenue.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#10b981", flex: 1 }]} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Log Sale</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: "#10b981" }]}
            onPress={() =>
              exportToCsv(
                "Kitchen_Sales",
                entries.map((e) => ({
                  Date: e.date,
                  Shift: e.shift,
                  Category: e.category,
                  Item: e.item,
                  Quantity: e.quantity,
                  "Unit Price ($)": e.unitPrice,
                  "Line Total ($)": ((parseFloat(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0)).toFixed(2),
                  "Server / Staff": e.server,
                  "Alcohol Included": "No — excluded per policy",
                }))
              )
            }
          >
            <Text style={[styles.exportBtnText, { color: "#10b981" }]}>⬆ Export</Text>
          </TouchableOpacity>
        </View>

        {/* Shift Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {["All", ...SHIFTS].map((s) => (
            <TouchableOpacity key={s} style={[styles.filterChip, { borderColor: colors.border }, filterShift === s && { backgroundColor: "#10b981", borderColor: "#10b981" }]} onPress={() => setFilterShift(s)}>
              <Text style={[styles.filterChipText, { color: filterShift === s ? "#fff" : colors.foreground }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {["All", ...NON_ALCOHOL_CATEGORIES].map((cat) => (
            <TouchableOpacity key={cat} style={[styles.filterChip, { borderColor: colors.border }, filterCat === cat && { backgroundColor: "#10b981", borderColor: "#10b981" }]} onPress={() => setFilterCat(cat)}>
              <Text style={[styles.filterChipText, { color: filterCat === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No kitchen sales logged yet.</Text>
          </View>
        )}

        {filtered.map((e) => {
          const lineTotal = (parseFloat(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0);
          return (
            <View key={e.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{e.item}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {e.category} · {e.shift} · {e.date}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    Qty: {e.quantity} × ${parseFloat(e.unitPrice).toFixed(2)}
                    {e.server ? ` · ${e.server}` : ""}
                  </Text>
                </View>
                <Text style={[styles.lineTotal, { color: "#10b981" }]}>${lineTotal.toFixed(2)}</Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Kitchen Sale</Text>
            <TouchableOpacity onPress={save}>
              <Text style={[styles.saveBtn, { color: "#10b981" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={[styles.modalNotice, { backgroundColor: "#fef3c7", borderColor: "#f59e0b" }]}>
              <Text style={{ color: "#92400e", fontSize: 13 }}>Alcohol sales not tracked here — use Ordering for bar inventory.</Text>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>SHIFT</Text>
            <View style={styles.chipGroup}>
              {SHIFTS.map((s) => (
                <TouchableOpacity key={s} style={[styles.chip, { borderColor: colors.border }, form.shift === s && { backgroundColor: "#10b981", borderColor: "#10b981" }]} onPress={() => setForm((f) => ({ ...f, shift: s }))}>
                  <Text style={[styles.chipText, { color: form.shift === s ? "#fff" : colors.foreground }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>KITCHEN CATEGORY</Text>
            <View style={styles.chipGroup}>
              {NON_ALCOHOL_CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, { borderColor: colors.border }, form.category === c && { backgroundColor: "#10b981", borderColor: "#10b981" }]} onPress={() => setForm((f) => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, { color: form.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM NAME</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Grilled Salmon" placeholderTextColor={colors.mutedForeground} value={form.item} onChangeText={(v) => setForm((f) => ({ ...f, item: v }))} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>QUANTITY</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={form.quantity} onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))} keyboardType="decimal-pad" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT PRICE ($)</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} value={form.unitPrice} onChangeText={(v) => setForm((f) => ({ ...f, unitPrice: v }))} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>SERVER / STAFF (optional)</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Name" placeholderTextColor={colors.mutedForeground} value={form.server} onChangeText={(v) => setForm((f) => ({ ...f, server: v }))} />
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
  noticeBanner: { borderRadius: 8, borderWidth: 1, padding: 10 },
  noticeText: { fontSize: 13, lineHeight: 18 },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center" },
  summaryLabel: { fontSize: 12 },
  summaryAmount: { fontSize: 24, fontWeight: "700", marginTop: 4 },
  breakdownCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  breakdownTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  breakdownLabel: { fontSize: 14 },
  breakdownValue: { fontSize: 14, fontWeight: "600" },
  btnRow: { flexDirection: "row", gap: 10 },
  addBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  exportBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  exportBtnText: { fontWeight: "700", fontSize: 14 },
  filterScroll: { marginBottom: 4 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 15 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: 2 },
  lineTotal: { fontSize: 17, fontWeight: "700" },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  modalContent: { padding: 16 },
  modalNotice: { borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  row: { flexDirection: "row" },
});
