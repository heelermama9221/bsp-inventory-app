import React, { useState, useCallback } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useStorage } from "@/hooks/useStorage";

// ── Types ────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string;
  name: string;
  parQty: string;
  unit: string;
  notes: string;
};

type Station = {
  id: string;
  name: string;
  icon: string;
  items: LineItem[];
};

type CheckEntry = {
  itemId: string;
  actual: string;
};

type CheckSession = {
  id: string;
  label: string;
  shift: "AM" | "PM" | "Mid";
  completedAt: string;
  entries: CheckEntry[];
  stationIds: string[];
  notes: string;
  passed: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATION_ICONS = ["🍳", "❄️", "🔥", "🥗", "🍺", "🍽️", "📦", "⚙️", "🥩", "🍲"];
const UNITS = ["each", "oz", "lbs", "portions", "pans", "trays", "cups", "qt", "bags", "bottles", "cans"];
const SHIFTS = ["AM", "PM", "Mid"] as const;

const DEFAULT_STATIONS: Station[] = [
  {
    id: "cold-line",
    name: "Cold Line",
    icon: "❄️",
    items: [
      { id: "cl-1", name: "Salad greens", parQty: "3", unit: "lbs", notes: "" },
      { id: "cl-2", name: "House dressing", parQty: "2", unit: "qt", notes: "" },
    ],
  },
  {
    id: "hot-line",
    name: "Hot Line",
    icon: "🔥",
    items: [
      { id: "hl-1", name: "Sauté station mise en place", parQty: "1", unit: "each", notes: "Full hotel pans" },
    ],
  },
  {
    id: "expo",
    name: "Expo / Pass",
    icon: "🍽️",
    items: [
      { id: "ex-1", name: "Garnish mise en place", parQty: "1", unit: "each", notes: "" },
      { id: "ex-2", name: "Plate liners", parQty: "50", unit: "each", notes: "" },
    ],
  },
  {
    id: "service",
    name: "Service Station",
    icon: "📦",
    items: [
      { id: "sv-1", name: "Napkins stocked", parQty: "200", unit: "each", notes: "" },
      { id: "sv-2", name: "Condiments filled", parQty: "1", unit: "each", notes: "Full set" },
    ],
  },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function pctColor(pct: number): string {
  if (pct >= 100) return "#16a34a";
  if (pct >= 75) return "#f59e0b";
  return "#ef4444";
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LineCheckScreen() {
  const colors = useColors();

  const [stations, setStations, stationsLoaded] = useStorage<Station[]>("line_stations", DEFAULT_STATIONS);
  const [history, setHistory, histLoaded] = useStorage<CheckSession[]>("line_check_history", []);

  const [tab, setTab] = useState<"check" | "setup" | "history">("check");

  // Active check state
  const [shift, setShift] = useState<"AM" | "PM" | "Mid">("AM");
  const [checkLabel, setCheckLabel] = useState("");
  const [checkEntries, setCheckEntries] = useState<Record<string, string>>({});
  const [checkNotes, setCheckNotes] = useState("");
  const [checkInProgress, setCheckInProgress] = useState(false);

  // Setup modals
  const [stationModal, setStationModal] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [stationForm, setStationForm] = useState({ name: "", icon: "🍳" });

  const [itemModal, setItemModal] = useState(false);
  const [itemStationId, setItemStationId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: "", parQty: "", unit: "each", notes: "" });

  // History detail
  const [detailSession, setDetailSession] = useState<CheckSession | null>(null);

  if (!stationsLoaded || !histLoaded) return null;

  // ── Check helpers ─────────────────────────────────────────────────────────

  function startCheck() {
    setCheckEntries({});
    setCheckNotes("");
    setCheckInProgress(true);
  }

  function setEntry(itemId: string, val: string) {
    setCheckEntries((prev) => ({ ...prev, [itemId]: val }));
  }

  function getStatus(item: LineItem): { pct: number; short: number; color: string; label: string } {
    const actual = parseFloat(checkEntries[item.id] ?? "");
    const par = parseFloat(item.parQty) || 0;
    if (isNaN(actual)) return { pct: 0, short: par, color: colors.mutedForeground, label: "Not checked" };
    const pct = par > 0 ? Math.min(100, (actual / par) * 100) : 100;
    const short = Math.max(0, par - actual);
    return { pct, short, color: pctColor(pct), label: pct >= 100 ? "✓ Stocked" : `Short ${short.toFixed(1)} ${item.unit}` };
  }

  function completeCheck() {
    const allItems = stations.flatMap((s) => s.items);
    const checkedCount = allItems.filter((i) => checkEntries[i.id] !== undefined).length;
    if (checkedCount === 0) {
      Alert.alert("No entries", "Enter at least one quantity before completing the check.");
      return;
    }
    const entries: CheckEntry[] = Object.entries(checkEntries).map(([itemId, actual]) => ({ itemId, actual }));
    const allPassed = allItems.every((i) => {
      const actual = parseFloat(checkEntries[i.id] ?? "");
      const par = parseFloat(i.parQty) || 0;
      return !isNaN(actual) && actual >= par;
    });
    const session: CheckSession = {
      id: uid(),
      label: checkLabel.trim() || `${shift} Line Check`,
      shift,
      completedAt: new Date().toISOString(),
      entries,
      stationIds: stations.map((s) => s.id),
      notes: checkNotes.trim(),
      passed: allPassed,
    };
    setHistory((prev) => [session, ...prev]);
    setCheckInProgress(false);
    setCheckEntries({});
    setCheckLabel("");
    setCheckNotes("");
    Alert.alert(allPassed ? "✓ Line Check Passed!" : "⚠ Line Check Complete", allPassed ? "All items are at or above par. Ready for service!" : "Some items are short. Review the summary below.");
  }

  function abandonCheck() {
    Alert.alert("Abandon check?", "Your entries will be lost.", [
      { text: "Keep going", style: "cancel" },
      { text: "Abandon", style: "destructive", onPress: () => { setCheckInProgress(false); setCheckEntries({}); } },
    ]);
  }

  // ── Station setup ─────────────────────────────────────────────────────────

  function openAddStation() {
    setEditingStation(null);
    setStationForm({ name: "", icon: "🍳" });
    setStationModal(true);
  }

  function openEditStation(s: Station) {
    setEditingStation(s);
    setStationForm({ name: s.name, icon: s.icon });
    setStationModal(true);
  }

  function saveStation() {
    if (!stationForm.name.trim()) { Alert.alert("Required", "Station name is required."); return; }
    if (editingStation) {
      setStations((prev) => prev.map((s) => s.id === editingStation.id ? { ...s, name: stationForm.name.trim(), icon: stationForm.icon } : s));
    } else {
      setStations((prev) => [...prev, { id: uid(), name: stationForm.name.trim(), icon: stationForm.icon, items: [] }]);
    }
    setStationModal(false);
  }

  function deleteStation(id: string) {
    Alert.alert("Delete station?", "All items in this station will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setStations((prev) => prev.filter((s) => s.id !== id)) },
    ]);
  }

  // ── Item setup ────────────────────────────────────────────────────────────

  function openAddItem(stationId: string) {
    setItemStationId(stationId);
    setEditingItem(null);
    setItemForm({ name: "", parQty: "", unit: "each", notes: "" });
    setItemModal(true);
  }

  function openEditItem(stationId: string, item: LineItem) {
    setItemStationId(stationId);
    setEditingItem(item);
    setItemForm({ name: item.name, parQty: item.parQty, unit: item.unit, notes: item.notes });
    setItemModal(true);
  }

  function saveItem() {
    if (!itemForm.name.trim() || !itemForm.parQty.trim()) { Alert.alert("Required", "Name and par qty are required."); return; }
    const newItem: LineItem = { id: editingItem?.id ?? uid(), name: itemForm.name.trim(), parQty: itemForm.parQty, unit: itemForm.unit, notes: itemForm.notes.trim() };
    setStations((prev) => prev.map((s) => {
      if (s.id !== itemStationId) return s;
      if (editingItem) return { ...s, items: s.items.map((i) => i.id === editingItem.id ? newItem : i) };
      return { ...s, items: [...s.items, newItem] };
    }));
    setItemModal(false);
  }

  function deleteItem(stationId: string, itemId: string) {
    Alert.alert("Remove item?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setStations((prev) => prev.map((s) => s.id === stationId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s)) },
    ]);
  }

  // ── Summary stats ─────────────────────────────────────────────────────────

  const allItems = stations.flatMap((s) => s.items);
  const checkedItems = allItems.filter((i) => checkEntries[i.id] !== undefined);
  const shortItems = checkedItems.filter((i) => {
    const actual = parseFloat(checkEntries[i.id] ?? "");
    const par = parseFloat(i.parQty) || 0;
    return !isNaN(actual) && actual < par;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["check", "setup", "history"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: "#0891b2", borderBottomWidth: 2.5 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? "#0891b2" : colors.mutedForeground }]}>
              {t === "check" ? "✓ Line Check" : t === "setup" ? "⚙ Setup" : "🕐 History"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── LINE CHECK TAB ────────────────────────────────────────────────── */}
      {tab === "check" && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {!checkInProgress ? (
            <>
              {/* Start check */}
              <View style={[styles.startCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.startTitle, { color: colors.foreground }]}>Start a Line Check</Text>
                <Text style={[styles.startSub, { color: colors.mutedForeground }]}>
                  Walk each station and enter actual quantities. Items below par will be flagged instantly.
                </Text>

                <Text style={[styles.label, { color: colors.mutedForeground }]}>SHIFT</Text>
                <View style={styles.shiftRow}>
                  {SHIFTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.shiftBtn, { borderColor: shift === s ? "#0891b2" : colors.border, backgroundColor: shift === s ? "#0891b2" : colors.background }]}
                      onPress={() => setShift(s)}
                    >
                      <Text style={[styles.shiftBtnText, { color: shift === s ? "#fff" : colors.foreground }]}>{s} Shift</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.mutedForeground }]}>LABEL (optional)</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  placeholder={`e.g. ${shift} Line Check — Monday`}
                  placeholderTextColor={colors.mutedForeground}
                  value={checkLabel}
                  onChangeText={setCheckLabel}
                />

                <TouchableOpacity style={[styles.startBtn, { backgroundColor: "#0891b2" }]} onPress={startCheck}>
                  <Text style={styles.startBtnText}>▶  Begin Check</Text>
                </TouchableOpacity>
              </View>

              {/* Last check summary */}
              {history.length > 0 && (
                <View style={[styles.lastCheckCard, { backgroundColor: history[0].passed ? "#16a34a10" : "#ef444410", borderColor: history[0].passed ? "#16a34a40" : "#ef444440" }]}>
                  <Text style={[styles.lastCheckLabel, { color: colors.mutedForeground }]}>LAST CHECK</Text>
                  <Text style={[styles.lastCheckName, { color: colors.foreground }]}>{history[0].label}</Text>
                  <Text style={[styles.lastCheckTime, { color: colors.mutedForeground }]}>{formatTime(history[0].completedAt)}</Text>
                  <View style={[styles.lastCheckBadge, { backgroundColor: history[0].passed ? "#16a34a" : "#ef4444" }]}>
                    <Text style={styles.lastCheckBadgeText}>{history[0].passed ? "✓ PASSED" : "⚠ ITEMS SHORT"}</Text>
                  </View>
                </View>
              )}

              {stations.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.emptyIcon}>⚙️</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No stations configured</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
                    Go to the Setup tab to add your prep stations and par levels.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Active check header */}
              <View style={[styles.checkHeader, { backgroundColor: "#0891b210", borderColor: "#0891b240" }]}>
                <View>
                  <Text style={[styles.checkHeaderTitle, { color: "#0891b2" }]}>
                    {checkLabel.trim() || `${shift} Line Check`}
                  </Text>
                  <Text style={[styles.checkHeaderSub, { color: colors.mutedForeground }]}>
                    {checkedItems.length}/{allItems.length} checked · {shortItems.length > 0 ? `${shortItems.length} short` : "all OK so far"}
                  </Text>
                </View>
                <TouchableOpacity onPress={abandonCheck}>
                  <Text style={[styles.abandonBtn, { color: colors.destructive }]}>Abandon</Text>
                </TouchableOpacity>
              </View>

              {/* Stations */}
              {stations.map((station) => (
                <View key={station.id}>
                  <View style={[styles.stationHeader, { borderBottomColor: colors.border }]}>
                    <Text style={styles.stationHeaderIcon}>{station.icon}</Text>
                    <Text style={[styles.stationHeaderName, { color: colors.foreground }]}>{station.name}</Text>
                    <Text style={[styles.stationHeaderCount, { color: colors.mutedForeground }]}>
                      {station.items.filter((i) => checkEntries[i.id] !== undefined).length}/{station.items.length}
                    </Text>
                  </View>

                  {station.items.length === 0 && (
                    <Text style={[styles.noItemsText, { color: colors.mutedForeground }]}>No items — add in Setup</Text>
                  )}

                  {station.items.map((item) => {
                    const status = getStatus(item);
                    const hasEntry = checkEntries[item.id] !== undefined;
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.checkItemRow,
                          { backgroundColor: colors.card, borderColor: hasEntry ? status.color + "50" : colors.border },
                          hasEntry && { borderLeftWidth: 3, borderLeftColor: status.color },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.checkItemName, { color: colors.foreground }]}>{item.name}</Text>
                          <Text style={[styles.checkItemPar, { color: colors.mutedForeground }]}>
                            Par: {item.parQty} {item.unit}
                            {item.notes ? `  ·  ${item.notes}` : ""}
                          </Text>
                          {hasEntry && (
                            <Text style={[styles.checkItemStatus, { color: status.color }]}>{status.label}</Text>
                          )}
                        </View>
                        <View style={styles.checkItemRight}>
                          <View style={[styles.checkInputWrap, { borderColor: hasEntry ? status.color : colors.border, backgroundColor: colors.background }]}>
                            <TextInput
                              style={[styles.checkInput, { color: colors.foreground }]}
                              value={checkEntries[item.id] ?? ""}
                              onChangeText={(v) => setEntry(item.id, v)}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={colors.mutedForeground}
                            />
                          </View>
                          <Text style={[styles.checkItemUnit, { color: colors.mutedForeground }]}>{item.unit}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Notes */}
              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>NOTES (optional)</Text>
              <TextInput
                style={[styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="Any issues, context, or follow-up items…"
                placeholderTextColor={colors.mutedForeground}
                value={checkNotes}
                onChangeText={setCheckNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Complete button */}
              <TouchableOpacity style={[styles.completeBtn, { backgroundColor: "#16a34a" }]} onPress={completeCheck}>
                <Text style={styles.completeBtnText}>✓  Complete Line Check</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── SETUP TAB ─────────────────────────────────────────────────────── */}
      {tab === "setup" && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.infoBox, { backgroundColor: "#0891b212", borderColor: "#0891b240" }]}>
            <Text style={[styles.infoText, { color: "#0e7490" }]}>
              Configure your prep stations and set par (target) quantities for each item. These become the checklist for every line check.
            </Text>
          </View>

          <TouchableOpacity style={[styles.addStationBtn, { backgroundColor: "#0891b2" }]} onPress={openAddStation}>
            <Text style={styles.addStationBtnText}>+ Add Station</Text>
          </TouchableOpacity>

          {stations.map((station) => (
            <View key={station.id} style={[styles.setupStation, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.setupStationHeader}>
                <Text style={styles.setupStationIcon}>{station.icon}</Text>
                <Text style={[styles.setupStationName, { color: colors.foreground }]}>{station.name}</Text>
                <TouchableOpacity onPress={() => openEditStation(station)} style={styles.setupAction}>
                  <Text style={[styles.setupActionText, { color: "#0891b2" }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteStation(station.id)} style={styles.setupAction}>
                  <Text style={[styles.setupActionText, { color: colors.destructive }]}>Delete</Text>
                </TouchableOpacity>
              </View>

              {station.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.setupItem, { borderTopColor: colors.border }]}
                  onPress={() => openEditItem(station.id, item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.setupItemName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.setupItemPar, { color: colors.mutedForeground }]}>
                      Par: {item.parQty} {item.unit}{item.notes ? `  ·  ${item.notes}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteItem(station.id, item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[{ color: colors.destructive, fontSize: 13 }]}>Remove</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={[styles.addItemBtn, { borderColor: "#0891b2" }]} onPress={() => openAddItem(station.id)}>
                <Text style={[styles.addItemBtnText, { color: "#0891b2" }]}>+ Add Item</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────────── */}
      {tab === "history" && (
        <ScrollView contentContainerStyle={styles.content}>
          {history.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.emptyIcon}>🕐</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No checks yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
                Completed line checks will appear here.
              </Text>
            </View>
          ) : (
            history.map((session) => {
              const shortCount = session.entries.filter((e) => {
                const actual = parseFloat(e.actual);
                const item = stations.flatMap((s) => s.items).find((i) => i.id === e.itemId);
                if (!item) return false;
                return !isNaN(actual) && actual < parseFloat(item.parQty);
              }).length;
              return (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.historyCard, { backgroundColor: colors.card, borderColor: session.passed ? "#16a34a30" : "#ef444430", borderLeftWidth: 4, borderLeftColor: session.passed ? "#16a34a" : "#ef4444" }]}
                  onPress={() => setDetailSession(session)}
                >
                  <View style={styles.historyTop}>
                    <Text style={[styles.historyName, { color: colors.foreground }]}>{session.label}</Text>
                    <View style={[styles.historyBadge, { backgroundColor: session.passed ? "#16a34a" : "#ef4444" }]}>
                      <Text style={styles.historyBadgeText}>{session.passed ? "PASSED" : "SHORT"}</Text>
                    </View>
                  </View>
                  <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
                    {formatTime(session.completedAt)}  ·  {session.shift} Shift
                    {shortCount > 0 ? `  ·  ${shortCount} item${shortCount !== 1 ? "s" : ""} short` : "  ·  All items stocked"}
                  </Text>
                  {session.notes ? (
                    <Text style={[styles.historyNotes, { color: colors.mutedForeground }]} numberOfLines={2}>{session.notes}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}

          {history.length > 0 && (
            <TouchableOpacity
              style={[styles.clearHistBtn, { borderColor: colors.destructive + "50" }]}
              onPress={() => Alert.alert("Clear history?", "Remove all line check records?", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: () => setHistory([]) },
              ])}
            >
              <Text style={[styles.clearHistBtnText, { color: colors.destructive }]}>🗑 Clear history</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── Station Form Modal ────────────────────────────────────────────── */}
      <Modal visible={stationModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStationModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingStation ? "Edit Station" : "New Station"}</Text>
            <TouchableOpacity onPress={saveStation}>
              <Text style={[styles.saveBtn, { color: "#0891b2" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.mutedForeground }]}>STATION NAME</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Cold Line, Grill Station, Expo…"
              placeholderTextColor={colors.mutedForeground}
              value={stationForm.name}
              onChangeText={(v) => setStationForm((f) => ({ ...f, name: v }))}
              autoFocus
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ICON</Text>
            <View style={styles.iconRow}>
              {STATION_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBtn, { borderColor: stationForm.icon === ic ? "#0891b2" : colors.border, backgroundColor: stationForm.icon === ic ? "#0891b220" : colors.card }]}
                  onPress={() => setStationForm((f) => ({ ...f, icon: ic }))}
                >
                  <Text style={styles.iconBtnText}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Item Form Modal ───────────────────────────────────────────────── */}
      <Modal visible={itemModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setItemModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingItem ? "Edit Item" : "New Item"}</Text>
            <TouchableOpacity onPress={saveItem}>
              <Text style={[styles.saveBtn, { color: "#0891b2" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ITEM NAME *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Salad greens, Sauté mise en place…"
              placeholderTextColor={colors.mutedForeground}
              value={itemForm.name}
              onChangeText={(v) => setItemForm((f) => ({ ...f, name: v }))}
              autoFocus
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>PAR QUANTITY * (target for service readiness)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. 3"
              placeholderTextColor={colors.mutedForeground}
              value={itemForm.parQty}
              onChangeText={(v) => setItemForm((f) => ({ ...f, parQty: v }))}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.chip, { borderColor: itemForm.unit === u ? "#0891b2" : colors.border, backgroundColor: itemForm.unit === u ? "#0891b2" : colors.card }]}
                  onPress={() => setItemForm((f) => ({ ...f, unit: u }))}
                >
                  <Text style={[styles.chipText, { color: itemForm.unit === u ? "#fff" : colors.foreground }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Full hotel pans, pre-portioned, chilled"
              placeholderTextColor={colors.mutedForeground}
              value={itemForm.notes}
              onChangeText={(v) => setItemForm((f) => ({ ...f, notes: v }))}
            />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── History Detail Modal ──────────────────────────────────────────── */}
      <Modal visible={!!detailSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ minWidth: 56 }} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{detailSession?.label}</Text>
            <TouchableOpacity onPress={() => setDetailSession(null)}>
              <Text style={[styles.saveBtn, { color: "#0891b2" }]}>Done</Text>
            </TouchableOpacity>
          </View>
          {detailSession && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={[styles.detailMeta, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.detailMetaText, { color: colors.mutedForeground }]}>{formatTime(detailSession.completedAt)}</Text>
                <Text style={[styles.detailMetaText, { color: colors.mutedForeground }]}>{detailSession.shift} Shift</Text>
                <View style={[styles.detailBadge, { backgroundColor: detailSession.passed ? "#16a34a" : "#ef4444" }]}>
                  <Text style={styles.detailBadgeText}>{detailSession.passed ? "✓ PASSED" : "⚠ ITEMS SHORT"}</Text>
                </View>
              </View>

              {stations.map((station) => {
                const stationEntries = detailSession.entries.filter((e) => station.items.some((i) => i.id === e.itemId));
                if (stationEntries.length === 0) return null;
                return (
                  <View key={station.id}>
                    <Text style={[styles.detailStationLabel, { color: colors.mutedForeground }]}>{station.icon} {station.name}</Text>
                    {station.items.map((item) => {
                      const entry = detailSession.entries.find((e) => e.itemId === item.id);
                      if (!entry) return null;
                      const actual = parseFloat(entry.actual);
                      const par = parseFloat(item.parQty) || 0;
                      const pct = par > 0 ? Math.min(100, (actual / par) * 100) : 100;
                      const color = pctColor(pct);
                      return (
                        <View key={item.id} style={[styles.detailRow, { backgroundColor: colors.card, borderColor: color + "40", borderLeftColor: color, borderLeftWidth: 3 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.detailItemName, { color: colors.foreground }]}>{item.name}</Text>
                            <Text style={[styles.detailItemPar, { color: colors.mutedForeground }]}>Par: {item.parQty} {item.unit}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={[styles.detailActual, { color }]}>{entry.actual} {item.unit}</Text>
                            <Text style={[styles.detailPct, { color }]}>{pct.toFixed(0)}%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {detailSession.notes ? (
                <>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
                  <View style={[styles.detailNotes, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[{ color: colors.foreground, fontSize: 14 }]}>{detailSession.notes}</Text>
                  </View>
                </>
              ) : null}

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: "600" },
  content: { padding: 16, gap: 12 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginTop: 12 },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  infoText: { fontSize: 13, lineHeight: 19 },
  // Start card
  startCard: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 4 },
  startTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  startSub: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  shiftRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  shiftBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  shiftBtnText: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginTop: 4 },
  textarea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 80 },
  startBtn: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  // Last check
  lastCheckCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 4 },
  lastCheckLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  lastCheckName: { fontSize: 16, fontWeight: "700" },
  lastCheckTime: { fontSize: 13 },
  lastCheckBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  lastCheckBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  // Empty
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyText: { fontSize: 14, lineHeight: 20 },
  // Active check header
  checkHeader: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  checkHeaderTitle: { fontSize: 16, fontWeight: "700" },
  checkHeaderSub: { fontSize: 13, marginTop: 2 },
  abandonBtn: { fontSize: 14, fontWeight: "600" },
  // Station header
  stationHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, marginBottom: 4 },
  stationHeaderIcon: { fontSize: 18 },
  stationHeaderName: { fontSize: 15, fontWeight: "700", flex: 1 },
  stationHeaderCount: { fontSize: 13 },
  noItemsText: { fontSize: 13, fontStyle: "italic", paddingVertical: 8 },
  // Check item row
  checkItemRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  checkItemName: { fontSize: 15, fontWeight: "600" },
  checkItemPar: { fontSize: 12, marginTop: 2 },
  checkItemStatus: { fontSize: 12, fontWeight: "700", marginTop: 3 },
  checkItemRight: { alignItems: "center", gap: 4 },
  checkInputWrap: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 64, alignItems: "center" },
  checkInput: { fontSize: 18, fontWeight: "700", textAlign: "center", minWidth: 40 },
  checkItemUnit: { fontSize: 11, fontWeight: "600" },
  completeBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  completeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  // Setup
  addStationBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  addStationBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  setupStation: { borderRadius: 14, borderWidth: 1, padding: 16 },
  setupStationHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  setupStationIcon: { fontSize: 20 },
  setupStationName: { fontSize: 16, fontWeight: "700", flex: 1 },
  setupAction: { paddingHorizontal: 6 },
  setupActionText: { fontSize: 13, fontWeight: "600" },
  setupItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, gap: 8 },
  setupItemName: { fontSize: 14, fontWeight: "600" },
  setupItemPar: { fontSize: 12, marginTop: 1 },
  addItemBtn: { borderWidth: 1, borderRadius: 8, borderStyle: "dashed", paddingVertical: 10, alignItems: "center", marginTop: 10 },
  addItemBtnText: { fontSize: 13, fontWeight: "600" },
  // History
  historyCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  historyTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyName: { fontSize: 15, fontWeight: "700", flex: 1 },
  historyBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  historyBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  historyMeta: { fontSize: 12 },
  historyNotes: { fontSize: 13, fontStyle: "italic" },
  clearHistBtn: { borderRadius: 12, borderWidth: 1, borderStyle: "dashed", padding: 14, alignItems: "center" },
  clearHistBtnText: { fontSize: 14, fontWeight: "600" },
  // Modal
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "700" },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalContent: { padding: 20, gap: 6 },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  iconBtn: { width: 48, height: 48, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 22 },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600" },
  // Detail modal
  detailMeta: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  detailMetaText: { fontSize: 13 },
  detailBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  detailBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  detailStationLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  detailRow: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  detailItemName: { fontSize: 14, fontWeight: "600" },
  detailItemPar: { fontSize: 12, marginTop: 2 },
  detailActual: { fontSize: 17, fontWeight: "800" },
  detailPct: { fontSize: 12, fontWeight: "700" },
  detailNotes: { borderRadius: 10, borderWidth: 1, padding: 14 },
});
