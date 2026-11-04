import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

/**
 * Deadline reminders shown by the phone itself (local notifications), so no
 * push server or Apple/Google push keys are needed. The website inside the app
 * sends the coming deadlines; we replace the scheduled reminders each time.
 */
export interface Reminder { id: string; title: string; date: string }

const DAYS_BEFORE = [7, 2, 1, 0];
const HOUR = 9; // 9 in the morning, phone's own time
const MAX = 60; // iPhone keeps at most 64 scheduled reminders per app
const LAST = "st-reminders-last";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const label = (n: number) => (n === 0 ? "is due today" : n === 1 ? "is due tomorrow" : `is due in ${n} days`);

export async function scheduleReminders(items: Reminder[]): Promise<void> {
  const clean = items.filter((i) => typeof i.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.date)).slice(0, 40);
  const key = JSON.stringify(clean);
  // Nothing changed since last time: leave the schedule alone.
  if ((await SecureStore.getItemAsync(LAST).catch(() => null)) === key) return;

  const perm = await Notifications.getPermissionsAsync();
  let granted = perm.granted;
  if (!granted && perm.canAskAgain && clean.length) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const plan: { at: Date; title: string; body: string }[] = [];
  for (const i of clean) {
    const [y, m, d] = i.date.split("-").map(Number) as [number, number, number];
    for (const n of DAYS_BEFORE) {
      const at = new Date(y, m - 1, d - n, HOUR, 0, 0);
      if (at.getTime() > now + 60_000) plan.push({ at, title: i.title, body: `${i.title} ${label(n)}. Open ScholarTasks to see what's left.` });
    }
  }
  plan.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const p of plan.slice(0, MAX)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: "ScholarTasks reminder", body: p.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at },
    });
  }
  await SecureStore.setItemAsync(LAST, key).catch(() => {});
}

/** Signing out stops reminders for that account. */
export async function clearReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  await SecureStore.deleteItemAsync(LAST).catch(() => {});
}
