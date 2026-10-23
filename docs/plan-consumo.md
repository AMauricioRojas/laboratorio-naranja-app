# Mi plan y consumo — 22 de octubre de 2026

Rama de trabajo: `feature/planes-consumo`.

La nueva vista **Mi plan** consulta `GET /me/usage` con la sesión existente. Muestra cupo disponible, consultas utilizadas y reservadas, restablecimiento en UTC, modelos incluidos y tokens informados por el proveedor. No contiene botones de compra ni precios.

`use-plan-usage.ts` gestiona carga, errores, timeout e invalida respuestas de sesiones anteriores. `PlanUsagePanel` presenta la información. El chat mantiene el identificador de cada intento ante errores inciertos y muestra los modelos fuera del plan como Pro. El backend decide finalmente qué modelos permite.

Para desarrollo se puede definir `EXPO_PUBLIC_API_URL`; si falta, se mantiene la dirección pública existente. No cambiarla a localhost en una compilación de distribución. En un teléfono real, localhost representa el teléfono y debe sustituirse por la dirección accesible de un backend de desarrollo.

Ejecutar Expo desde la carpeta real, no desde el junction de Documents:

`C:\Users\polom\Proyectos\Escuela\Nexo_IA\App_movil\laboratorio-naranja-app`

La exportación desde el junction duplicó React y falló al renderizar; desde la ruta real funciona.

Comprobaciones realizadas: TypeScript sin errores, lint de los dos módulos nuevos limpio, exportación web de Expo SDK 54 y revisión en navegador a 390 × 844 con datos sintéticos. Se probaron consumo normal, cupo agotado y error de servidor. La pantalla aún debe probarse en Android físico.

El backend requiere la migración explícita `001-plans-consumption.sql`. No se modificó producción ni se activaron pagos. Suscripciones verificadas y Account Linking oficial de Alexa corresponden a los siguientes incrementos. Ver `Backend/docs/planes-consumo.md` para el contrato y los comandos de prueba.
