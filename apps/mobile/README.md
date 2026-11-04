# ScholarTasks phone app (iPhone and Android)

An Expo (React Native) app. It signs in natively, keeps the sign-in token in the
phone's secure storage (iPhone Keychain / Android Keystore), opens with Face ID
or fingerprint, then shows the full ScholarTasks site already signed in. Every
feature on the website is in the app the moment it ships, with no app update.

## How it works

- `src/session.ts`: password sign-in with Supabase; only the refresh token is
  stored (`expo-secure-store`, this device only). Opening the app trades it for
  a fresh session.
- `src/unlock.ts`: Face ID / Touch ID / fingerprint (`expo-local-authentication`).
- `src/App.tsx`: screens (sign in, "Turn on Face ID?", locked, app). The site
  runs in a WebView; before it loads, the app puts the session into the site's
  storage, and the site reports back whenever it refreshes the token so the
  phone always holds the newest one. Signing out on the site signs out the app.
  Links to other websites open in the phone's browser. The app asks for Face ID
  again after 5 minutes in the background.
- The site sees `ScholarTasksApp/` in the user agent and hides its own
  browser Face ID (passkey) prompts, since the app has its own lock.

## Run it

    pnpm install
    pnpm --filter @scholartasks/mobile typecheck
    cd apps/mobile && npx expo start          # needs a Mac/PC; scan the QR with a dev build

## Build for the stores (EAS)

Needs an Expo account plus Apple Developer and Google Play accounts.

    npx eas-cli build --platform ios --profile production
    npx eas-cli build --platform android --profile production
    npx eas-cli submit --platform ios

Bundle id / package: `com.scholartasks.app`. Version in `app.json`.

## Next

- Google sign-in in the app, together with Sign in with Apple (Apple requires both once Google is offered).
- Push notifications for reminders (`expo-notifications`).
- When scholartasks.com is live, change `SITE_URL` in `src/config.ts`.
