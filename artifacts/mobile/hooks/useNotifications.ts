import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { useStorage } from "@/hooks/useStorage";

export type ShiftReminder = {
  id: string;
  shift: string;
  hour: number;
  minute: number;
  enabled: boolean;
  notificationIds?: string[]; // one per open kitchen day
};

const DEFAULT_REMINDERS: ShiftReminder[] = [
  { id: "morning", shift: "Morning", hour: 7, minute: 0, enabled: false },
  { id: "afternoon", shift: "Afternoon", hour: 12, minute: 0, enabled: false },
  { id: "evening", shift: "Evening", hour: 17, minute: 0, enabled: false },
  { id: "closing", shift: "Closing", hour: 21, minute: 0, enabled: false },
];

// expo-notifications WEEKLY weekday: 1 = Sunday … 7 = Saturday
const DAY_TO_WEEKDAY: Record<string, number> = {
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thursday: 5,
  Friday: 6,
  Saturday: 7,
};

const ALL_DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

type WeekSchedule = Record<string, { open: boolean; slots: unknown[] }>;

/** Returns the list of day names that are currently marked open in Kitchen Hours. */
export async function getOpenKitchenDays(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem("kitchen_hours");
    if (!raw) return [...ALL_DAYS]; // no hours set → all days open
    const schedule: WeekSchedule = JSON.parse(raw);
    return ALL_DAYS.filter((d) => schedule[d]?.open);
  } catch {
    return [...ALL_DAYS];
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedule one WEEKLY notification per open kitchen day.
 * Returns the list of scheduled notification IDs.
 */
export async function scheduleShiftReminder(
  reminder: ShiftReminder,
  openDays: string[]
): Promise<string[]> {
  if (Platform.OS === "web") return [];
  const ids: string[] = [];
  for (const day of openDays) {
    const weekday = DAY_TO_WEEKDAY[day];
    if (!weekday) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Walkthrough Reminder",
          body: `Time to log the ${reminder.shift} shift walkthrough!`,
          data: { shift: reminder.shift, day },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: reminder.hour,
          minute: reminder.minute,
        },
      });
      ids.push(id);
    } catch {
      // skip days that fail (e.g. invalid weekday on simulator)
    }
  }
  return ids;
}

export async function cancelShiftReminder(notificationIds: string[]): Promise<void> {
  if (Platform.OS === "web") return;
  for (const id of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export function useReminders() {
  const [reminders, setReminders, loaded] = useStorage<ShiftReminder[]>(
    "shift_reminders",
    DEFAULT_REMINDERS
  );
  return { reminders, setReminders, loaded };
}
