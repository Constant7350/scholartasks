# ScholarTasks phone app (iOS and Android)

Not started yet. Planned next step: create an Expo (React Native) app here that
imports `@scholartasks/core`, the same rules engine the website uses, so phone
and web always give the same answers.

## Face ID / fingerprint

The website already supports Face ID / fingerprint sign-in with passkeys
(`apps/web/app/api/passkeys`, table `passkeys`). The phone app should reuse the
same server routes so a passkey works in both. Plan: sign in once (password,
Google, Apple or passkey), keep the session in the phone's secure storage
(`expo-secure-store`) and ask for Face ID / fingerprint (`expo-local-authentication`)
each time the app opens. Passkeys in the app need the site's
`/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
files once the app IDs exist.
