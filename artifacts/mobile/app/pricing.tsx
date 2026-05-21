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
import * as DocumentPicker from "expo-document-picker";
import { useColors } from "@/hooks/useColors";
import { useStorage } from "@/hooks/useStorage";
import { exportToCsv } from "@/utils/exportCsv";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type ImportPreview = {
  item: string;
  distributor: string;
  category: string;
  unit: string;
  currentPrice: string;
  previousPrice: string;
  sku: string;
  notes: string;
};

type InventoryRef = { id: string; name: string; category: string; unit: string; cost: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Produce", "Protein", "Dairy", "Dry Goods", "Beverages", "Bar & Spirits", "Packaging", "Cleaning", "Other"];
const UNITS = ["case", "each", "lb", "oz", "gallon", "bottle", "keg", "bag"];

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function splitCsvRow(row: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parsePricingCsv(text: string): ImportPreview[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = splitCsvRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim());

  const COL: Record<string, string> = {
    // item name
    "item": "item", "name": "item", "product": "item", "item name": "item", "product name": "item", "description": "item",
    // distributor
    "distributor": "distributor", "vendor": "distributor", "supplier": "distributor", "company": "distributor",
    // category
    "category": "category", "cat": "category", "type": "category", "section": "category",
    // unit
    "unit": "unit", "uom": "unit", "unit of measure": "unit", "units": "unit", "pack": "unit",
    // current price
    "current price": "currentPrice", "price": "currentPrice", "cost": "currentPrice",
    "unit price": "currentPrice", "unit cost": "currentPrice", "current cost": "currentPrice",
    "case price": "currentPrice", "case cost": "currentPrice",
    // previous price
    "previous price": "previousPrice", "last price": "previousPrice", "prev price": "previousPrice",
    "old price": "previousPrice", "previous cost": "previousPrice", "last cost": "previousPrice",
    // sku
    "sku": "sku", "item number": "sku", "item num": "sku", "item no": "sku",
    "part number": "sku", "part no": "sku", "part num": "sku", "code": "sku", "product code": "sku",
    // notes
    "notes": "notes", "note": "notes", "comment": "notes", "comments": "notes", "remarks": "notes",
  };

  return lines.slice(1).map((line) => {
    const cols = splitCsvRow(line);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
      const key = COL[h];
      if (key) row[key] = (cols[i] ?? "").replace(/^\$/, "").trim();
    });
    return {
      item: row.item ?? "",
      distributor: row.distributor ?? "",
      category: row.category ?? "Other",
      unit: row.unit ?? "each",
      currentPrice: row.currentPrice ?? "",
      previousPrice: row.previousPrice ?? "",
      sku: row.sku ?? "",
      notes: row.notes ?? "",
    };
  }).filter((r) => r.item.trim() && r.currentPrice.trim());
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PricingScreen() {
  const colors = useColors();
  const [items, setItems, loaded] = useStorage<PriceEntry[]>("pricing_items", []);
  const [inventoryItems] = useStorage<InventoryRef[]>("inventory_items", []);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<PriceEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [form, setForm] = useState({
    item: "", distributor: "", category: "Produce", unit: "case",
    currentPrice: "", sku: "", notes: "",
  });

  const [importPreview, setImportPreview] = useState<ImportPreview[]>([]);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importVisible, setImportVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  if (!loaded) return null;

  const unlinked = inventoryItems.filter(
    (inv) =>
      inv.cost?.trim() &&
      !items.find((p) => p.item.toLowerCase() === inv.name?.toLowerCase())
  );

  function quickAddFromInventory(inv: InventoryRef) {
    const entry: PriceEntry = {
      id: `inv_${Date.now()}`,
      item: inv.name,
      distributor: "",
      category: inv.category ?? "Other",
      unit: inv.unit ?? "each",
      currentPrice: inv.cost,
      previousPrice: "",
      lastUpdated: new Date().toLocaleDateString(),
      sku: "",
      notes: "Synced from Inventory",
    };
    setItems((prev) => [entry, ...prev]);
  }

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

  async function pickAndImport() {
    try {
      setImportLoading(true);
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "text/plain", "*/*"] });
      if (result.canceled || !result.assets?.length) { setImportLoading(false); return; }

      const asset = result.assets[0];
      const text = await fetch(asset.uri).then((r) => r.text());
      const rows = parsePricingCsv(text);

      if (rows.length === 0) {
        Alert.alert("Nothing Imported", "No valid rows found. Make sure your CSV has an 'Item' column and a 'Price' or 'Cost' column.");
        setImportLoading(false);
        return;
      }

      setImportPreview(rows);
      setImportMode("append");
      setImportVisible(true);
    } catch {
      Alert.alert("Import Error", "Could not read that file. Please export your spreadsheet as CSV and try again.");
    } finally {
      setImportLoading(false);
    }
  }

  function confirmImport() {
    const today = new Date().toLocaleDateString();
    const newEntries: PriceEntry[] = importPreview.map((r) => ({
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      item: r.item,
      distributor: r.distributor,
      category: CATEGORIES.includes(r.category) ? r.category : "Other",
      unit: r.unit || "each",
      currentPrice: r.currentPrice,
      previousPrice: r.previousPrice,
      lastUpdated: today,
      sku: r.sku,
      notes: r.notes,
    }));

    if (importMode === "replace") {
      setItems(newEntries);
    } else {
      setItems((prev) => {
        const existingNames = new Set(prev.map((p) => p.item.toLowerCase()));
        const toAdd = newEntries.filter((e) => !existingNames.has(e.item.toLowerCase()));
        const toUpdate = newEntries.filter((e) => existingNames.has(e.item.toLowerCase()));
        const updated = prev.map((p) => {
          const match = toUpdate.find((e) => e.item.toLowerCase() === p.item.toLowerCase());
          if (!match) return p;
          return { ...p, previousPrice: p.currentPrice, currentPrice: match.currentPrice, lastUpdated: today, distributor: match.distributor || p.distributor, sku: match.sku || p.sku };
        });
        return [...updated, ...toAdd];
      });
    }
    setImportVisible(false);
  }

  const filtered = items.filter((p) => {
    const matchCat = filterCat === "All" || p.category === filterCat;
    const matchSearch = !search || p.item.toLowerCase().includes(search.toLowerCase()) || p.distributor.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function priceChange(p: PriceEntry) {
    if (!p.previousPrice || !p.currentPrice) return null;
    return parseFloat(p.currentPrice) - parseFloat(p.previousPrice);
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
            style={[styles.iconBtn, { borderColor: "#8b5cf6" }]}
            onPress={pickAndImport}
            disabled={importLoading}
          >
            <Text style={[styles.iconBtnText, { color: "#8b5cf6" }]}>{importLoading ? "…" : "⬇ Import"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: "#8b5cf6" }]}
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
            <Text style={[styles.iconBtnText, { color: "#8b5cf6" }]}>⬆ Export</Text>
          </TouchableOpacity>
        </View>

        {/* CSV format hint */}
        <View style={[styles.hintBox, { backgroundColor: "#8b5cf610", borderColor: "#8b5cf630" }]}>
          <Text style={[styles.hintBoxText, { color: "#8b5cf6" }]}>
            📄 CSV columns: <Text style={{ fontWeight: "700" }}>Item, Distributor, Category, Unit, Price, SKU, Notes</Text>
            {"\n"}Export first to see the exact format.
          </Text>
        </View>

        {/* Unlinked inventory suggestions */}
        {unlinked.length > 0 && (
          <View style={[styles.suggestBox, { backgroundColor: "#8b5cf610", borderColor: "#8b5cf640" }]}>
            <Text style={[styles.suggestTitle, { color: "#8b5cf6" }]}>
              📦 {unlinked.length} inventory item{unlinked.length !== 1 ? "s" : ""} not yet in pricing
            </Text>
            <Text style={[styles.suggestSub, { color: colors.mutedForeground }]}>
              Tap to add — distributor and SKU can be filled in afterwards.
            </Text>
            {unlinked.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={[styles.suggestRow, { borderTopColor: colors.border }]}
                onPress={() => quickAddFromInventory(inv)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggestName, { color: colors.foreground }]}>{inv.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.mutedForeground }]}>
                    {inv.category} · {inv.unit} · ${parseFloat(inv.cost).toFixed(2)} cost/unit
                  </Text>
                </View>
                <Text style={[styles.suggestAdd, { color: "#8b5cf6" }]}>+ Add</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {filtered.length === 0 && unlinked.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pricing entries yet.</Text>
          </View>
        )}

        {filtered.map((p) => {
          const change = priceChange(p);
          const isLinked = p.notes === "Synced from Inventory" || p.id.startsWith("inv_");
          const hasDistributor = p.distributor.trim().length > 0;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openEdit(p)}
              onLongPress={() => deleteItem(p.id)}
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{p.item}</Text>
                    {isLinked && (
                      <View style={[styles.linkedBadge, { backgroundColor: "#8b5cf620" }]}>
                        <Text style={[styles.linkedBadgeText, { color: "#8b5cf6" }]}>📦 Inventory</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cardSub, { color: hasDistributor ? colors.mutedForeground : "#f59e0b" }]}>
                    {hasDistributor ? p.distributor : "⚠ No distributor set"} · {p.category}
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

      {/* ── Add/Edit Modal ─────────────────────────────────────────────── */}
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
            <View style={styles.chipGroup}>
              {["Performance", "US Foods", "Retail Store"].map((d) => (
                <TouchableOpacity key={d} style={[styles.chip, { borderColor: colors.border }, form.distributor === d && { backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }]} onPress={() => setForm((f) => ({ ...f, distributor: d }))}>
                  <Text style={[styles.chipText, { color: form.distributor === d ? "#fff" : colors.foreground }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, marginTop: 8 }]} placeholder="Or type a custom distributor…" placeholderTextColor={colors.mutedForeground} value={form.distributor} onChangeText={(v) => setForm((f) => ({ ...f, distributor: v }))} />

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

      {/* ── Import Preview Modal ───────────────────────────────────────── */}
      <Modal visible={importVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setImportVisible(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Import Preview</Text>
            <TouchableOpacity onPress={confirmImport}>
              <Text style={[styles.saveBtn, { color: "#8b5cf6" }]}>Import</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.importModeRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.importModeLabel, { color: colors.mutedForeground }]}>{importPreview.length} items found</Text>
            <View style={styles.importModeToggle}>
              {(["append", "replace"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, { borderColor: colors.border }, importMode === m && { backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }]}
                  onPress={() => setImportMode(m)}
                >
                  <Text style={[styles.modeBtnText, { color: importMode === m ? "#fff" : colors.foreground }]}>
                    {m === "append" ? "Merge / Add" : "Replace All"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {importMode === "replace" && (
            <View style={[styles.warnBanner, { backgroundColor: "#ef444415", borderBottomColor: "#ef444430" }]}>
              <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
                ⚠ Replace All will delete all existing pricing data and load only this file.
              </Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.importList}>
            {importPreview.map((r, i) => (
              <View key={i} style={[styles.importRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.importName, { color: colors.foreground }]}>{r.item}</Text>
                  <Text style={[styles.importMeta, { color: colors.mutedForeground }]}>
                    {r.distributor || "No distributor"} · {r.category} · {r.unit}
                    {r.sku ? `  ·  SKU: ${r.sku}` : ""}
                  </Text>
                </View>
                <Text style={[styles.importPrice, { color: "#8b5cf6" }]}>${parseFloat(r.currentPrice).toFixed(2)}</Text>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  iconBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", paddingVertical: 10 },
  iconBtnText: { fontWeight: "700", fontSize: 13 },
  hintBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  hintBoxText: { fontSize: 12, lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 15 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: 2 },
  priceText: { fontSize: 18, fontWeight: "700" },
  changeText: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  hint: { fontSize: 12, textAlign: "center", marginTop: 8 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  linkedBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  linkedBadgeText: { fontSize: 11, fontWeight: "600" },
  suggestBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  suggestTitle: { fontSize: 14, fontWeight: "700" },
  suggestSub: { fontSize: 13, lineHeight: 18 },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: 1 },
  suggestName: { fontSize: 14, fontWeight: "600" },
  suggestMeta: { fontSize: 12, marginTop: 1 },
  suggestAdd: { fontSize: 14, fontWeight: "700" },
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
  importModeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  importModeLabel: { fontSize: 13 },
  importModeToggle: { flexDirection: "row", gap: 8 },
  modeBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  modeBtnText: { fontSize: 13, fontWeight: "600" },
  warnBanner: { padding: 12, borderBottomWidth: 1 },
  importList: { padding: 16 },
  importRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  importName: { fontSize: 14, fontWeight: "600" },
  importMeta: { fontSize: 12, marginTop: 2 },
  importPrice: { fontSize: 16, fontWeight: "800" },
  exportBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  exportBtnText: { fontWeight: "700", fontSize: 14 },
});
