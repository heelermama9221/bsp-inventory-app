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

type RecipeIngredient = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
};

type Recipe = {
  id: string;
  name: string;
  category: string;
  yieldQty: string;
  yieldUnit: string;
  servings: string;
  notes: string;
  ingredients: RecipeIngredient[];
};

type InventoryRef = { id: string; name: string; currentStock: string; unit: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const RECIPE_CATEGORIES = ["Sauce", "Soup", "Protein", "Side", "Salad", "Marinade", "Dressing", "Dessert", "Beverage", "Prep", "Other"];
const YIELD_UNITS = ["portions", "oz", "lbs", "cups", "quarts", "gallons", "each", "batch"];
const ING_UNITS = ["oz", "lbs", "each", "cup", "quart", "gallon", "tbsp", "tsp", "portion", "slice", "bunch", "case", "bag"];

const CAT_COLORS: Record<string, string> = {
  Sauce: "#f97316", Soup: "#06b6d4", Protein: "#ef4444", Side: "#10b981",
  Salad: "#84cc16", Marinade: "#8b5cf6", Dressing: "#f59e0b", Dessert: "#ec4899",
  Beverage: "#3b82f6", Prep: "#16a34a", Other: "#6b7280",
};

const BLANK_RECIPE = { name: "", category: "Prep", yieldQty: "", yieldUnit: "portions", servings: "", notes: "" };
const BLANK_ING = { name: "", quantity: "", unit: "oz" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrepScreen() {
  const colors = useColors();
  const [recipes, setRecipes, loaded] = useStorage<Recipe[]>("recipes", []);
  const [inventory] = useStorage<InventoryRef[]>("inventory_items", []);

  const [tab, setTab] = useState<"recipes" | "batch">("recipes");
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");

  // Recipe modal
  const [recipeModal, setRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeForm, setRecipeForm] = useState(BLANK_RECIPE);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  // Ingredient add (inline inside recipe modal)
  const [ingForm, setIngForm] = useState(BLANK_ING);
  const [ingSection, setIngSection] = useState(false);

  // Detail view
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  // Batch calc
  const [batchRecipeId, setBatchRecipeId] = useState<string | null>(null);
  const [batchMultiplier, setBatchMultiplier] = useState("1");

  if (!loaded) return null;

  // ── Filtering ─────────────────────────────────────────────────────────

  const filtered = recipes.filter((r) => {
    const matchCat = filterCat === "All" || r.category === filterCat;
    const matchSearch = !search.trim() || r.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Recipe CRUD ───────────────────────────────────────────────────────

  function openAdd() {
    setEditingRecipe(null);
    setRecipeForm(BLANK_RECIPE);
    setIngredients([]);
    setIngForm(BLANK_ING);
    setIngSection(false);
    setRecipeModal(true);
  }

  function openEdit(r: Recipe) {
    setEditingRecipe(r);
    setRecipeForm({ name: r.name, category: r.category, yieldQty: r.yieldQty, yieldUnit: r.yieldUnit, servings: r.servings, notes: r.notes });
    setIngredients([...r.ingredients]);
    setIngForm(BLANK_ING);
    setIngSection(false);
    setRecipeModal(true);
  }

  function saveRecipe() {
    if (!recipeForm.name.trim()) { Alert.alert("Required", "Recipe name is required."); return; }
    if (editingRecipe) {
      setRecipes((prev) => prev.map((r) =>
        r.id === editingRecipe.id ? { ...r, ...recipeForm, name: recipeForm.name.trim(), ingredients } : r
      ));
    } else {
      setRecipes((prev) => [{ id: Date.now().toString(), ...recipeForm, name: recipeForm.name.trim(), ingredients }, ...prev]);
    }
    setRecipeModal(false);
  }

  function deleteRecipe(id: string) {
    Alert.alert("Delete Recipe", "Remove this recipe?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setRecipes((prev) => prev.filter((r) => r.id !== id)) },
    ]);
  }

  // ── Ingredient management (inside modal) ──────────────────────────────

  function addIngredient() {
    if (!ingForm.name.trim() || !ingForm.quantity.trim()) {
      Alert.alert("Required", "Ingredient name and quantity are required.");
      return;
    }
    setIngredients((prev) => [...prev, { id: Date.now().toString(), ...ingForm, name: ingForm.name.trim() }]);
    setIngForm(BLANK_ING);
    setIngSection(false);
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  // ── Batch calc ────────────────────────────────────────────────────────

  const batchRecipe = recipes.find((r) => r.id === batchRecipeId) ?? null;
  const multiplier = Math.max(1, parseFloat(batchMultiplier) || 1);

  type IngCalc = {
    ingredient: RecipeIngredient;
    needed: number;
    onHand: number | null;
    maxBatches: number | null;
    isLinked: boolean;
  };

  const ingCalcs: IngCalc[] = batchRecipe
    ? batchRecipe.ingredients.map((ing) => {
        const inv = inventory.find((i) => i.name.toLowerCase() === ing.name.toLowerCase());
        const needed = parseFloat(ing.quantity) || 0;
        const onHand = inv ? (parseFloat(inv.currentStock) || 0) : null;
        const maxBatches = onHand !== null && needed > 0 ? Math.floor(onHand / needed) : null;
        return { ingredient: ing, needed, onHand, maxBatches, isLinked: !!inv };
      })
    : [];

  const linkedCalcs = ingCalcs.filter((c) => c.maxBatches !== null);
  const overallMax = linkedCalcs.length > 0 ? Math.min(...linkedCalcs.map((c) => c.maxBatches!)) : null;
  const limitingIng = linkedCalcs.find((c) => c.maxBatches === overallMax);

  function exportRecipes() {
    const rows = recipes.flatMap((r) =>
      r.ingredients.length > 0
        ? r.ingredients.map((ing) => ({
            Recipe: r.name, Category: r.category,
            "Yield Qty": r.yieldQty, "Yield Unit": r.yieldUnit,
            Servings: r.servings, Notes: r.notes,
            Ingredient: ing.name, "Ing Qty": ing.quantity, "Ing Unit": ing.unit,
          }))
        : [{ Recipe: r.name, Category: r.category, "Yield Qty": r.yieldQty, "Yield Unit": r.yieldUnit, Servings: r.servings, Notes: r.notes, Ingredient: "", "Ing Qty": "", "Ing Unit": "" }]
    );
    exportToCsv("Recipes", rows);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["recipes", "batch"] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && { borderBottomColor: "#16a34a", borderBottomWidth: 2.5 }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, { color: tab === t ? "#16a34a" : colors.mutedForeground }]}>
              {t === "recipes" ? "📖 Recipe Book" : "⚖ Batch Calculator"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── RECIPES TAB ──────────────────────────────────────────────────── */}
      {tab === "recipes" && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Search recipes…"
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, { borderBottomColor: colors.border }]} contentContainerStyle={styles.filterContent}>
            {["All", ...RECIPE_CATEGORIES].map((cat) => (
              <TouchableOpacity key={cat} style={[styles.filterChip, { borderColor: colors.border }, filterCat === cat && { backgroundColor: "#16a34a", borderColor: "#16a34a" }]} onPress={() => setFilterCat(cat)}>
                <Text style={[styles.filterChipText, { color: filterCat === cat ? "#fff" : colors.foreground }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: "#16a34a", flex: 1 }]} onPress={openAdd}>
                <Text style={styles.addBtnText}>+ Add Recipe</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.exportBtn, { borderColor: "#16a34a" }]} onPress={exportRecipes}>
                <Text style={[styles.exportBtnText, { color: "#16a34a" }]}>⬆ Export</Text>
              </TouchableOpacity>
            </View>

            {filtered.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📖</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No recipes yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap + Add Recipe to build your recipe book.</Text>
              </View>
            )}

            {filtered.map((r) => {
              const catColor = CAT_COLORS[r.category] ?? "#6b7280";
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: catColor, borderLeftWidth: 4 }]}
                  onPress={() => setDetailRecipe(r)}
                  onLongPress={() => deleteRecipe(r.id)}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{r.name}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                        {r.yieldQty ? `Yield: ${r.yieldQty} ${r.yieldUnit}` : r.category}
                        {r.servings ? ` · ${r.servings} servings` : ""}
                        {" · "}{r.ingredients.length} ingredient{r.ingredients.length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View style={[styles.catBadge, { backgroundColor: catColor + "20" }]}>
                      <Text style={[styles.catBadgeText, { color: catColor }]}>{r.category}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Tap to view · Long press to delete</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}

      {/* ── BATCH CALC TAB ───────────────────────────────────────────────── */}
      {tab === "batch" && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.infoBox, { backgroundColor: "#16a34a12", borderColor: "#16a34a40" }]}>
            <Text style={[styles.infoText, { color: "#16a34a" }]}>
              Select a recipe to see how many batches you can make from your current on-hand inventory. Ingredient names must match inventory exactly.
            </Text>
          </View>

          {/* Recipe picker */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELECT RECIPE</Text>
          {recipes.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>No recipes yet. Add one in the Recipe Book tab.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipePickerRow}>
              {recipes.map((r) => {
                const isSelected = r.id === batchRecipeId;
                const catColor = CAT_COLORS[r.category] ?? "#6b7280";
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.recipeChip, { borderColor: isSelected ? "#16a34a" : colors.border, backgroundColor: isSelected ? "#16a34a" : colors.card }]}
                    onPress={() => setBatchRecipeId(r.id)}
                  >
                    <Text style={[styles.recipeChipText, { color: isSelected ? "#fff" : colors.foreground }]}>{r.name}</Text>
                    <Text style={[styles.recipeChipSub, { color: isSelected ? "#ffffff99" : colors.mutedForeground }]}>{r.category}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {batchRecipe && (
            <>
              {/* Multiplier */}
              <View style={styles.multiplierRow}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 0 }]}>BATCH MULTIPLIER</Text>
                <View style={styles.multiplierControl}>
                  <TouchableOpacity style={[styles.multBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setBatchMultiplier((v) => String(Math.max(1, (parseFloat(v) || 1) - 1)))}>
                    <Text style={[styles.multBtnText, { color: colors.foreground }]}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.multInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                    value={batchMultiplier}
                    onChangeText={setBatchMultiplier}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity style={[styles.multBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setBatchMultiplier((v) => String((parseFloat(v) || 1) + 1))}>
                    <Text style={[styles.multBtnText, { color: colors.foreground }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Overall result */}
              {overallMax !== null ? (
                <View style={[styles.resultCard, { backgroundColor: overallMax >= multiplier ? "#16a34a15" : "#ef444415", borderColor: overallMax >= multiplier ? "#16a34a50" : "#ef444450" }]}>
                  <Text style={[styles.resultNum, { color: overallMax >= multiplier ? "#16a34a" : "#ef4444" }]}>{overallMax}</Text>
                  <Text style={[styles.resultLabel, { color: colors.foreground }]}>
                    max batch{overallMax !== 1 ? "es" : ""} of {batchRecipe.name}
                  </Text>
                  {overallMax < multiplier && (
                    <Text style={[styles.resultSub, { color: "#ef4444" }]}>⚠ Not enough inventory for {multiplier} batch{multiplier !== 1 ? "es" : ""}</Text>
                  )}
                  {limitingIng && (
                    <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>
                      Limited by: {limitingIng.ingredient.name}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={[styles.resultCard, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b50" }]}>
                  <Text style={[styles.resultLabel, { color: "#f59e0b" }]}>No inventory linked yet</Text>
                  <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>Make sure ingredient names match items in your inventory.</Text>
                </View>
              )}

              {/* Yield for multiplier */}
              {batchRecipe.yieldQty && overallMax !== null && overallMax >= multiplier && (
                <View style={[styles.yieldRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.yieldLabel, { color: colors.mutedForeground }]}>Total yield for {multiplier} batch{multiplier !== 1 ? "es" : ""}</Text>
                  <Text style={[styles.yieldValue, { color: "#16a34a" }]}>
                    {(parseFloat(batchRecipe.yieldQty) * multiplier).toFixed(1)} {batchRecipe.yieldUnit}
                    {batchRecipe.servings ? ` · ${(parseFloat(batchRecipe.servings) * multiplier).toFixed(0)} servings` : ""}
                  </Text>
                </View>
              )}

              {/* Ingredient breakdown */}
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>INGREDIENT BREAKDOWN ({multiplier}× batch)</Text>
              {batchRecipe.ingredients.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>No ingredients on this recipe. Tap the recipe in Recipe Book to edit it.</Text>
                </View>
              ) : (
                ingCalcs.map(({ ingredient, needed, onHand, maxBatches, isLinked }) => {
                  const totalNeeded = needed * multiplier;
                  const canMake = maxBatches !== null && maxBatches >= multiplier;
                  const isLimiting = ingredient.id === limitingIng?.ingredient.id;
                  return (
                    <View
                      key={ingredient.id}
                      style={[
                        styles.ingRow,
                        { backgroundColor: colors.card, borderColor: isLimiting ? "#ef4444" : colors.border },
                        isLimiting && { borderWidth: 1.5 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.ingRowTop}>
                          <Text style={[styles.ingName, { color: colors.foreground }]}>{ingredient.name}</Text>
                          {isLimiting && (
                            <View style={[styles.limitingBadge, { backgroundColor: "#ef444420" }]}>
                              <Text style={[styles.limitingBadgeText, { color: "#ef4444" }]}>Limiting</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.ingMeta, { color: colors.mutedForeground }]}>
                          Need: {totalNeeded.toFixed(1)} {ingredient.unit} ({needed} per batch)
                        </Text>
                        {isLinked ? (
                          <Text style={[styles.ingMeta, { color: canMake ? "#16a34a" : "#ef4444" }]}>
                            On hand: {onHand} {ingredient.unit} → can make {maxBatches} batch{maxBatches !== 1 ? "es" : ""}
                          </Text>
                        ) : (
                          <Text style={[styles.ingMeta, { color: "#f59e0b" }]}>⚠ Not in inventory — name doesn't match</Text>
                        )}
                      </View>
                      <View style={[styles.ingStatus, { backgroundColor: !isLinked ? "#f59e0b20" : canMake ? "#16a34a20" : "#ef444420" }]}>
                        <Text style={{ fontSize: 16 }}>{!isLinked ? "?" : canMake ? "✓" : "✕"}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── Recipe Form Modal ─────────────────────────────────────────────── */}
      <Modal visible={recipeModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setRecipeModal(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingRecipe ? "Edit Recipe" : "New Recipe"}</Text>
            <TouchableOpacity onPress={saveRecipe}>
              <Text style={[styles.saveBtn, { color: "#16a34a" }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            <Text style={[styles.label, { color: colors.mutedForeground }]}>RECIPE NAME *</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. House BBQ Sauce" placeholderTextColor={colors.mutedForeground} value={recipeForm.name} onChangeText={(v) => setRecipeForm((f) => ({ ...f, name: v }))} autoFocus={!editingRecipe} />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>CATEGORY</Text>
            <View style={styles.chipGroup}>
              {RECIPE_CATEGORIES.map((c) => {
                const cc = CAT_COLORS[c] ?? "#6b7280";
                return (
                  <TouchableOpacity key={c} style={[styles.chip, { borderColor: colors.border }, recipeForm.category === c && { backgroundColor: cc, borderColor: cc }]} onPress={() => setRecipeForm((f) => ({ ...f, category: c }))}>
                    <Text style={[styles.chipText, { color: recipeForm.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>YIELD QTY</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={recipeForm.yieldQty} onChangeText={(v) => setRecipeForm((f) => ({ ...f, yieldQty: v }))} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>YIELD UNIT</Text>
                <View style={styles.chipGroup}>
                  {YIELD_UNITS.map((u) => (
                    <TouchableOpacity key={u} style={[styles.chip, { borderColor: colors.border }, recipeForm.yieldUnit === u && { backgroundColor: "#16a34a", borderColor: "#16a34a" }]} onPress={() => setRecipeForm((f) => ({ ...f, yieldUnit: u }))}>
                      <Text style={[styles.chipText, { color: recipeForm.yieldUnit === u ? "#fff" : colors.foreground }]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>SERVINGS PER BATCH</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="e.g. 20" placeholderTextColor={colors.mutedForeground} value={recipeForm.servings} onChangeText={(v) => setRecipeForm((f) => ({ ...f, servings: v }))} keyboardType="decimal-pad" />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES / INSTRUCTIONS</Text>
            <TextInput style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder="Steps, temperatures, tips…" placeholderTextColor={colors.mutedForeground} value={recipeForm.notes} onChangeText={(v) => setRecipeForm((f) => ({ ...f, notes: v }))} multiline numberOfLines={4} textAlignVertical="top" />

            {/* Ingredients */}
            <View style={styles.ingHeader}>
              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 0 }]}>INGREDIENTS ({ingredients.length})</Text>
              <TouchableOpacity style={[styles.addIngBtn, { backgroundColor: "#16a34a" }]} onPress={() => setIngSection(true)}>
                <Text style={styles.addIngBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {ingredients.map((ing) => (
              <View key={ing.id} style={[styles.ingChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ingChipName, { color: colors.foreground }]}>{ing.name}</Text>
                  <Text style={[styles.ingChipMeta, { color: colors.mutedForeground }]}>{ing.quantity} {ing.unit}</Text>
                </View>
                <TouchableOpacity onPress={() => removeIngredient(ing.id)}>
                  <Text style={[styles.removeBtn, { color: colors.destructive }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {ingSection && (
              <View style={[styles.ingForm, { backgroundColor: colors.card, borderColor: "#16a34a" }]}>
                <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 0 }]}>INGREDIENT NAME</Text>
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} placeholder="Match inventory name exactly for batch calc" placeholderTextColor={colors.mutedForeground} value={ingForm.name} onChangeText={(v) => setIngForm((f) => ({ ...f, name: v }))} autoFocus />
                {/* Inventory name suggestions */}
                {ingForm.name.trim().length > 1 && (() => {
                  const suggestions = inventory.filter((i) => i.name.toLowerCase().includes(ingForm.name.toLowerCase())).slice(0, 4);
                  if (suggestions.length === 0) return null;
                  return (
                    <View style={styles.suggestions}>
                      {suggestions.map((s) => (
                        <TouchableOpacity key={s.id} style={[styles.suggestionRow, { borderColor: colors.border }]} onPress={() => setIngForm((f) => ({ ...f, name: s.name, unit: s.unit || f.unit }))}>
                          <Text style={[styles.suggestionText, { color: "#16a34a" }]}>✓ {s.name}</Text>
                          <Text style={[styles.suggestionMeta, { color: colors.mutedForeground }]}>{parseFloat(s.currentStock) || 0} {s.unit} on hand</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}
                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>QTY PER BATCH</Text>
                    <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} placeholder="0" placeholderTextColor={colors.mutedForeground} value={ingForm.quantity} onChangeText={(v) => setIngForm((f) => ({ ...f, quantity: v }))} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>UNIT</Text>
                    <View style={styles.chipGroup}>
                      {ING_UNITS.map((u) => (
                        <TouchableOpacity key={u} style={[styles.chip, { borderColor: colors.border }, ingForm.unit === u && { backgroundColor: "#16a34a", borderColor: "#16a34a" }]} onPress={() => setIngForm((f) => ({ ...f, unit: u }))}>
                          <Text style={[styles.chipText, { color: ingForm.unit === u ? "#fff" : colors.foreground }]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <View style={styles.ingFormActions}>
                  <TouchableOpacity style={[styles.ingCancelBtn, { borderColor: colors.border }]} onPress={() => { setIngSection(false); setIngForm(BLANK_ING); }}>
                    <Text style={[styles.ingCancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ingSaveBtn, { backgroundColor: "#16a34a" }]} onPress={addIngredient}>
                    <Text style={styles.ingSaveBtnText}>Add Ingredient</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Recipe Detail Modal ───────────────────────────────────────────── */}
      <Modal visible={!!detailRecipe} animationType="slide" presentationStyle="pageSheet">
        {detailRecipe && (
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setDetailRecipe(null)}>
                <Text style={[styles.cancelBtn, { color: "#3b82f6" }]}>Close</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={1}>{detailRecipe.name}</Text>
              <TouchableOpacity onPress={() => { setDetailRecipe(null); openEdit(detailRecipe); }}>
                <Text style={[styles.saveBtn, { color: "#16a34a" }]}>Edit</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.detailMetas}>
                <View style={[styles.detailChip, { backgroundColor: (CAT_COLORS[detailRecipe.category] ?? "#6b7280") + "20" }]}>
                  <Text style={[styles.detailChipText, { color: CAT_COLORS[detailRecipe.category] ?? "#6b7280" }]}>{detailRecipe.category}</Text>
                </View>
                {detailRecipe.yieldQty ? (
                  <View style={[styles.detailChip, { backgroundColor: "#16a34a20" }]}>
                    <Text style={[styles.detailChipText, { color: "#16a34a" }]}>Yield: {detailRecipe.yieldQty} {detailRecipe.yieldUnit}</Text>
                  </View>
                ) : null}
                {detailRecipe.servings ? (
                  <View style={[styles.detailChip, { backgroundColor: colors.border + "80" }]}>
                    <Text style={[styles.detailChipText, { color: colors.mutedForeground }]}>{detailRecipe.servings} servings</Text>
                  </View>
                ) : null}
              </View>

              {detailRecipe.notes ? (
                <>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>NOTES / INSTRUCTIONS</Text>
                  <View style={[styles.notesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.notesText, { color: colors.foreground }]}>{detailRecipe.notes}</Text>
                  </View>
                </>
              ) : null}

              <Text style={[styles.label, { color: colors.mutedForeground }]}>INGREDIENTS ({detailRecipe.ingredients.length})</Text>
              {detailRecipe.ingredients.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No ingredients added yet.</Text>
              ) : (
                detailRecipe.ingredients.map((ing) => {
                  const inv = inventory.find((i) => i.name.toLowerCase() === ing.name.toLowerCase());
                  return (
                    <View key={ing.id} style={[styles.detailIngRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ingName, { color: colors.foreground }]}>{ing.name}</Text>
                        <Text style={[styles.ingMeta, { color: colors.mutedForeground }]}>{ing.quantity} {ing.unit} per batch</Text>
                        {inv ? (
                          <Text style={[styles.ingMeta, { color: "#16a34a" }]}>
                            On hand: {parseFloat(inv.currentStock) || 0} {inv.unit}
                          </Text>
                        ) : (
                          <Text style={[styles.ingMeta, { color: "#f59e0b" }]}>Not tracked in inventory</Text>
                        )}
                      </View>
                      <View style={[styles.ingStatus, { backgroundColor: inv ? "#16a34a20" : "#f59e0b20" }]}>
                        <Text style={{ fontSize: 14 }}>{inv ? "✓" : "?"}</Text>
                      </View>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={[styles.batchBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => { setDetailRecipe(null); setBatchRecipeId(detailRecipe.id); setTab("batch"); }}
              >
                <Text style={styles.batchBtnText}>⚖ Calculate Batch Yield →</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
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
  tabText: { fontSize: 13, fontWeight: "600" },
  searchRow: { padding: 12, paddingBottom: 8 },
  searchInput: { borderWidth: 1, borderRadius: 10, padding: 11, fontSize: 14 },
  filterScroll: { borderBottomWidth: 1, maxHeight: 52 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: "row" },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 5 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  content: { padding: 16, gap: 12 },
  btnRow: { flexDirection: "row", gap: 10 },
  addBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  exportBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" },
  exportBtnText: { fontWeight: "700", fontSize: 14 },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: "center" },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: 2 },
  catBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  catBadgeText: { fontSize: 12, fontWeight: "600" },
  hint: { fontSize: 12, textAlign: "center", marginTop: 4 },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  infoText: { fontSize: 13, lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  recipePickerRow: { gap: 10, flexDirection: "row", paddingVertical: 4 },
  recipeChip: { borderWidth: 1.5, borderRadius: 10, padding: 12, minWidth: 110, alignItems: "center", gap: 4 },
  recipeChipText: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  recipeChipSub: { fontSize: 11, textAlign: "center" },
  multiplierRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  multiplierControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  multBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  multBtnText: { fontSize: 20, fontWeight: "600" },
  multInput: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 16, fontWeight: "700", width: 60, textAlign: "center" },
  resultCard: { borderRadius: 14, borderWidth: 1.5, padding: 20, alignItems: "center", gap: 6 },
  resultNum: { fontSize: 52, fontWeight: "800", lineHeight: 58 },
  resultLabel: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  resultSub: { fontSize: 13, textAlign: "center" },
  yieldRow: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  yieldLabel: { fontSize: 13, fontWeight: "600" },
  yieldValue: { fontSize: 15, fontWeight: "700" },
  ingRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  ingRowTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  ingName: { fontSize: 14, fontWeight: "600" },
  ingMeta: { fontSize: 12, marginTop: 2 },
  limitingBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  limitingBadgeText: { fontSize: 11, fontWeight: "700" },
  ingStatus: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  cancelBtn: { fontSize: 16, minWidth: 56 },
  saveBtn: { fontSize: 16, fontWeight: "600", minWidth: 56, textAlign: "right" },
  modalContent: { padding: 16 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  textarea: { minHeight: 100 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  twoCol: { flexDirection: "row", gap: 12 },
  ingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 },
  addIngBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addIngBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  ingChip: { borderRadius: 8, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  ingChipName: { fontSize: 14, fontWeight: "600" },
  ingChipMeta: { fontSize: 12, marginTop: 1 },
  removeBtn: { fontSize: 18, fontWeight: "700" },
  ingForm: { borderRadius: 12, borderWidth: 1.5, padding: 14, gap: 4, marginBottom: 8 },
  suggestions: { borderRadius: 8, overflow: "hidden", marginBottom: 4 },
  suggestionRow: { padding: 10, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  suggestionText: { fontSize: 14, fontWeight: "600" },
  suggestionMeta: { fontSize: 12 },
  ingFormActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  ingCancelBtn: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 11, alignItems: "center" },
  ingCancelBtnText: { fontSize: 14, fontWeight: "600" },
  ingSaveBtn: { flex: 2, borderRadius: 8, padding: 11, alignItems: "center" },
  ingSaveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  detailMetas: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  detailChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  detailChipText: { fontSize: 13, fontWeight: "600" },
  notesBox: { borderRadius: 10, borderWidth: 1, padding: 14 },
  notesText: { fontSize: 14, lineHeight: 22 },
  detailIngRow: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  batchBtn: { borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  batchBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
