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

// ─── Types ────────────────────────────────────────────────────────────────────

type Equipment = {
  id: string;
  name: string;
  type: string;
  minTemp: string;
  maxTemp: string;
  unit: "F" | "C";
};

type TempReading = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  temp: string;
  unit: "F" | "C";
  date: string;
  time: string;
  shift: string;
  loggedBy: string;
  notes: string;
  inRange: boolean;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_EQUIPMENT: Equipment[] = [
  { id: "wic", name: "Walk-in Cooler", type: "Refrigeration", minTemp: "35", maxTemp: "41", unit: "F" },
  { id: "frz", name: "Freezer", type: "Freezer", minTemp: "-10", maxTemp: "0", unit: "F" },
  { id: "prep", name: "Prep Cooler", type: "Refrigeration", minTemp: "35", maxTemp: "41", unit: "F" },
  { id: "steam", name: "Steam Table", type: "Hot Holding", minTemp: "140", maxTemp: "165", unit: "F" },
  { id: "dish", name: "Dishwasher", type: "Sanitation", minTemp: "160", maxTemp: "180", unit: "F" },
];

const EQUIPMENT_TYPES = [
  "Refrigeration", "Freezer", "Hot Holding", "Sanitation",
  "Cooking", "Prep Station", "Beverage", "Other",
];

