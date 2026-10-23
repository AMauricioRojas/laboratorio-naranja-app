# Mi plan y consumo — 23 de octubre de 2026

Rama de trabajo: `feature/planes-consumo`.

La nueva vista **Mi plan** consulta `GET /me/usage` con la sesión existente. Muestra cupo disponible, consultas utilizadas y reservadas, restablecimiento en UTC, modelos incluidos y tokens informados por el proveedor. No contiene botones de compra ni precios.

`use-plan-usage.ts` gestiona carga, errores, timeout e invalida respuestas de sesiones anteriores. `PlanUsagePanel` presenta la información. La sesión nativa usa SecureStore. El chat conserva el identificador de cada intento entre cierres y ante errores inciertos y muestra los modelos fuera del plan como Pro. El backend decide finalmente qué modelos permite.

Para desarrollo se puede definir `EXPO_PUBLIC_API_URL`; si falta, se mantiene la dirección pública existente. No cambiarla a localhost en una compilación de distribución. En un teléfono real, localhost representa el teléfono y debe sustituirse por la dirección accesible de un backend de desarrollo.

Ejecutar Expo desde la carpeta real, no desde el junction de Documents:

`C:\Users\polom\Proyectos\Escuela\Nexo_IA\App_movil\laboratorio-naranja-app`

La exportación desde el junction duplicó React y falló al renderizar; desde la ruta real funciona.

Comprobaciones realizadas: TypeScript sin errores, lint de los dos módulos nuevos limpio, exportación web de Expo SDK 54 y revisión en navegador a 390 × 844 con datos sintéticos. Se probaron consumo normal, cupo agotado y error de servidor. La pantalla aún debe probarse en Android físico.

El backend de beta ya está desplegado con las migraciones `001-plans-consumption.sql` y `002-alexa-oauth.sql`. Account Linking oficial usa OAuth con PKCE y cada usuario autoriza la conexión desde Alexa. El panel de la app permite abrir Alexa, actualizar estado y revocar la conexión. Las respuestas admiten reportes. No se activaron pagos; las suscripciones verificadas siguen pendientes.

La versión Android 1.0.1 (versionCode 2) terminó de compilar y se verificó su archivo APK. Tras elegir el usuario el nombre **Zuneri**, se solicita la versión 1.0.2 (versionCode 3) con los nuevos textos, logotipo e icono. Conserva el paquete Android, la firma y las claves de sesión para actualizar la instalación existente. El perfil preview fija la URL HTTPS de Render. El backend pasa 53 pruebas aisladas y su comprobación pública confirma planes, OAuth y reportes. El usuario completó Account Linking desde su teléfono y el simulador de Amazon reconoció su cuenta vinculada. La prueba de uso en Android físico y Echo sigue pendiente.

El alojamiento Free puede arrancar lentamente tras inactividad. El envío real de correos sigue pendiente de proveedor, por lo que la beta está orientada a las cuentas recuperadas y verificadas. Ver `Backend/docs/planes-consumo.md` para el contrato y los comandos de prueba.
