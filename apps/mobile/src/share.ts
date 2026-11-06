import { Alert, Linking, Platform, Share } from "react-native";
import * as StoreReview from "expo-store-review";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.scholartasks.app";

/** "Invite a friend" on the website: open the phone's own share sheet (Messages, WhatsApp, Mail...). */
export async function shareText(m: { title?: unknown; text?: unknown }) {
  const message = typeof m.text === "string" ? m.text.slice(0, 2000) : "";
  if (!message) return;
  await Share.share({ message, title: typeof m.title === "string" ? m.title.slice(0, 200) : undefined }).catch(() => {});
}

/** "Rate in the App Store / Google Play" on the website: show the store's own rating box. */
export async function rateApp() {
  if (await StoreReview.hasAction().catch(() => false)) {
    await StoreReview.requestReview().catch(() => {});
    return;
  }
  if (Platform.OS === "android") {
    Linking.openURL(PLAY_URL).catch(() => {});
    return;
  }
  Alert.alert("Thank you!", "Rating in the App Store opens once ScholarTasks is listed there. Your rating on this page already reaches our team.");
}
