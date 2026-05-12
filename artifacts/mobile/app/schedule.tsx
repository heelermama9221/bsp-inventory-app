import React, { useMemo, useState } from "react";
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

type Employee = { id: string; name: string; role: string; color: string };

const SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening", "Closing", "Split", "Day Off"] as const;
type ShiftName = (typeof SHIFT_OPTIONS)[number];
type DayAssignments = Record<string, ShiftName>;   // employeeId → shift
type WeekAssignments = Record<string, DayAssignments>; // dayName → DayAssignments

type ScheduleWeek = {
  id: string;           // ISO Monday date "2026-05-11"
  weekStart: string;    // "2026-05-11"
  weekEnd: string;      // "2026-05-17"
  label: string;        // "May 11 – 17, 2026"
  published: boolean;
  publishedAt?: string;
  assignments: WeekAssignments;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type Day = (typeof DAYS)[number];

const DAY_SHORT: Record<Day, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLOYEE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#f97316", "#06b6d4", "#84cc16", "#ec4899", "#6366f1",
];

const SHIFT_COLORS: Record<ShiftName, string> = {
  Morning: "#f59e0b", Afternoon: "#3b82f6", Evening: "#8b5cf6",
  Closing: "#ef4444", Split: "#10b981", "Day Off": "#94a3b8",
};

const SHIFT_ICONS: Record<ShiftName, string> = {
  Morning: "🌅", Afternoon: "☀️", Evening: "🌆",
  Closing: "🌙", Split: "⚡", "Day Off": "—",
};

// ─── Date Utilities ───────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date`, as a local Date at midnight. */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const mo = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const su = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${mo} – ${su}`;
}

function makeWeek(monday: Date): ScheduleWeek {
  const sunday = addDays(monday, 6);
  return {
    id: toISO(monday),
    weekStart: toISO(monday),
    weekEnd: toISO(sunday),
    label: formatWeekLabel(monday),
    published: false,
    assignments: {},
  };
}

function isCurrentWeekMonday(monday: Date): boolean {
  return toISO(getMondayOf(new Date())) === toISO(monday);
}

