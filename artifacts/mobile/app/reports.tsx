import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useStorage } from "@/hooks/useStorage";
import { exportToCsv } from "@/utils/exportCsv";

/**
 * Reports screen — live business analytics.
 * Kitchen sales EXCLUDE alcohol per business policy.
 * Bar & Service data appears only in Ordering and Inventory sections.
 */

const PERIODS = ["Today", "This Week", "This Month", "All Time"] as const;
type Period = (typeof PERIODS)[number];

// ─── Minimal types (mirrors each module's storage shape) ────────────────────
type Walkthrough = {
  id: string; date: string; shift: string; conductedBy: string;
  items: { id: string; label: string; checked: boolean }[];
  notes: string; completed: boolean;
};
type WasteEntry = {
  id: string; date: string; item: string; category: string;
  quantity: string; unit: string; costPerUnit: string; reason: string; recordedBy: string;
};
type SaleEntry = {
  id: string; date: string; shift: string; category: string;
  item: string; quantity: string; unitPrice: string; server: string;
};
type PriceEntry = {
  id: string; item: string; distributor: string; category: string;
  unit: string; currentPrice: string; previousPrice: string;
  lastUpdated: string; sku: string; notes: string;
};
type InventoryItem = {
  id: string; name: string; category: string; currentStock: string;
  parLevel: string; unit: string; location: string; lastCounted: string; cost: string;
};
type OrderItem = {
  id: string; item: string; category: string; quantity: string;
  unit: string; distributor: string; estimatedCost: string; notes: string;
};
type Order = {
  id: string; date: string; status: "Draft" | "Submitted" | "Received";
  distributor: string; items: OrderItem[]; notes: string;
};

// ─── Period filter helper ────────────────────────────────────────────────────
function inPeriod(dateStr: string, period: Period): boolean {
  if (period === "All Time") return true;
  const today = new Date();
  const todayStr = today.toLocaleDateString();
  if (period === "Today") return dateStr === todayStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (period === "This Week") {
    const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    return d >= weekAgo;
  }
  if (period === "This Month") {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }
  return true;
}

