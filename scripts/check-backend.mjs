const base = process.env.EXPO_PUBLIC_API_URL || 'https://multi-ia-alexa-backend.onrender.com';
const url = new URL(base);
if (url.protocol !== 'https:' || ['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('La beta instalable necesita un backend HTTPS accesible desde el teléfono.');
try {
  const response = await fetch(new URL('/health',url), { signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  if (response.status === 503 && body.includes('Service Suspended')) throw new Error('Render tiene suspendido el backend. Reactiva el servicio en Render antes de generar la beta.');
  let data;
  try { data=JSON.parse(body); } catch { throw new Error('El servidor no devolvió una respuesta válida. Revisa su estado en Render.'); }
  if (!response.ok || !data.ok || !data.capabilities?.plans || !data.capabilities?.alexa_oauth || !data.capabilities?.content_reports) {
    throw new Error('El backend todavía no tiene activa la versión de planes, OAuth y reportes. Despliega y configura el servidor antes de generar el APK.');
  }
  console.log('Backend de beta verificado: planes, vinculación OAuth y reportes disponibles.');
} catch (error) { console.error(error.message); process.exitCode=1; }
