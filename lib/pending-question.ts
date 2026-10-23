import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

async function key(token: string) {
  const session = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
  return `nexo.pending.${session}`;
}
// Persist only hashes and an opaque identifier; never persist the question text here.
export async function questionRequestId(token: string, payload: { message: string; model: string; conversation: string | null }) {
  const storageKey = await key(token);
  const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(payload));
  const saved = await AsyncStorage.getItem(storageKey);
  if (saved) {
    try {
      const pending = JSON.parse(saved);
      if (pending.fingerprint === fingerprint && typeof pending.id === 'string' && /^[0-9a-f-]{36}$/.test(pending.id)) return pending.id as string;
    } catch { /* A malformed local record is replaced before sending. */ }
  }
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(storageKey, JSON.stringify({ fingerprint, id }));
  return id;
}
export async function clearPendingQuestion(token: string) { await AsyncStorage.removeItem(await key(token)); }
