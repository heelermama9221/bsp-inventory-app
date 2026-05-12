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

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryRef = {
  id: string;
  name: string;
  category: string;
  currentStock: string;
  unit: string;
  unitsPerCase: string;
  distributor: string;
  sku: string;
  cost: string;
};

type ReceiptLine = {
  itemId: string;
  itemName: string;
  unit: string;
  casesReceived: string;
  unitsReceived: string;
  unitsPerCase: string;
  unitCost: string;
  qtyAdded: number;
  lineCost: number;
};

type Receipt = {
  id: string;
  date: string;
  invoiceNum: string;
  distributor: string;
  mode: "single" | "invoice";
  lines: ReceiptLine[];
  totalCost: number;
};

type InvoiceLine = {
  itemId: string;
  itemName: string;
  unit: string;
  casesReceived: string;
  unitsReceived: string;
  unitsPerCase: string;
  unitCost: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BLANK_SINGLE = {
  itemId: "", itemName: "", unit: "",
  casesReceived: "", unitsReceived: "", unitsPerCase: "1",
  unitCost: "", invoiceNum: "", distributor: "",
};

const BLANK_LINE: InvoiceLine = {
  itemId: "", itemName: "", unit: "",
  casesReceived: "", unitsReceived: "", unitsPerCase: "1",
  unitCost: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReceivingScreen() {
  const colors = useColors();
  const [inventory, setInventory] = useStorage<InventoryRef[]>("inventory_items", []);
  const [receipts, setReceipts] = useStorage<Receipt[]>("receiving_receipts", []);

  const [tab, setTab] = useState<"single" | "invoice" | "history">("single");

  const [singleForm, setSingleForm] = useState(BLANK_SINGLE);

  const [invoiceNum, setInvoiceNum] = useState("");
  const [invoiceDistributor, setInvoiceDistributor] = useState("");
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([{ ...BLANK_LINE }]);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTarget, setPickerTarget] = useState<"single" | number>("single");

  if (!inventory) return null;

  // ── Helpers ───────────────────────────────────────────────────────────

  function calcQty(cases: string, units: string, upc: string): number {
    return (parseFloat(cases) || 0) * (parseFloat(upc) || 1) + (parseFloat(units) || 0);
  }

  function calcLineCost(cases: string, units: string, upc: string, cost: string): number {
    return calcQty(cases, units, upc) * (parseFloat(cost) || 0);
  }

  function openPicker(target: "single" | number) {
    setPickerTarget(target);
    setPickerSearch("");
    setPickerVisible(true);
  }

  function selectItem(item: InventoryRef) {
    if (pickerTarget === "single") {
      setSingleForm((f) => ({
        ...f,
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        unitsPerCase: item.unitsPerCase || "1",
        distributor: item.distributor || f.distributor,
        unitCost: item.cost || f.unitCost,
      }));
    } else {
      const idx = pickerTarget as number;
      setInvoiceLines((prev) =>
        prev.map((l, i) =>
          i === idx
            ? { ...l, itemId: item.id, itemName: item.name, unit: item.unit, unitsPerCase: item.unitsPerCase || "1", unitCost: item.cost || l.unitCost }
            : l
        )
      );
    }
    setPickerVisible(false);
  }

  function submitSingle() {
    if (!singleForm.itemId) { Alert.alert("Required", "Please select an item."); return; }
    const qty = calcQty(singleForm.casesReceived, singleForm.unitsReceived, singleForm.unitsPerCase);
    if (qty <= 0) { Alert.alert("Required", "Enter cases or units received."); return; }
    if (!singleForm.invoiceNum.trim()) { Alert.alert("Required", "Invoice number is required."); return; }

    setInventory((prev) =>
      prev.map((inv) =>
        inv.id === singleForm.itemId
          ? { ...inv, currentStock: String((parseFloat(inv.currentStock) || 0) + qty) }
          : inv
      )
    );

    const line: ReceiptLine = {
      itemId: singleForm.itemId,
      itemName: singleForm.itemName,
      unit: singleForm.unit,
      casesReceived: singleForm.casesReceived,
      unitsReceived: singleForm.unitsReceived,
      unitsPerCase: singleForm.unitsPerCase,
      unitCost: singleForm.unitCost,
      qtyAdded: qty,
      lineCost: calcLineCost(singleForm.casesReceived, singleForm.unitsReceived, singleForm.unitsPerCase, singleForm.unitCost),
    };
    setReceipts((prev) => [{
      id: Date.now().toString(),
      date: new Date().toISOString(),
      invoiceNum: singleForm.invoiceNum.trim().toUpperCase(),
      distributor: singleForm.distributor.trim(),
      mode: "single",
      lines: [line],
      totalCost: line.lineCost,
    }, ...prev]);

    Alert.alert("✓ Received", `Added ${qty} ${singleForm.unit} of ${singleForm.itemName} to inventory.`);
    setSingleForm(BLANK_SINGLE);
  }

  function submitInvoice() {
    if (!invoiceNum.trim()) { Alert.alert("Required", "Invoice number is required."); return; }
    const validLines = invoiceLines.filter((l) => l.itemId && calcQty(l.casesReceived, l.unitsReceived, l.unitsPerCase) > 0);
    if (validLines.length === 0) { Alert.alert("Required", "Add at least one item with a quantity."); return; }

    const updates: Record<string, number> = {};
    for (const l of validLines) {
      const qty = calcQty(l.casesReceived, l.unitsReceived, l.unitsPerCase);
      updates[l.itemId] = (updates[l.itemId] || 0) + qty;
    }
    setInventory((prev) =>
      prev.map((inv) =>
        updates[inv.id] !== undefined
          ? { ...inv, currentStock: String((parseFloat(inv.currentStock) || 0) + updates[inv.id]) }
          : inv
      )
    );

    const receiptLines: ReceiptLine[] = validLines.map((l) => ({
      itemId: l.itemId,
      itemName: l.itemName,
      unit: l.unit,
      casesReceived: l.casesReceived,
      unitsReceived: l.unitsReceived,
      unitsPerCase: l.unitsPerCase,
      unitCost: l.unitCost,
      qtyAdded: calcQty(l.casesReceived, l.unitsReceived, l.unitsPerCase),
      lineCost: calcLineCost(l.casesReceived, l.unitsReceived, l.unitsPerCase, l.unitCost),
    }));
    const totalCost = receiptLines.reduce((s, l) => s + l.lineCost, 0);

    setReceipts((prev) => [{
      id: Date.now().toString(),
      date: new Date().toISOString(),
      invoiceNum: invoiceNum.trim().toUpperCase(),
      distributor: invoiceDistributor.trim(),
      mode: "invoice",
      lines: receiptLines,
      totalCost,
    }, ...prev]);

    Alert.alert("✓ Invoice Posted", `Checked in ${receiptLines.length} item${receiptLines.length !== 1 ? "s" : ""}. Inventory updated.`);
    setInvoiceNum("");
    setInvoiceDistributor("");
    setInvoiceLines([{ ...BLANK_LINE }]);
  }

  function clearHistory() {
    Alert.alert("Clear History", "Delete all receipt history? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => setReceipts([]) },
    ]);
  }

  const filteredInventory = inventory.filter(
    (inv) => !pickerSearch.trim() ||
      inv.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      (inv.sku || "").toLowerCase().includes(pickerSearch.toLowerCase()) ||
      (inv.distributor || "").toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const invoiceTotal = invoiceLines.reduce(
    (s, l) => s + calcLineCost(l.casesReceived, l.unitsReceived, l.unitsPerCase, l.unitCost), 0
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["single", "invoice", "history"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: "#10b981", borderBottomWidth: 2.5 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? "#10b981" : colors.mutedForeground }]}>
              {t === "single" ? "📦 Single" : t === "invoice" ? "📄 Invoice" : "🕓 History"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── SINGLE CHECK-IN ──────────────────────────────────────────── */}
      {tab === "single" && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.infoBox, { backgroundColor: "#10b98112", borderColor: "#10b98140" }]}>
            <Text style={[styles.infoText, { color: "#059669" }]}>
              Quick single-SKU check-in. Select the item, enter how much arrived, and post — inventory updates instantly.
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM *</Text>
          <TouchableOpacity
            style={[styles.pickerBtn, { borderColor: singleForm.itemId ? "#10b981" : colors.border, backgroundColor: colors.card }]}
            onPress={() => openPicker("single")}
          >
            <View style={{ flex: 1 }}>
              {singleForm.itemName ? (
                <>
                  <Text style={[styles.pickerBtnName, { color: colors.foreground }]}>{singleForm.itemName}</Text>
                  <Text style={[styles.pickerBtnSub, { color: colors.mutedForeground }]}>
                    {singleForm.unit} · {singleForm.unitsPerCase}/case
                    {singleForm.distributor ? `  ·  ${singleForm.distributor}` : ""}
                  </Text>
                </>
              ) : (
                <Text style={[styles.pickerBtnPlaceholder, { color: colors.mutedForeground }]}>
                  {inventory.length > 0 ? "Search & select item from inventory…" : "Add items to Inventory first"}
                </Text>
              )}
            </View>
            <Text style={{ color: "#10b981", fontSize: 14, fontWeight: "700" }}>▼</Text>
          </TouchableOpacity>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>CASES RECEIVED</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="0" placeholderTextColor={colors.mutedForeground}
                value={singleForm.casesReceived}
                onChangeText={(v) => setSingleForm((f) => ({ ...f, casesReceived: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>LOOSE UNITS</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="0" placeholderTextColor={colors.mutedForeground}
                value={singleForm.unitsReceived}
                onChangeText={(v) => setSingleForm((f) => ({ ...f, unitsReceived: v }))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>UNITS PER CASE</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="1" placeholderTextColor={colors.mutedForeground}
                value={singleForm.unitsPerCase}
                onChangeText={(v) => setSingleForm((f) => ({ ...f, unitsPerCase: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT COST ($)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="0.00" placeholderTextColor={colors.mutedForeground}
                value={singleForm.unitCost}
                onChangeText={(v) => setSingleForm((f) => ({ ...f, unitCost: v }))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {singleForm.itemName && (
            <View style={[styles.qtyPreview, { backgroundColor: "#10b98110", borderColor: "#10b98140" }]}>
              <View>
                <Text style={[styles.qtyPreviewLabel, { color: "#059669" }]}>Stock to add</Text>
                {singleForm.unitCost ? (
                  <Text style={[styles.qtyPreviewCost, { color: "#059669" }]}>
                    ${calcLineCost(singleForm.casesReceived, singleForm.unitsReceived, singleForm.unitsPerCase, singleForm.unitCost).toFixed(2)} total cost
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.qtyPreviewNum, { color: "#059669" }]}>
                +{calcQty(singleForm.casesReceived, singleForm.unitsReceived, singleForm.unitsPerCase)} {singleForm.unit}
              </Text>
            </View>
          )}

          <Text style={[styles.label, { color: colors.mutedForeground }]}>INVOICE NUMBER *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
            placeholder="INV-0000" placeholderTextColor={colors.mutedForeground}
            value={singleForm.invoiceNum}
            onChangeText={(v) => setSingleForm((f) => ({ ...f, invoiceNum: v }))}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>DISTRIBUTOR</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
            placeholder="e.g. Sysco, US Foods…" placeholderTextColor={colors.mutedForeground}
            value={singleForm.distributor}
            onChangeText={(v) => setSingleForm((f) => ({ ...f, distributor: v }))}
          />

          <TouchableOpacity style={[styles.postBtn, { backgroundColor: "#10b981" }]} onPress={submitSingle}>
            <Text style={styles.postBtnText}>✓ Post Check-In</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── FULL INVOICE ENTRY ──────────────────────────────────────── */}
      {tab === "invoice" && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.infoBox, { backgroundColor: "#3b82f612", borderColor: "#3b82f640" }]}>
            <Text style={[styles.infoText, { color: "#2563eb" }]}>
              Full distributor drop. Enter one invoice number, add all items received, then post — all inventory updates at once.
            </Text>
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>INVOICE NUMBER *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="INV-0000" placeholderTextColor={colors.mutedForeground}
                value={invoiceNum}
                onChangeText={setInvoiceNum}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>DISTRIBUTOR</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="e.g. Sysco" placeholderTextColor={colors.mutedForeground}
                value={invoiceDistributor}
                onChangeText={setInvoiceDistributor}
              />
            </View>
          </View>

          <View style={styles.invoiceHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Line Items ({invoiceLines.length})
            </Text>
            <TouchableOpacity style={[styles.addLineBtn, { backgroundColor: "#3b82f6" }]} onPress={() => setInvoiceLines((p) => [...p, { ...BLANK_LINE }])}>
              <Text style={styles.addLineBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {invoiceLines.map((line, idx) => (
            <View key={idx} style={[styles.invoiceLine, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.lineNumBubble, { backgroundColor: "#3b82f620" }]}>
                <Text style={[styles.lineNumText, { color: "#3b82f6" }]}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <TouchableOpacity
                  style={[styles.linePickerBtn, { borderColor: line.itemId ? "#10b981" : colors.border, backgroundColor: colors.background }]}
                  onPress={() => openPicker(idx)}
                >
                  {line.itemName ? (
                    <View>
                      <Text style={[styles.linePickerName, { color: colors.foreground }]}>{line.itemName}</Text>
                      <Text style={[styles.linePickerSub, { color: colors.mutedForeground }]}>{line.unit} · {line.unitsPerCase}/case</Text>
                    </View>
                  ) : (
                    <Text style={[styles.linePickerPlaceholder, { color: colors.mutedForeground }]}>Select item…</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.labelSm, { color: colors.mutedForeground }]}>CASES</Text>
                    <TextInput
                      style={[styles.inputSm, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      placeholder="0" placeholderTextColor={colors.mutedForeground}
                      value={line.casesReceived}
                      onChangeText={(v) => setInvoiceLines((p) => p.map((l, i) => i === idx ? { ...l, casesReceived: v } : l))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.labelSm, { color: colors.mutedForeground }]}>UNITS</Text>
                    <TextInput
                      style={[styles.inputSm, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      placeholder="0" placeholderTextColor={colors.mutedForeground}
                      value={line.unitsReceived}
                      onChangeText={(v) => setInvoiceLines((p) => p.map((l, i) => i === idx ? { ...l, unitsReceived: v } : l))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.labelSm, { color: colors.mutedForeground }]}>COST $</Text>
                    <TextInput
                      style={[styles.inputSm, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      placeholder="0.00" placeholderTextColor={colors.mutedForeground}
                      value={line.unitCost}
                      onChangeText={(v) => setInvoiceLines((p) => p.map((l, i) => i === idx ? { ...l, unitCost: v } : l))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                {line.itemName && calcQty(line.casesReceived, line.unitsReceived, line.unitsPerCase) > 0 && (
                  <Text style={[styles.linePreview, { color: "#059669" }]}>
                    → +{calcQty(line.casesReceived, line.unitsReceived, line.unitsPerCase)} {line.unit}
                    {line.unitCost ? `  ·  $${calcLineCost(line.casesReceived, line.unitsReceived, line.unitsPerCase, line.unitCost).toFixed(2)}` : ""}
                  </Text>
                )}
              </View>
              {invoiceLines.length > 1 && (
                <TouchableOpacity onPress={() => setInvoiceLines((p) => p.filter((_, i) => i !== idx))} style={{ paddingTop: 2 }}>
                  <Text style={[styles.removeText, { color: colors.destructive }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {invoiceTotal > 0 && (
            <View style={[styles.invoiceTotalRow, { backgroundColor: "#10b98110", borderColor: "#10b98140" }]}>
              <Text style={[styles.invoiceTotalLabel, { color: "#059669" }]}>
                Invoice Total  ·  {invoiceLines.filter((l) => l.itemId && calcQty(l.casesReceived, l.unitsReceived, l.unitsPerCase) > 0).length} items
              </Text>
              <Text style={[styles.invoiceTotalValue, { color: "#059669" }]}>${invoiceTotal.toFixed(2)}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.postBtn, { backgroundColor: "#3b82f6" }]} onPress={submitInvoice}>
            <Text style={styles.postBtnText}>📄 Post Invoice</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── HISTORY ──────────────────────────────────────────────────── */}
      {tab === "history" && (
        <>
          <View style={[styles.historyBar, { borderBottomColor: colors.border }]}>
            <Text style={[styles.historyCount, { color: colors.mutedForeground }]}>
              {receipts.length} receipt{receipts.length !== 1 ? "s" : ""}
            </Text>
            {receipts.length > 0 && (
              <TouchableOpacity onPress={clearHistory}>
                <Text style={[styles.clearBtn, { color: colors.destructive }]}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView contentContainerStyle={styles.historyContent}>
            {receipts.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📄</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No receipts yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Posted check-ins and invoices appear here.
                </Text>
              </View>
            )}
            {receipts.map((r) => (
              <View
                key={r.id}
                style={[styles.receiptCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: r.mode === "single" ? "#10b981" : "#3b82f6" }]}
              >
                <View style={styles.receiptTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.receiptInvoice, { color: colors.foreground }]}>{r.invoiceNum}</Text>
                    <Text style={[styles.receiptMeta, { color: colors.mutedForeground }]}>
                      {`${new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}  ${new Date(r.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}${r.distributor ? `  ·  ${r.distributor}` : ""}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.modeBadge, { backgroundColor: r.mode === "single" ? "#10b98120" : "#3b82f620" }]}>
                      <Text style={[styles.modeBadgeText, { color: r.mode === "single" ? "#059669" : "#2563eb" }]}>
                        {r.mode === "single" ? "Single SKU" : "Invoice"}
                      </Text>
                    </View>
                    {r.totalCost > 0 && (
                      <Text style={[styles.receiptTotal, { color: colors.foreground }]}>${r.totalCost.toFixed(2)}</Text>
                    )}
                  </View>
                </View>
                {r.lines.map((l, li) => (
                  <View key={li} style={[styles.receiptLineRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.receiptLineName, { color: colors.foreground }]}>{l.itemName}</Text>
                    <Text style={[styles.receiptLineMeta, { color: colors.mutedForeground }]}>
                      +{l.qtyAdded} {l.unit}
                      {l.lineCost > 0 ? `  ·  $${l.lineCost.toFixed(2)}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}

      {/* ── Item Picker Modal ─────────────────────────────────────────── */}
      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Item</Text>
            <View style={{ minWidth: 56 }} />
          </View>
          <View style={styles.pickerSearchRow}>
            <TextInput
              style={[styles.pickerSearchInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Search by name, SKU, or distributor…"
              placeholderTextColor={colors.mutedForeground}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              autoFocus
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {inventory.length === 0 && (
              <View style={styles.pickerEmpty}>
                <Text style={[styles.pickerEmptyText, { color: colors.mutedForeground }]}>
                  No inventory items yet. Add items in the Inventory module first.
                </Text>
              </View>
            )}
            {filteredInventory.map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                onPress={() => selectItem(inv)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerRowName, { color: colors.foreground }]}>{inv.name}</Text>
                  <Text style={[styles.pickerRowMeta, { color: colors.mutedForeground }]}>
                    {inv.category} · Stock: {parseFloat(inv.currentStock) || 0} {inv.unit}
                    {inv.sku ? `  ·  SKU: ${inv.sku}` : ""}
                    {inv.distributor ? `  ·  ${inv.distributor}` : ""}
                  </Text>
                </View>
                <Text style={[styles.pickerChevron, { color: colors.mutedForeground }]}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 13, fontWeight: "600" },
  content: { padding: 16, gap: 12 },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  infoText: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 6 },
  labelSm: { fontSize: 10, fontWeight: "600", letterSpacing: 0.4, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  inputSm: { borderWidth: 1, borderRadius: 8, padding: 9, fontSize: 14 },
  twoCol: { flexDirection: "row", gap: 10 },
  pickerBtn: { borderWidth: 1.5, borderRadius: 10, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  pickerBtnName: { fontSize: 15, fontWeight: "600" },
  pickerBtnSub: { fontSize: 12, marginTop: 2 },
  pickerBtnPlaceholder: { fontSize: 14 },
  qtyPreview: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qtyPreviewLabel: { fontSize: 13, fontWeight: "600" },
  qtyPreviewCost: { fontSize: 12, marginTop: 2 },
  qtyPreviewNum: { fontSize: 22, fontWeight: "800" },
  postBtn: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 4 },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  invoiceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  addLineBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addLineBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  invoiceLine: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", gap: 10, marginBottom: 4 },
  lineNumBubble: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", marginTop: 2 },
  lineNumText: { fontSize: 12, fontWeight: "800" },
  linePickerBtn: { borderWidth: 1.5, borderRadius: 8, padding: 10 },
  linePickerName: { fontSize: 14, fontWeight: "600" },
  linePickerSub: { fontSize: 11, marginTop: 1 },
  linePickerPlaceholder: { fontSize: 14 },
  linePreview: { fontSize: 12, fontWeight: "600" },
  removeText: { fontSize: 18, fontWeight: "700" },
  invoiceTotalRow: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  invoiceTotalLabel: { fontSize: 13, fontWeight: "600" },
  invoiceTotalValue: { fontSize: 20, fontWeight: "800" },
  historyBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  historyCount: { fontSize: 13 },
  clearBtn: { fontSize: 14, fontWeight: "600" },
  historyContent: { padding: 16, gap: 10 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  receiptCard: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 4, padding: 14, gap: 6 },
  receiptTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  receiptInvoice: { fontSize: 16, fontWeight: "700" },
  receiptMeta: { fontSize: 12, marginTop: 2 },
  modeBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  modeBadgeText: { fontSize: 11, fontWeight: "600" },
  receiptTotal: { fontSize: 15, fontWeight: "700", textAlign: "right" },
  receiptLineRow: { borderTopWidth: 1, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  receiptLineName: { fontSize: 13, fontWeight: "600", flex: 1 },
  receiptLineMeta: { fontSize: 12, textAlign: "right" },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  cancelBtn: { fontSize: 16, minWidth: 56 },
  pickerSearchRow: { padding: 12, paddingBottom: 8 },
  pickerSearchInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  pickerEmpty: { padding: 24, alignItems: "center" },
  pickerEmptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  pickerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  pickerRowName: { fontSize: 15, fontWeight: "600" },
  pickerRowMeta: { fontSize: 13, marginTop: 2 },
  pickerChevron: { fontSize: 22 },
});
