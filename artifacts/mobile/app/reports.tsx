import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

/**
 * Reports screen — business analytics overview.
 * Kitchen sales reports EXCLUDE alcohol per business rules.
 * Bar & service data visible under ordering/inventory summary only.
 */

const PERIODS = ["Today", "This Week", "This Month", "All Time"];

type MetricCard = { label: string; value: string; sub?: string; color: string };

export default function ReportsScreen() {
  const colors = useColors();
  const [period, setPeriod] = useState("Today");

  const kitchenMetrics: MetricCard[] = [
    { label: "Kitchen Revenue", value: "$0.00", sub: "Alcohol excluded", color: "#10b981" },
    { label: "Items Sold", value: "0", sub: "Food & non-alc. beverages", color: "#3b82f6" },
    { label: "Avg. Sale Value", value: "$0.00", sub: "Per kitchen item", color: "#8b5cf6" },
    { label: "Top Category", value: "—", sub: "By revenue", color: "#f59e0b" },
  ];

  const wasteMetrics: MetricCard[] = [
    { label: "Total Waste Cost", value: "$0.00", sub: "All categories", color: "#ef4444" },
    { label: "Waste Entries", value: "0", sub: "Logged entries", color: "#f97316" },
    { label: "Top Waste Reason", value: "—", sub: "Most common", color: "#f59e0b" },
    { label: "Waste % of Sales", value: "—%", sub: "Kitchen only", color: "#ef4444" },
  ];

  const walkthroughMetrics: MetricCard[] = [
    { label: "Walkthroughs", value: "0", sub: "Completed this period", color: "#3b82f6" },
    { label: "Avg. Completion", value: "—%", sub: "Checklist %", color: "#10b981" },
    { label: "Incomplete", value: "0", sub: "Below 100%", color: "#f59e0b" },
  ];

  const inventoryMetrics: MetricCard[] = [
    { label: "Critical Items", value: "0", sub: "Below 25% par", color: "#ef4444" },
    { label: "Low Stock Items", value: "0", sub: "Below 60% par", color: "#f59e0b" },
    { label: "Total SKUs", value: "0", sub: "All categories", color: "#3b82f6" },
    { label: "Inventory Value", value: "$0.00", sub: "At cost", color: "#8b5cf6" },
  ];

  const orderingMetrics: MetricCard[] = [
    { label: "Open Orders", value: "0", sub: "Draft + Submitted", color: "#f97316" },
    { label: "Received Orders", value: "0", sub: "This period", color: "#10b981" },
    { label: "Est. Order Value", value: "$0.00", sub: "Pending orders", color: "#8b5cf6" },
  ];

  const pricingMetrics: MetricCard[] = [
    { label: "Tracked Items", value: "0", sub: "Across all vendors", color: "#8b5cf6" },
    { label: "Price Increases", value: "0", sub: "Since last update", color: "#ef4444" },
    { label: "Price Decreases", value: "0", sub: "Since last update", color: "#10b981" },
  ];

  function Section({ title, color, metrics }: { title: string; color: string; metrics: MetricCard[] }) {
    return (
      <View style={styles.section}>
        <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        </View>
        <View style={styles.metricGrid}>
          {metrics.map((m) => (
            <View key={m.label} style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={[styles.metricLabel, { color: colors.foreground }]}>{m.label}</Text>
              {m.sub && <Text style={[styles.metricSub, { color: colors.mutedForeground }]}>{m.sub}</Text>}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Alcohol exclusion notice */}
        <View style={[styles.noticeBanner, { backgroundColor: "#fef3c7", borderColor: "#f59e0b" }]}>
          <Text style={[styles.noticeText, { color: "#92400e" }]}>
            ⚠ Kitchen sales reports exclude all alcohol. Bar & service data appears only in Ordering and Inventory modules.
          </Text>
        </View>

        {/* Period selector */}
        <View style={styles.periodRow}>
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
        </View>

        {/* Data note */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Reports will populate as you log data across the seven modules. All figures shown are for {period.toLowerCase()}.
          </Text>
        </View>

        <Section title="Kitchen Sales (Alcohol Excluded)" color="#10b981" metrics={kitchenMetrics} />
        <Section title="Waste Management" color="#ef4444" metrics={wasteMetrics} />
        <Section title="Shift Walkthroughs" color="#3b82f6" metrics={walkthroughMetrics} />
        <Section title="Inventory Status" color="#f97316" metrics={inventoryMetrics} />
        <Section title="Ordering" color="#f97316" metrics={orderingMetrics} />
        <Section title="Distributor Pricing" color="#8b5cf6" metrics={pricingMetrics} />

        {/* Summary footer */}
        <View style={[styles.footerCard, { backgroundColor: "#0ea5e920", borderColor: "#0ea5e940" }]}>
          <Text style={[styles.footerTitle, { color: "#0ea5e9" }]}>Business Health Summary</Text>
          <Text style={[styles.footerBody, { color: colors.mutedForeground }]}>
            Start logging data in each module to see trends, cost analytics, and operational insights populate here automatically.
          </Text>
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
  periodRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  periodChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  periodChipText: { fontSize: 13, fontWeight: "500" },
  infoCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  infoText: { fontSize: 14, lineHeight: 20 },
  section: { gap: 10 },
  sectionHeader: { borderLeftWidth: 3, paddingLeft: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    width: "47%",
    minWidth: 140,
    flex: 1,
  },
  metricValue: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  metricLabel: { fontSize: 13, fontWeight: "600" },
  metricSub: { fontSize: 11, marginTop: 2 },
  footerCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  footerTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  footerBody: { fontSize: 14, lineHeight: 20 },
});
