# Clinica Backend (Express + Sequelize)

Backend público para gestión de agenda y soporte a Chatbot (n8n + WhatsApp). Implementa endpoints estilo WordPress Rest API bajo `/wp-json/appointments/v1`.

## Stack
- Node.js 18+
- Express 4
- Sequelize 6 (MySQL)
- MySQL 8+

## Seguridad y acceso
- Público (sin autenticación).
- CORS abierto (allow-all).
- Escucha en `0.0.0.0`.

## Instalación
1) Docker (recomendado)
- Crea el volumen y levanta servicios:
```
docker compose up -d --build
```
- (Opcional) Inicializa la base importando tu dump: coloca el `.sql` en `docker/mysql-init/` antes del primer `up`.
- Backend: http://localhost:3000
- MySQL: localhost:3306 (root/12345678, DB noelia)

2) Instalación manual
1) Instala dependencias
```
npm install
```

2) Variables en `.env`
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=noelia
DB_USER=root
DB_PASSWORD=12345678
```

3) Ejecuta en desarrollo (con nodemon)
```
npm run dev
```

## Tablas empleadas
- Imprescindibles: `appointments`, `blocks`, `businesshours`, `7xoht3agf_posts`, `7xoht3agf_postmeta`, `7xoht3agf_users`, `7xoht3agf_usermeta`
- Opcionales: `payments`, `logs`, `notifications`

Notas:
- Locations es CPT `clinic` en `7xoht3agf_posts`.
- Doctors/Patients son usuarios WP (roles en `7xoht3agf_usermeta`), teléfono en meta `mobile`.
- Slots se calculan desde `businesshours` excluyendo `blocks` y `appointments` activos.

## Endpoints

### Locations
- GET `/wp-json/appointments/v1/locations`
  - Lista clínicas (CPT `clinic`).
  - Respuesta: `[{ id, name }]`

### Doctors
- GET `/wp-json/appointments/v1/doctors?location_id=1`
  - Lista médicos (rol `doctor`). Si `location_id`, filtra por `businesshours.clin`.
  - Respuesta: `[{ id, name }]`
- GET `/wp-json/appointments/v1/doctors/search?q=maru`
  - Búsqueda por nombre de médico.

### Calendar & Slots
- GET `/wp-json/appointments/v1/slots?location_id=1&doctor_id=101[&days=14&slot=30]`
  - Devuelve slots libres próximos (rango de `days`).
  - Respuesta: `[{ start_ts, end_ts }]`
- GET `/wp-json/appointments/v1/calendar/days?location_id=1&doctor_id=101&from=YYYY-MM-DD&days=14[&slot=30]`
  - Días con disponibilidad y cantidad de slots: `[{ date, slots }]`
- GET `/wp-json/appointments/v1/calendar/slots?location_id=1&doctor_id=101&date=YYYY-MM-DD[&slot=30]`
  - Slots solo del día especificado: `[{ start_ts, end_ts }]`

### Patient
- GET `/wp-json/appointments/v1/patient?phone=1234567890`
  - Verifica existencia de paciente por teléfono.
- POST `/wp-json/appointments/v1/patient/upsert`
  - Crea/actualiza paciente por teléfono.
  - Body: `{ phone, first_name?, last_name?, email? }`
  - Respuesta: `{ id, exists, name }`
- GET `/wp-json/appointments/v1/patient/appointments?phone=...&only_upcoming=1`
  - Lista citas activas del paciente (si `only_upcoming=1`, solo futuras).

### Appointments
- POST `/wp-json/appointments/v1/add`
  - Crea cita si no hay solape.
  - Body: `{ appid?, start_ts, end_ts, price?, cli, doc, treat?, pat }`
  - Efectos: inserta en `appointments`; logs/notifications (`appointment_created`).
- DELETE `/wp-json/appointments/v1/delete/:id`
  - Soft delete (`active=0`).
  - Efectos: logs/notifications (`appointment_deleted`).
- POST `/wp-json/appointments/v1/cancel`
  - Cancela por `phone` + `appointment_id` (valida pertenencia del turno).
  - Body: `{ phone, appointment_id }`

### Treatments (opcional)
- GET `/wp-json/appointments/v1/treatments`
  - Lista tratamientos (CPT `treatment`).

### Bot logging (opcional)
- POST `/wp-json/appointments/v1/log`
  - Body: `{ phone?, event, data? }` → inserta en `logs`.

### Health endpoints
- GET `/health`
  - Endpoint público de salud para monitoreo/liveness.
  - Respuesta: `{ status: "ok" }`
- GET `/wp-json/appointments/v1/health`
  - Health bajo el prefijo WP-JSON, útil si expones y monitoreas solo ese namespace.
  - Respuesta: `{ status: "ok" }`

## Validaciones clave
- IDs numéricos (`location_id`, `doctor_id`, `cli`, `doc`, `pat`).
- `phone` se normaliza a dígitos (longitud 6–20).
- Slots:
  - `days` ∈ [1..60]
  - `slot` ∈ [10..120] minutos
- Creación de cita (`/add`):
  - `start_ts < end_ts`
  - `price ≥ 0` si se envía
  - Chequeo de solape robusto: NOT (`existing.end_ts ≤ new.start_ts` OR `existing.start_ts ≥ new.end_ts`).
- Cancelación por phone: verifica que la cita pertenece al paciente y `active=1`.

## Lógica de slots
1) Base: `businesshours` por doctor y location (`day`, `start`, `end`).
2) Ventana de consulta → se generan intervalos de `slot` minutos.
3) Exclusiones: `blocks` (`active=1`) y `appointments` (`active=1`).
4) Devuelve slots libres `{ start_ts, end_ts }`.

## Logs y Notifications
- `POST /add` → `logs.msg = 'appointment_created'` y `notifications.type = 'appointment_created'`.
- `DELETE /delete/:id` y `POST /cancel` → `appointment_deleted`.
- `notifications` estructura: `{ itemid, type, not_datetime, availto, availtoid, readby, data }`.
- Útil si un worker (o n8n) quiere enviar mensajes a doctor/paciente.

## Ejemplos rápidos
- Listar ubicaciones
```
curl http://localhost:3000/wp-json/appointments/v1/locations
```
- Upsert paciente
```
curl -X POST http://localhost:3000/wp-json/appointments/v1/patient/upsert \
 -H "Content-Type: application/json" \
 -d '{"phone":"34600111222","first_name":"Ana","last_name":"Perez"}'
