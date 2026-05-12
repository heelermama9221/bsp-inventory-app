import { Share, Platform } from "react-native";

/**
 * Converts an array of objects to a CSV string and triggers the native share sheet.
 * Works on iOS, Android, and web (falls back to alert on web).
 */
export function exportToCsv(title: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    const s = val === null || val === undefined ? "" : String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvLines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  const csv = csvLines.join("\n");

  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  Share.share({
    title: `${title} Export`,
    message: csv,
  });
}
