import { useRouter } from "expo-router";
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

const MODES = [
  {
    id: "walkthroughs",
    title: "Walkthroughs",
    description: "Daily shift inspections",
    icon: "✓",
    color: "#3b82f6",
    route: "/walkthroughs",
  },
  {
    id: "waste",
    title: "Waste Management",
    description: "Log & track food waste",
    icon: "♻",
    color: "#f59e0b",
    route: "/waste",
  },
  {
    id: "pricing",
    title: "Distributor Pricing",
    description: "Vendor price tracking",
    icon: "$",
    color: "#8b5cf6",
    route: "/pricing",
  },
  {
    id: "sales",
    title: "Kitchen Sales",
    description: "Food sales reports (no alcohol)",
    icon: "📊",
    color: "#10b981",
    route: "/sales",
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Stock counts & par levels",
    icon: "📦",
    color: "#ef4444",
    route: "/inventory",
  },
  {
    id: "ordering",
    title: "Ordering",
    description: "All categories incl. bar & service",
    icon: "🛒",
    color: "#f97316",
    route: "/ordering",
  },
  {
    id: "reports",
    title: "Reports",
    description: "Business analytics summary",
    icon: "📈",
    color: "#0ea5e9",
    route: "/reports",
  },
  {
    id: "notifications",
    title: "Reminders",
    description: "Daily walkthrough alerts",
    icon: "🔔",
    color: "#6366f1",
    route: "/notifications",
  },
  {
    id: "hours",
    title: "Kitchen Hours",
    description: "Per-day schedules & time slots",
    icon: "🕐",
    color: "#0891b2",
    route: "/hours",
  },
  {
    id: "schedule",
    title: "Employee Schedule",
    description: "Staff roster & weekly shifts",
    icon: "👥",
    color: "#059669",
    route: "/schedule",
  },
  {
    id: "temps",
    title: "Temperature Log",
    description: "Equipment temps & safe ranges",
    icon: "🌡️",
    color: "#dc2626",
    route: "/temps",
  },
  {
    id: "prep",
    title: "Prep Hub",
    description: "Recipe book & batch yield calculator",
    icon: "👨‍🍳",
    color: "#16a34a",
    route: "/prep",
  },
];

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Business Manager
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Select a module to get started
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {MODES.map((mode) => (
          <TouchableOpacity
            key={mode.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(mode.route as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconContainer, { backgroundColor: mode.color + "20" }]}>
              <Text style={styles.iconText}>{mode.icon}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {mode.title}
              </Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                {mode.description}
              </Text>
            </View>
            <View style={[styles.arrow, { backgroundColor: mode.color }]}>
              <Text style={styles.arrowText}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", marginBottom: 2 },
  headerSub: { fontSize: 14 },
  grid: { padding: 16, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  cardDesc: { fontSize: 13 },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { color: "#fff", fontSize: 20, lineHeight: 26 },
});
