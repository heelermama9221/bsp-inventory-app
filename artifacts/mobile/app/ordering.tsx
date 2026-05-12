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
 * Ordering includes ALL categories including Bar & Service (alcohol, spirits, wine, beer).
 * Alcohol sales are excluded from kitchen SALES reports — but ordering here is unaffected.
 */

const CATEGORIES = [
  "Produce", "Protein", "Dairy", "Dry Goods",
  "Non-Alcoholic Beverages", "Bar & Spirits", "Beer & Wine",
  "Service Supplies", "Packaging", "Cleaning", "Other",
];

const DISTRIBUTORS = ["US Foods", "Sysco", "Gordon Food Service", "Restaurant Depot", "Local Vendor", "Other"];
const UNITS = ["case", "each", "lb", "oz", "gallon", "bottle", "keg", "bag", "box"];

type OrderItem = {
  id: string;
  item: string;
  sku: string;
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

type PriceCatalogEntry = {
  id: string; item: string; distributor: string; category: string;
  unit: string; currentPrice: string; sku: string; notes: string;
};

const STATUS_COLOR: Record<Order["status"], string> = {
  Draft: "#6b7280", Submitted: "#f97316", Received: "#10b981",
};

const BLANK_ITEM_FORM = {
  item: "", sku: "", category: "Produce", quantity: "", unit: "case",
  distributor: "", estimatedCost: "", notes: "",
};

export default function OrderingScreen() {
  const colors = useColors();
  const [orders, setOrders, loaded] = useStorage<Order[]>("orders", []);
  const [catalog] = useStorage<PriceCatalogEntry[]>("pricing_items", []);

  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalog, setShowCatalog] = useState(true);

  const [orderForm, setOrderForm] = useState({ distributor: "US Foods", notes: "" });
  const [itemForm, setItemForm] = useState(BLANK_ITEM_FORM);
  const [draftItems, setDraftItems] = useState<OrderItem[]>([]);

  if (!loaded) return null;

  // ── Catalog helpers ───────────────────────────────────────────────────────

  const catalogFiltered = catalog.filter((c) =>
    !catalogSearch.trim() ||
    c.item.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.distributor.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.sku.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  // Items already added in this draft (by name) — for quick "already added" indicator
  const draftNames = new Set(draftItems.map((i) => i.item.toLowerCase()));

  function pickFromCatalog(entry: PriceCatalogEntry) {
    setItemForm({
      item: entry.item,
      sku: entry.sku ?? "",
      category: entry.category ?? "Other",
      quantity: "",
      unit: entry.unit ?? "case",
      distributor: entry.distributor ?? "",
      estimatedCost: entry.currentPrice ?? "",
      notes: "",
    });
    setShowCatalog(false); // collapse catalog after picking
  }

  // ── Item form ─────────────────────────────────────────────────────────────

  function resetForms() {
    setOrderForm({ distributor: "US Foods", notes: "" });
    setItemForm(BLANK_ITEM_FORM);
    setDraftItems([]);
    setCatalogSearch("");
    setShowCatalog(true);
  }

  function addItemToDraft() {
    if (!itemForm.item.trim() || !itemForm.quantity.trim()) {
      Alert.alert("Required", "Item name and quantity are required.");
      return;
    }
    const oi: OrderItem = { id: Date.now().toString(), ...itemForm, item: itemForm.item.trim() };
    setDraftItems((prev) => [...prev, oi]);
    setItemForm(BLANK_ITEM_FORM);
    setCatalogSearch("");
    setShowCatalog(true);
    setAddItemModalVisible(false);
  }

  // ── Order CRUD ────────────────────────────────────────────────────────────

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

  const filtered = orders.filter((o) =>
    filterCat === "All" || o.items.some((i) => i.category === filterCat)
  );

  function orderTotal(o: Order) {
    return o.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.estimatedCost) || 0), 0);
  }

  // ─────────────────────────────────────────────────────────────────────────

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

        {/* Catalog summary */}
        {catalog.length > 0 && (
          <View style={[styles.catalogBanner, { backgroundColor: "#f97316" + "12", borderColor: "#f97316" + "40" }]}>
            <Text style={[styles.catalogBannerText, { color: "#f97316" }]}>
              📋 {catalog.length} items in your catalog — auto-filled when you add items to an order.
            </Text>
          </View>
        )}

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#f97316", flex: 1 }]} onPress={() => setOrderModalVisible(true)}>
            <Text style={styles.addBtnText}>+ New Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: "#f97316" }]}
            onPress={() =>
              exportToCsv("Orders", orders.flatMap((o) =>
                o.items.map((item) => ({
                  "Order Date": o.date,
                  Distributor: item.distributor || o.distributor,
                  Status: o.status,
                  "Order Notes": o.notes,
                  Item: item.item,
                  "Item #": item.sku || "",
                  Category: item.category,
                  Quantity: item.quantity,
                  Unit: item.unit,
                  "Price Per Case ($)": item.estimatedCost,
                  "Est. Line Total ($)": ((parseFloat(item.quantity) || 0) * (parseFloat(item.estimatedCost) || 0)).toFixed(2),
                  "Item Notes": item.notes,
                }))
              ))
            }
          >
            <Text style={[styles.exportBtnText, { color: "#f97316" }]}>⬆ Export</Text>
          </TouchableOpacity>
        </View>

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

      {/* ── New Order Modal ─────────────────────────────────────────────────── */}
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
              <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: "#f97316" }]} onPress={() => { setShowCatalog(true); setCatalogSearch(""); setItemForm(BLANK_ITEM_FORM); setAddItemModalVisible(true); }}>
                <Text style={styles.addItemBtnText}>+ Add Item</Text>
              </TouchableOpacity>
            </View>

            {draftItems.length === 0 && (
              <View style={[styles.emptyItems, { borderColor: colors.border }]}>
                <Text style={[styles.emptyItemsText, { color: colors.mutedForeground }]}>No items yet. Tap + Add Item to pick from your catalog or enter manually.</Text>
              </View>
            )}

            {draftItems.map((item) => {
              const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.estimatedCost) || 0);
              return (
                <View key={item.id} style={[styles.draftItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.draftItemTitle, { color: colors.foreground }]}>{item.item}</Text>
                    <Text style={[styles.draftItemSub, { color: colors.mutedForeground }]}>
                      {item.distributor ? `${item.distributor} · ` : ""}{item.quantity} {item.unit}
                      {item.estimatedCost ? ` · $${item.estimatedCost}/case` : ""}
                      {item.sku ? ` · #${item.sku}` : ""}
                    </Text>
                    {lineTotal > 0 && (
                      <Text style={[styles.draftItemTotal, { color: "#f97316" }]}>
                        Line total: ${lineTotal.toFixed(2)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeItemFromDraft(item.id)}>
                    <Text style={[styles.removeBtn, { color: colors.destructive }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {draftItems.length > 0 && (
              <View style={[styles.orderTotalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.orderTotalLabel, { color: colors.mutedForeground }]}>Estimated Order Total</Text>
                <Text style={[styles.orderTotalValue, { color: colors.foreground }]}>
                  ${draftItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.estimatedCost) || 0), 0).toFixed(2)}
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: "#10b981" }]} onPress={() => saveOrder("Submitted")}>
              <Text style={styles.addBtnText}>Submit Order</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Add Item Modal ──────────────────────────────────────────────────── */}
      <Modal visible={addItemModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setAddItemModalVisible(false); setItemForm(BLANK_ITEM_FORM); }}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Item</Text>
            <TouchableOpacity onPress={addItemToDraft}>
              <Text style={[styles.saveBtn, { color: "#f97316" }]}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* ── Catalog picker ── */}
            {catalog.length > 0 && (
              <View style={[styles.catalogBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity style={styles.catalogHeader} onPress={() => setShowCatalog((v) => !v)}>
                  <Text style={[styles.catalogHeaderText, { color: colors.foreground }]}>
                    📋 Pick from catalog ({catalog.length} items)
                  </Text>
                  <Text style={[styles.catalogToggle, { color: "#f97316" }]}>{showCatalog ? "▲ Hide" : "▼ Show"}</Text>
                </TouchableOpacity>

                {showCatalog && (
                  <>
                    <TextInput
                      style={[styles.catalogSearch, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      placeholder="Search item, distributor, or item #…"
                      placeholderTextColor={colors.mutedForeground}
                      value={catalogSearch}
                      onChangeText={setCatalogSearch}
                      autoCorrect={false}
                    />
                    {catalogFiltered.length === 0 ? (
                      <Text style={[styles.catalogEmpty, { color: colors.mutedForeground }]}>No matches — fill in manually below.</Text>
                    ) : (
                      catalogFiltered.map((entry) => {
                        const alreadyAdded = draftNames.has(entry.item.toLowerCase());
                        const hasPrice = !!entry.currentPrice;
                        return (
                          <TouchableOpacity
                            key={entry.id}
                            style={[styles.catalogRow, { borderTopColor: colors.border }, alreadyAdded && { opacity: 0.5 }]}
                            onPress={() => pickFromCatalog(entry)}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.catalogRowTop}>
                                <Text style={[styles.catalogRowName, { color: colors.foreground }]}>{entry.item}</Text>
                                {alreadyAdded && (
                                  <View style={[styles.addedPill, { backgroundColor: "#10b98120" }]}>
                                    <Text style={[styles.addedPillText, { color: "#10b981" }]}>Added</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.catalogRowMeta, { color: colors.mutedForeground }]}>
                                {entry.distributor ? `${entry.distributor} · ` : ""}
                                {entry.sku ? `#${entry.sku} · ` : ""}
                                {entry.unit}
                                {hasPrice ? ` · $${parseFloat(entry.currentPrice).toFixed(2)}/case` : ""}
                              </Text>
                            </View>
                            <Text style={[styles.catalogPickBtn, { color: "#f97316" }]}>Select →</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </>
                )}
              </View>
            )}

            {/* Selected item preview */}
            {itemForm.item.trim() ? (
              <View style={[styles.selectedPreview, { backgroundColor: "#f97316" + "12", borderColor: "#f97316" + "40" }]}>
                <Text style={[styles.selectedPreviewTitle, { color: "#f97316" }]}>✓ Selected: {itemForm.item}</Text>
                {(itemForm.distributor || itemForm.sku || itemForm.estimatedCost) && (
                  <Text style={[styles.selectedPreviewMeta, { color: colors.mutedForeground }]}>
                    {[
                      itemForm.distributor,
                      itemForm.sku ? `#${itemForm.sku}` : "",
                      itemForm.estimatedCost ? `$${itemForm.estimatedCost}/case` : "",
                    ].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
            ) : null}

            {/* Manual fields */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM NAME *</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Roma Tomatoes" placeholderTextColor={colors.mutedForeground} value={itemForm.item} onChangeText={(v) => setItemForm((f) => ({ ...f, item: v }))} />

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>DISTRIBUTOR</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Sysco" placeholderTextColor={colors.mutedForeground} value={itemForm.distributor} onChangeText={(v) => setItemForm((f) => ({ ...f, distributor: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM # / SKU</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. 12345" placeholderTextColor={colors.mutedForeground} value={itemForm.sku} onChangeText={(v) => setItemForm((f) => ({ ...f, sku: v }))} />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY (incl. Bar & Service)</Text>
            <View style={styles.chipGroup}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, { borderColor: colors.border }, itemForm.category === c && { backgroundColor: "#f97316", borderColor: "#f97316" }]} onPress={() => setItemForm((f) => ({ ...f, category: c }))}>
                  <Text style={[styles.chipText, { color: itemForm.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>QUANTITY *</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={itemForm.quantity} onChangeText={(v) => setItemForm((f) => ({ ...f, quantity: v }))} keyboardType="decimal-pad" autoFocus={!showCatalog && !itemForm.item} />
              </View>
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

            <Text style={[styles.label, { color: colors.mutedForeground }]}>PRICE PER CASE ($)</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0.00" placeholderTextColor={colors.mutedForeground} value={itemForm.estimatedCost} onChangeText={(v) => setItemForm((f) => ({ ...f, estimatedCost: v }))} keyboardType="decimal-pad" />

            {itemForm.quantity && itemForm.estimatedCost ? (
              <View style={[styles.lineTotalRow, { backgroundColor: "#f97316" + "12", borderColor: "#f97316" + "30" }]}>
                <Text style={[styles.lineTotalLabel, { color: colors.mutedForeground }]}>Line total</Text>
                <Text style={[styles.lineTotalValue, { color: "#f97316" }]}>
                  ${((parseFloat(itemForm.quantity) || 0) * (parseFloat(itemForm.estimatedCost) || 0)).toFixed(2)}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Brand preference, substitutes..." placeholderTextColor={colors.mutedForeground} value={itemForm.notes} onChangeText={(v) => setItemForm((f) => ({ ...f, notes: v }))} />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Order Detail Modal ──────────────────────────────────────────────── */}
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
              {detailOrder.items.map((item) => {
                const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.estimatedCost) || 0);
                return (
                  <View key={item.id} style={[styles.detailItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.detailItemRow}>
                      <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>{item.item}</Text>
                      {lineTotal > 0 && (
                        <Text style={[styles.lineTotalValue, { color: "#f97316", fontSize: 14 }]}>${lineTotal.toFixed(2)}</Text>
                      )}
                    </View>
                    <View style={styles.detailMetas}>
                      {item.distributor ? <Text style={[styles.detailMetaChip, { backgroundColor: "#3b82f620", color: "#3b82f6" }]}>{item.distributor}</Text> : null}
                      {item.sku ? <Text style={[styles.detailMetaChip, { backgroundColor: colors.border + "60", color: colors.mutedForeground }]}>#{item.sku}</Text> : null}
                      <Text style={[styles.detailMetaChip, { backgroundColor: colors.border + "60", color: colors.mutedForeground }]}>{item.quantity} {item.unit}</Text>
                      {item.estimatedCost ? <Text style={[styles.detailMetaChip, { backgroundColor: "#f9731620", color: "#f97316" }]}>${item.estimatedCost}/case</Text> : null}
                    </View>
                    {item.notes ? <Text style={[styles.cardSub, { color: colors.mutedForeground, marginTop: 4 }]}>{item.notes}</Text> : null}
                  </View>
                );
              })}

              {orderTotal(detailOrder) > 0 && (
                <View style={[styles.orderTotalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.orderTotalLabel, { color: colors.mutedForeground }]}>Estimated Total</Text>
                  <Text style={[styles.orderTotalValue, { color: colors.foreground }]}>${orderTotal(detailOrder).toFixed(2)}</Text>
                </View>
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
  catalogBanner: { borderRadius: 8, borderWidth: 1, padding: 10 },
  catalogBannerText: { fontSize: 13, lineHeight: 18 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center" },
  statCount: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 2 },
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
  twoCol: { flexDirection: "row", gap: 12 },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  addItemBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addItemBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  emptyItems: { borderWidth: 1, borderRadius: 8, borderStyle: "dashed", padding: 16, alignItems: "center" },
  emptyItemsText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  draftItem: { borderRadius: 8, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  draftItemTitle: { fontSize: 14, fontWeight: "600" },
  draftItemSub: { fontSize: 12, marginTop: 2 },
  draftItemTotal: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  removeBtn: { fontSize: 18, fontWeight: "700" },
  orderTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  orderTotalLabel: { fontSize: 14, fontWeight: "600" },
  orderTotalValue: { fontSize: 18, fontWeight: "700" },
  submitBtn: { borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  catalogBox: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  catalogHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  catalogHeaderText: { fontSize: 14, fontWeight: "600" },
  catalogToggle: { fontSize: 13, fontWeight: "600" },
  catalogSearch: { borderWidth: 1, borderRadius: 8, margin: 10, marginTop: 4, padding: 10, fontSize: 14 },
  catalogEmpty: { textAlign: "center", fontSize: 13, paddingBottom: 12 },
  catalogRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1 },
  catalogRowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  catalogRowName: { fontSize: 14, fontWeight: "600" },
  catalogRowMeta: { fontSize: 12, marginTop: 2 },
  addedPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  addedPillText: { fontSize: 11, fontWeight: "700" },
  catalogPickBtn: { fontSize: 14, fontWeight: "700" },
  selectedPreview: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 4, marginBottom: 4 },
  selectedPreviewTitle: { fontSize: 14, fontWeight: "700" },
  selectedPreviewMeta: { fontSize: 13, marginTop: 3 },
  lineTotalRow: { borderRadius: 8, borderWidth: 1, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  lineTotalLabel: { fontSize: 13, fontWeight: "600" },
  lineTotalValue: { fontSize: 16, fontWeight: "700" },
  detailMeta: { fontSize: 14, marginBottom: 4 },
  detailItemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailMetas: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  detailMetaChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: "500", overflow: "hidden" },
  actionBtn: { borderRadius: 10, padding: 12, alignItems: "center", marginTop: 12 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  detailItemCard: { borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 8 },
  totalLine: { fontSize: 17, fontWeight: "700", textAlign: "right", marginTop: 8 },
});
