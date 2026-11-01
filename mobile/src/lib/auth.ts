import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

const HASH_KEY = 'finance_tracker.pin.hash.v1';
const SALT_KEY = 'finance_tracker.pin.salt.v1';
const ENABLED_KEY = 'finance_tracker.pin.enabled.v1';
const BIO_KEY = 'finance_tracker.biometric.enabled.v1';
const LOCKOUT_KEY = 'finance_tracker.lockout.until.v1';
const ATTEMPTS_KEY = 'finance_tracker.failed_attempts.v1';

export async function isLockEnabled(): Promise<boolean> {
  const enabled = (await SecureStore.getItemAsync(ENABLED_KEY)) === 'true';
  if (!enabled) return false;
  const hash = await SecureStore.getItemAsync(HASH_KEY);
  return !!hash;
}

export async function setPin(pin: string): Promise<void> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = btoa(String.fromCharCode(...new Uint8Array(saltBytes)));
  await SecureStore.setItemAsync(SALT_KEY, salt);
  let hash = pin + salt;
  for (let i = 0; i < 10000; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  await SecureStore.setItemAsync(HASH_KEY, hash);
  await SecureStore.setItemAsync(ENABLED_KEY, 'true');
  await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
  await SecureStore.deleteItemAsync(LOCKOUT_KEY);
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const remaining = await getLockoutRemaining();
  if (remaining > 0) return false;
  const enabled = await isLockEnabled();
  if (!enabled) return false;
  const hash = await SecureStore.getItemAsync(HASH_KEY);
  const salt = await SecureStore.getItemAsync(SALT_KEY);
  if (!hash || !salt) return false;
  let computed = pin + salt;
  for (let i = 0; i < 10000; i++) {
    computed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, computed);
  }
  if (constantTimeCompare(computed, hash)) {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
    await SecureStore.deleteItemAsync(LOCKOUT_KEY);
    return true;
  }
  let attempts = parseInt((await SecureStore.getItemAsync(ATTEMPTS_KEY)) || '0', 10);
  attempts += 1;
  await SecureStore.setItemAsync(ATTEMPTS_KEY, String(attempts));
  if (attempts >= 5) {
    const durations = [30000, 60000, 300000, 900000, 900000];
    const idx = Math.min(attempts - 1, durations.length - 1);
    const until = Date.now() + durations[idx];
    await SecureStore.setItemAsync(LOCKOUT_KEY, new Date(until).toISOString());
  }
  return false;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(HASH_KEY);
  await SecureStore.deleteItemAsync(SALT_KEY);
  await SecureStore.deleteItemAsync(ENABLED_KEY);
  await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
  await SecureStore.deleteItemAsync(LOCKOUT_KEY);
  await SecureStore.deleteItemAsync(BIO_KEY);
}

export async function enableBiometric(): Promise<void> {
  await SecureStore.setItemAsync(BIO_KEY, 'true');
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIO_KEY);
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIO_KEY)) === 'true';
}

export async function isBiometricAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Paisora AI',
  });
  return result.success;
}

export async function getLockoutRemaining(): Promise<number> {
  const untilStr = await SecureStore.getItemAsync(LOCKOUT_KEY);
  if (!untilStr) return 0;
  const until = new Date(untilStr).getTime();
  const remaining = until - Date.now();
  return remaining > 0 ? remaining : 0;
}
