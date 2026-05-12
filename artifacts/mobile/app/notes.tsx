import React, { useState, useEffect, useCallback } from "react";
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

// ── Types ────────────────────────────────────────────────────────────────────

type NoteCategory = "Special" | "Rotation" | "Handoff" | "Allergy" | "General";

type KitchenNote = {
  id: string;
  category: NoteCategory;
  title: string;
  body: string;
  author: string;
  pinned: boolean;
  done: boolean;
  shift: "AM" | "PM" | "All";
  createdAt: string;
  updatedAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "kitchen_notes";

const CATEGORIES: NoteCategory[] = ["Special", "Rotation", "Handoff", "Allergy", "General"];

const CAT_META: Record<NoteCategory, { icon: string; color: string; label: string; hint: string }> = {
  Special:  { icon: "⭐", color: "#f59e0b", label: "Daily Special",      hint: "Today's features, 86'd items, chef's additions" },
  Rotation: { icon: "🔄", color: "#ef4444", label: "Rotation Alert",     hint: "Use older stock first, date checks, FIFO reminders" },
  Handoff:  { icon: "🤝", color: "#3b82f6", label: "Shift Handoff",      hint: "What AM is leaving for PM, open issues, heads-up" },
  Allergy:  { icon: "⚠️",  color: "#dc2626", label: "Allergy / Safety",   hint: "Cross-contact risks, guest alerts, modified prep" },
  General:  { icon: "📝", color: "#6b7280", label: "General Note",       hint: "Anything the team needs to know today" },
};

const SHIFTS = ["All", "AM", "PM"] as const;

const EMPTY_FORM: Omit<KitchenNote, "id" | "createdAt" | "updatedAt"> = {
  category: "General",
  title: "",
  body: "",
  author: "",
  pinned: false,
  done: false,
  shift: "All",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const colors = useColors();

  const [notes, setNotes] = useState<KitchenNote[]>([]);
  const [filterCat, setFilterCat] = useState<NoteCategory | "All">("All");
  const [filterShift, setFilterShift] = useState<"All" | "AM" | "PM">("All");
  const [showDone, setShowDone] = useState(false);
  const [modal, setModal] = useState(false);
  const [editingNote, setEditingNote] = useState<KitchenNote | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState("");

  // ── Persist ───────────────────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setNotes(JSON.parse(raw));
    });
  }, []);

  const persist = useCallback((next: KitchenNote[]) => {
    setNotes(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function openNew() {
    setEditingNote(null);
    setForm({ ...EMPTY_FORM });
    setModal(true);
  }

  function openEdit(note: KitchenNote) {
    setEditingNote(note);
    setForm({
      category: note.category,
      title: note.title,
      body: note.body,
      author: note.author,
      pinned: note.pinned,
      done: note.done,
      shift: note.shift,
    });
    setModal(true);
  }

  function saveNote() {
    if (!form.title.trim() && !form.body.trim()) {
      Alert.alert("Empty note", "Add a title or message before saving.");
      return;
    }
    const now = new Date().toISOString();
    if (editingNote) {
      persist(
        notes.map((n) =>
          n.id === editingNote.id
            ? { ...n, ...form, updatedAt: now }
            : n
        )
      );
    } else {
      const note: KitchenNote = {
        id: uid(),
        ...form,
        createdAt: now,
        updatedAt: now,
      };
      persist([note, ...notes]);
    }
    setModal(false);
  }

  function toggleDone(id: string) {
    persist(notes.map((n) => (n.id === id ? { ...n, done: !n.done, updatedAt: new Date().toISOString() } : n)));
  }

  function togglePin(id: string) {
    persist(notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n)));
  }

  function deleteNote(note: KitchenNote) {
    Alert.alert("Delete note?", `"${note.title || note.body.slice(0, 40)}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => persist(notes.filter((n) => n.id !== note.id)) },
    ]);
  }

  function clearDone() {
    Alert.alert("Clear completed?", "Remove all marked-done notes?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => persist(notes.filter((n) => !n.done)) },
    ]);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const q = search.toLowerCase();
  const visible = notes
    .filter((n) => {
      if (!showDone && n.done) return false;
      if (filterCat !== "All" && n.category !== filterCat) return false;
      if (filterShift !== "All" && n.shift !== "All" && n.shift !== filterShift) return false;
      if (q) return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.author.toLowerCase().includes(q);
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const doneCount = notes.filter((n) => n.done).length;
  const activeCount = notes.filter((n) => !n.done).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search notes…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Shift filter */}
      <View style={styles.shiftRow}>
        {SHIFTS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.shiftBtn, { borderColor: colors.border, backgroundColor: filterShift === s ? "#3b82f6" : colors.card }]}
            onPress={() => setFilterShift(s)}
          >
            <Text style={[styles.shiftBtnText, { color: filterShift === s ? "#fff" : colors.foreground }]}>
              {s === "All" ? "All Shifts" : `${s} Shift`}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.shiftBtn, { borderColor: colors.border, backgroundColor: showDone ? "#6b728020" : colors.card }]}
          onPress={() => setShowDone((v) => !v)}
        >
          <Text style={[styles.shiftBtnText, { color: showDone ? "#6b7280" : colors.mutedForeground }]}>
            ✓ Done {doneCount > 0 ? `(${doneCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catFilter}>
        {(["All", ...CATEGORIES] as (NoteCategory | "All")[]).map((c) => {
          const meta = c !== "All" ? CAT_META[c] : null;
          const active = filterCat === c;
          const col = meta?.color ?? "#6b7280";
          return (
            <TouchableOpacity
              key={c}
              style={[styles.catChip, { borderColor: active ? col : colors.border, backgroundColor: active ? col + "20" : colors.card }]}
              onPress={() => setFilterCat(c)}
            >
              {meta && <Text style={styles.catChipIcon}>{meta.icon}</Text>}
              <Text style={[styles.catChipText, { color: active ? col : colors.foreground, fontWeight: active ? "700" : "500" }]}>
                {c === "All" ? "All Notes" : meta?.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Notes list */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>

        {activeCount === 0 && !showDone && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notes yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Tap + Add Note to post daily specials, rotation reminders, or shift handoff messages for your team.
            </Text>
          </View>
        )}

        {visible.map((note) => {
          const meta = CAT_META[note.category];
          return (
            <TouchableOpacity
              key={note.id}
              style={[
                styles.noteCard,
                { backgroundColor: colors.card, borderColor: note.done ? colors.border : meta.color + "40" },
                note.pinned && !note.done && { borderLeftWidth: 4, borderLeftColor: meta.color },
                note.done && { opacity: 0.55 },
              ]}
              onPress={() => openEdit(note)}
              activeOpacity={0.8}
            >
              {/* Top row */}
              <View style={styles.noteTop}>
                <View style={[styles.catBadge, { backgroundColor: meta.color + "20" }]}>
                  <Text style={styles.catBadgeIcon}>{meta.icon}</Text>
                  <Text style={[styles.catBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <View style={styles.noteActions}>
                  {note.shift !== "All" && (
                    <View style={[styles.shiftTag, { backgroundColor: note.shift === "AM" ? "#f59e0b20" : "#3b82f620" }]}>
                      <Text style={[styles.shiftTagText, { color: note.shift === "AM" ? "#b45309" : "#1d4ed8" }]}>{note.shift}</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => togglePin(note.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 16 }}>{note.pinned ? "📌" : "📍"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleDone(note.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <View style={[styles.doneBox, { borderColor: note.done ? "#16a34a" : colors.border, backgroundColor: note.done ? "#16a34a" : "transparent" }]}>
                      {note.done && <Text style={styles.doneCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title */}
              {note.title.length > 0 && (
                <Text style={[styles.noteTitle, { color: note.done ? colors.mutedForeground : colors.foreground, textDecorationLine: note.done ? "line-through" : "none" }]}>
                  {note.title}
                </Text>
              )}

              {/* Body */}
              {note.body.length > 0 && (
                <Text style={[styles.noteBody, { color: colors.mutedForeground }]} numberOfLines={4}>
                  {note.body}
                </Text>
              )}

              {/* Footer */}
              <View style={styles.noteFoot}>
                <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>
                  {note.author ? `${note.author}  ·  ` : ""}{formatTime(note.updatedAt)}
                </Text>
                <TouchableOpacity onPress={() => deleteNote(note)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: colors.destructive, fontSize: 12 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {doneCount > 0 && showDone && (
          <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.destructive + "50" }]} onPress={clearDone}>
            <Text style={[styles.clearBtnText, { color: colors.destructive }]}>🗑 Clear all completed ({doneCount})</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: "#3b82f6" }]} onPress={openNew}>
        <Text style={styles.fabText}>+ Add Note</Text>
      </TouchableOpacity>

      {/* ── Note Form Modal ───────────────────────────────────────────────── */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingNote ? "Edit Note" : "New Note"}
            </Text>
            <TouchableOpacity onPress={saveNote}>
              <Text style={[styles.saveBtn, { color: "#3b82f6" }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* Category */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPickerRow}>
              {CATEGORIES.map((c) => {
                const meta = CAT_META[c];
                const sel = form.category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catPickerChip, { borderColor: sel ? meta.color : colors.border, backgroundColor: sel ? meta.color : colors.card }]}
                    onPress={() => setForm((f) => ({ ...f, category: c }))}
                  >
                    <Text style={styles.catPickerIcon}>{meta.icon}</Text>
                    <Text style={[styles.catPickerText, { color: sel ? "#fff" : colors.foreground }]}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>{CAT_META[form.category].hint}</Text>

            {/* Shift */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>SHIFT</Text>
            <View style={styles.shiftPickRow}>
              {SHIFTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.shiftPickBtn, { borderColor: form.shift === s ? "#3b82f6" : colors.border, backgroundColor: form.shift === s ? "#3b82f6" : colors.card }]}
                  onPress={() => setForm((f) => ({ ...f, shift: s }))}
                >
                  <Text style={[styles.shiftPickText, { color: form.shift === s ? "#fff" : colors.foreground }]}>
                    {s === "All" ? "All Shifts" : `${s} Shift`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TITLE</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder={form.category === "Special" ? "e.g. 86'd — Salmon" : form.category === "Rotation" ? "e.g. Use older red sauce first" : "Short headline…"}
              placeholderTextColor={colors.mutedForeground}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
            />

            {/* Body */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>MESSAGE</Text>
            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Add details, instructions, or anything your team needs to know…"
              placeholderTextColor={colors.mutedForeground}
              value={form.body}
              onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {/* Author */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>POSTED BY (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Your name or initials"
              placeholderTextColor={colors.mutedForeground}
              value={form.author}
              onChangeText={(v) => setForm((f) => ({ ...f, author: v }))}
            />

            {/* Options */}
            <View style={styles.optRow}>
              <TouchableOpacity
                style={[styles.optBtn, { borderColor: colors.border, backgroundColor: form.pinned ? "#f59e0b20" : colors.card }]}
                onPress={() => setForm((f) => ({ ...f, pinned: !f.pinned }))}
              >
                <Text style={styles.optIcon}>📌</Text>
                <Text style={[styles.optText, { color: form.pinned ? "#b45309" : colors.foreground, fontWeight: form.pinned ? "700" : "500" }]}>
                  {form.pinned ? "Pinned to top" : "Pin to top"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optBtn, { borderColor: colors.border, backgroundColor: form.done ? "#16a34a20" : colors.card }]}
                onPress={() => setForm((f) => ({ ...f, done: !f.done }))}
              >
                <Text style={styles.optIcon}>✓</Text>
                <Text style={[styles.optText, { color: form.done ? "#16a34a" : colors.foreground, fontWeight: form.done ? "700" : "500" }]}>
                  {form.done ? "Marked done" : "Mark done"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchBar: { flexDirection: "row", alignItems: "center", margin: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  shiftRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  shiftBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  shiftBtnText: { fontSize: 12, fontWeight: "600" },
  catFilter: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  catChipIcon: { fontSize: 13 },
  catChipText: { fontSize: 13 },
  list: { padding: 12, gap: 12 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  noteCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  noteTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  catBadgeIcon: { fontSize: 13 },
  catBadgeText: { fontSize: 12, fontWeight: "700" },
  noteActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  shiftTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  shiftTagText: { fontSize: 11, fontWeight: "800" },
  doneBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  doneCheck: { color: "#fff", fontSize: 13, fontWeight: "800" },
  noteTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  noteBody: { fontSize: 14, lineHeight: 20 },
  noteFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  noteTime: { fontSize: 12 },
  clearBtn: { borderRadius: 12, borderWidth: 1, borderStyle: "dashed", padding: 14, alignItems: "center", marginTop: 8 },
  clearBtnText: { fontSize: 14, fontWeight: "600" },
  fab: { position: "absolute", bottom: 28, right: 20, borderRadius: 28, paddingHorizontal: 24, paddingVertical: 14, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8 },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // Modal
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  cancelBtn: { fontSize: 16 },
  saveBtn: { fontSize: 16, fontWeight: "700" },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalContent: { padding: 20, gap: 6 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginTop: 14 },
  hintText: { fontSize: 12, marginTop: 4, marginBottom: 4, fontStyle: "italic" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 110 },
  catPickerRow: { gap: 8, paddingVertical: 4 },
  catPickerChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  catPickerIcon: { fontSize: 16 },
  catPickerText: { fontSize: 13, fontWeight: "600" },
  shiftPickRow: { flexDirection: "row", gap: 10 },
  shiftPickBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  shiftPickText: { fontSize: 13, fontWeight: "600" },
  optRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  optBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  optIcon: { fontSize: 16 },
  optText: { fontSize: 13 },
});
