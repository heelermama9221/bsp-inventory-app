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

  const [tab, setTab] = useState<"recipes" | "batch" | "plan">("recipes");
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
  const [ingPickerVisible, setIngPickerVisible] = useState(false);
  const [ingPickerSearch, setIngPickerSearch] = useState("");

  // Detail view
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  // Batch calc
  const [batchRecipeId, setBatchRecipeId] = useState<string | null>(null);
  const [batchMultiplier, setBatchMultiplier] = useState("1");

  // Daily Prep Plan
  const [planBatches, setPlanBatches] = useStorage<Record<string, string>>("daily_prep_batches", {});
  const [planChecked, setPlanChecked] = useStorage<Record<string, boolean>>("daily_prep_checked", {});

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

  // ── Daily Prep Plan logic ─────────────────────────────────────────────

  function planFeasible(recipe: Recipe, batches: number): "ok" | "short" | "unknown" {
    if (recipe.ingredients.length === 0) return "unknown";
    let anyLinked = false;
    for (const ing of recipe.ingredients) {
      const inv = inventory.find((i) => i.name.toLowerCase() === ing.name.toLowerCase());
      if (!inv) continue;
      anyLinked = true;
      const needed = (parseFloat(ing.quantity) || 0) * batches;
      const onHand = parseFloat(inv.currentStock) || 0;
      if (needed > onHand) return "short";
    }
    return anyLinked ? "ok" : "unknown";
  }

  const plannedRecipes = recipes.filter((r) => (parseFloat(planBatches[r.id]) || 0) > 0);

  // Aggregate ingredient pull list across all planned recipes
  type PullItem = { name: string; totalNeeded: number; unit: string; onHand: number | null };
  const pullMap: Record<string, PullItem> = {};
  for (const recipe of plannedRecipes) {
    const batches = parseFloat(planBatches[recipe.id]) || 0;
    for (const ing of recipe.ingredients) {
      const key = ing.name.toLowerCase();
      const needed = (parseFloat(ing.quantity) || 0) * batches;
      if (!pullMap[key]) {
        const inv = inventory.find((i) => i.name.toLowerCase() === key);
        pullMap[key] = {
          name: ing.name, totalNeeded: 0, unit: ing.unit,
          onHand: inv ? (parseFloat(inv.currentStock) || 0) : null,
        };
      }
      pullMap[key].totalNeeded += needed;
    }
  }
  const pullItems = Object.values(pullMap).sort((a, b) => a.name.localeCompare(b.name));

  const checkedCount = plannedRecipes.filter((r) => planChecked[r.id]).length;

  function clearPlan() {
    Alert.alert("Clear Plan", "Reset today's prep plan?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => { setPlanBatches({}); setPlanChecked({}); } },
    ]);
  }

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
        {(["recipes", "batch", "plan"] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && { borderBottomColor: "#16a34a", borderBottomWidth: 2.5 }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, { color: tab === t ? "#16a34a" : colors.mutedForeground }]}>
              {t === "recipes" ? "📖 Recipes" : t === "batch" ? "⚖ Batch" : "📋 Daily Plan"}
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

      {/* ── DAILY PREP PLAN TAB ──────────────────────────────────────────── */}
      {tab === "plan" && (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Header bar */}
          <View style={styles.planHeader}>
            <View>
              <Text style={[styles.planTitle, { color: colors.foreground }]}>Today's Prep Plan</Text>
              {plannedRecipes.length > 0 && (
                <Text style={[styles.planSub, { color: colors.mutedForeground }]}>
                  {plannedRecipes.length} recipe{plannedRecipes.length !== 1 ? "s" : ""} · {checkedCount}/{plannedRecipes.length} complete
                </Text>
              )}
            </View>
            {plannedRecipes.length > 0 && (
              <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.border }]} onPress={clearPlan}>
                <Text style={[styles.clearBtnText, { color: colors.mutedForeground }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress bar */}
          {plannedRecipes.length > 0 && (
            <View style={[styles.planProgress, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.planProgressRow}>
                <Text style={[styles.planProgressLabel, { color: colors.mutedForeground }]}>
                  {checkedCount === plannedRecipes.length ? "All prep complete!" : `${checkedCount} of ${plannedRecipes.length} done`}
                </Text>
                <Text style={[styles.planProgressPct, { color: "#16a34a" }]}>
                  {Math.round((checkedCount / plannedRecipes.length) * 100)}%
                </Text>
              </View>
              <View style={[styles.planProgressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.planProgressFill, { backgroundColor: "#16a34a", width: `${(checkedCount / plannedRecipes.length) * 100}%` as any }]} />
              </View>
            </View>
          )}

          {/* ── Set batch counts ── */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SET REQUIRED BATCHES</Text>

          {recipes.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
                No recipes yet. Add recipes in the Recipes tab first.
              </Text>
            </View>
          ) : (
            recipes.map((recipe) => {
              const batches = parseFloat(planBatches[recipe.id]) || 0;
              const feasibility = batches > 0 ? planFeasible(recipe, batches) : null;
              const catColor = CAT_COLORS[recipe.category] ?? "#6b7280";
              const feasIcon = feasibility === "ok" ? "✓" : feasibility === "short" ? "✕" : "?";
              const feasColor = feasibility === "ok" ? "#16a34a" : feasibility === "short" ? "#ef4444" : "#f59e0b";
              return (
                <View
                  key={recipe.id}
                  style={[
                    styles.planRow,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    batches > 0 && { borderLeftColor: feasColor, borderLeftWidth: 3 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planRecipeName, { color: colors.foreground }]}>{recipe.name}</Text>
                    <View style={styles.planRecipeMeta}>
                      <View style={[styles.planCatDot, { backgroundColor: catColor + "25" }]}>
                        <Text style={[styles.planCatDotText, { color: catColor }]}>{recipe.category}</Text>
                      </View>
                      {recipe.yieldQty && batches > 0 && (
                        <Text style={[styles.planYieldText, { color: colors.mutedForeground }]}>
                          → {(parseFloat(recipe.yieldQty) * batches).toFixed(1)} {recipe.yieldUnit} total
                        </Text>
                      )}
                    </View>
                    {feasibility === "short" && batches > 0 && (
                      <Text style={[styles.planWarnText, { color: "#ef4444" }]}>
                        ⚠ Inventory may be short for {batches} batch{batches !== 1 ? "es" : ""}
                      </Text>
                    )}
                  </View>
                  <View style={styles.planStepper}>
                    {batches > 0 && (
                      <View style={[styles.planFeasIcon, { backgroundColor: feasColor + "20" }]}>
                        <Text style={[styles.planFeasIconText, { color: feasColor }]}>{feasIcon}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.planStepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => setPlanBatches((prev) => ({ ...prev, [recipe.id]: String(Math.max(0, batches - 1)) }))}
                    >
                      <Text style={[styles.planStepBtnText, { color: colors.foreground }]}>−</Text>
                    </TouchableOpacity>
                    <View style={[styles.planBatchBox, { borderColor: batches > 0 ? "#16a34a" : colors.border, backgroundColor: batches > 0 ? "#16a34a10" : colors.background }]}>
                      <Text style={[styles.planBatchNum, { color: batches > 0 ? "#16a34a" : colors.mutedForeground }]}>{batches}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.planStepBtn, { backgroundColor: "#16a34a", borderColor: "#16a34a" }]}
                      onPress={() => setPlanBatches((prev) => ({ ...prev, [recipe.id]: String(batches + 1) }))}
                    >
                      <Text style={[styles.planStepBtnText, { color: "#fff" }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* ── Ingredient pull list ── */}
          {pullItems.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>INGREDIENT PULL LIST</Text>
              <View style={[styles.pullCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {pullItems.map((item, idx) => {
                  const isShort = item.onHand !== null && item.onHand < item.totalNeeded;
                  return (
                    <View
                      key={item.name}
                      style={[
                        styles.pullRow,
                        { borderTopColor: colors.border },
                        idx === 0 && { borderTopWidth: 0 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pullName, { color: colors.foreground }]}>{item.name}</Text>
                        {item.onHand !== null && (
                          <Text style={[styles.pullMeta, { color: isShort ? "#ef4444" : colors.mutedForeground }]}>
                            {isShort ? "⚠ " : ""}On hand: {item.onHand} {item.unit}
                            {isShort ? ` — short ${(item.totalNeeded - item.onHand).toFixed(1)} ${item.unit}` : ""}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.pullQty, { backgroundColor: isShort ? "#ef444415" : "#16a34a15", borderColor: isShort ? "#ef4444" : "#16a34a" }]}>
                        <Text style={[styles.pullQtyNum, { color: isShort ? "#ef4444" : "#16a34a" }]}>
                          {item.totalNeeded % 1 === 0 ? item.totalNeeded : item.totalNeeded.toFixed(1)}
                        </Text>
                        <Text style={[styles.pullQtyUnit, { color: isShort ? "#ef4444" : "#16a34a" }]}>{item.unit}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Completion checklist ── */}
          {plannedRecipes.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>COMPLETION CHECKLIST</Text>
              {plannedRecipes.map((recipe) => {
                const done = !!planChecked[recipe.id];
                const batches = parseFloat(planBatches[recipe.id]) || 0;
                const catColor = CAT_COLORS[recipe.category] ?? "#6b7280";
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[
                      styles.checkRow,
                      { backgroundColor: colors.card, borderColor: done ? "#16a34a40" : colors.border },
                      done && { backgroundColor: "#16a34a08" },
                    ]}
                    onPress={() => setPlanChecked((prev) => ({ ...prev, [recipe.id]: !prev[recipe.id] }))}
                  >
                    <View style={[styles.checkbox, { borderColor: done ? "#16a34a" : colors.border, backgroundColor: done ? "#16a34a" : "transparent" }]}>
                      {done && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.checkName, { color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? "line-through" : "none" }]}>
                        {recipe.name}
                      </Text>
                      <Text style={[styles.checkMeta, { color: colors.mutedForeground }]}>
                        {batches} batch{batches !== 1 ? "es" : ""}
                        {recipe.yieldQty ? ` · ${(parseFloat(recipe.yieldQty) * batches).toFixed(1)} ${recipe.yieldUnit}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.planCatDot, { backgroundColor: catColor + "25" }]}>
                      <Text style={[styles.planCatDotText, { color: catColor }]}>{recipe.category}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {plannedRecipes.length === 0 && recipes.length > 0 && (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
                Use the + buttons above to set how many batches of each recipe you need today. The pull list and checklist will appear here.
              </Text>
            </View>
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
                <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 0 }]}>INGREDIENT</Text>
                <TouchableOpacity
                  style={[styles.pickerBtn, { borderColor: ingForm.name ? "#16a34a" : colors.border, backgroundColor: colors.background }]}
                  onPress={() => { setIngPickerSearch(""); setIngPickerVisible(true); }}
                >
                  <View style={{ flex: 1 }}>
                    {ingForm.name ? (
                      <>
                        <Text style={[styles.pickerBtnName, { color: colors.foreground }]}>{ingForm.name}</Text>
                        {(() => {
                          const inv = inventory.find((i) => i.name.toLowerCase() === ingForm.name.toLowerCase());
                          return inv ? (
                            <Text style={[styles.pickerBtnSub, { color: "#16a34a" }]}>
                              {parseFloat(inv.currentStock) || 0} {inv.unit} on hand
                            </Text>
                          ) : null;
                        })()}
                      </>
                    ) : (
                      <Text style={[styles.pickerBtnPlaceholder, { color: colors.mutedForeground }]}>
                        {inventory.length > 0 ? "Select from inventory…" : "Type ingredient name…"}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.pickerBtnChevron, { color: "#16a34a" }]}>▼</Text>
                </TouchableOpacity>
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

      {/* ── Ingredient Picker Modal ──────────────────────────────────────── */}
      <Modal visible={ingPickerVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setIngPickerVisible(false)}>
              <Text style={[styles.cancelBtn, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Ingredient</Text>
            <View style={{ minWidth: 56 }} />
          </View>

          <View style={styles.pickerSearchRow}>
            <TextInput
              style={[styles.pickerSearchInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="Search inventory…"
              placeholderTextColor={colors.mutedForeground}
              value={ingPickerSearch}
              onChangeText={setIngPickerSearch}
              autoFocus
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {inventory.length === 0 && (
              <View style={styles.pickerEmpty}>
                <Text style={[styles.pickerEmptyText, { color: colors.mutedForeground }]}>
                  No inventory items yet. Add items in the Inventory module first, or type the name manually below.
                </Text>
              </View>
            )}

            {inventory
              .filter((inv) =>
                !ingPickerSearch.trim() ||
                inv.name.toLowerCase().includes(ingPickerSearch.toLowerCase())
              )
              .map((inv) => {
                const isSelected = ingForm.name.toLowerCase() === inv.name.toLowerCase();
                const stock = parseFloat(inv.currentStock) || 0;
                return (
                  <TouchableOpacity
                    key={inv.id}
                    style={[styles.pickerRow, { borderBottomColor: colors.border }, isSelected && { backgroundColor: "#16a34a12" }]}
                    onPress={() => {
                      setIngForm((f) => ({ ...f, name: inv.name, unit: inv.unit || f.unit }));
                      setIngPickerVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerRowName, { color: colors.foreground }]}>{inv.name}</Text>
                      <Text style={[styles.pickerRowMeta, { color: colors.mutedForeground }]}>
                        {inv.category} · {stock} {inv.unit} on hand
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={[styles.pickerCheck, { backgroundColor: "#16a34a" }]}>
                        <Text style={styles.pickerCheckText}>✓</Text>
                      </View>
                    ) : (
                      <Text style={[styles.pickerChevron, { color: colors.mutedForeground }]}>›</Text>
                    )}
                  </TouchableOpacity>
                );
              })}

            {/* Manual entry option at bottom */}
            <View style={[styles.pickerManualSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.pickerManualLabel, { color: colors.mutedForeground }]}>NOT IN INVENTORY? TYPE MANUALLY</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="Ingredient name…"
                placeholderTextColor={colors.mutedForeground}
                value={ingPickerSearch && !inventory.find((i) => i.name.toLowerCase() === ingPickerSearch.toLowerCase()) ? ingPickerSearch : ingForm.name}
                onChangeText={(v) => setIngForm((f) => ({ ...f, name: v }))}
              />
              <TouchableOpacity
                style={[styles.pickerManualBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => setIngPickerVisible(false)}
              >
                <Text style={styles.pickerManualBtnText}>Use This Name</Text>
              </TouchableOpacity>
            </View>
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
  pickerBtn: { borderWidth: 1.5, borderRadius: 10, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  pickerBtnName: { fontSize: 15, fontWeight: "600" },
  pickerBtnSub: { fontSize: 12, marginTop: 2 },
  pickerBtnPlaceholder: { fontSize: 15 },
  pickerBtnChevron: { fontSize: 14, fontWeight: "700" },
  pickerSearchRow: { padding: 12, paddingBottom: 8 },
  pickerSearchInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  pickerEmpty: { padding: 24, alignItems: "center" },
  pickerEmptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  pickerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  pickerRowName: { fontSize: 15, fontWeight: "600" },
  pickerRowMeta: { fontSize: 13, marginTop: 2 },
  pickerCheck: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  pickerCheckText: { color: "#fff", fontWeight: "700" },
  pickerChevron: { fontSize: 22, fontWeight: "300" },
  pickerManualSection: { padding: 16, borderTopWidth: 1, gap: 10, marginTop: 8 },
  pickerManualLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  pickerManualBtn: { borderRadius: 10, padding: 13, alignItems: "center" },
  pickerManualBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
  // Daily Prep Plan
  planHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  planTitle: { fontSize: 18, fontWeight: "700" },
  planSub: { fontSize: 13, marginTop: 2 },
  clearBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  clearBtnText: { fontSize: 13, fontWeight: "600" },
  planProgress: { borderRadius: 10, borderWidth: 1, padding: 12 },
  planProgressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  planProgressLabel: { fontSize: 13 },
  planProgressPct: { fontSize: 13, fontWeight: "700" },
  planProgressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  planProgressFill: { height: 6, borderRadius: 3 },
  planRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  planRecipeName: { fontSize: 15, fontWeight: "600" },
  planRecipeMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
  planCatDot: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  planCatDotText: { fontSize: 11, fontWeight: "700" },
  planYieldText: { fontSize: 12 },
  planWarnText: { fontSize: 12, marginTop: 4 },
  planStepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  planFeasIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  planFeasIconText: { fontSize: 14, fontWeight: "700" },
  planStepBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  planStepBtnText: { fontSize: 20, fontWeight: "700", lineHeight: 24 },
  planBatchBox: { width: 40, height: 34, borderRadius: 8, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  planBatchNum: { fontSize: 16, fontWeight: "800" },
  pullCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  pullRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, gap: 12 },
  pullName: { fontSize: 14, fontWeight: "600" },
  pullMeta: { fontSize: 12, marginTop: 2 },
  pullQty: { borderWidth: 1.5, borderRadius: 8, minWidth: 56, padding: 7, alignItems: "center" },
  pullQtyNum: { fontSize: 17, fontWeight: "800" },
  pullQtyUnit: { fontSize: 10, fontWeight: "600" },
  checkRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  checkboxTick: { color: "#fff", fontSize: 14, fontWeight: "800" },
  checkName: { fontSize: 15, fontWeight: "600" },
  checkMeta: { fontSize: 12, marginTop: 2 },
});