function topBy<T>(arr: T[], keyFn: (item: T) => string): string {
  if (arr.length === 0) return "—";
  const counts: Record<string, number> = {};
  arr.forEach((item) => {
    const k = keyFn(item);
    counts[k] = (counts[k] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

function topByValue<T>(arr: T[], keyFn: (item: T) => string, valFn: (item: T) => number): string {
  if (arr.length === 0) return "—";
  const totals: Record<string, number> = {};
  arr.forEach((item) => {
    const k = keyFn(item);
    totals[k] = (totals[k] ?? 0) + valFn(item);
  });
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

function stockStatus(item: InventoryItem): "ok" | "low" | "critical" {
  const cur = parseFloat(item.currentStock) || 0;
  const par = parseFloat(item.parLevel) || 0;
  if (par === 0) return "ok";
  if (cur <= par * 0.25) return "critical";
  if (cur <= par * 0.6) return "low";
  return "ok";
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[cardStyles.value, { color }]}>{value}</Text>
      <Text style={[cardStyles.label, { color: colors.foreground }]}>{label}</Text>
      {sub ? <Text style={[cardStyles.sub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 14, width: "47%", flex: 1 },
  value: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600" },
  sub: { fontSize: 11, marginTop: 2 },
});

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={sectionStyles.section}>
      <View style={[sectionStyles.header, { borderLeftColor: color }]}>
        <Text style={[sectionStyles.title, { color: colors.foreground }]}>{title}</Text>
      </View>
      <View style={sectionStyles.grid}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  section: { gap: 10 },
  header: { borderLeftWidth: 3, paddingLeft: 10 },
  title: { fontSize: 16, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const colors = useColors();
  const [period, setPeriod] = React.useState<Period>("This Month");

  const [walkthroughs] = useStorage<Walkthrough[]>("walkthroughs", []);
  const [wasteEntries] = useStorage<WasteEntry[]>("waste_entries", []);
  const [salesEntries] = useStorage<SaleEntry[]>("sales_entries", []);
  const [pricingItems] = useStorage<PriceEntry[]>("pricing_items", []);
  const [inventoryItems] = useStorage<InventoryItem[]>("inventory_items", []);
  const [orders] = useStorage<Order[]>("orders", []);

  // Period-filtered slices
  const filteredWalkthroughs = walkthroughs.filter((w) => inPeriod(w.date, period));
  const filteredWaste = wasteEntries.filter((e) => inPeriod(e.date, period));
  const filteredSales = salesEntries.filter((e) => inPeriod(e.date, period));
  const filteredOrders = orders.filter((o) => inPeriod(o.date, period));

  // ── Kitchen Sales metrics ──
  const kitchenRevenue = filteredSales.reduce(
    (s, e) => s + (parseFloat(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0), 0
  );
  const totalItemsSold = filteredSales.reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);
  const avgSaleValue = totalItemsSold > 0 ? kitchenRevenue / totalItemsSold : 0;
  const topCategory = topByValue(filteredSales, (e) => e.category, (e) => (parseFloat(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0));

  // ── Waste metrics ──
  const totalWasteCost = filteredWaste.reduce(
    (s, e) => s + (parseFloat(e.quantity) || 0) * (parseFloat(e.costPerUnit) || 0), 0
  );
  const topWasteReason = topBy(filteredWaste, (e) => e.reason);
  const wastePct = kitchenRevenue > 0 ? ((totalWasteCost / kitchenRevenue) * 100).toFixed(1) : "—";

  // ── Walkthrough metrics ──
  const walkthroughCount = filteredWalkthroughs.length;
  const avgCompletion = walkthroughCount > 0
    ? Math.round(
        filteredWalkthroughs.reduce(
          (s, w) => s + (w.items.filter((i) => i.checked).length / w.items.length) * 100, 0
        ) / walkthroughCount
      )
    : null;
  const incompleteWalkthroughs = filteredWalkthroughs.filter(
    (w) => w.items.some((i) => !i.checked)
  ).length;

  // ── Inventory metrics (all time — inventory is current state) ──
  const criticalItems = inventoryItems.filter((i) => stockStatus(i) === "critical").length;
  const lowItems = inventoryItems.filter((i) => stockStatus(i) === "low").length;
  const inventoryValue = inventoryItems.reduce(
    (s, i) => s + (parseFloat(i.currentStock) || 0) * (parseFloat(i.cost) || 0), 0
  );

  // ── Ordering metrics ──
  const openOrders = filteredOrders.filter((o) => o.status === "Draft" || o.status === "Submitted").length;
  const receivedOrders = filteredOrders.filter((o) => o.status === "Received").length;
  const pendingOrderValue = filteredOrders
    .filter((o) => o.status !== "Received")
    .reduce((s, o) => s + o.items.reduce(
      (si, i) => si + (parseFloat(i.quantity) || 0) * (parseFloat(i.estimatedCost) || 0), 0
    ), 0);

  // ── Pricing metrics (all time) ──
  const priceIncreases = pricingItems.filter(
    (p) => p.previousPrice && parseFloat(p.currentPrice) > parseFloat(p.previousPrice)
  ).length;
  const priceDecreases = pricingItems.filter(
    (p) => p.previousPrice && parseFloat(p.currentPrice) < parseFloat(p.previousPrice)
  ).length;

  // ── Summary export ──
  function exportSummary() {
    exportToCsv("Business_Summary_Report", [
      { Section: "Kitchen Sales", Metric: "Revenue ($)", Value: kitchenRevenue.toFixed(2) },
      { Section: "Kitchen Sales", Metric: "Items Sold", Value: totalItemsSold },
      { Section: "Kitchen Sales", Metric: "Avg Sale Value ($)", Value: avgSaleValue.toFixed(2) },
      { Section: "Kitchen Sales", Metric: "Top Category", Value: topCategory },
      { Section: "Waste", Metric: "Total Waste Cost ($)", Value: totalWasteCost.toFixed(2) },
      { Section: "Waste", Metric: "Entries", Value: filteredWaste.length },
      { Section: "Waste", Metric: "Top Reason", Value: topWasteReason },
      { Section: "Waste", Metric: "Waste % of Sales", Value: wastePct === "—" ? "N/A" : `${wastePct}%` },
      { Section: "Walkthroughs", Metric: "Count", Value: walkthroughCount },
      { Section: "Walkthroughs", Metric: "Avg Completion", Value: avgCompletion !== null ? `${avgCompletion}%` : "N/A" },
      { Section: "Walkthroughs", Metric: "Incomplete", Value: incompleteWalkthroughs },
      { Section: "Inventory", Metric: "Critical Items", Value: criticalItems },
      { Section: "Inventory", Metric: "Low Stock Items", Value: lowItems },
      { Section: "Inventory", Metric: "Total SKUs", Value: inventoryItems.length },
      { Section: "Inventory", Metric: "Inventory Value ($)", Value: inventoryValue.toFixed(2) },
      { Section: "Ordering", Metric: "Open Orders", Value: openOrders },
      { Section: "Ordering", Metric: "Received Orders", Value: receivedOrders },
      { Section: "Ordering", Metric: "Pending Order Value ($)", Value: pendingOrderValue.toFixed(2) },
      { Section: "Pricing", Metric: "Tracked Items", Value: pricingItems.length },
      { Section: "Pricing", Metric: "Price Increases", Value: priceIncreases },
      { Section: "Pricing", Metric: "Price Decreases", Value: priceDecreases },
    ]);
  }

  const hasAnyData = walkthroughs.length + wasteEntries.length + salesEntries.length +
    pricingItems.length + inventoryItems.length + orders.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Alcohol notice */}
        <View style={[styles.noticeBanner, { backgroundColor: "#fef3c7", borderColor: "#f59e0b" }]}>
          <Text style={[styles.noticeText, { color: "#92400e" }]}>
            ⚠ Kitchen sales reports exclude alcohol. Bar & service figures appear in Ordering & Inventory sections only.
          </Text>
        </View>

        {/* Period + Export row */}
        <View style={styles.topRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodChip,
                  { borderColor: colors.border },
                  period === p && { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
                ]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodChipText, { color: period === p ? "#fff" : colors.foreground }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: "#0ea5e9" }]}
            onPress={exportSummary}
          >
            <Text style={[styles.exportBtnText, { color: "#0ea5e9" }]}>⬆ Export</Text>
          </TouchableOpacity>
        </View>

        {!hasAnyData && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Log entries in each module and they'll appear here automatically.
            </Text>
          </View>
        )}

        {/* ── Kitchen Sales ── */}
        <Section title="Kitchen Sales (Alcohol Excluded)" color="#10b981">
          <MetricCard label="Revenue" value={`$${kitchenRevenue.toFixed(2)}`} sub={`${filteredSales.length} entries`} color="#10b981" />
          <MetricCard label="Items Sold" value={totalItemsSold > 0 ? String(totalItemsSold) : "0"} sub="Food & non-alc. bev." color="#3b82f6" />
          <MetricCard label="Avg Sale Value" value={avgSaleValue > 0 ? `$${avgSaleValue.toFixed(2)}` : "—"} sub="Per item" color="#8b5cf6" />
          <MetricCard label="Top Category" value={topCategory} sub="By revenue" color="#f59e0b" />
        </Section>

        {/* ── Waste ── */}
        <Section title="Waste Management" color="#ef4444">
          <MetricCard label="Waste Cost" value={`$${totalWasteCost.toFixed(2)}`} sub={`${filteredWaste.length} entries`} color="#ef4444" />
          <MetricCard label="Waste % of Sales" value={typeof wastePct === "string" && wastePct !== "—" ? `${wastePct}%` : wastePct} sub="Kitchen sales only" color={parseFloat(String(wastePct)) > 5 ? "#ef4444" : "#10b981"} />
          <MetricCard label="Top Reason" value={topWasteReason} sub="Most common" color="#f59e0b" />
          <MetricCard label="Top Category" value={topBy(filteredWaste, (e) => e.category)} sub="By entries" color="#8b5cf6" />
        </Section>

        {/* ── Walkthroughs ── */}
        <Section title="Shift Walkthroughs" color="#3b82f6">
          <MetricCard label="Completed" value={String(walkthroughCount)} sub={period} color="#3b82f6" />
          <MetricCard label="Avg Completion" value={avgCompletion !== null ? `${avgCompletion}%` : "—"} sub="Checklist %" color={avgCompletion !== null && avgCompletion < 80 ? "#f59e0b" : "#10b981"} />
          <MetricCard label="Incomplete" value={String(incompleteWalkthroughs)} sub="Below 100%" color={incompleteWalkthroughs > 0 ? "#f59e0b" : "#10b981"} />
          <MetricCard label="Top Shift" value={topBy(filteredWalkthroughs, (w) => w.shift)} sub="Most covered" color="#8b5cf6" />
        </Section>

        {/* ── Inventory ── */}
        <Section title="Inventory Status (Current)" color="#f97316">
          <MetricCard label="Critical Items" value={String(criticalItems)} sub="Below 25% par" color={criticalItems > 0 ? "#ef4444" : "#10b981"} />
          <MetricCard label="Low Stock" value={String(lowItems)} sub="Below 60% par" color={lowItems > 0 ? "#f59e0b" : "#10b981"} />
          <MetricCard label="Total SKUs" value={String(inventoryItems.length)} sub="All categories" color="#3b82f6" />
          <MetricCard label="Inventory Value" value={`$${inventoryValue.toFixed(2)}`} sub="At cost" color="#8b5cf6" />
        </Section>

        {/* ── Ordering ── */}
        <Section title="Ordering" color="#f97316">
          <MetricCard label="Open Orders" value={String(openOrders)} sub="Draft + Submitted" color={openOrders > 0 ? "#f97316" : "#10b981"} />
          <MetricCard label="Received" value={String(receivedOrders)} sub={period} color="#10b981" />
          <MetricCard label="Pending Value" value={`$${pendingOrderValue.toFixed(2)}`} sub="Est. open orders" color="#8b5cf6" />
          <MetricCard label="Top Distributor" value={topBy(filteredOrders, (o) => o.distributor)} sub="By order count" color="#3b82f6" />
        </Section>

        {/* ── Distributor Pricing ── */}
        <Section title="Distributor Pricing (All Time)" color="#8b5cf6">
          <MetricCard label="Tracked Items" value={String(pricingItems.length)} sub="Across all vendors" color="#8b5cf6" />
          <MetricCard label="Price Increases" value={String(priceIncreases)} sub="Since last update" color={priceIncreases > 0 ? "#ef4444" : "#10b981"} />
          <MetricCard label="Price Decreases" value={String(priceDecreases)} sub="Since last update" color={priceDecreases > 0 ? "#10b981" : colors.mutedForeground} />
          <MetricCard label="Top Distributor" value={topBy(pricingItems, (p) => p.distributor)} sub="By item count" color="#f59e0b" />
        </Section>

        {/* ── Business Health Summary ── */}
        <View style={[styles.summaryCard, { backgroundColor: "#0ea5e920", borderColor: "#0ea5e940" }]}>
          <Text style={[styles.summaryTitle, { color: "#0ea5e9" }]}>Business Health — {period}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: "#10b981" }]}>${kitchenRevenue.toFixed(2)}</Text>
              <Text style={[styles.summaryLbl, { color: colors.mutedForeground }]}>Kitchen Revenue</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: "#ef4444" }]}>${totalWasteCost.toFixed(2)}</Text>
              <Text style={[styles.summaryLbl, { color: colors.mutedForeground }]}>Waste Cost</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: criticalItems > 0 ? "#ef4444" : "#10b981" }]}>{criticalItems}</Text>
              <Text style={[styles.summaryLbl, { color: colors.mutedForeground }]}>Critical Stock</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: "#3b82f6" }]}>{walkthroughCount}</Text>
              <Text style={[styles.summaryLbl, { color: colors.mutedForeground }]}>Walkthroughs</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 16 },
  noticeBanner: { borderRadius: 8, borderWidth: 1, padding: 10 },
  noticeText: { fontSize: 13, lineHeight: 18 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  periodChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  periodChipText: { fontSize: 13, fontWeight: "500" },
  exportBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  exportBtnText: { fontWeight: "700", fontSize: 13 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "600", marginBottom: 6 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  summaryTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  summaryItem: { width: "45%", alignItems: "center" },
  summaryVal: { fontSize: 26, fontWeight: "700" },
  summaryLbl: { fontSize: 12, marginTop: 2 },
});
