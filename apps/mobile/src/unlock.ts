import * as LocalAuthentication from "expo-local-authentication";

/** "Face ID", "Touch ID" or "fingerprint", or null if this phone has none set up. */
export async function unlockKind(): Promise<string | null> {
  if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null;
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "fingerprint";
  return "your phone's lock";
}

export async function unlock(kind: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: `Open ScholarTasks with ${kind}`,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });
  return r.success;
}
