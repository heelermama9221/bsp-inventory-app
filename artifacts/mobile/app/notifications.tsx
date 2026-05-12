import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  type ShiftReminder,
  cancelShiftReminder,
  getOpenKitchenDays,
  requestNotificationPermission,
  scheduleShiftReminder,
  useReminders,
} from "@/hooks/useNotifications";
import { useStorage } from "@/hooks/useStorage";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

type WeekSchedule = Record<string, { open: boolean; slots: unknown[] }>;

function fmt12(hour: number, minute: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

const SHIFT_COLORS: Record<string, string> = {
  Morning: "#f59e0b",
  Afternoon: "#3b82f6",
  Evening: "#8b5cf6",
  Closing: "#ef4444",
};

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { reminders, setReminders, loaded: remindersLoaded } = useReminders();
  const [kitchenHours, , hoursLoaded] = useStorage<WeekSchedule>("kitchen_hours", {} as WeekSchedule);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerHour, setPickerHour] = useState(8);
  const [pickerMinute, setPickerMinute] = useState(0);

  if (!remindersLoaded || !hoursLoaded) return null;

  const isWeb = Platform.OS === "web";
  const editingReminder = reminders.find((r) => r.id === editingId) ?? null;

  // Derive open days from kitchen hours (fall back to all days if not configured)
  const openDays = Object.keys(kitchenHours).length > 0
    ? ALL_DAYS.filter((d) => kitchenHours[d]?.open)
    : ALL_DAYS;
  const closedDays = ALL_DAYS.filter((d) => !openDays.includes(d));
  const hasCustomHours = Object.keys(kitchenHours).length > 0;

  async function ensurePermission(): Promise<boolean> {
    if (isWeb) {
      Alert.alert("Not supported", "Push notifications require the Expo Go app on iOS or Android.");
      return false;
    }
    if (permissionGranted === true) return true;
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        "Permission Required",
        "Please allow notifications in your device settings to enable shift reminders."
      );
    }
    return granted;
  }

  async function toggleReminder(reminder: ShiftReminder) {
    if (!reminder.enabled) {
      const granted = await ensurePermission();
      if (!granted) return;

      const days = await getOpenKitchenDays();
      const ids = await scheduleShiftReminder(reminder, days);
      setReminders((prev) =>
        prev.map((r) =>
          r.id === reminder.id ? { ...r, enabled: true, notificationIds: ids } : r
        )
      );
    } else {
      if (reminder.notificationIds?.length) {
        await cancelShiftReminder(reminder.notificationIds);
      }
      setReminders((prev) =>
        prev.map((r) =>
          r.id === reminder.id ? { ...r, enabled: false, notificationIds: [] } : r
        )
      );
    }
  }

  function openTimePicker(reminder: ShiftReminder) {
    setEditingId(reminder.id);
    setPickerHour(reminder.hour);
    setPickerMinute(reminder.minute);
  }

  async function saveTime() {
    if (!editingReminder) return;
    const updated = { ...editingReminder, hour: pickerHour, minute: pickerMinute };

    if (editingReminder.enabled) {
      if (editingReminder.notificationIds?.length) {
        await cancelShiftReminder(editingReminder.notificationIds);
      }
      const days = await getOpenKitchenDays();
      const ids = await scheduleShiftReminder(updated, days);
      updated.notificationIds = ids;
    }

    setReminders((prev) => prev.map((r) => (r.id === editingReminder.id ? updated : r)));
    setEditingId(null);
  }

  async function disableAll() {
    Alert.alert("Disable All", "Turn off all shift reminders?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disable All",
        style: "destructive",
        onPress: async () => {
          for (const r of reminders) {
            if (r.notificationIds?.length) await cancelShiftReminder(r.notificationIds);
          }
          setReminders((prev) =>
            prev.map((r) => ({ ...r, enabled: false, notificationIds: [] }))
          );
        },
      },
    ]);
  }

  const enabledCount = reminders.filter((r) => r.enabled).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: "#3b82f620", borderColor: "#3b82f640" }]}>
          <Text style={[styles.headerTitle, { color: "#3b82f6" }]}>Walkthrough Reminders</Text>
          <Text style={[styles.headerBody, { color: colors.mutedForeground }]}>
            Reminders fire only on days the kitchen is open, based on your Kitchen Hours settings.
            Enable each shift below and set the time you want to be notified.
          </Text>
          {isWeb && (
            <View style={[styles.webNotice, { backgroundColor: "#fef3c720", borderColor: "#f59e0b" }]}>
              <Text style={[styles.webNoticeText, { color: "#92400e" }]}>
                ⚠ Notifications require the Expo Go app on your iOS or Android device.
              </Text>
            </View>
          )}
        </View>

        {/* Kitchen hours linkage */}
        <View style={[styles.hoursCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.hoursCardHeader}>
            <Text style={[styles.hoursCardTitle, { color: colors.foreground }]}>Kitchen Schedule</Text>
            <TouchableOpacity onPress={() => router.push("/hours")}>
              <Text style={[styles.hoursEditLink, { color: "#3b82f6" }]}>Edit Hours →</Text>
            </TouchableOpacity>
          </View>

          {hasCustomHours ? (
            <>
              <View style={styles.dayGrid}>
                {ALL_DAYS.map((day) => {
                  const isOpen = openDays.includes(day);
                  return (
                    <View
                      key={day}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: isOpen ? "#10b98120" : "#ef444415",
                          borderColor: isOpen ? "#10b981" : "#ef444440",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          { color: isOpen ? "#10b981" : "#ef4444" },
                        ]}
                      >
                        {DAY_SHORT[day]}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {closedDays.length > 0 && (
                <Text style={[styles.closedNote, { color: colors.mutedForeground }]}>
                  No reminders on {closedDays.map((d) => DAY_SHORT[d]).join(", ")} (kitchen closed)
                </Text>
              )}
              {openDays.length === 0 && (
                <Text style={[styles.closedNote, { color: "#ef4444" }]}>
                  All days marked closed — reminders won't fire. Update Kitchen Hours to open some days.
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.noHoursNote, { color: colors.mutedForeground }]}>
              No Kitchen Hours configured yet — reminders will fire every day.{" "}
              <Text style={{ color: "#3b82f6" }} onPress={() => router.push("/hours")}>
                Set your hours →
              </Text>
            </Text>
          )}
        </View>

        {/* Status summary */}
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>Active Reminders</Text>
          <Text style={[styles.statusValue, { color: enabledCount > 0 ? "#3b82f6" : colors.mutedForeground }]}>
            {enabledCount} of {reminders.length} shifts
          </Text>
        </View>

        {/* Shift reminder cards */}
        {reminders.map((reminder) => {
          const color = SHIFT_COLORS[reminder.shift] ?? "#3b82f6";
          const activeDayCount = reminder.notificationIds?.length ?? 0;
          return (
            <View
              key={reminder.id}
              style={[
                styles.reminderCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: color, borderLeftWidth: 4 },
              ]}
            >
              <View style={styles.reminderTop}>
                <View style={styles.reminderInfo}>
                  <View style={[styles.shiftDot, { backgroundColor: color }]} />
                  <Text style={[styles.shiftName, { color: colors.foreground }]}>{reminder.shift} Shift</Text>
                </View>
                <Switch
                  value={reminder.enabled}
                  onValueChange={() => toggleReminder(reminder)}
                  trackColor={{ false: colors.border, true: color + "80" }}
                  thumbColor={reminder.enabled ? color : colors.mutedForeground}
                />
              </View>

              <View style={styles.reminderBottom}>
                <View>
                  <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Reminder time</Text>
                  <Text style={[styles.timeValue, { color: reminder.enabled ? color : colors.mutedForeground }]}>
                    {fmt12(reminder.hour, reminder.minute)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.editTimeBtn, { borderColor: color }]}
                  onPress={() => openTimePicker(reminder)}
                >
                  <Text style={[styles.editTimeBtnText, { color }]}>Change Time</Text>
                </TouchableOpacity>
              </View>

              {reminder.enabled && (
                <View style={[styles.activePill, { backgroundColor: color + "20" }]}>
                  <Text style={[styles.activePillText, { color }]}>
                    🔔 Active — {activeDayCount > 0
                      ? `fires ${activeDayCount}×/week at ${fmt12(reminder.hour, reminder.minute)}`
                      : `fires weekly at ${fmt12(reminder.hour, reminder.minute)}`}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Disable all */}
        {enabledCount > 0 && (
          <TouchableOpacity
            style={[styles.disableAllBtn, { borderColor: colors.destructive }]}
            onPress={disableAll}
          >
            <Text style={[styles.disableAllText, { color: colors.destructive }]}>Disable All Reminders</Text>
          </TouchableOpacity>
        )}

        {/* How it works */}
        <View style={[styles.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.howTitle, { color: colors.foreground }]}>How reminders work</Text>
          {[
            "Reminders only fire on days the kitchen is open (from Kitchen Hours).",
            "Toggle a shift on to activate its weekly reminders.",
            "Tap Change Time to set exactly when you want to be notified.",
            "When you update Kitchen Hours, toggle reminders off and on again to re-sync.",
            "Open Walkthroughs to log your shift inspection.",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={[styles.tipNum, { color: "#3b82f6" }]}>{i + 1}.</Text>
              <Text style={[styles.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Time picker modal */}
      <Modal visible={!!editingReminder} animationType="slide" presentationStyle="pageSheet">
        {editingReminder && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setEditingId(null)}>
                <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingReminder.shift} Reminder Time
              </Text>
              <TouchableOpacity onPress={saveTime}>
                <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.pickerContent}>
              <Text style={[styles.previewTime, { color: "#3b82f6" }]}>
                {fmt12(pickerHour, pickerMinute)}
              </Text>

              <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>HOUR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.pickerChip,
                      { borderColor: colors.border },
                      pickerHour === h && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
                    ]}
                    onPress={() => setPickerHour(h)}
                  >
                    <Text style={[styles.pickerChipText, { color: pickerHour === h ? "#fff" : colors.foreground }]}>
                      {String(h).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>MINUTE</Text>
              <View style={styles.minuteRow}>
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.minuteChip,
                      { borderColor: colors.border },
                      pickerMinute === m && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
                    ]}
                    onPress={() => setPickerMinute(m)}
                  >
                    <Text style={[styles.pickerChipText, { color: pickerMinute === m ? "#fff" : colors.foreground }]}>
                      :{String(m).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.previewCard, { backgroundColor: "#3b82f620", borderColor: "#3b82f640" }]}>
                <Text style={[styles.previewLabel, { color: "#3b82f6" }]}>
                  {editingReminder.shift} reminder will fire on{" "}
                  <Text style={{ fontWeight: "700" }}>{openDays.length} open day{openDays.length !== 1 ? "s" : ""}</Text>
                  {" "}at{" "}
                  <Text style={{ fontWeight: "700" }}>{fmt12(pickerHour, pickerMinute)}</Text>
                </Text>
                {openDays.length > 0 && (
                  <Text style={[styles.previewDays, { color: "#3b82f6" }]}>
                    {openDays.map((d) => DAY_SHORT[d]).join(" · ")}
                  </Text>
                )}
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
  content: { padding: 16, gap: 14 },
  headerCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerBody: { fontSize: 14, lineHeight: 20 },
  webNotice: { borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 6 },
  webNoticeText: { fontSize: 13 },
  hoursCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  hoursCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hoursCardTitle: { fontSize: 15, fontWeight: "600" },
  hoursEditLink: { fontSize: 14, fontWeight: "600" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayPill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  dayPillText: { fontSize: 13, fontWeight: "600" },
  closedNote: { fontSize: 12, lineHeight: 18 },
  noHoursNote: { fontSize: 14, lineHeight: 20 },
  statusCard: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLabel: { fontSize: 14 },
  statusValue: { fontSize: 16, fontWeight: "700" },
  reminderCard: { borderRadius: 10, borderWidth: 1, padding: 16, gap: 12 },
  reminderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reminderInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  shiftDot: { width: 10, height: 10, borderRadius: 5 },
  shiftName: { fontSize: 16, fontWeight: "600" },
  reminderBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timeLabel: { fontSize: 12, marginBottom: 2 },
  timeValue: { fontSize: 20, fontWeight: "700" },
  editTimeBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  editTimeBtnText: { fontSize: 14, fontWeight: "600" },
  activePill: { borderRadius: 8, padding: 8 },
  activePillText: { fontSize: 13, fontWeight: "500" },
  disableAllBtn: { borderWidth: 1.5, borderRadius: 10, padding: 14, alignItems: "center" },
  disableAllText: { fontSize: 15, fontWeight: "600" },
  howCard: { borderRadius: 10, borderWidth: 1, padding: 16, gap: 10 },
  howTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  tipRow: { flexDirection: "row", gap: 8 },
  tipNum: { fontSize: 14, fontWeight: "700", width: 18 },
  tipText: { fontSize: 14, lineHeight: 20, flex: 1 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  pickerContent: { padding: 20, gap: 12 },
  previewTime: { fontSize: 48, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  pickerLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  pickerScroll: { marginBottom: 8 },
  pickerChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 },
  minuteRow: { flexDirection: "row", gap: 12 },
  minuteChip: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  pickerChipText: { fontSize: 15, fontWeight: "600" },
  previewCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginTop: 16, gap: 6 },
  previewLabel: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  previewDays: { fontSize: 13, textAlign: "center", opacity: 0.8 },
});
