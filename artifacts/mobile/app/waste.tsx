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

type WasteEntry = {
  id: string;
  date: string;
  item: string;
  category: string;
  quantity: string;
  unit: string;
  costPerUnit: string;
  reason: string;
  recordedBy: string;
};

const CATEGORIES = ["Produce", "Protein", "Dairy", "Dry Goods", "Prepared", "Other"];
const REASONS = ["Spoilage", "Over-prep", "Dropped / Spilled", "Expired", "Wrong Order", "Quality Reject", "Other"];
const UNITS = ["lbs", "oz", "each", "portion", "batch", "case", "gallon"];

export default function WasteScreen() {
  const colors = useColors();
  const [entries, setEntries] = useState<WasteEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [form, setForm] = useState({
    item: "",
    category: "Produce",
    quantity: "",
    unit: "lbs",
    costPerUnit: "",
    reason: "Spoilage",
    recordedBy: "",
  });

  function resetForm() {
    setForm({ item: "", category: "Produce", quantity: "", unit: "lbs", costPerUnit: "", reason: "Spoilage", recordedBy: "" });
  }

  function save() {
    if (!form.item.trim() || !form.quantity.trim()) {
      Alert.alert("Required", "Item name and quantity are required.");
      return;
    }
    const entry: WasteEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      ...form,
      item: form.item.trim(),
      recordedBy: form.recordedBy.trim(),
    };
    setEntries((prev) => [entry, ...prev]);
    setModalVisible(false);
    resetForm();
  }

  const totalCost = entries
    .filter((e) => filterCat === "All" || e.category === filterCat)
    .reduce((sum, e) => {
      const qty = parseFloat(e.quantity) || 0;
      const cost = parseFloat(e.costPerUnit) || 0;
      return sum + qty * cost;
    }, 0);

  const filtered = entries.filter((e) => filterCat === "All" || e.category === filterCat);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: "#f59e0b20", borderColor: "#f59e0b40" }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
            Total Waste Cost ({filterCat})
          </Text>
          <Text style={[styles.summaryAmount, { color: "#f59e0b" }]}>
            ${totalCost.toFixed(2)}
          </Text>
          <Text style={[styles.summaryCount, { color: colors.mutedForeground }]}>
            {filtered.length} entries
          </Text>
        </View>

        <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#f59e0b" }]} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Log Waste</Text>
        </TouchableOpacity>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {["All", ...CATEGORIES].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                { borderColor: colors.border },
                filterCat === cat && { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
              ]}
              onPress={() => setFilterCat(cat)}
            >
              <Text style={[styles.filterChipText, { color: filterCat === cat ? "#fff" : colors.foreground }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No waste entries yet.</Text>
          </View>
        )}

        {filtered.map((e) => {
          const totalLine = (parseFloat(e.quantity) || 0) * (parseFloat(e.costPerUnit) || 0);
          return (
            <View key={e.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{e.item}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {e.category} · {e.reason}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {e.quantity} {e.unit} · {e.date}
                    {e.recordedBy ? ` · ${e.recordedBy}` : ""}
                  </Text>
                </View>
                <Text style={[styles.cost, { color: "#ef4444" }]}>
                  {totalLine > 0 ? `-$${totalLine.toFixed(2)}` : "-"}
                </Text>
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
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Waste</Text>
            <TouchableOpacity onPress={save}>
              <Text style={[styles.saveBtn, { color: "#f59e0b" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM NAME</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Romaine Lettuce" placeholderTextColor={colors.mutedForeground} value={form.item} onChangeText={(v) => setForm((f) => ({ ...f, item: v }))} />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY</Text>
            <View style={styles.chipGroup}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, { borderColor: colors.border }, form.category === c && { backgroundColor: "#f59e0b", borderColor: "#f59e0b" }]} onPress={() => setForm((f) => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, { color: form.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>REASON</Text>
            <View style={styles.chipGroup}>
              {REASONS.map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, { borderColor: colors.border }, form.reason === r && { backgroundColor: "#f59e0b", borderColor: "#f59e0b" }]} onPress={() => setForm((f) => ({ ...f, reason: r }))}>
                  <Text style={[styles.chipText, { color: form.reason === r ? "#fff" : colors.foreground }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>QUANTITY</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={form.quantity} onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))} keyboardType="decimal-pad" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT</Text>
                <View style={styles.chipGroup}>
                  {UNITS.map((u) => (
                    <TouchableOpacity key={u} style={[styles.chip, { borderColor: colors.border }, form.unit === u && { backgroundColor: "#f59e0b", borderColor: "#f59e0b" }]} onPress={() => setForm((f) => ({ ...f, unit: u }))}>
                      <Text style={[styles.chipText, { color: form.unit === u ? "#fff" : colors.foreground }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>COST PER UNIT ($)</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} value={form.costPerUnit} onChangeText={(v) => setForm((f) => ({ ...f, costPerUnit: v }))} keyboardType="decimal-pad" />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>RECORDED BY</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Name (optional)" placeholderTextColor={colors.mutedForeground} value={form.recordedBy} onChangeText={(v) => setForm((f) => ({ ...f, recordedBy: v }))} />
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
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: "center" },
  summaryLabel: { fontSize: 13 },
  summaryAmount: { fontSize: 32, fontWeight: "700", marginVertical: 4 },
  summaryCount: { fontSize: 13 },
  addBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  filterScroll: { marginBottom: 4 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 15 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: 2 },
  cost: { fontSize: 16, fontWeight: "700" },
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