```
- Días disponibles
```
curl "http://localhost:3000/wp-json/appointments/v1/calendar/days?location_id=1&doctor_id=101&from=2025-12-01&days=7"
```
- Crear cita
```
curl -X POST http://localhost:3000/wp-json/appointments/v1/add \
 -H "Content-Type: application/json" \
 -d '{"start_ts":1734000000,"end_ts":1734001800,"cli":1,"doc":101,"pat":5334,"price":0}'
```
- Cancelar por phone
```
curl -X POST http://localhost:3000/wp-json/appointments/v1/cancel \
 -H "Content-Type: application/json" \
 -d '{"phone":"34600111222","appointment_id":6451}'
```
- Health (global)
```
curl http://localhost:3000/health
```
- Health (WP-JSON)
```
curl http://localhost:3000/wp-json/appointments/v1/health
```

## Estructura del proyecto
```
src/
  index.js            # Express + rutas
  config/db.js        # Sequelize init
  models/index.js     # Modelos Sequelize
  controllers/
    locationsController.js
    doctorsController.js
    slotsController.js
    calendarController.js
    patientController.js
    appointmentsController.js
    auxController.js
  routes/index.js     # Rutas
```

## Observaciones
- Este backend asume MySQL 8+ (collation `utf8mb4_0900_ai_ci`).
- El dataset proviene de WordPress; `locations` y `treatments` son CPT.
- El backend es público; si necesitas endurecer seguridad, añade auth y CORS restringido.

---

## Guías de flujos n8n (WhatsApp)
A continuación tres recetas de flujo (nodos mínimos) pensadas para WhatsApp. Suponemos que dispones del `phone` del usuario (en formato internacional) y del texto/selección que envía.

Consejo general: normaliza el teléfono a dígitos antes de llamar a la API (ej. en un nodo Function: `{{$json["phone"].replace(/\D+/g, "")}}`).

### Flujo 1: Descubrir disponibilidad (ubicación → médicos → días → horas)
1) Trigger (WhatsApp/Webhook)
- Variables de entrada: `phone`, `text` (puedes iniciar con “1. Ver ubicaciones”).

2) HTTP Request: GET /locations
- Método: GET
- URL: http://localhost:3000/wp-json/appointments/v1/locations
- Respuesta: array de `{ id, name }`.
- Siguiente nodo: Set/Function para construir un mensaje tipo:
  "Responde con el número de la clínica:\n1) {{items[0].name}} (id={{items[0].id}})\n2) ..." y guarda `location_id` elegido (por índice)

3) HTTP Request: GET /doctors?location_id={{$json.location_id}}
- Método: GET
- URL: http://localhost:3000/wp-json/appointments/v1/doctors
- Query: location_id = `{{$json.location_id}}`
- Respuesta: `{ id, name }[]`
- Construye mensaje: "Elige médico:" y guarda `doctor_id`.

4) HTTP Request: GET /calendar/days?location_id={{...}}&doctor_id={{...}}&from={{hoy}}&days=14
- Método: GET
- URL: http://localhost:3000/wp-json/appointments/v1/calendar/days
- Query: location_id, doctor_id, from=`{{$now.format('YYYY-MM-DD')}}`, days=14
- Respuesta: `[{ date: 'YYYY-MM-DD', slots: N }]`
- Si vacío: ofrecer otro médico o ampliar rango.
- Construye mensaje: "Elige día:" y guarda `date`.

5) HTTP Request: GET /calendar/slots?location_id={{...}}&doctor_id={{...}}&date={{...}}&slot=30
- Método: GET
- URL: http://localhost:3000/wp-json/appointments/v1/calendar/slots
- Query: location_id, doctor_id, date (YYYY-MM-DD), slot=30
- Respuesta: `[{ start_ts, end_ts }]`
- Construye mensaje con horas locales (ej. `new Date(start_ts*1000)`), permite elegir índice. Guarda `start_ts`/`end_ts` elegidos para el Flujo 2.

Manejo de errores:
- Si no hay doctores/días/slots, envía mensaje de “sin disponibilidad” y ofrece reintentar.

### Flujo 2: Apartar la cita (registro/validación paciente → crear turno)
1) (Opcional) HTTP Request: POST /patient/upsert
- Método: POST
- URL: http://localhost:3000/wp-json/appointments/v1/patient/upsert
- Body JSON: `{ "phone": "{{$json.phone}}", "first_name": "{{$json.first_name}}", "last_name": "{{$json.last_name}}", "email": "{{$json.email}}" }`
- Respuesta: `{ id, exists, name }` → guarda `pat`.
- Alternativa: si ya conoces el paciente, puedes recuperar su id con GET /patient?phone y luego un nodo Function que convierta a `{ pat: response.user.id }`. En este backend `GET /patient` devuelve `{ exists, user }`.

2) HTTP Request: POST /add
- Método: POST
- URL: http://localhost:3000/wp-json/appointments/v1/add
- Body JSON:
```
{
  "start_ts": {{$json.start_ts}},
  "end_ts": {{$json.end_ts}},
  "cli": {{$json.location_id}},
  "doc": {{$json.doctor_id}},
  "pat": {{$json.pat}},
  "price": 0
}
```
- Respuesta éxito: `{ id }` (id del turno). Mensaje de confirmación.
- Errores a contemplar:
  - 409 overlap → “El slot acaba de ocuparse, elige otro”.
  - 400 invalid_* → revisar datos.

3) (Opcional) HTTP Request: GET /patient/appointments?phone=...&only_upcoming=1
- Confirmar que la cita aparece en la lista y enviar resumen al usuario.

### Flujo 3: Cancelar la cita (listar → elegir → cancelar)
1) HTTP Request: GET /patient/appointments?phone={{$json.phone}}&only_upcoming=1
- Muestra lista numerada con `id`, fecha y médico.

2) HTTP Request: POST /cancel
- Método: POST
- URL: http://localhost:3000/wp-json/appointments/v1/cancel
- Body JSON: `{ "phone": "{{$json.phone}}", "appointment_id": {{$json.appointment_id}} }`
- Respuesta: `{ ok: true }` → Envía confirmación al usuario.

### Configuración típica de “HTTP Request” en n8n
- Response Format: JSON
- Send Query Parameters: activado (para GET con query)
- Content Type: JSON (para POST)
- Error Handling: “Continue On Fail” si prefieres capturar mensaje de error y responder algo amigable.

### Variables útiles en n8n
- `{{$json}}` para los datos del mensaje/contexto.
- `{{$now}}` para la fecha actual (con n8n expressions).
- Para convertir timestamp a hora local en un Function:
```
const ts = $json.start_ts * 1000;
return new Date(ts).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' });
```

### Notas operativas
- Este backend trabaja con timestamps (UTC). Si necesitas zona horaria específica, convierte en n8n al mostrar al usuario.
- Antes de reservar, vuelve a consultar `calendar/slots` si pasan varios minutos entre elección y confirmación, para evitar solapes.
- `notifications` y `logs` se escriben automáticamente al crear/cancelar; puedes leerlos si deseas disparar envíos propios desde n8n.
