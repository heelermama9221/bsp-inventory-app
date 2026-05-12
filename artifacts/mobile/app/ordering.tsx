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

/**
 * Ordering includes ALL categories including Bar & Service (alcohol, spirits, wine, beer).
 * Alcohol sales are excluded from kitchen SALES reports — but ordering here is unaffected.
 */

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
  "Other",
];

const DISTRIBUTORS = ["US Foods", "Sysco", "Gordon Food Service", "Restaurant Depot", "Local Vendor", "Other"];
const UNITS = ["case", "each", "lb", "oz", "gallon", "bottle", "keg", "bag", "box"];

type OrderItem = {
  id: string;
  item: string;
  category: string;
  quantity: string;
  unit: string;
  distributor: string;
  estimatedCost: string;
  notes: string;
};

type Order = {
  id: string;
  date: string;
  status: "Draft" | "Submitted" | "Received";
  distributor: string;
  items: OrderItem[];
  notes: string;
};

export default function OrderingScreen() {
  const colors = useColors();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [filterCat, setFilterCat] = useState("All");

  const [orderForm, setOrderForm] = useState({ distributor: "US Foods", notes: "" });
  const [itemForm, setItemForm] = useState({
    item: "", category: "Produce", quantity: "", unit: "case",
    distributor: "", estimatedCost: "", notes: "",
  });
  const [draftItems, setDraftItems] = useState<OrderItem[]>([]);

  function resetForms() {
    setOrderForm({ distributor: "US Foods", notes: "" });
    setItemForm({ item: "", category: "Produce", quantity: "", unit: "case", distributor: "", estimatedCost: "", notes: "" });
    setDraftItems([]);
  }

  function addItemToDraft() {
    if (!itemForm.item.trim() || !itemForm.quantity.trim()) {
      Alert.alert("Required", "Item name and quantity are required.");
      return;
    }
    const oi: OrderItem = { id: Date.now().toString(), ...itemForm, item: itemForm.item.trim() };
    setDraftItems((prev) => [...prev, oi]);
    setItemForm({ item: "", category: "Produce", quantity: "", unit: "case", distributor: "", estimatedCost: "", notes: "" });
    setAddItemModalVisible(false);
  }

  function saveOrder(status: "Draft" | "Submitted") {
    if (draftItems.length === 0) {
      Alert.alert("Empty Order", "Add at least one item before saving.");
      return;
    }
    const order: Order = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      status,
      distributor: orderForm.distributor,
      items: draftItems,
      notes: orderForm.notes,
    };
    setOrders((prev) => [order, ...prev]);
    setOrderModalVisible(false);
    resetForms();
  }

  function updateStatus(id: string, status: Order["status"]) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  }

  function deleteOrder(id: string) {
    Alert.alert("Delete Order", "Remove this order?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setOrders((prev) => prev.filter((o) => o.id !== id)) },
    ]);
  }

  function removeItemFromDraft(id: string) {
    setDraftItems((prev) => prev.filter((i) => i.id !== id));
  }

  const STATUS_COLOR: Record<Order["status"], string> = {
    Draft: "#6b7280",
    Submitted: "#f97316",
    Received: "#10b981",
  };

  const filtered = orders.filter((o) =>
    filterCat === "All" || o.items.some((i) => i.category === filterCat)
  );

  function orderTotal(o: Order) {
    return o.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.estimatedCost) || 0), 0);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.noticeBanner, { backgroundColor: "#eff6ff", borderColor: "#3b82f640" }]}>
          <Text style={[styles.noticeText, { color: "#1e40af" }]}>
            ℹ All categories including Bar & Service are available for ordering. Alcohol sales are tracked separately.
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {(["Draft", "Submitted", "Received"] as Order["status"][]).map((s) => {
            const count = orders.filter((o) => o.status === s).length;
            return (
              <View key={s} style={[styles.statCard, { backgroundColor: STATUS_COLOR[s] + "20", borderColor: STATUS_COLOR[s] + "40" }]}>
                <Text style={[styles.statCount, { color: STATUS_COLOR[s] }]}>{count}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#f97316" }]} onPress={() => setOrderModalVisible(true)}>
          <Text style={styles.addBtnText}>+ New Order</Text>
        </TouchableOpacity>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {["All", ...CATEGORIES].map((cat) => (
            <TouchableOpacity key={cat} style={[styles.filterChip, { borderColor: colors.border }, filterCat === cat && { backgroundColor: "#f97316", borderColor: "#f97316" }]} onPress={() => setFilterCat(cat)}>
              <Text style={[styles.filterChipText, { color: filterCat === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No orders yet.</Text>
          </View>
        )}

        {filtered.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: STATUS_COLOR[order.status], borderLeftWidth: 4 }]}
            onPress={() => setDetailOrder(order)}
            onLongPress={() => deleteOrder(order.id)}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{order.distributor}</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {order.date}
                </Text>
                {orderTotal(order) > 0 && (
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    Est: ${orderTotal(order).toFixed(2)}
                  </Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[order.status] + "20" }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[order.status] }]}>{order.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Tap for details · Long press to delete</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* New Order Modal */}
      <Modal visible={orderModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setOrderModalVisible(false); resetForms(); }}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Order</Text>
            <TouchableOpacity onPress={() => saveOrder("Draft")}>
              <Text style={[styles.saveBtn, { color: "#f97316" }]}>Save Draft</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>DISTRIBUTOR</Text>
            <View style={styles.chipGroup}>
              {DISTRIBUTORS.map((d) => (
                <TouchableOpacity key={d} style={[styles.chip, { borderColor: colors.border }, orderForm.distributor === d && { backgroundColor: "#f97316", borderColor: "#f97316" }]} onPress={() => setOrderForm((f) => ({ ...f, distributor: d }))}>
                  <Text style={[styles.chipText, { color: orderForm.distributor === d ? "#fff" : colors.foreground }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>ORDER NOTES</Text>
            <TextInput style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Delivery instructions, special requests..." placeholderTextColor={colors.mutedForeground} value={orderForm.notes} onChangeText={(v) => setOrderForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={3} textAlignVertical="top" />

            <View style={styles.itemsHeader}>
              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 0 }]}>ITEMS ({draftItems.length})</Text>
              <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: "#f97316" }]} onPress={() => setAddItemModalVisible(true)}>
                <Text style={styles.addItemBtnText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>

            {draftItems.map((item) => (
              <View key={item.id} style={[styles.draftItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.draftItemTitle, { color: colors.foreground }]}>{item.item}</Text>
                  <Text style={[styles.draftItemSub, { color: colors.mutedForeground }]}>
                    {item.category} · {item.quantity} {item.unit}
                    {item.estimatedCost ? ` · $${item.estimatedCost}/unit` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeItemFromDraft(item.id)}>
                  <Text style={[styles.removeBtn, { color: colors.destructive }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: "#10b981" }]} onPress={() => saveOrder("Submitted")}>
              <Text style={styles.addBtnText}>Submit Order</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={addItemModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setAddItemModalVisible(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Item</Text>
            <TouchableOpacity onPress={addItemToDraft}>
              <Text style={[styles.saveBtn, { color: "#f97316" }]}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM NAME</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. House Bourbon" placeholderTextColor={colors.mutedForeground} value={itemForm.item} onChangeText={(v) => setItemForm((f) => ({ ...f, item: v }))} />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY (incl. Bar & Service)</Text>
            <View style={styles.chipGroup}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, { borderColor: colors.border }, itemForm.category === c && { backgroundColor: "#f97316", borderColor: "#f97316" }]} onPress={() => setItemForm((f) => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, { color: itemForm.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>QUANTITY</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={itemForm.quantity} onChangeText={(v) => setItemForm((f) => ({ ...f, quantity: v }))} keyboardType="decimal-pad" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT</Text>
                <View style={styles.chipGroup}>
                  {UNITS.map((u) => (
                    <TouchableOpacity key={u} style={[styles.chip, { borderColor: colors.border }, itemForm.unit === u && { backgroundColor: "#f97316", borderColor: "#f97316" }]} onPress={() => setItemForm((f) => ({ ...f, unit: u }))}>
                      <Text style={[styles.chipText, { color: itemForm.unit === u ? "#fff" : colors.foreground }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>EST. COST PER UNIT ($)</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} value={itemForm.estimatedCost} onChangeText={(v) => setItemForm((f) => ({ ...f, estimatedCost: v }))} keyboardType="decimal-pad" />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Brand preference, notes..." placeholderTextColor={colors.mutedForeground} value={itemForm.notes} onChangeText={(v) => setItemForm((f) => ({ ...f, notes: v }))} />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Order Detail Modal */}
      <Modal visible={!!detailOrder} animationType="slide" presentationStyle="pageSheet">
        {detailOrder && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setDetailOrder(null)}>
                <Text style={[styles.cancelBtn, { color: "#3b82f6" }]}>Close</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{detailOrder.distributor}</Text>
              <View />
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.detailMeta, { color: colors.mutedForeground }]}>Date: {detailOrder.date}</Text>
              <Text style={[styles.detailMeta, { color: STATUS_COLOR[detailOrder.status] }]}>Status: {detailOrder.status}</Text>
              {detailOrder.notes ? <Text style={[styles.detailMeta, { color: colors.mutedForeground }]}>Notes: {detailOrder.notes}</Text> : null}

              {/* Status actions */}
              {detailOrder.status === "Draft" && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#f97316" }]} onPress={() => { updateStatus(detailOrder.id, "Submitted"); setDetailOrder({ ...detailOrder, status: "Submitted" }); }}>
                  <Text style={styles.actionBtnText}>Mark as Submitted</Text>
                </TouchableOpacity>
              )}
              {detailOrder.status === "Submitted" && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10b981" }]} onPress={() => { updateStatus(detailOrder.id, "Received"); setDetailOrder({ ...detailOrder, status: "Received" }); }}>
                  <Text style={styles.actionBtnText}>Mark as Received</Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEMS</Text>
              {detailOrder.items.map((item) => (
                <View key={item.id} style={[styles.detailItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.item}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {item.category} · {item.quantity} {item.unit}
                    {item.estimatedCost ? ` · $${item.estimatedCost}/unit` : ""}
                  </Text>
                  {item.notes ? <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.notes}</Text> : null}
                </View>
              ))}
              {orderTotal(detailOrder) > 0 && (
                <Text style={[styles.totalLine, { color: colors.foreground }]}>
                  Estimated Total: ${orderTotal(detailOrder).toFixed(2)}
                </Text>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 12 },
  noticeBanner: { borderRadius: 8, borderWidth: 1, padding: 10 },
  noticeText: { fontSize: 13, lineHeight: 18 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center" },
  statCount: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 2 },
  addBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  filterScroll: { marginBottom: 4 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
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
  textarea: { minHeight: 80 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  row: { flexDirection: "row" },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  addItemBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addItemBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  draftItem: { borderRadius: 8, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  draftItemTitle: { fontSize: 14, fontWeight: "600" },
  draftItemSub: { fontSize: 12, marginTop: 2 },
  removeBtn: { fontSize: 18, fontWeight: "700" },
  submitBtn: { borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  detailMeta: { fontSize: 14, marginBottom: 4 },
  actionBtn: { borderRadius: 10, padding: 12, alignItems: "center", marginTop: 12 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  detailItemCard: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 8 },
  totalLine: { fontSize: 17, fontWeight: "700", textAlign: "right", marginTop: 8 },
});
