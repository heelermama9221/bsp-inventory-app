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

type CheckItem = { id: string; label: string; checked: boolean };
type Walkthrough = {
  id: string;
  date: string;
  shift: string;
  conductedBy: string;
  items: CheckItem[];
  notes: string;
  completed: boolean;
};

const DEFAULT_CHECKLIST: Omit<CheckItem, "checked">[] = [
  { id: "1", label: "Walk-in cooler temps logged" },
  { id: "2", label: "Freezer temps logged" },
  { id: "3", label: "Line setup complete" },
  { id: "4", label: "Prep levels adequate" },
  { id: "5", label: "Storage areas organized" },
  { id: "6", label: "Cleaning tasks completed" },
  { id: "7", label: "Equipment operational" },
  { id: "8", label: "Safety hazards clear" },
  { id: "9", label: "Staff properly positioned" },
  { id: "10", label: "Waste log updated" },
];

const SHIFTS = ["Morning", "Afternoon", "Evening", "Closing"];

function freshChecklist(): CheckItem[] {
  return DEFAULT_CHECKLIST.map((i) => ({ ...i, checked: false }));
}

export default function WalkthroughsScreen() {
  const colors = useColors();
  const [walkthroughs, setWalkthroughs] = useState<Walkthrough[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({
    shift: "Morning",
    conductedBy: "",
    notes: "",
    items: freshChecklist(),
  });

  const detail = walkthroughs.find((w) => w.id === detailId) ?? null;

  function startNew() {
    setForm({ shift: "Morning", conductedBy: "", notes: "", items: freshChecklist() });
    setModalVisible(true);
  }

  function toggleCheck(id: string) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
    }));
  }

  function saveWalkthrough() {
    if (!form.conductedBy.trim()) {
      Alert.alert("Required", "Please enter who conducted the walkthrough.");
      return;
    }
    const completed = form.items.every((i) => i.checked);
    const w: Walkthrough = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      shift: form.shift,
      conductedBy: form.conductedBy.trim(),
      items: form.items,
      notes: form.notes.trim(),
      completed,
    };
    setWalkthroughs((prev) => [w, ...prev]);
    setModalVisible(false);
  }

  const pct = (w: Walkthrough) =>
    Math.round((w.items.filter((i) => i.checked).length / w.items.length) * 100);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: "#3b82f6" }]}
          onPress={startNew}
        >
          <Text style={styles.addBtnText}>+ New Walkthrough</Text>
        </TouchableOpacity>

        {walkthroughs.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No walkthroughs logged yet. Tap above to start.
            </Text>
          </View>
        )}

        {walkthroughs.map((w) => (
          <TouchableOpacity
            key={w.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setDetailId(w.id)}
          >
            <View style={styles.cardRow}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  {w.shift} Shift — {w.date}
                </Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                  By: {w.conductedBy}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: w.completed ? "#10b981" : "#f59e0b" },
                ]}
              >
                <Text style={styles.badgeText}>{pct(w)}%</Text>
              </View>
            </View>
            {w.notes ? (
              <Text style={[styles.cardNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                {w.notes}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* New Walkthrough Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Walkthrough</Text>
            <TouchableOpacity onPress={saveWalkthrough}>
              <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>SHIFT</Text>
            <View style={styles.shiftRow}>
              {SHIFTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.shiftBtn,
                    { borderColor: colors.border },
                    form.shift === s && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
                  ]}
                  onPress={() => setForm((f) => ({ ...f, shift: s }))}
                >
                  <Text
                    style={[
                      styles.shiftBtnText,
                      { color: form.shift === s ? "#fff" : colors.foreground },
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CONDUCTED BY</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Name"
              placeholderTextColor={colors.mutedForeground}
              value={form.conductedBy}
              onChangeText={(v) => setForm((f) => ({ ...f, conductedBy: v }))}
            />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CHECKLIST</Text>
            {form.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.checkRow, { borderBottomColor: colors.border }]}
                onPress={() => toggleCheck(item.id)}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border },
                    item.checked && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
                  ]}
                >
                  {item.checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, { color: colors.foreground }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES</Text>
            <TextInput
              style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Additional notes..."
              placeholderTextColor={colors.mutedForeground}
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet">
        {detail && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {detail.shift} — {detail.date}
              </Text>
              <TouchableOpacity onPress={() => setDetailId(null)}>
                <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.detailMeta, { color: colors.mutedForeground }]}>
                Conducted by: {detail.conductedBy}
              </Text>
              <Text style={[styles.detailMeta, { color: colors.mutedForeground }]}>
                Completion: {pct(detail)}% ({detail.items.filter((i) => i.checked).length}/{detail.items.length})
              </Text>
              {detail.items.map((item) => (
                <View key={item.id} style={[styles.checkRow, { borderBottomColor: colors.border }]}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.border },
                      item.checked && { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
                    ]}
                  >
                    {item.checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.checkLabel, { color: colors.foreground }]}>{item.label}</Text>
                </View>
              ))}
              {detail.notes ? (
                <>
                  <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>NOTES</Text>
                  <Text style={[styles.detailNote, { color: colors.foreground }]}>{detail.notes}</Text>
                </>
              ) : null}
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
  addBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 15, textAlign: "center" },
  card: { borderRadius: 10, borderWidth: 1, padding: 14 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: 2 },
  cardNote: { fontSize: 13, marginTop: 6 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "600" },
  modalScroll: { flex: 1 },
  modalContent: { padding: 16 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  shiftRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shiftBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  shiftBtnText: { fontSize: 14, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  textarea: { minHeight: 90 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  checkLabel: { fontSize: 15, flex: 1 },
  detailMeta: { fontSize: 14, marginBottom: 4 },
  detailNote: { fontSize: 15, lineHeight: 22 },
});