const SHIFTS = ["Morning", "Afternoon", "Evening", "Closing"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function nowDate() {
  return new Date().toLocaleDateString();
}

function inRange(temp: string, min: string, max: string): boolean {
  const t = parseFloat(temp);
  const lo = parseFloat(min);
  const hi = parseFloat(max);
  if (isNaN(t) || isNaN(lo) || isNaN(hi)) return true;
  return t >= lo && t <= hi;
}

const TYPE_ICONS: Record<string, string> = {
  Refrigeration: "🧊", Freezer: "❄️", "Hot Holding": "♨️",
  Sanitation: "🫧", Cooking: "🔥", "Prep Station": "🥗",
  Beverage: "🥤", Other: "🌡️",
};

function statusColor(eq: Equipment, readings: TempReading[]): "ok" | "danger" | "none" {
  const last = readings.filter((r) => r.equipmentId === eq.id).sort((a, b) => b.id.localeCompare(a.id))[0];
  if (!last) return "none";
  return last.inRange ? "ok" : "danger";
}

function lastReading(eq: Equipment, readings: TempReading[]): TempReading | null {
  return readings.filter((r) => r.equipmentId === eq.id).sort((a, b) => b.id.localeCompare(a.id))[0] ?? null;
}

const STATUS_BG = { ok: "#10b98120", danger: "#ef444420", none: "transparent" };
const STATUS_BORDER = { ok: "#10b98140", danger: "#ef444440", none: "transparent" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function TempsScreen() {
  const colors = useColors();
  const [equipment, setEquipment, eqLoaded] = useStorage<Equipment[]>("equipment_list", DEFAULT_EQUIPMENT);
  const [readings, setReadings, rdLoaded] = useStorage<TempReading[]>("temp_readings", []);

  const [tab, setTab] = useState<"log" | "equipment">("log");
  const [logModal, setLogModal] = useState(false);
  const [eqModal, setEqModal] = useState(false);
  const [editEq, setEditEq] = useState<Equipment | null>(null);
  const [historyEqId, setHistoryEqId] = useState<string | null>(null);

  // Log form
  const [logForm, setLogForm] = useState({
    equipmentId: "",
    temp: "",
    shift: "Morning",
    loggedBy: "",
    notes: "",
  });

  // Equipment form
  const [eqForm, setEqForm] = useState({
    name: "", type: "Refrigeration", minTemp: "", maxTemp: "", unit: "F" as "F" | "C",
  });

  if (!eqLoaded || !rdLoaded) return null;

  // ── Log a reading ──────────────────────────────────────────────────────

  function openLog(eq?: Equipment) {
    setLogForm({
      equipmentId: eq?.id ?? (equipment[0]?.id ?? ""),
      temp: "",
      shift: "Morning",
      loggedBy: "",
      notes: "",
    });
    setLogModal(true);
  }

  function saveReading() {
    if (!logForm.equipmentId) { Alert.alert("Required", "Select a piece of equipment."); return; }
    if (!logForm.temp.trim()) { Alert.alert("Required", "Enter the temperature reading."); return; }
    if (isNaN(parseFloat(logForm.temp))) { Alert.alert("Invalid", "Temperature must be a number."); return; }

    const eq = equipment.find((e) => e.id === logForm.equipmentId);
    if (!eq) return;

    const reading: TempReading = {
      id: Date.now().toString(),
      equipmentId: eq.id,
      equipmentName: eq.name,
      temp: logForm.temp,
      unit: eq.unit,
      date: nowDate(),
      time: nowTime(),
      shift: logForm.shift,
      loggedBy: logForm.loggedBy.trim(),
      notes: logForm.notes.trim(),
      inRange: inRange(logForm.temp, eq.minTemp, eq.maxTemp),
    };
    setReadings((prev) => [reading, ...prev]);
    setLogModal(false);
  }

  // ── Equipment CRUD ─────────────────────────────────────────────────────

  function openAddEq() {
    setEditEq(null);
    setEqForm({ name: "", type: "Refrigeration", minTemp: "", maxTemp: "", unit: "F" });
    setEqModal(true);
  }

  function openEditEq(eq: Equipment) {
    setEditEq(eq);
    setEqForm({ name: eq.name, type: eq.type, minTemp: eq.minTemp, maxTemp: eq.maxTemp, unit: eq.unit });
    setEqModal(true);
  }

  function saveEquipment() {
    if (!eqForm.name.trim()) { Alert.alert("Required", "Enter the equipment name."); return; }
    if (editEq) {
      setEquipment((prev) =>
        prev.map((e) => e.id === editEq.id ? { ...e, ...eqForm, name: eqForm.name.trim() } : e)
      );
    } else {
      setEquipment((prev) => [...prev, { id: Date.now().toString(), ...eqForm, name: eqForm.name.trim() }]);
    }
    setEqModal(false);
  }

  function deleteEquipment(eq: Equipment) {
    Alert.alert("Remove Equipment", `Remove "${eq.name}" and all its readings?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => {
          setEquipment((prev) => prev.filter((e) => e.id !== eq.id));
          setReadings((prev) => prev.filter((r) => r.equipmentId !== eq.id));
        },
      },
    ]);
  }

  function deleteReading(id: string) {
    Alert.alert("Delete Reading", "Remove this temperature entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setReadings((prev) => prev.filter((r) => r.id !== id)) },
    ]);
  }

  // ── Derived ────────────────────────────────────────────────────────────

  const outOfRange = readings.filter((r) => !r.inRange);
  const historyEq = equipment.find((e) => e.id === historyEqId) ?? null;
  const historyReadings = historyEqId ? readings.filter((r) => r.equipmentId === historyEqId) : [];
  const selectedEq = equipment.find((e) => e.id === logForm.equipmentId);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["log", "equipment"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: "#3b82f6", borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? "#3b82f6" : colors.mutedForeground }]}>
              {t === "log" ? "🌡️  Temperature Log" : "⚙️  Equipment"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "log" ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Alert banner */}
          {outOfRange.length > 0 && (
            <View style={[styles.alertBanner, { backgroundColor: "#fef2f2", borderColor: "#ef444440" }]}>
              <Text style={[styles.alertTitle, { color: "#ef4444" }]}>⚠ {outOfRange.length} out-of-range reading{outOfRange.length !== 1 ? "s" : ""}</Text>
              <Text style={[styles.alertSub, { color: "#ef4444" }]}>
                {[...new Set(outOfRange.map((r) => r.equipmentName))].join(", ")}
              </Text>
            </View>
          )}

          {/* Equipment status cards */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EQUIPMENT STATUS</Text>
          {equipment.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No equipment set up. Go to the Equipment tab to add your units.</Text>
            </View>
          ) : (
            <View style={styles.eqGrid}>
              {equipment.map((eq) => {
                const st = statusColor(eq, readings);
                const last = lastReading(eq, readings);
                const icon = TYPE_ICONS[eq.type] ?? "🌡️";
                return (
                  <TouchableOpacity
                    key={eq.id}
                    style={[
                      styles.eqCard,
                      { backgroundColor: STATUS_BG[st], borderColor: STATUS_BORDER[st] || colors.border },
                      st === "none" && { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => openLog(eq)}
                    onLongPress={() => setHistoryEqId(eq.id)}
                  >
                    <Text style={styles.eqIcon}>{icon}</Text>
                    <Text style={[styles.eqName, { color: colors.foreground }]} numberOfLines={2}>{eq.name}</Text>
                    {last ? (
                      <>
                        <Text style={[styles.eqTemp, { color: last.inRange ? "#10b981" : "#ef4444" }]}>
                          {last.temp}°{last.unit}
                        </Text>
                        <Text style={[styles.eqTime, { color: colors.mutedForeground }]}>{last.time}</Text>
                        <View style={[styles.eqRangeBadge, { backgroundColor: last.inRange ? "#10b98120" : "#ef444420" }]}>
                          <Text style={[styles.eqRangeText, { color: last.inRange ? "#10b981" : "#ef4444" }]}>
                            {last.inRange ? "✓ In Range" : "✕ OUT OF RANGE"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={[styles.eqNoReading, { color: colors.mutedForeground }]}>No reading yet</Text>
                    )}
                    <Text style={[styles.eqRange, { color: colors.mutedForeground }]}>
                      Safe: {eq.minTemp}–{eq.maxTemp}°{eq.unit}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Log button + export */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.logBtn, { backgroundColor: "#3b82f6", flex: 1 }]} onPress={() => openLog()}>
              <Text style={styles.logBtnText}>+ Log Temperature</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { borderColor: "#3b82f6" }]}
              onPress={() =>
                exportToCsv("Temperature_Log", readings.map((r) => ({
                  Date: r.date,
                  Time: r.time,
                  Shift: r.shift,
                  Equipment: r.equipmentName,
                  "Temp (°F/°C)": `${r.temp}°${r.unit}`,
                  Status: r.inRange ? "In Range" : "OUT OF RANGE",
                  "Logged By": r.loggedBy,
                  Notes: r.notes,
                })))
              }
            >
              <Text style={[styles.exportBtnText, { color: "#3b82f6" }]}>⬆ Export</Text>
            </TouchableOpacity>
          </View>

          {/* Recent readings */}
          {readings.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>RECENT READINGS</Text>
              {readings.slice(0, 30).map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.readingCard,
                    { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: r.inRange ? "#10b981" : "#ef4444", borderLeftWidth: 4 },
                  ]}
                  onLongPress={() => deleteReading(r.id)}
                >
                  <View style={styles.readingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.readingEquip, { color: colors.foreground }]}>{r.equipmentName}</Text>
                      <Text style={[styles.readingMeta, { color: colors.mutedForeground }]}>
                        {r.date} · {r.time} · {r.shift}{r.loggedBy ? ` · ${r.loggedBy}` : ""}
                      </Text>
                      {r.notes ? <Text style={[styles.readingNote, { color: colors.mutedForeground }]} numberOfLines={1}>{r.notes}</Text> : null}
                    </View>
                    <View style={styles.readingRight}>
                      <Text style={[styles.readingTemp, { color: r.inRange ? "#10b981" : "#ef4444" }]}>
                        {r.temp}°{r.unit}
                      </Text>
                      <Text style={[styles.readingStatus, { color: r.inRange ? "#10b981" : "#ef4444" }]}>
                        {r.inRange ? "OK" : "⚠ OOR"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>Long press a reading to delete · Long press an equipment card to see its history</Text>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* ── Equipment tab ──────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={[styles.logBtn, { backgroundColor: "#3b82f6" }]} onPress={openAddEq}>
            <Text style={styles.logBtnText}>+ Add Equipment</Text>
          </TouchableOpacity>

          {equipment.map((eq) => {
            const icon = TYPE_ICONS[eq.type] ?? "🌡️";
            const rCount = readings.filter((r) => r.equipmentId === eq.id).length;
            const oor = readings.filter((r) => r.equipmentId === eq.id && !r.inRange).length;
            return (
              <View key={eq.id} style={[styles.eqManageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.eqManageRow}>
                  <Text style={styles.eqManageIcon}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eqManageName, { color: colors.foreground }]}>{eq.name}</Text>
                    <Text style={[styles.eqManageType, { color: colors.mutedForeground }]}>{eq.type}</Text>
                    <Text style={[styles.eqManageRange, { color: "#3b82f6" }]}>
                      Safe range: {eq.minTemp}–{eq.maxTemp}°{eq.unit}
                    </Text>
                    <Text style={[styles.eqManageStat, { color: oor > 0 ? "#ef4444" : colors.mutedForeground }]}>
                      {rCount} reading{rCount !== 1 ? "s" : ""}{oor > 0 ? ` · ${oor} out-of-range` : ""}
                    </Text>
                  </View>
                  <View style={styles.eqManageActions}>
                    <TouchableOpacity onPress={() => openEditEq(eq)} style={styles.iconBtn}>
                      <Text style={[styles.iconBtnTxt, { color: "#3b82f6" }]}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteEquipment(eq)} style={styles.iconBtn}>
                      <Text style={[styles.iconBtnTxt, { color: colors.destructive }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Log Reading Modal ─────────────────────────────────────────────── */}
      <Modal visible={logModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setLogModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Temperature</Text>
            <TouchableOpacity onPress={saveReading}>
              <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EQUIPMENT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {equipment.map((eq) => (
                <TouchableOpacity
                  key={eq.id}
                  style={[
                    styles.eqChip,
                    { borderColor: colors.border },
                    logForm.equipmentId === eq.id && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
                  ]}
                  onPress={() => setLogForm((f) => ({ ...f, equipmentId: eq.id }))}
                >
                  <Text style={{ color: logForm.equipmentId === eq.id ? "#fff" : colors.foreground, fontWeight: "600" }}>
                    {TYPE_ICONS[eq.type] ?? "🌡️"} {eq.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedEq && (
              <View style={[styles.rangeHint, { backgroundColor: "#3b82f610", borderColor: "#3b82f630" }]}>
                <Text style={[styles.rangeHintText, { color: "#3b82f6" }]}>
                  Safe range: {selectedEq.minTemp}–{selectedEq.maxTemp}°{selectedEq.unit}
                </Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TEMPERATURE READING</Text>
            <View style={styles.tempInputRow}>
              <TextInput
                style={[styles.tempInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="e.g. 38"
                placeholderTextColor={colors.mutedForeground}
                value={logForm.temp}
                onChangeText={(v) => setLogForm((f) => ({ ...f, temp: v }))}
                keyboardType="numbers-and-punctuation"
                autoFocus
              />
              <View style={[styles.unitBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.unitBadgeText, { color: colors.foreground }]}>
                  °{selectedEq?.unit ?? "F"}
                </Text>
              </View>
            </View>

            {/* Live range check */}
            {logForm.temp && selectedEq && (
              <View style={[
                styles.rangeCheck,
                { backgroundColor: inRange(logForm.temp, selectedEq.minTemp, selectedEq.maxTemp) ? "#10b98120" : "#ef444420",
                  borderColor: inRange(logForm.temp, selectedEq.minTemp, selectedEq.maxTemp) ? "#10b981" : "#ef4444" },
              ]}>
                <Text style={[styles.rangeCheckText, {
                  color: inRange(logForm.temp, selectedEq.minTemp, selectedEq.maxTemp) ? "#10b981" : "#ef4444",
                }]}>
                  {inRange(logForm.temp, selectedEq.minTemp, selectedEq.maxTemp)
                    ? `✓ ${logForm.temp}°${selectedEq.unit} is within safe range`
                    : `⚠ ${logForm.temp}°${selectedEq.unit} is OUTSIDE safe range (${selectedEq.minTemp}–${selectedEq.maxTemp}°${selectedEq.unit})`}
                </Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SHIFT</Text>
            <View style={styles.shiftRow}>
              {SHIFTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.shiftChip, { borderColor: colors.border }, logForm.shift === s && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }]}
                  onPress={() => setLogForm((f) => ({ ...f, shift: s }))}
                >
                  <Text style={[styles.shiftChipText, { color: logForm.shift === s ? "#fff" : colors.foreground }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>LOGGED BY (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              value={logForm.loggedBy}
              onChangeText={(v) => setLogForm((f) => ({ ...f, loggedBy: v }))}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>NOTES (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Door seal needs checking, adjusted thermostat..."
              placeholderTextColor={colors.mutedForeground}
              value={logForm.notes}
              onChangeText={(v) => setLogForm((f) => ({ ...f, notes: v }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Add/Edit Equipment Modal ──────────────────────────────────────── */}
      <Modal visible={eqModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setEqModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editEq ? "Edit Equipment" : "Add Equipment"}</Text>
            <TouchableOpacity onPress={saveEquipment}>
              <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>EQUIPMENT NAME</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Walk-in Cooler, Grill, Dishwasher…"
              placeholderTextColor={colors.mutedForeground}
              value={eqForm.name}
              onChangeText={(v) => setEqForm((f) => ({ ...f, name: v }))}
              autoFocus={!editEq}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TYPE</Text>
            <View style={styles.chipGroup}>
              {EQUIPMENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, { borderColor: colors.border }, eqForm.type === t && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }]}
                  onPress={() => setEqForm((f) => ({ ...f, type: t }))}
                >
                  <Text style={[styles.chipText, { color: eqForm.type === t ? "#fff" : colors.foreground }]}>
                    {TYPE_ICONS[t]} {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SAFE TEMPERATURE RANGE</Text>
            <View style={styles.rangeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rangeSubLabel, { color: colors.mutedForeground }]}>Min</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  placeholder="35"
                  placeholderTextColor={colors.mutedForeground}
                  value={eqForm.minTemp}
                  onChangeText={(v) => setEqForm((f) => ({ ...f, minTemp: v }))}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <Text style={[styles.rangeDash, { color: colors.mutedForeground }]}>—</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rangeSubLabel, { color: colors.mutedForeground }]}>Max</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  placeholder="41"
                  placeholderTextColor={colors.mutedForeground}
                  value={eqForm.maxTemp}
                  onChangeText={(v) => setEqForm((f) => ({ ...f, maxTemp: v }))}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ width: 12 }} />
              <View>
                <Text style={[styles.rangeSubLabel, { color: colors.mutedForeground }]}>Unit</Text>
                <View style={styles.unitToggle}>
                  {(["F", "C"] as const).map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitBtn, eqForm.unit === u && { backgroundColor: "#3b82f6" }, { borderColor: colors.border }]}
                      onPress={() => setEqForm((f) => ({ ...f, unit: u }))}
                    >
                      <Text style={[styles.unitBtnText, { color: eqForm.unit === u ? "#fff" : colors.foreground }]}>°{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Common presets */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>QUICK PRESETS (tap to fill range)</Text>
            <View style={styles.presetsGrid}>
              {[
                { label: "Refrigerator", min: "35", max: "41" },
                { label: "Freezer", min: "-10", max: "0" },
                { label: "Hot Holding", min: "140", max: "165" },
                { label: "Steam Table", min: "140", max: "165" },
                { label: "Dishwasher", min: "160", max: "180" },
                { label: "Oven/Grill", min: "325", max: "500" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.presetChip, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => setEqForm((f) => ({ ...f, minTemp: p.min, maxTemp: p.max, unit: "F" }))}
                >
                  <Text style={[styles.presetLabel, { color: colors.foreground }]}>{p.label}</Text>
                  <Text style={[styles.presetRange, { color: "#3b82f6" }]}>{p.min}–{p.max}°F</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── History Modal ──────────────────────────────────────────────────── */}
      <Modal visible={!!historyEqId} animationType="slide" presentationStyle="pageSheet">
        {historyEq && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ width: 60 }} />
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{historyEq.name}</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  Safe: {historyEq.minTemp}–{historyEq.maxTemp}°{historyEq.unit}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryEqId(null)}>
                <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {historyReadings.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center", marginTop: 40 }]}>No readings yet.</Text>
              ) : (
                historyReadings.map((r) => (
                  <View
                    key={r.id}
                    style={[styles.readingCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: r.inRange ? "#10b981" : "#ef4444", borderLeftWidth: 4 }]}
                  >
                    <View style={styles.readingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.readingMeta, { color: colors.mutedForeground }]}>
                          {r.date} · {r.time} · {r.shift}{r.loggedBy ? ` · ${r.loggedBy}` : ""}
                        </Text>
                        {r.notes ? <Text style={[styles.readingNote, { color: colors.mutedForeground }]}>{r.notes}</Text> : null}
                      </View>
                      <View style={styles.readingRight}>
                        <Text style={[styles.readingTemp, { color: r.inRange ? "#10b981" : "#ef4444" }]}>{r.temp}°{r.unit}</Text>
                        <Text style={[styles.readingStatus, { color: r.inRange ? "#10b981" : "#ef4444" }]}>{r.inRange ? "OK" : "⚠ OOR"}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  content: { padding: 16, gap: 12 },
  alertBanner: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 2 },
  alertTitle: { fontSize: 15, fontWeight: "700" },
  alertSub: { fontSize: 13 },
  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  eqGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  eqCard: { width: "47%", borderRadius: 12, borderWidth: 1, padding: 12, gap: 4, alignItems: "flex-start" },
  eqIcon: { fontSize: 22, marginBottom: 2 },
  eqName: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  eqTemp: { fontSize: 26, fontWeight: "700", marginTop: 4 },
  eqTime: { fontSize: 11, marginTop: -2 },
  eqRangeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 4 },
  eqRangeText: { fontSize: 11, fontWeight: "700" },
  eqNoReading: { fontSize: 12, fontStyle: "italic", marginTop: 6 },
  eqRange: { fontSize: 10, marginTop: 4 },
  emptyCard: { borderRadius: 10, borderWidth: 1, padding: 24, alignItems: "center" },
  emptyText: { fontSize: 14, textAlign: "center" },
  btnRow: { flexDirection: "row", gap: 10 },
  logBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  logBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  exportBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  exportBtnText: { fontWeight: "700", fontSize: 14 },
  readingCard: { borderRadius: 10, borderWidth: 1, padding: 12 },
  readingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  readingEquip: { fontSize: 14, fontWeight: "600" },
  readingMeta: { fontSize: 12, marginTop: 2 },
  readingNote: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  readingRight: { alignItems: "flex-end", gap: 2 },
  readingTemp: { fontSize: 20, fontWeight: "700" },
  readingStatus: { fontSize: 11, fontWeight: "700" },
  hint: { fontSize: 12, textAlign: "center", marginTop: 4 },
  eqManageCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  eqManageRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eqManageIcon: { fontSize: 24, marginTop: 2 },
  eqManageName: { fontSize: 15, fontWeight: "600" },
  eqManageType: { fontSize: 13, marginTop: 1 },
  eqManageRange: { fontSize: 13, marginTop: 4, fontWeight: "500" },
  eqManageStat: { fontSize: 12, marginTop: 2 },
  eqManageActions: { gap: 6 },
  iconBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  iconBtnTxt: { fontSize: 18, fontWeight: "600" },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalSub: { fontSize: 12, marginTop: 2 },
  cancelBtn: { fontSize: 16, width: 60 },
  saveBtn: { fontSize: 16, fontWeight: "600", width: 60, textAlign: "right" },
  modalContent: { padding: 16, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginTop: 12 },
  eqChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  rangeHint: { borderRadius: 8, borderWidth: 1, padding: 10 },
  rangeHintText: { fontSize: 13, fontWeight: "600" },
  tempInputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  tempInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 28, fontWeight: "700", textAlign: "center" },
  unitBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  unitBadgeText: { fontSize: 18, fontWeight: "700" },
  rangeCheck: { borderRadius: 8, borderWidth: 1, padding: 10 },
  rangeCheckText: { fontSize: 13, fontWeight: "600" },
  shiftRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shiftChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  shiftChipText: { fontSize: 14, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  textarea: { minHeight: 80 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  rangeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rangeSubLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  rangeDash: { fontSize: 20, paddingBottom: 10 },
  unitToggle: { flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0" },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  unitBtnText: { fontSize: 14, fontWeight: "700" },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetChip: { borderRadius: 8, borderWidth: 1, padding: 10, width: "47%" },
  presetLabel: { fontSize: 13, fontWeight: "600" },
  presetRange: { fontSize: 12, marginTop: 2 },
});
