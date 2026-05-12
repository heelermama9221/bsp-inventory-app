import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useStorage } from "@/hooks/useStorage";
import { useEffect } from "react";

export type ShiftReminder = {
  id: string;
  shift: string;
  hour: number;
  minute: number;
  enabled: boolean;
  notificationId?: string;
};

const DEFAULT_REMINDERS: ShiftReminder[] = [
  { id: "morning", shift: "Morning", hour: 7, minute: 0, enabled: false },
  { id: "afternoon", shift: "Afternoon", hour: 12, minute: 0, enabled: false },
  { id: "evening", shift: "Evening", hour: 17, minute: 0, enabled: false },
  { id: "closing", shift: "Closing", hour: 21, minute: 0, enabled: false },
];

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

export async function scheduleShiftReminder(reminder: ShiftReminder): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Walkthrough Reminder",
        body: `Time to log the ${reminder.shift} shift walkthrough!`,
        data: { shift: reminder.shift },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelShiftReminder(notificationId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
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
