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

type Employee = {
  id: string;
  name: string;
  role: string;
  color: string;
};

const SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening", "Closing", "Split", "Day Off"] as const;
type ShiftName = (typeof SHIFT_OPTIONS)[number];

type DayAssignments = Record<string, ShiftName>; // employeeId → shift
type WeekAssignments = Record<string, DayAssignments>; // day → DayAssignments

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Day = (typeof DAYS)[number];

const DAY_SHORT: Record<Day, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLOYEE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
  "#ec4899", "#6366f1",
];

const SHIFT_COLORS: Record<ShiftName, string> = {
  Morning: "#f59e0b",
  Afternoon: "#3b82f6",
  Evening: "#8b5cf6",
  Closing: "#ef4444",
  Split: "#10b981",
  "Day Off": "#94a3b8",
};

const SHIFT_ICONS: Record<ShiftName, string> = {
  Morning: "🌅", Afternoon: "☀️", Evening: "🌆", Closing: "🌙", Split: "⚡", "Day Off": "—",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const colors = useColors();

  const [employees, setEmployees, empLoaded] = useStorage<Employee[]>("employees", []);
  const [assignments, setAssignments, assignLoaded] = useStorage<WeekAssignments>("week_assignments", {});

  const [tab, setTab] = useState<"schedule" | "staff">("schedule");
  const [selectedDay, setSelectedDay] = useState<Day>("Monday");

  // Staff modal
  const [staffModal, setStaffModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empColor, setEmpColor] = useState(EMPLOYEE_COLORS[0]);

  // Shift picker modal
  const [shiftModal, setShiftModal] = useState(false);
  const [shiftTarget, setShiftTarget] = useState<{ day: Day; employeeId: string } | null>(null);

  if (!empLoaded || !assignLoaded) return null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getAssignment(day: Day, empId: string): ShiftName | null {
    return (assignments[day]?.[empId] as ShiftName) ?? null;
  }

  function setAssignment(day: Day, empId: string, shift: ShiftName) {
    setAssignments((prev) => ({
      ...prev,
      [day]: { ...(prev[day] ?? {}), [empId]: shift },
    }));
  }

  function openShiftPicker(day: Day, empId: string) {
    setShiftTarget({ day, employeeId: empId });
    setShiftModal(true);
  }

  function openAddStaff() {
    setEditingEmp(null);
    setEmpName("");
    setEmpRole("");
    setEmpColor(EMPLOYEE_COLORS[employees.length % EMPLOYEE_COLORS.length]);
    setStaffModal(true);
  }

  function openEditStaff(emp: Employee) {
    setEditingEmp(emp);
    setEmpName(emp.name);
    setEmpRole(emp.role);
    setEmpColor(emp.color);
    setStaffModal(true);
  }

  function saveStaff() {
    if (!empName.trim()) {
      Alert.alert("Required", "Please enter the employee's name.");
      return;
    }
    if (editingEmp) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingEmp.id ? { ...e, name: empName.trim(), role: empRole.trim(), color: empColor } : e
        )
      );
    } else {
      const newEmp: Employee = {
        id: Date.now().toString(),
        name: empName.trim(),
        role: empRole.trim(),
        color: empColor,
      };
      setEmployees((prev) => [...prev, newEmp]);
    }
    setStaffModal(false);
  }

  function deleteStaff(emp: Employee) {
    Alert.alert("Remove Employee", `Remove ${emp.name} from the roster?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => {
          setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
          // clean up their assignments
          setAssignments((prev) => {
            const next = { ...prev };
            for (const day of DAYS) {
              if (next[day]) {
                const d = { ...next[day] };
                delete d[emp.id];
                next[day] = d;
              }
            }
            return next;
          });
        },
      },
    ]);
  }

  function copyDayToAll() {
    Alert.alert("Copy Schedule", `Copy ${selectedDay}'s assignments to all other days?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Copy",
        onPress: () => {
          const source = assignments[selectedDay] ?? {};
          setAssignments((prev) => {
            const next = { ...prev };
            for (const day of DAYS) {
              if (day !== selectedDay) next[day] = { ...source };
            }
            return next;
          });
        },
      },
    ]);
  }

  function clearDay() {
    Alert.alert("Clear Day", `Clear all assignments for ${selectedDay}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive",
        onPress: () => setAssignments((prev) => ({ ...prev, [selectedDay]: {} })),
      },
    ]);
  }

  // ── Summary stats ──────────────────────────────────────────────────────

  const dayAssignments = assignments[selectedDay] ?? {};
  const scheduled = employees.filter((e) => dayAssignments[e.id] && dayAssignments[e.id] !== "Day Off");
  const offToday = employees.filter((e) => dayAssignments[e.id] === "Day Off");
  const unassigned = employees.filter((e) => !dayAssignments[e.id]);

  // ── Shift counts for the week (staff tab) ─────────────────────────────

  function weekShiftsFor(empId: string): ShiftName[] {
    return DAYS.map((d) => assignments[d]?.[empId] as ShiftName).filter(Boolean);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["schedule", "staff"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: "#3b82f6", borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, { color: tab === t ? "#3b82f6" : colors.mutedForeground }]}>
              {t === "schedule" ? "📅  Weekly Schedule" : "👥  Staff Roster"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "schedule" ? (
        <>
          {/* Day strip */}
          <View style={[styles.dayStrip, { borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStripContent}>
              {DAYS.map((day) => {
                const isSelected = day === selectedDay;
                const count = employees.filter(
                  (e) => assignments[day]?.[e.id] && assignments[day][e.id] !== "Day Off"
                ).length;
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
                    {count > 0 && (
                      <View style={[styles.dayChipBadge, { backgroundColor: isSelected ? "#ffffff40" : "#3b82f620" }]}>
                        <Text style={[styles.dayChipBadgeText, { color: isSelected ? "#fff" : "#3b82f6" }]}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {employees.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.emptyIcon]}>👥</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No staff yet</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Switch to the Staff tab to add your team members.</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setTab("staff")}>
                  <Text style={styles.emptyBtnText}>Add Staff →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Stats row */}
                <View style={styles.statsRow}>
                  {[
                    { label: "Working", value: scheduled.length, color: "#10b981" },
                    { label: "Day Off", value: offToday.length, color: "#94a3b8" },
                    { label: "Unset", value: unassigned.length, color: "#f59e0b" },
                  ].map((s) => (
                    <View key={s.label} style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Employee rows */}
                {employees.map((emp) => {
                  const shift = getAssignment(selectedDay, emp.id);
                  const shiftColor = shift ? SHIFT_COLORS[shift] : colors.mutedForeground;
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.empRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => openShiftPicker(selectedDay, emp.id)}
                    >
                      <View style={[styles.avatar, { backgroundColor: emp.color + "20", borderColor: emp.color }]}>
                        <Text style={[styles.avatarText, { color: emp.color }]}>{initials(emp.name)}</Text>
                      </View>
                      <View style={styles.empInfo}>
                        <Text style={[styles.empName, { color: colors.foreground }]}>{emp.name}</Text>
                        {emp.role ? (
                          <Text style={[styles.empRole, { color: colors.mutedForeground }]}>{emp.role}</Text>
                        ) : null}
                      </View>
                      {shift ? (
                        <View style={[styles.shiftBadge, { backgroundColor: shiftColor + "20", borderColor: shiftColor + "60" }]}>
                          <Text style={[styles.shiftBadgeIcon]}>{SHIFT_ICONS[shift]}</Text>
                          <Text style={[styles.shiftBadgeText, { color: shiftColor }]}>{shift}</Text>
                        </View>
                      ) : (
                        <View style={[styles.unsetBadge, { borderColor: colors.border }]}>
                          <Text style={[styles.unsetText, { color: colors.mutedForeground }]}>Tap to assign</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Day actions */}
                <View style={styles.dayActionsRow}>
                  <TouchableOpacity
                    style={[styles.dayActionBtn, { borderColor: "#3b82f6" }]}
                    onPress={copyDayToAll}
                  >
                    <Text style={[styles.dayActionText, { color: "#3b82f6" }]}>Copy to All Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dayActionBtn, { borderColor: colors.destructive }]}
                    onPress={clearDay}
                  >
                    <Text style={[styles.dayActionText, { color: colors.destructive }]}>Clear Day</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      ) : (
        /* ── Staff tab ──────────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity
            style={[styles.addStaffBtn, { borderColor: "#3b82f6" }]}
            onPress={openAddStaff}
          >
            <Text style={[styles.addStaffBtnText, { color: "#3b82f6" }]}>+ Add Employee</Text>
          </TouchableOpacity>

          {employees.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No employees yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tap above to add your first team member.</Text>
            </View>
          ) : (
            employees.map((emp) => {
              const shifts = weekShiftsFor(emp.id);
              const workingDays = shifts.filter((s) => s !== "Day Off").length;
              return (
                <View
                  key={emp.id}
                  style={[styles.staffCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: emp.color, borderLeftWidth: 4 }]}
                >
                  <View style={styles.staffCardTop}>
                    <View style={[styles.avatar, { backgroundColor: emp.color + "20", borderColor: emp.color }]}>
                      <Text style={[styles.avatarText, { color: emp.color }]}>{initials(emp.name)}</Text>
                    </View>
                    <View style={styles.empInfo}>
                      <Text style={[styles.empName, { color: colors.foreground }]}>{emp.name}</Text>
                      {emp.role ? (
                        <Text style={[styles.empRole, { color: colors.mutedForeground }]}>{emp.role}</Text>
                      ) : null}
                    </View>
                    <View style={styles.staffActions}>
                      <TouchableOpacity onPress={() => openEditStaff(emp)} style={styles.iconBtn}>
                        <Text style={[styles.iconBtnText, { color: "#3b82f6" }]}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteStaff(emp)} style={styles.iconBtn}>
                        <Text style={[styles.iconBtnText, { color: colors.destructive }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Week mini-grid */}
                  <View style={styles.miniGrid}>
                    {DAYS.map((day) => {
                      const s = assignments[day]?.[emp.id] as ShiftName | undefined;
                      const col = s ? SHIFT_COLORS[s] : colors.border;
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[styles.miniCell, { borderColor: col, backgroundColor: s ? col + "20" : "transparent" }]}
                          onPress={() => { setSelectedDay(day); setTab("schedule"); openShiftPicker(day, emp.id); }}
                        >
                          <Text style={[styles.miniCellDay, { color: colors.mutedForeground }]}>{DAY_SHORT[day].slice(0, 1)}</Text>
                          <Text style={[styles.miniCellShift, { color: col }]}>
                            {s ? SHIFT_ICONS[s] : "·"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[styles.weekSummary, { color: colors.mutedForeground }]}>
                    {workingDays} shift{workingDays !== 1 ? "s" : ""} scheduled this week
                  </Text>
                </View>
              );
            })
          )}

          {/* Legend */}
          {employees.length > 0 && (
            <View style={[styles.legendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.legendTitle, { color: colors.foreground }]}>Shift Legend</Text>
              <View style={styles.legendGrid}>
                {SHIFT_OPTIONS.map((s) => (
                  <View key={s} style={styles.legendItem}>
                    <Text style={styles.legendIcon}>{SHIFT_ICONS[s]}</Text>
                    <Text style={[styles.legendLabel, { color: SHIFT_COLORS[s] }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Shift picker modal ─────────────────────────────────────────────── */}
      <Modal visible={shiftModal} animationType="slide" presentationStyle="pageSheet">
        {shiftTarget && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShiftModal(false)}>
                <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {employees.find((e) => e.id === shiftTarget.employeeId)?.name ?? "Employee"}
                </Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{shiftTarget.day}</Text>
              </View>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={styles.shiftPickerContent}>
              <Text style={[styles.pickerInstruction, { color: colors.mutedForeground }]}>Select a shift for this day</Text>
              {SHIFT_OPTIONS.map((shift) => {
                const current = getAssignment(shiftTarget.day, shiftTarget.employeeId);
                const isSelected = current === shift;
                const col = SHIFT_COLORS[shift];
                return (
                  <TouchableOpacity
                    key={shift}
                    style={[
                      styles.shiftOption,
                      { borderColor: isSelected ? col : colors.border, backgroundColor: isSelected ? col + "15" : colors.card },
                    ]}
                    onPress={() => {
                      setAssignment(shiftTarget.day, shiftTarget.employeeId, shift);
                      setShiftModal(false);
                    }}
                  >
                    <Text style={styles.shiftOptionIcon}>{SHIFT_ICONS[shift]}</Text>
                    <Text style={[styles.shiftOptionText, { color: isSelected ? col : colors.foreground }]}>{shift}</Text>
                    {isSelected && <Text style={[styles.checkmark, { color: col }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── Add / Edit staff modal ─────────────────────────────────────────── */}
      <Modal visible={staffModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStaffModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingEmp ? "Edit Employee" : "Add Employee"}
            </Text>
            <TouchableOpacity onPress={saveStaff}>
              <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.staffFormContent}>
            {/* Avatar preview */}
            <View style={[styles.avatarLarge, { backgroundColor: empColor + "20", borderColor: empColor }]}>
              <Text style={[styles.avatarLargeText, { color: empColor }]}>
                {empName ? initials(empName) : "?"}
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FULL NAME *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={colors.mutedForeground}
              value={empName}
              onChangeText={setEmpName}
              autoFocus={!editingEmp}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ROLE / POSITION</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Line Cook, Server, Manager…"
              placeholderTextColor={colors.mutedForeground}
              value={empRole}
              onChangeText={setEmpRole}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>COLOUR</Text>
            <View style={styles.colorPicker}>
              {EMPLOYEE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, empColor === c && styles.colorSwatchSelected]}
                  onPress={() => setEmpColor(c)}
                />
              ))}
            </View>
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
  tabBtnText: { fontSize: 14, fontWeight: "600" },
  dayStrip: { borderBottomWidth: 1 },
  dayStripContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  dayChip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, alignItems: "center", gap: 4 },
  dayChipLabel: { fontSize: 13, fontWeight: "600" },
  dayChipBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  dayChipBadgeText: { fontSize: 11, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 10 },
  statChip: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center", gap: 2 },
  statNum: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 12 },
  empRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 15, fontWeight: "700" },
  empInfo: { flex: 1 },
  empName: { fontSize: 15, fontWeight: "600" },
  empRole: { fontSize: 13, marginTop: 1 },
  shiftBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  shiftBadgeIcon: { fontSize: 14 },
  shiftBadgeText: { fontSize: 13, fontWeight: "600" },
  unsetBadge: { borderRadius: 8, borderWidth: 1, borderStyle: "dashed", paddingHorizontal: 10, paddingVertical: 6 },
  unsetText: { fontSize: 12 },
  dayActionsRow: { flexDirection: "row", gap: 10 },
  dayActionBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, padding: 12, alignItems: "center" },
  dayActionText: { fontSize: 14, fontWeight: "600" },
  addStaffBtn: { borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", padding: 14, alignItems: "center" },
  addStaffBtnText: { fontSize: 15, fontWeight: "600" },
  staffCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  staffCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  staffActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  iconBtnText: { fontSize: 18, fontWeight: "600" },
  miniGrid: { flexDirection: "row", gap: 4 },
  miniCell: { flex: 1, borderRadius: 6, borderWidth: 1, paddingVertical: 4, alignItems: "center", gap: 2 },
  miniCellDay: { fontSize: 9, fontWeight: "600" },
  miniCellShift: { fontSize: 13 },
  weekSummary: { fontSize: 12 },
  legendCard: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 10 },
  legendTitle: { fontSize: 14, fontWeight: "600" },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, width: "30%" },
  legendIcon: { fontSize: 16 },
  legendLabel: { fontSize: 13, fontWeight: "500" },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptySub: { fontSize: 14, textAlign: "center" },
  emptyBtn: { marginTop: 8, backgroundColor: "#3b82f6", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalSub: { fontSize: 13, marginTop: 2 },
  cancelBtn: { fontSize: 16, width: 60 },
  saveBtn: { fontSize: 16, fontWeight: "600", width: 60, textAlign: "right" },
  shiftPickerContent: { padding: 20, gap: 10 },
  pickerInstruction: { fontSize: 14, textAlign: "center", marginBottom: 8 },
  shiftOption: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 12, borderWidth: 1.5, padding: 16 },
  shiftOptionIcon: { fontSize: 22 },
  shiftOptionText: { fontSize: 16, fontWeight: "600", flex: 1 },
  checkmark: { fontSize: 18, fontWeight: "700" },
  staffFormContent: { padding: 20, gap: 10 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 8 },
  avatarLargeText: { fontSize: 28, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  colorPicker: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18 },
  colorSwatchSelected: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
});
