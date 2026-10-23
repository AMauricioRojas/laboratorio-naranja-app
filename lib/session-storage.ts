import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const key = 'nexo.session';
export async function getSessionToken() {
  if (Platform.OS === 'web') return AsyncStorage.getItem('token');
  const encrypted = await SecureStore.getItemAsync(key);
  if (encrypted) return encrypted;
  const previous = await AsyncStorage.getItem('token');
  if (previous) {
    await SecureStore.setItemAsync(key, previous);
    await AsyncStorage.removeItem('token');
  }
  return previous;
}
export async function saveSessionToken(token: string) {
  if (Platform.OS === 'web') await AsyncStorage.setItem('token', token);
  else {
    await SecureStore.setItemAsync(key, token);
    await AsyncStorage.removeItem('token');
  }
}
export async function clearSessionToken() {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
  await AsyncStorage.removeItem('token');
  // A shared administrative secret never belongs in the public mobile client.
  await AsyncStorage.removeItem('nexo_admin_key');
}
