import { useCallback, useEffect, useRef, useState } from 'react';

export type PlanUsage = {
  plan: { id: 'basic' | 'pro'; name: string };
  beta: boolean;
  period: { start: string; end: string; timezone: string };
  quota: { unit: 'requests'; limit: number; used: number; reserved: number; available: number };
  allowed_models: { id: string; model: string }[];
  usage: { total_tokens: string; unreported_requests: number; by_model: { provider: string; model: string; requests: number; total_tokens: string }[] };
};

export function usePlanUsage(api: string, token: string | null) {
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [usageLoading, setLoading] = useState(false);
  const [usageError, setError] = useState('');
  const sequence = useRef(0);
  const activeToken = useRef(token);
  activeToken.current = token;

  const refreshUsage = useCallback(async () => {
    if (!token || activeToken.current !== token) return;
    const request = ++sequence.current;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${api}/me/usage`, { headers: { Authorization: token }, signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.quota || !Array.isArray(data.allowed_models)) {
        throw new Error(response.status === 404 ? 'El servidor aún no tiene disponible la consulta de planes.' : data.error || 'No pudimos consultar tu consumo.');
      }
      if (sequence.current === request && activeToken.current === token) setUsage(data);
    } catch (error) {
      if (sequence.current === request && activeToken.current === token) setError(error instanceof Error && error.name !== 'TypeError'
        ? error.message : 'No pudimos conectar. Intenta actualizar tu consumo.');
    } finally {
      clearTimeout(timeout);
      if (sequence.current === request && activeToken.current === token) setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    setUsage(null);
    setError('');
    setLoading(false);
    void refreshUsage();
    const requests = sequence;
    return () => { requests.current++; };
  }, [refreshUsage]);

  return { usage, usageLoading, usageError, refreshUsage };
}
