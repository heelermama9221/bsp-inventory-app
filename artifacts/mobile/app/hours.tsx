import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useStorage } from "@/hooks/useStorage";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Day = (typeof DAYS)[number];

const DAY_SHORT: Record<Day, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const DEFAULT_SLOTS = [
  { id: "prep", label: "Prep Start", hour: 10, minute: 0 },
  { id: "open", label: "Kitchen Opens", hour: 16, minute: 0 },
  { id: "last", label: "Last Order", hour: 21, minute: 0 },
  { id: "close", label: "Kitchen Closes", hour: 22, minute: 0 },
];

type TimeSlot = { id: string; label: string; hour: number; minute: number };
type DaySchedule = { open: boolean; slots: TimeSlot[] };
type WeekSchedule = Record<Day, DaySchedule>;

function makeDefault(): WeekSchedule {
  const sched = {} as WeekSchedule;
  for (const day of DAYS) {
    const isOpen = day !== "Monday"; // Monday closed by default
    sched[day] = {
      open: isOpen,
      slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    };
  }
  return sched;
}

const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_LIST = [0, 15, 30, 45];
const SLOT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#f97316"];

function fmt12(hour: number, minute: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

type EditTarget = { day: Day; slotId: string } | null;
type AddSlotTarget = Day | null;

export default function HoursScreen() {
  const colors = useColors();
  const [schedule, setSchedule, loaded] = useStorage<WeekSchedule>("kitchen_hours", makeDefault());
  const [selectedDay, setSelectedDay] = useState<Day>("Monday");
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [addSlotTarget, setAddSlotTarget] = useState<AddSlotTarget>(null);
  const [pickerHour, setPickerHour] = useState(10);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newSlotHour, setNewSlotHour] = useState(12);
  const [newSlotMinute, setNewSlotMinute] = useState(0);

  if (!loaded) return null;

  const daySchedule = schedule[selectedDay];

  function toggleDay(day: Day) {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], open: !prev[day].open },
    }));
  }

  function openTimePicker(day: Day, slotId: string) {
    const slot = schedule[day].slots.find((s) => s.id === slotId);
    if (!slot) return;
    setPickerHour(slot.hour);
    setPickerMinute(slot.minute);
    setEditTarget({ day, slotId });
  }

  function saveTime() {
    if (!editTarget) return;
    setSchedule((prev) => ({
      ...prev,
      [editTarget.day]: {
        ...prev[editTarget.day],
        slots: prev[editTarget.day].slots.map((s) =>
          s.id === editTarget.slotId
            ? { ...s, hour: pickerHour, minute: pickerMinute }
            : s
        ),
      },
    }));
    setEditTarget(null);
  }

  function removeSlot(day: Day, slotId: string) {
    Alert.alert("Remove Time Slot", "Remove this time slot?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () =>
          setSchedule((prev) => ({
            ...prev,
            [day]: {
              ...prev[day],
              slots: prev[day].slots.filter((s) => s.id !== slotId),
            },
          })),
      },
    ]);
  }

  function addSlot() {
    if (!addSlotTarget) return;
    if (!newSlotLabel.trim()) {
      Alert.alert("Required", "Please enter a label for this time slot.");
      return;
    }
    const newSlot: TimeSlot = {
      id: Date.now().toString(),
      label: newSlotLabel.trim(),
      hour: newSlotHour,
      minute: newSlotMinute,
    };
    setSchedule((prev) => ({
      ...prev,
      [addSlotTarget]: {
        ...prev[addSlotTarget],
        slots: [...prev[addSlotTarget].slots, newSlot],
      },
    }));
    setAddSlotTarget(null);
    setNewSlotLabel("");
    setNewSlotHour(12);
    setNewSlotMinute(0);
  }

  function copyToAll() {
    Alert.alert(
      "Copy to All Days",
      `Copy ${selectedDay}'s schedule to all other days?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Copy",
          onPress: () => {
            const source = schedule[selectedDay];
            setSchedule((prev) => {
              const next = { ...prev };
              for (const day of DAYS) {
                if (day !== selectedDay) {
                  next[day] = {
                    open: source.open,
                    slots: source.slots.map((s) => ({ ...s, id: `${day}_${s.id}` })),
                  };
                }
              }
              return next;
            });
          },
        },
      ]
    );
  }

  const openDays = DAYS.filter((d) => schedule[d].open);
  const closedDays = DAYS.filter((d) => !schedule[d].open);

  const editingSlot = editTarget
    ? schedule[editTarget.day].slots.find((s) => s.id === editTarget.slotId) ?? null
    : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Week overview strip */}
      <View style={[styles.dayStrip, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStripContent}>
          {DAYS.map((day) => {
            const isSelected = day === selectedDay;
            const isOpen = schedule[day].open;
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayChip,
                  { borderColor: isSelected ? "#3b82f6" : colors.border },
                  isSelected && { backgroundColor: "#3b82f6" },
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayChipLabel, { color: isSelected ? "#fff" : colors.foreground }]}>
                  {DAY_SHORT[day]}
                </Text>
                <View
                  style={[
                    styles.dayChipDot,
                    { backgroundColor: isOpen ? "#10b981" : "#ef4444" },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Selected day header */}
        <View style={[styles.dayHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.dayName, { color: colors.foreground }]}>{selectedDay}</Text>
            <Text style={[styles.dayStatus, { color: daySchedule.open ? "#10b981" : "#ef4444" }]}>
              {daySchedule.open ? `${daySchedule.slots.length} time slots configured` : "Closed"}
            </Text>
          </View>
          <View style={styles.dayToggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.mutedForeground }]}>
              {daySchedule.open ? "Open" : "Closed"}
            </Text>
            <Switch
              value={daySchedule.open}
              onValueChange={() => toggleDay(selectedDay)}
              trackColor={{ false: "#ef444440", true: "#10b98140" }}
              thumbColor={daySchedule.open ? "#10b981" : "#ef4444"}
            />
          </View>
        </View>

        {daySchedule.open ? (
          <>
            {/* Time slots */}
            {daySchedule.slots
              .slice()
              .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
              .map((slot, idx) => {
                const color = SLOT_COLORS[idx % SLOT_COLORS.length];
                return (
                  <View
                    key={slot.id}
                    style={[styles.slotCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: color, borderLeftWidth: 4 }]}
                  >
                    <View style={styles.slotRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.slotLabel, { color: colors.mutedForeground }]}>{slot.label.toUpperCase()}</Text>
                        <Text style={[styles.slotTime, { color }]}>{fmt12(slot.hour, slot.minute)}</Text>
                      </View>
                      <View style={styles.slotActions}>
                        <TouchableOpacity
                          style={[styles.slotEditBtn, { borderColor: color }]}
                          onPress={() => openTimePicker(selectedDay, slot.id)}
                        >
                          <Text style={[styles.slotEditBtnText, { color }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.slotRemoveBtn, { borderColor: colors.border }]}
                          onPress={() => removeSlot(selectedDay, slot.id)}
                        >
                          <Text style={[styles.slotRemoveBtnText, { color: colors.destructive }]}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}

            {/* Add time slot */}
            <TouchableOpacity
              style={[styles.addSlotBtn, { borderColor: "#3b82f6" }]}
              onPress={() => setAddSlotTarget(selectedDay)}
            >
              <Text style={[styles.addSlotBtnText, { color: "#3b82f6" }]}>+ Add Time Slot</Text>
            </TouchableOpacity>

            {/* Copy to all */}
            <TouchableOpacity
              style={[styles.copyBtn, { borderColor: colors.border }]}
              onPress={copyToAll}
            >
              <Text style={[styles.copyBtnText, { color: colors.mutedForeground }]}>
                Copy {DAY_SHORT[selectedDay]}'s schedule to all days
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.closedCard, { backgroundColor: "#fef2f220", borderColor: "#ef444440" }]}>
            <Text style={[styles.closedText, { color: "#ef4444" }]}>Kitchen is closed on {selectedDay}s</Text>
            <Text style={[styles.closedSub, { color: colors.mutedForeground }]}>Toggle the switch above to mark this day as open.</Text>
          </View>
        )}

        {/* Weekly summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Weekly Overview</Text>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryBadge, { backgroundColor: "#10b98120" }]}>
              <Text style={[styles.summaryBadgeNum, { color: "#10b981" }]}>{openDays.length}</Text>
              <Text style={[styles.summaryBadgeLbl, { color: colors.mutedForeground }]}>Open Days</Text>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: "#ef444420" }]}>
              <Text style={[styles.summaryBadgeNum, { color: "#ef4444" }]}>{closedDays.length}</Text>
              <Text style={[styles.summaryBadgeLbl, { color: colors.mutedForeground }]}>Closed Days</Text>
            </View>
          </View>

          {DAYS.map((day) => {
            const ds = schedule[day];
            const sorted = [...ds.slots].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
            return (
              <TouchableOpacity
                key={day}
                style={[styles.summaryDayRow, { borderTopColor: colors.border }]}
                onPress={() => setSelectedDay(day)}
              >
                <View style={styles.summaryDayLeft}>
                  <View style={[styles.summaryDot, { backgroundColor: ds.open ? "#10b981" : "#ef4444" }]} />
                  <Text style={[styles.summaryDayName, { color: colors.foreground }]}>{day}</Text>
                </View>
                {ds.open ? (
                  <Text style={[styles.summaryDayTimes, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {sorted.length > 0
                      ? sorted.map((s) => `${s.label} ${fmt12(s.hour, s.minute)}`).join(" · ")
                      : "No slots set"}
                  </Text>
                ) : (
                  <Text style={[styles.summaryDayClosed, { color: "#ef4444" }]}>Closed</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit time slot modal */}
      <Modal visible={!!editTarget} animationType="slide" presentationStyle="pageSheet">
        {editTarget && editingSlot && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setEditTarget(null)}>
                <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingSlot.label}
              </Text>
              <TouchableOpacity onPress={saveTime}>
                <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.pickerContent}>
              <Text style={[styles.pickerPreview, { color: "#3b82f6" }]}>
                {fmt12(pickerHour, pickerMinute)}
              </Text>
              <Text style={[styles.pickerCtx, { color: colors.mutedForeground }]}>
                {editTarget.day} · {editingSlot.label}
              </Text>

              <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>HOUR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                {HOURS_LIST.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.hourChip, { borderColor: colors.border }, pickerHour === h && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }]}
                    onPress={() => setPickerHour(h)}
                  >
                    <Text style={[styles.hourChipText, { color: pickerHour === h ? "#fff" : colors.foreground }]}>
                      {String(h).padStart(2, "0")}
                    </Text>
                    <Text style={[styles.hourChipSuffix, { color: pickerHour === h ? "#ffffffaa" : colors.mutedForeground }]}>
                      {h < 12 ? "AM" : "PM"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>MINUTE</Text>
              <View style={styles.minuteRow}>
                {MINUTES_LIST.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.minuteChip, { borderColor: colors.border }, pickerMinute === m && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }]}
                    onPress={() => setPickerMinute(m)}
                  >
                    <Text style={[styles.minuteChipText, { color: pickerMinute === m ? "#fff" : colors.foreground }]}>
                      :{String(m).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* Add new slot modal */}
      <Modal visible={!!addSlotTarget} animationType="slide" presentationStyle="pageSheet">
        {addSlotTarget && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => { setAddSlotTarget(null); setNewSlotLabel(""); }}>
                <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Time Slot</Text>
              <TouchableOpacity onPress={addSlot}>
                <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Add</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.pickerContent}>
              <Text style={[styles.pickerCtx, { color: colors.mutedForeground }]}>{addSlotTarget}</Text>

              <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>SLOT LABEL</Text>
              <TextInput
                style={[styles.labelInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="e.g. Prep Start, Kitchen Opens, Last Order…"
                placeholderTextColor={colors.mutedForeground}
                value={newSlotLabel}
                onChangeText={setNewSlotLabel}
                autoFocus
              />

              <Text style={[styles.pickerPreview, { color: "#3b82f6" }]}>
                {fmt12(newSlotHour, newSlotMinute)}
              </Text>

              <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>HOUR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                {HOURS_LIST.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.hourChip, { borderColor: colors.border }, newSlotHour === h && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }]}
                    onPress={() => setNewSlotHour(h)}
                  >
                    <Text style={[styles.hourChipText, { color: newSlotHour === h ? "#fff" : colors.foreground }]}>
                      {String(h).padStart(2, "0")}
                    </Text>
                    <Text style={[styles.hourChipSuffix, { color: newSlotHour === h ? "#ffffffaa" : colors.mutedForeground }]}>
                      {h < 12 ? "AM" : "PM"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>MINUTE</Text>
              <View style={styles.minuteRow}>
                {MINUTES_LIST.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.minuteChip, { borderColor: colors.border }, newSlotMinute === m && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }]}
                    onPress={() => setNewSlotMinute(m)}
                  >
                    <Text style={[styles.minuteChipText, { color: newSlotMinute === m ? "#fff" : colors.foreground }]}>
                      :{String(m).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.suggestBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.suggestTitle, { color: colors.mutedForeground }]}>Common slot names</Text>
                {["Prep Start", "Line Setup", "Kitchen Opens", "Lunch Service", "Dinner Service", "Last Order", "Kitchen Closes"].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setNewSlotLabel(s)}>
                    <Text style={[styles.suggestItem, { color: "#3b82f6" }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  dayStrip: { borderBottomWidth: 1 },
  dayStripContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  dayChip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 4 },
  dayChipLabel: { fontSize: 13, fontWeight: "600" },
  dayChipDot: { width: 6, height: 6, borderRadius: 3 },
  content: { padding: 16, gap: 12 },
  dayHeader: { borderRadius: 12, borderWidth: 1, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayName: { fontSize: 20, fontWeight: "700" },
  dayStatus: { fontSize: 13, marginTop: 2 },
  dayToggleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { fontSize: 14 },
  slotCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  slotRow: { flexDirection: "row", alignItems: "center" },
  slotLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginBottom: 4 },
  slotTime: { fontSize: 24, fontWeight: "700" },
  slotActions: { flexDirection: "row", gap: 8 },
  slotEditBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  slotEditBtnText: { fontSize: 14, fontWeight: "600" },
  slotRemoveBtn: { borderWidth: 1, borderRadius: 8, width: 36, alignItems: "center", justifyContent: "center" },
  slotRemoveBtnText: { fontSize: 16, fontWeight: "700" },
  addSlotBtn: { borderWidth: 1.5, borderRadius: 10, padding: 14, alignItems: "center", borderStyle: "dashed" },
  addSlotBtnText: { fontSize: 15, fontWeight: "600" },
  copyBtn: { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  copyBtnText: { fontSize: 13 },
  closedCard: { borderRadius: 10, borderWidth: 1, padding: 24, alignItems: "center", gap: 6 },
  closedText: { fontSize: 16, fontWeight: "600" },
  closedSub: { fontSize: 14, textAlign: "center" },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  summaryTitle: { fontSize: 15, fontWeight: "700" },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryBadge: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  summaryBadgeNum: { fontSize: 26, fontWeight: "700" },
  summaryBadgeLbl: { fontSize: 12, marginTop: 2 },
  summaryDayRow: { flexDirection: "row", alignItems: "flex-start", paddingTop: 10, borderTopWidth: 1, gap: 10 },
  summaryDayLeft: { flexDirection: "row", alignItems: "center", gap: 6, width: 90 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryDayName: { fontSize: 13, fontWeight: "600" },
  summaryDayTimes: { fontSize: 12, flex: 1, lineHeight: 18 },
  summaryDayClosed: { fontSize: 13, fontWeight: "500" },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  pickerContent: { padding: 20, gap: 12 },
  pickerPreview: { fontSize: 52, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  pickerCtx: { fontSize: 14, textAlign: "center", marginBottom: 8 },
  pickerLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  hourScroll: { marginBottom: 4 },
  hourChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, alignItems: "center" },
  hourChipText: { fontSize: 16, fontWeight: "700" },
  hourChipSuffix: { fontSize: 10, marginTop: 2 },
  minuteRow: { flexDirection: "row", gap: 12 },
  minuteChip: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  minuteChipText: { fontSize: 16, fontWeight: "600" },
  labelInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  suggestBox: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 10 },
  suggestTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  suggestItem: { fontSize: 15 },
});
