import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlanUsage } from '../hooks/use-plan-usage';

const labels: Record<string, string> = { groq_fast: 'Groq rápido', groq_power: 'Groq potente', chatgpt: 'ChatGPT', gemini: 'Gemini' };

export function PlanUsagePanel({ usage, loading, error, refresh }: {
  usage: PlanUsage | null; loading: boolean; error: string; refresh: () => Promise<void>;
}) {
  const quota = usage?.quota;
  const percent = quota ? Math.min(100, quota.limit > 0 ? ((quota.used + quota.reserved) / quota.limit) * 100 : 100) : 0;
  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>Mi plan y consumo</Text>
      <Text style={styles.subtitle}>Un mismo cupo para web, móvil y Alexa.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Actualizar consumo" disabled={loading}
        style={styles.refresh} onPress={() => void refresh()}>
        <Text style={styles.refreshText}>{loading ? 'Actualizando…' : 'Actualizar consumo'}</Text>
      </Pressable>
      {loading && !usage && <ActivityIndicator color="#2563eb" accessibilityLabel="Consultando consumo" />}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {usage && quota && <>
        <View style={styles.card}>
          <Text style={styles.tag}>BETA · CUPOS DE PRUEBA</Text>
          <Text accessibilityRole="header" style={styles.plan}>{usage.plan.name}</Text>
          <Text style={styles.available}>{quota.available.toLocaleString('es-MX')} disponibles</Text>
          <Text style={styles.body}>de {quota.limit.toLocaleString('es-MX')} consultas del periodo</Text>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent,
            text: `${quota.used} usadas, ${quota.reserved} reservadas` }} style={styles.track}>
            <View style={[styles.bar, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.body}>{quota.used} usadas · {quota.reserved} reservadas</Text>
          <Text style={styles.muted}>El cupo se restablece el {new Date(usage.period.end).toLocaleString('es-MX', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC.</Text>
          {quota.available === 0 && <Text accessibilityRole="alert" style={styles.error}>No hay cupo disponible en este periodo.</Text>}
          {quota.reserved > 0 && <Text style={styles.muted}>Las consultas pendientes mantienen su reserva hasta confirmar el resultado. Así evitamos enviarlas dos veces.</Text>}
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>Modelos incluidos</Text>
          {usage.allowed_models.map(model => <Text key={model.id} style={styles.body}>{labels[model.id] || model.id}</Text>)}
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>Consumo informado por la IA</Text>
          <Text style={styles.available}>{Number(usage.usage.total_tokens).toLocaleString('es-MX')} tokens</Text>
          <Text style={styles.muted}>Los tokens miden el texto procesado. Cada consulta puede usar una cantidad distinta y el costo depende del modelo.</Text>
          {usage.usage.by_model.map(row => <Text key={row.provider} style={styles.body}>{labels[row.provider] || row.provider}: {row.requests} consultas · {Number(row.total_tokens).toLocaleString('es-MX')} tokens</Text>)}
          {usage.usage.unreported_requests > 0 && <Text style={styles.muted}>{usage.usage.unreported_requests} consultas sin detalle de tokens del proveedor. El total mostrado es parcial.</Text>}
        </View>
        <Text style={styles.muted}>Los cupos de esta beta son de prueba. Las suscripciones y los pagos todavía no están habilitados.</Text>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 18, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 15, color: '#475569' },
  refresh: { backgroundColor: '#2563eb', padding: 13, borderRadius: 12, alignItems: 'center' },
  refreshText: { color: 'white', fontWeight: '700' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 18, borderColor: '#cbd5e1', borderWidth: 1, gap: 10 },
  tag: { color: '#1d4ed8', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  plan: { color: '#0f172a', fontSize: 30, fontWeight: '800' },
  available: { color: '#0f172a', fontSize: 24, fontWeight: '700' },
  heading: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  body: { color: '#334155', fontSize: 15, lineHeight: 22 },
  muted: { color: '#475569', fontSize: 13, lineHeight: 20 },
  error: { color: '#991b1b', fontSize: 14, lineHeight: 21 },
  track: { height: 10, borderRadius: 5, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  bar: { height: 10, backgroundColor: '#2563eb' },
});