function isPastMonday(monday: Date): boolean {
  return toISO(monday) < toISO(getMondayOf(new Date()));
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const colors = useColors();
  const [employees, setEmployees, empLoaded] = useStorage<Employee[]>("employees", []);
  const [weeks, setWeeks, weeksLoaded] = useStorage<ScheduleWeek[]>("schedule_weeks", []);

  // Current viewed Monday (as ISO string)
  const [viewMonday, setViewMonday] = useState<string>(() => toISO(getMondayOf(new Date())));

  const [tab, setTab] = useState<"schedule" | "staff" | "archive">("schedule");
  const [selectedDay, setSelectedDay] = useState<Day>("Monday");

  // Modals
  const [shiftModal, setShiftModal] = useState(false);
  const [shiftTarget, setShiftTarget] = useState<{ empId: string } | null>(null);
  const [staffModal, setStaffModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empColor, setEmpColor] = useState(EMPLOYEE_COLORS[0]);

  if (!empLoaded || !weeksLoaded) return null;

  // ── Derived ────────────────────────────────────────────────────────────

  const viewDate = new Date(viewMonday + "T00:00:00");
  const viewLabel = formatWeekLabel(viewDate);
  const isCurrent = isCurrentWeekMonday(viewDate);
  const isPast = isPastMonday(viewDate);

  const currentWeek = weeks.find((w) => w.id === viewMonday) ?? null;

  const todayISO = toISO(getMondayOf(new Date()));
  const publishedWeeks = weeks.filter((w) => w.published).sort((a, b) => b.id.localeCompare(a.id));
  const draftWeeks = weeks.filter((w) => !w.published).sort((a, b) => b.id.localeCompare(a.id));

  // Week quick-nav: current week ± 8 weeks
  const weekNavDates = useMemo(() => {
    const today = getMondayOf(new Date());
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, (i - 4) * 7);
      return toISO(getMondayOf(d));
    });
  }, []);

  // ── Week CRUD ──────────────────────────────────────────────────────────

  function createWeek(copyFromId?: string) {
    const monday = new Date(viewMonday + "T00:00:00");
    const newWeek = makeWeek(monday);
    if (copyFromId) {
      const source = weeks.find((w) => w.id === copyFromId);
      if (source) {
        newWeek.assignments = JSON.parse(JSON.stringify(source.assignments));
      }
    }
    setWeeks((prev) => [...prev.filter((w) => w.id !== newWeek.id), newWeek]);
  }

  function publishWeek() {
    if (!currentWeek) return;
    Alert.alert(
      "Publish Schedule",
      `Publish the schedule for ${currentWeek.label}? Staff will see this as the final schedule.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: () =>
            setWeeks((prev) =>
              prev.map((w) =>
                w.id === currentWeek.id
                  ? { ...w, published: true, publishedAt: new Date().toLocaleDateString() }
                  : w
              )
            ),
        },
      ]
    );
  }

  function unpublishWeek() {
    if (!currentWeek) return;
    Alert.alert("Revert to Draft", "Move this schedule back to draft so you can edit it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revert",
        onPress: () =>
          setWeeks((prev) =>
            prev.map((w) =>
              w.id === currentWeek.id ? { ...w, published: false, publishedAt: undefined } : w
            )
          ),
      },
    ]);
  }

  function deleteWeek() {
    if (!currentWeek) return;
    Alert.alert("Delete Schedule", `Delete the schedule for ${currentWeek.label}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => setWeeks((prev) => prev.filter((w) => w.id !== currentWeek.id)),
      },
    ]);
  }

  // ── Assignments ────────────────────────────────────────────────────────

  function getAssignment(day: Day, empId: string): ShiftName | null {
    return (currentWeek?.assignments?.[day]?.[empId] as ShiftName) ?? null;
  }

  function setAssignment(day: Day, empId: string, shift: ShiftName) {
    if (!currentWeek) return;
    setWeeks((prev) =>
      prev.map((w) =>
        w.id === currentWeek.id
          ? {
              ...w,
              assignments: {
                ...w.assignments,
                [day]: { ...(w.assignments[day] ?? {}), [empId]: shift },
              },
            }
          : w
      )
    );
  }

  function clearDay() {
    if (!currentWeek) return;
    Alert.alert("Clear Day", `Clear all assignments for ${selectedDay}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive",
        onPress: () =>
          setWeeks((prev) =>
            prev.map((w) =>
              w.id === currentWeek.id
                ? { ...w, assignments: { ...w.assignments, [selectedDay]: {} } }
                : w
            )
          ),
      },
    ]);
  }

  function copyDayToAll() {
    if (!currentWeek) return;
    const source = currentWeek.assignments[selectedDay] ?? {};
    Alert.alert("Copy to All Days", `Copy ${selectedDay}'s assignments to all other days?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Copy",
        onPress: () =>
          setWeeks((prev) =>
            prev.map((w) => {
              if (w.id !== currentWeek.id) return w;
              const next = { ...w.assignments };
              for (const day of DAYS) if (day !== selectedDay) next[day] = { ...source };
              return { ...w, assignments: next };
            })
          ),
      },
    ]);
  }

  function exportWeek() {
    if (!currentWeek || employees.length === 0) return;
    const rows: Record<string, string>[] = [];
    for (const day of DAYS) {
      for (const emp of employees) {
        const shift = currentWeek.assignments[day]?.[emp.id] ?? "Unassigned";
        rows.push({ Week: currentWeek.label, Day: day, Employee: emp.name, Role: emp.role, Shift: shift });
      }
    }
    exportToCsv(`Schedule_${currentWeek.id}`, rows);
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  function navWeek(direction: -1 | 1) {
    const d = new Date(viewMonday + "T00:00:00");
    d.setDate(d.getDate() + direction * 7);
    setViewMonday(toISO(d));
  }

  // ── Staff ──────────────────────────────────────────────────────────────

  function openAddStaff() {
    setEditingEmp(null); setEmpName(""); setEmpRole("");
    setEmpColor(EMPLOYEE_COLORS[employees.length % EMPLOYEE_COLORS.length]);
    setStaffModal(true);
  }

  function openEditStaff(emp: Employee) {
    setEditingEmp(emp); setEmpName(emp.name); setEmpRole(emp.role); setEmpColor(emp.color);
    setStaffModal(true);
  }

  function saveStaff() {
    if (!empName.trim()) { Alert.alert("Required", "Enter the employee's name."); return; }
    if (editingEmp) {
      setEmployees((prev) =>
        prev.map((e) => e.id === editingEmp.id ? { ...e, name: empName.trim(), role: empRole.trim(), color: empColor } : e)
      );
    } else {
      setEmployees((prev) => [...prev, { id: Date.now().toString(), name: empName.trim(), role: empRole.trim(), color: empColor }]);
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
          setWeeks((prev) =>
            prev.map((w) => {
              const next = { ...w.assignments };
              for (const day of DAYS) { const d = { ...(next[day] ?? {}) }; delete d[emp.id]; next[day] = d; }
              return { ...w, assignments: next };
            })
          );
        },
      },
    ]);
  }

  // ── Week stats for selected day ────────────────────────────────────────

  const dayAssignments = currentWeek?.assignments?.[selectedDay] ?? {};
  const scheduled = employees.filter((e) => dayAssignments[e.id] && dayAssignments[e.id] !== "Day Off");
  const offToday = employees.filter((e) => dayAssignments[e.id] === "Day Off");
  const unassigned = employees.filter((e) => !dayAssignments[e.id]);
  const isReadOnly = currentWeek?.published ?? false;

  // ── Previous week id for copy ──────────────────────────────────────────
  const prevMonday = toISO(addDays(new Date(viewMonday + "T00:00:00"), -7));
  const prevWeek = weeks.find((w) => w.id === prevMonday);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["schedule", "staff", "archive"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: "#3b82f6", borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? "#3b82f6" : colors.mutedForeground }]}>
              {t === "schedule" ? "📅 Schedule" : t === "staff" ? "👥 Staff" : "📁 Archive"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── SCHEDULE TAB ─────────────────────────────────────────────────── */}
      {tab === "schedule" && (
        <>
          {/* Week navigator */}
          <View style={[styles.weekNav, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => navWeek(-1)} style={styles.navArrow}>
              <Text style={[styles.navArrowText, { color: "#3b82f6" }]}>‹</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <View style={styles.weekLabelRow}>
                <Text style={[styles.weekLabel, { color: colors.foreground }]}>{viewLabel}</Text>
                {currentWeek?.published && (
                  <View style={[styles.statusPill, { backgroundColor: "#10b98120" }]}>
                    <Text style={[styles.statusPillText, { color: "#10b981" }]}>✓ Published</Text>
                  </View>
                )}
                {currentWeek && !currentWeek.published && (
                  <View style={[styles.statusPill, { backgroundColor: "#f59e0b20" }]}>
                    <Text style={[styles.statusPillText, { color: "#f59e0b" }]}>Draft</Text>
                  </View>
                )}
              </View>
              {!isCurrent && (
                <TouchableOpacity onPress={() => setViewMonday(todayISO)}>
                  <Text style={[styles.todayLink, { color: "#3b82f6" }]}>
                    {isPast ? "← " : ""}Today's week{!isPast ? " →" : ""}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={() => navWeek(1)} style={styles.navArrow}>
              <Text style={[styles.navArrowText, { color: "#3b82f6" }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Quick week strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.weekStrip, { borderBottomColor: colors.border }]} contentContainerStyle={styles.weekStripContent}>
            {weekNavDates.map((iso) => {
              const w = weeks.find((x) => x.id === iso);
              const isSelected = iso === viewMonday;
              const isToday = iso === todayISO;
              const d = new Date(iso + "T00:00:00");
              const shortLabel = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
              return (
                <TouchableOpacity
                  key={iso}
                  style={[
                    styles.weekChip,
                    { borderColor: isSelected ? "#3b82f6" : colors.border },
                    isSelected && { backgroundColor: "#3b82f6" },
                  ]}
                  onPress={() => setViewMonday(iso)}
                >
                  <Text style={[styles.weekChipDate, { color: isSelected ? "#fff" : isToday ? "#3b82f6" : colors.foreground }]}>
                    {isToday ? "Today" : shortLabel}
                  </Text>
                  {w && (
                    <View style={[styles.weekChipDot, { backgroundColor: w.published ? "#10b981" : "#f59e0b" }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.content}>
            {/* No week yet — create or copy */}
            {!currentWeek ? (
              <View style={[styles.emptyWeekCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.emptyWeekIcon}>{isPast ? "📁" : "📅"}</Text>
                <Text style={[styles.emptyWeekTitle, { color: colors.foreground }]}>
                  {isPast ? "No schedule saved for this week" : "No schedule yet for this week"}
                </Text>
                <Text style={[styles.emptyWeekSub, { color: colors.mutedForeground }]}>{viewLabel}</Text>
                <TouchableOpacity
                  style={[styles.createWeekBtn, { backgroundColor: "#3b82f6" }]}
                  onPress={() => createWeek()}
                >
                  <Text style={styles.createWeekBtnText}>+ Create Schedule</Text>
                </TouchableOpacity>
                {prevWeek && (
                  <TouchableOpacity
                    style={[styles.copyWeekBtn, { borderColor: "#3b82f6" }]}
                    onPress={() => createWeek(prevMonday)}
                  >
                    <Text style={[styles.copyWeekBtnText, { color: "#3b82f6" }]}>
                      Copy from {prevWeek.label}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {/* Published banner */}
                {isReadOnly && (
                  <View style={[styles.publishedBanner, { backgroundColor: "#10b98115", borderColor: "#10b98140" }]}>
                    <Text style={[styles.publishedBannerText, { color: "#10b981" }]}>
                      ✓ Published {currentWeek.publishedAt ?? ""}
                    </Text>
                    <TouchableOpacity onPress={unpublishWeek}>
                      <Text style={[styles.revertLink, { color: "#10b981" }]}>Revert to Draft</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Day strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStripContent}>
                  {DAYS.map((day) => {
                    const isSelected = day === selectedDay;
                    const count = employees.filter(
                      (e) => currentWeek.assignments[day]?.[e.id] && currentWeek.assignments[day][e.id] !== "Day Off"
                    ).length;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayChip, { borderColor: isSelected ? "#3b82f6" : colors.border }, isSelected && { backgroundColor: "#3b82f6" }]}
                        onPress={() => setSelectedDay(day)}
                      >
                        <Text style={[styles.dayChipLabel, { color: isSelected ? "#fff" : colors.foreground }]}>{DAY_SHORT[day]}</Text>
                        {count > 0 && (
                          <View style={[styles.dayChipBadge, { backgroundColor: isSelected ? "#ffffff40" : "#3b82f620" }]}>
                            <Text style={[styles.dayChipBadgeText, { color: isSelected ? "#fff" : "#3b82f6" }]}>{count}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Stats */}
                {employees.length > 0 && (
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
                )}

                {/* Employee rows */}
                {employees.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No staff yet. Add employees in the Staff tab.</Text>
                    <TouchableOpacity onPress={() => setTab("staff")} style={styles.emptyBtn}>
                      <Text style={styles.emptyBtnText}>Go to Staff →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  employees.map((emp) => {
                    const shift = getAssignment(selectedDay, emp.id);
                    const shiftColor = shift ? SHIFT_COLORS[shift] : colors.mutedForeground;
                    return (
                      <TouchableOpacity
                        key={emp.id}
                        style={[styles.empRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => {
                          if (isReadOnly) {
                            Alert.alert("Published", "This schedule is published. Revert to draft to make changes.");
                            return;
                          }
                          setShiftTarget({ empId: emp.id });
                          setShiftModal(true);
                        }}
                      >
                        <View style={[styles.avatar, { backgroundColor: emp.color + "20", borderColor: emp.color }]}>
                          <Text style={[styles.avatarText, { color: emp.color }]}>{initials(emp.name)}</Text>
                        </View>
                        <View style={styles.empInfo}>
                          <Text style={[styles.empName, { color: colors.foreground }]}>{emp.name}</Text>
                          {emp.role ? <Text style={[styles.empRole, { color: colors.mutedForeground }]}>{emp.role}</Text> : null}
                        </View>
                        {shift ? (
                          <View style={[styles.shiftBadge, { backgroundColor: shiftColor + "20", borderColor: shiftColor + "60" }]}>
                            <Text style={styles.shiftBadgeIcon}>{SHIFT_ICONS[shift]}</Text>
                            <Text style={[styles.shiftBadgeText, { color: shiftColor }]}>{shift}</Text>
                          </View>
                        ) : (
                          <View style={[styles.unsetBadge, { borderColor: isReadOnly ? "transparent" : colors.border }]}>
                            <Text style={[styles.unsetText, { color: colors.mutedForeground }]}>
                              {isReadOnly ? "—" : "Tap to assign"}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}

                {/* Week actions */}
                {!isReadOnly && employees.length > 0 && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: "#3b82f6" }]} onPress={copyDayToAll}>
                      <Text style={[styles.actionBtnText, { color: "#3b82f6" }]}>Copy Day to All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.destructive }]} onPress={clearDay}>
                      <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Clear Day</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Publish / Export / Delete */}
                <View style={styles.actionsRow}>
                  {!isReadOnly ? (
                    <TouchableOpacity style={[styles.publishBtn, { backgroundColor: "#10b981" }]} onPress={publishWeek}>
                      <Text style={styles.publishBtnText}>✓ Publish Schedule</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.publishBtn, { backgroundColor: "#3b82f6" }]} onPress={exportWeek}>
                      <Text style={styles.publishBtnText}>⬆ Export to CSV</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!isReadOnly && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: "#3b82f6", flex: 1 }]} onPress={exportWeek}>
                      <Text style={[styles.actionBtnText, { color: "#3b82f6" }]}>⬆ Export CSV</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.destructive }]} onPress={deleteWeek}>
                      <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}

      {/* ── STAFF TAB ────────────────────────────────────────────────────── */}
      {tab === "staff" && (
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={[styles.addStaffBtn, { borderColor: "#3b82f6" }]} onPress={openAddStaff}>
            <Text style={[styles.addStaffBtnText, { color: "#3b82f6" }]}>+ Add Employee</Text>
          </TouchableOpacity>

          {employees.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>No employees yet. Tap above to add your first team member.</Text>
            </View>
          ) : (
            employees.map((emp) => {
              const weekShifts = weeks.flatMap((w) =>
                DAYS.map((d) => w.assignments[d]?.[emp.id]).filter(Boolean)
              );
              const totalShifts = weekShifts.filter((s) => s !== "Day Off").length;
              return (
                <View key={emp.id} style={[styles.staffCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: emp.color, borderLeftWidth: 4 }]}>
                  <View style={styles.staffCardTop}>
                    <View style={[styles.avatar, { backgroundColor: emp.color + "20", borderColor: emp.color }]}>
                      <Text style={[styles.avatarText, { color: emp.color }]}>{initials(emp.name)}</Text>
                    </View>
                    <View style={styles.empInfo}>
                      <Text style={[styles.empName, { color: colors.foreground }]}>{emp.name}</Text>
                      {emp.role ? <Text style={[styles.empRole, { color: colors.mutedForeground }]}>{emp.role}</Text> : null}
                      <Text style={[styles.empRole, { color: colors.mutedForeground }]}>{totalShifts} shifts scheduled across all saved weeks</Text>
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
                </View>
              );
            })
          )}

          {/* Legend */}
          <View style={[styles.legendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.legendTitle, { color: colors.foreground }]}>Shift Legend</Text>
            <View style={styles.legendGrid}>
              {SHIFT_OPTIONS.map((s) => (
                <View key={s} style={styles.legendItem}>
                  <Text>{SHIFT_ICONS[s]}</Text>
                  <Text style={[styles.legendLabel, { color: SHIFT_COLORS[s] }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── ARCHIVE TAB ──────────────────────────────────────────────────── */}
      {tab === "archive" && (
        <ScrollView contentContainerStyle={styles.content}>
          {weeks.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>No schedules saved yet. Create one in the Schedule tab.</Text>
            </View>
          ) : (
            <>
              {publishedWeeks.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PUBLISHED</Text>
                  {publishedWeeks.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.archiveCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: "#10b981", borderLeftWidth: 4 }]}
                      onPress={() => { setViewMonday(w.id); setTab("schedule"); }}
                    >
                      <View style={styles.archiveRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.archiveLabel, { color: colors.foreground }]}>{w.label}</Text>
                          <Text style={[styles.archiveMeta, { color: colors.mutedForeground }]}>
                            Published {w.publishedAt ?? ""} · {employees.length} employees
                          </Text>
                        </View>
                        <View style={[styles.archivePill, { backgroundColor: "#10b98120" }]}>
                          <Text style={[styles.archivePillText, { color: "#10b981" }]}>✓ Published</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {draftWeeks.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DRAFTS</Text>
                  {draftWeeks.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.archiveCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: "#f59e0b", borderLeftWidth: 4 }]}
                      onPress={() => { setViewMonday(w.id); setTab("schedule"); }}
                    >
                      <View style={styles.archiveRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.archiveLabel, { color: colors.foreground }]}>{w.label}</Text>
                          <Text style={[styles.archiveMeta, { color: colors.mutedForeground }]}>Draft · {employees.length} employees</Text>
                        </View>
                        <View style={[styles.archivePill, { backgroundColor: "#f59e0b20" }]}>
                          <Text style={[styles.archivePillText, { color: "#f59e0b" }]}>Draft</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
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
                  {employees.find((e) => e.id === shiftTarget.empId)?.name}
                </Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{selectedDay} · {viewLabel}</Text>
              </View>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={styles.shiftPickerContent}>
              {SHIFT_OPTIONS.map((shift) => {
                const current = getAssignment(selectedDay, shiftTarget.empId);
                const isSelected = current === shift;
                const col = SHIFT_COLORS[shift];
                return (
                  <TouchableOpacity
                    key={shift}
                    style={[styles.shiftOption, { borderColor: isSelected ? col : colors.border, backgroundColor: isSelected ? col + "15" : colors.card }]}
                    onPress={() => { setAssignment(selectedDay, shiftTarget.empId, shift); setShiftModal(false); }}
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

      {/* ── Staff modal ────────────────────────────────────────────────────── */}
      <Modal visible={staffModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStaffModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingEmp ? "Edit Employee" : "Add Employee"}</Text>
            <TouchableOpacity onPress={saveStaff}>
              <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.staffFormContent}>
            <View style={[styles.avatarLarge, { backgroundColor: empColor + "20", borderColor: empColor }]}>
              <Text style={[styles.avatarLargeText, { color: empColor }]}>{empName ? initials(empName) : "?"}</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FULL NAME *</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Jane Smith" placeholderTextColor={colors.mutedForeground} value={empName} onChangeText={setEmpName} autoFocus={!editingEmp} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ROLE / POSITION</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. Line Cook, Server, Manager…" placeholderTextColor={colors.mutedForeground} value={empRole} onChangeText={setEmpRole} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>COLOUR</Text>
            <View style={styles.colorPicker}>
              {EMPLOYEE_COLORS.map((c) => (
                <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }, empColor === c && styles.colorSwatchSelected]} onPress={() => setEmpColor(c)} />
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
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: "center" },
  tabText: { fontSize: 13, fontWeight: "600" },
  weekNav: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1 },
  navArrow: { width: 44, alignItems: "center", justifyContent: "center" },
  navArrowText: { fontSize: 32, fontWeight: "300", lineHeight: 36 },
  weekLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  weekLabel: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  todayLink: { fontSize: 12, fontWeight: "500" },
  weekStrip: { borderBottomWidth: 1, maxHeight: 56 },
  weekStripContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, flexDirection: "row" },
  weekChip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignItems: "center", gap: 3, minWidth: 52 },
  weekChipDate: { fontSize: 12, fontWeight: "600" },
  weekChipDot: { width: 6, height: 6, borderRadius: 3 },
  content: { padding: 16, gap: 12 },
  emptyWeekCard: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  emptyWeekIcon: { fontSize: 40 },
  emptyWeekTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyWeekSub: { fontSize: 13, textAlign: "center" },
  createWeekBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13, marginTop: 4 },
  createWeekBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  copyWeekBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 11 },
  copyWeekBtnText: { fontWeight: "600", fontSize: 14 },
  publishedBanner: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  publishedBannerText: { fontSize: 14, fontWeight: "600" },
  revertLink: { fontSize: 13, fontWeight: "600" },
  dayStripContent: { paddingHorizontal: 0, paddingVertical: 4, gap: 8, flexDirection: "row" },
  dayChip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, alignItems: "center", gap: 3 },
  dayChipLabel: { fontSize: 12, fontWeight: "600" },
  dayChipBadge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  dayChipBadgeText: { fontSize: 10, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10 },
  statChip: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: "center", gap: 1 },
  statNum: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  empRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" },
  empInfo: { flex: 1 },
  empName: { fontSize: 15, fontWeight: "600" },
  empRole: { fontSize: 12, marginTop: 1 },
  shiftBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  shiftBadgeIcon: { fontSize: 14 },
  shiftBadgeText: { fontSize: 13, fontWeight: "600" },
  unsetBadge: { borderRadius: 8, borderWidth: 1, borderStyle: "dashed", paddingHorizontal: 10, paddingVertical: 6 },
  unsetText: { fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, padding: 12, alignItems: "center" },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  publishBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: "center" },
  publishBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  addStaffBtn: { borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", padding: 14, alignItems: "center" },
  addStaffBtnText: { fontSize: 15, fontWeight: "600" },
  staffCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  staffCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  staffActions: { gap: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  iconBtnText: { fontSize: 18, fontWeight: "600" },
  legendCard: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 10 },
  legendTitle: { fontSize: 14, fontWeight: "600" },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, width: "30%" },
  legendLabel: { fontSize: 13, fontWeight: "500" },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  archiveCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  archiveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  archiveLabel: { fontSize: 15, fontWeight: "600" },
  archiveMeta: { fontSize: 13, marginTop: 2 },
  archivePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  archivePillText: { fontSize: 12, fontWeight: "700" },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14 },
  emptyBtn: { marginTop: 4, backgroundColor: "#3b82f6", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalSub: { fontSize: 12, marginTop: 2 },
  cancelBtn: { fontSize: 16, width: 60 },
  saveBtn: { fontSize: 16, fontWeight: "600", width: 60, textAlign: "right" },
  shiftPickerContent: { padding: 20, gap: 10 },
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
