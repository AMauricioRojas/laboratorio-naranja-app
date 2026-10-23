import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

export function AlexaConnection({ status, refresh, unlink, working }: {
  status: { linked?: boolean; method?: string; official_linking_available?: boolean; error?: string } | null;
  refresh: () => Promise<void>; unlink: () => void; working: boolean;
}) {
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Conecta Alexa con tu cuenta</Text>
    <Text style={styles.status}>{status?.error ? 'Estado no disponible' : status === null ? 'Consultando conexión…' : status.linked ? 'Alexa vinculada' : 'Alexa pendiente de vinculación'}</Text>
    {status?.error && <Text accessibilityRole="alert" style={styles.notice}>{status.error}</Text>}
    <Text style={styles.body}>Usa la misma cuenta de Nexo IA para compartir tu historial y el cupo de consultas.</Text>
    <Text style={styles.body}>1. Abre la app de Alexa y busca Nexo IA en tus skills.</Text>
    <Text style={styles.body}>2. Pulsa Vincular cuenta. Inicia sesión en Nexo IA y autoriza la conexión.</Text>
    <Text style={styles.body}>3. Vuelve aquí y pulsa Actualizar conexión.</Text>
    {!status?.official_linking_available && <Text style={styles.notice}>La conexión oficial estará disponible cuando el servidor y la skill tengan activada esta versión.</Text>}
    <Text style={styles.body}>Para hablar con la skill di: “Alexa, abre nexo inteligente”.</Text>
    <Text style={styles.small}>Durante la beta, la skill en desarrollo está disponible para las cuentas autorizadas de prueba.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => void Linking.openURL('https://alexa.amazon.com').catch(() => Alert.alert('Abre Alexa', 'No pudimos abrir el enlace. Abre la app de Alexa en tu teléfono.'))}>
      <Text style={styles.buttonText}>Abrir Alexa</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={working} style={[styles.button,styles.secondary]} onPress={() => void refresh()}>
      <Text style={styles.buttonText}>Actualizar conexión</Text>
    </Pressable>
    {status?.linked && <Pressable accessibilityRole="button" disabled={working} style={[styles.button,styles.danger]} onPress={unlink}>
      <Text style={styles.buttonText}>Desvincular Alexa</Text>
    </Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, margin: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', gap: 12 },
  title: { fontSize: 24, color: '#0f172a', fontWeight: '800' },
  status: { color: '#1d4ed8', fontWeight: '700', fontSize: 17 },
  body: { color: '#334155', lineHeight: 23, fontSize: 15 },
  small: { color: '#475569', lineHeight: 20, fontSize: 13 },
  notice: { color: '#92400e', backgroundColor: '#fffbeb', padding: 12, borderRadius: 10, lineHeight: 21 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' }, secondary: { backgroundColor: '#334155' }, danger: { backgroundColor: '#991b1b' },
});
