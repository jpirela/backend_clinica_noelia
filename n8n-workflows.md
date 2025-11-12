# n8n Workflows (WhatsApp Chatbot) — Importable examples

Este archivo contiene 3 workflows ejemplo en formato JSON para importar en n8n. Cada uno modela un flujo:
- Descubrimiento: ubicaciones → médicos → días → horas
- Reserva: upsert paciente → crear cita
- Cancelación: listar → cancelar

Notas
- Sustituye http://localhost:3000 si expones el backend en otra URL.
- Los ejemplos usan Webhook (POST) como trigger; ajusta el nodo de entrada a tu conector de WhatsApp.
- En escenarios reales, mapea la interacción del usuario (elecciones) a variables (location_id, doctor_id, date, start_ts, end_ts, etc.).

---

## 1) WA - Discovery (ubicaciones → médicos → días → horas)

```json
{
  "name": "WA - Discovery",
  "nodes": [
    {
      "parameters": {
        "path": "wa-discovery",
        "methods": [
          "POST"
        ],
        "responseMode": "onReceived",
        "responseData": "={{$json}}"
      },
      "id": "Webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [
        -420,
        300
      ]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:3000/wp-json/appointments/v1/health",
        "options": { "response": "json" }
      },
      "id": "HealthWP",
      "name": "Health (WP)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [
        -300,
        300
      ]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:3000/wp-json/appointments/v1/locations",
        "options": {
          "response": "json"
        }
      },
      "id": "GetLocations",
      "name": "Get Locations",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [
        -180,
        300
      ]
    },
    {
      "parameters": {
        "functionCode": "// Construir mensaje y simular selección de location_id (índice 0)\nconst list = items[0].json;
if (!Array.isArray(list) || list.length === 0) {
  return [{ json: { message: 'No hay ubicaciones disponibles' } }];
}
const options = list.map((x, i) => `${i+1}) ${x.name} (id=${x.id})`).join('\n');
const selectedIndex = 0; // TODO: reemplazar por la selección del usuario
const location_id = list[selectedIndex].id;
return [{ json: { location_id, message: `Elige médico para la clínica ${list[selectedIndex].name}:\n${options}` } }];"
      },
      "id": "PickLocation",
      "name": "Pick Location (demo)",
      "type": "n8n-nodes-base.function",
      "typeVersion": 2,
      "position": [
        80,
        300
      ]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:3000/wp-json/appointments/v1/doctors",
        "queryParametersUi": {
          "parameter": [
            {
              "name": "location_id",
              "value": "={{$json.location_id}}"
            }
          ]
        },
        "options": { "response": "json" }
      },
      "id": "GetDoctors",
      "name": "Get Doctors",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [
        320,
        300
      ]
    },
    {
      "parameters": {
        "functionCode": "// Construir mensaje y simular selección de doctor_id (índice 0)
const list = items[0].json;
if (!Array.isArray(list) || list.length === 0) {
  return [{ json: { message: 'No hay médicos disponibles' } }];
}
const options = list.map((x, i) => `${i+1}) ${x.name} (id=${x.id})`).join('\n');
const selectedIndex = 0; // TODO: reemplazar por selección del usuario
const doctor_id = list[selectedIndex].id;
return [{ json: { doctor_id, location_id: $items("Pick Location (demo)")[0].json.location_id, message: `Elige día para ${list[selectedIndex].name}:\n${options}` } }];"
      },
      "id": "PickDoctor",
      "name": "Pick Doctor (demo)",
      "type": "n8n-nodes-base.function",
      "typeVersion": 2,
      "position": [
        560,
        300
      ]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:3000/wp-json/appointments/v1/calendar/days",
        "queryParametersUi": {
          "parameter": [
            {"name": "location_id", "value": "={{$json.location_id}}"},
            {"name": "doctor_id", "value": "={{$json.doctor_id}}"},
            {"name": "from", "value": "={{$now.format('YYYY-MM-DD')}}"},
            {"name": "days", "value": "14"}
          ]
        },
        "options": { "response": "json" }
      },
      "id": "GetDays",
      "name": "Get Days",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [
        820,
        300
      ]
    },
    {
      "parameters": {
        "functionCode": "// Simular elección de fecha (primer día con slots)
const list = items[0].json;
if (!Array.isArray(list) || list.length === 0) {
  return [{ json: { message: 'Sin días disponibles' } }];
}
const date = list[0].date; // TODO: reemplazar por selección del usuario
return [{ json: { date, location_id: $items("Pick Doctor (demo)")[0].json.location_id, doctor_id: $items("Pick Doctor (demo)")[0].json.doctor_id } }];"
      },
      "id": "PickDate",
      "name": "Pick Date (demo)",
      "type": "n8n-nodes-base.function",
      "typeVersion": 2,
      "position": [
        1060,
        300
      ]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:3000/wp-json/appointments/v1/calendar/slots",
        "queryParametersUi": {
          "parameter": [
            {"name": "location_id", "value": "={{$json.location_id}}"},
            {"name": "doctor_id", "value": "={{$json.doctor_id}}"},
            {"name": "date", "value": "={{$json.date}}"},
            {"name": "slot", "value": "30"}
          ]
        },
        "options": { "response": "json" }
      },
      "id": "GetSlotsByDate",
      "name": "Get Slots (By Date)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [
        1300,
        300
      ]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Health (WP)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Health (WP)": {
      "main": [
        [
          {
            "node": "Get Locations",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Locations": {
      "main": [
        [
          {
            "node": "Pick Location (demo)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Pick Location (demo)": {
      "main": [
        [
          {
            "node": "Get Doctors",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Doctors": {
      "main": [
        [
          {
            "node": "Pick Doctor (demo)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Pick Doctor (demo)": {
      "main": [
        [
          {
            "node": "Get Days",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Days": {
      "main": [
        [
          {
            "node": "Pick Date (demo)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Pick Date (demo)": {
      "main": [
        [
          {
            "node": "Get Slots (By Date)",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": false
}
```

---

## 2) WA - Book (upsert paciente → crear cita)

```json
{
  "name": "WA - Book",
  "nodes": [
    {
      "parameters": {
        "path": "wa-book",
        "methods": ["POST"],
        "responseMode": "onReceived"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [-420, 300],
      "id": "WB"
    },
    {
      "parameters": { "method": "GET", "url": "http://localhost:3000/wp-json/appointments/v1/health", "options": {"response": "json"} },
      "name": "Health (WP)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [-280, 300],
      "id": "HWPB"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/wp-json/appointments/v1/patient/upsert",
        "options": {"response": "json"},
        "jsonParameters": true,
        "optionsUi": {},
        "bodyParametersJson": "={\n  \"phone\": \"{{$json.phone}}\",\n  \"first_name\": \"{{$json.first_name || ''}}\",\n  \"last_name\": \"{{$json.last_name || ''}}\",\n  \"email\": \"{{$json.email || ''}}\"\n}"
      },
      "name": "Upsert Patient",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [-140, 300],
      "id": "UP"
    },
    {
      "parameters": {
        "functionCode": "// Preparar payload de reserva usando variables previas\nconst pat = $json.id || $items(\"Upsert Patient\")[0].json.id;\nreturn [{ json: {\n  start_ts: $json.start_ts,\n  end_ts: $json.end_ts,\n  cli: $json.location_id,\n  doc: $json.doctor_id,\n  pat,\n  price: 0\n} }];"
      },
      "name": "Prepare Add Body",
      "type": "n8n-nodes-base.function",
      "typeVersion": 2,
      "position": [120, 300],
      "id": "PA"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/wp-json/appointments/v1/add",
        "jsonParameters": true,
        "options": {"response": "json"},
        "optionsUi": {},
        "bodyParametersJson": "={{JSON.stringify($json)}}"
      },
      "name": "Create Appointment",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [380, 300],
      "id": "CA"
    }
  ],
  "connections": {
    "WB": {"main": [[{"node": "Health (WP)", "type": "main", "index": 0}]]},
    "Health (WP)": {"main": [[{"node": "Upsert Patient", "type": "main", "index": 0}]]},
    "Upsert Patient": {"main": [[{"node": "Prepare Add Body", "type": "main", "index": 0}]]},
    "Prepare Add Body": {"main": [[{"node": "Create Appointment", "type": "main", "index": 0}]]}
  },
  "active": false
}
```

---

## 3) WA - Cancel (listar → cancelar)

```json
{
  "name": "WA - Cancel",
  "nodes": [
    {
      "parameters": { "path": "wa-cancel", "methods": ["POST"], "responseMode": "onReceived" },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [-420, 300],
      "id": "WBC"
    },
    {
      "parameters": { "method": "GET", "url": "http://localhost:3000/wp-json/appointments/v1/health", "options": {"response": "json"} },
      "name": "Health (WP)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [-280, 300],
      "id": "HWPC"
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:3000/wp-json/appointments/v1/patient/appointments",
        "options": {"response": "json"},
        "queryParametersUi": {"parameter": [
          {"name": "phone", "value": "={{$json.phone}}"},
          {"name": "only_upcoming", "value": "1"}
        ]}
      },
      "name": "Get My Appointments",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [-140, 300],
      "id": "GMA"
    },
    {
      "parameters": {
        "functionCode": "// Tomar el primer appointment para cancelar (DEMO)\nconst list = items[0].json;\nif (!Array.isArray(list) || list.length === 0) {\n  return [{ json: { message: 'No tienes citas futuras' } }];\n}\nconst appointment_id = list[0].id;\nreturn [{ json: { phone: $json.phone, appointment_id } }];"
      },
      "name": "Pick Appointment (demo)",
      "type": "n8n-nodes-base.function",
      "typeVersion": 2,
      "position": [120, 300],
      "id": "PAD"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/wp-json/appointments/v1/cancel",
        "jsonParameters": true,
        "options": {"response": "json"},
        "bodyParametersJson": "={{JSON.stringify($json)}}"
      },
      "name": "Cancel Appointment",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [380, 300],
      "id": "CAN"
    }
  ],
  "connections": {
    "WBC": {"main": [[{"node": "Health (WP)", "type": "main", "index": 0}]]},
    "Health (WP)": {"main": [[{"node": "Get My Appointments", "type": "main", "index": 0}]]},
    "Get My Appointments": {"main": [[{"node": "Pick Appointment (demo)", "type": "main", "index": 0}]]},
    "Pick Appointment (demo)": {"main": [[{"node": "Cancel Appointment", "type": "main", "index": 0}]]}
  },
  "active": false
}
```

---

### Importar en n8n
1) Copia cada bloque JSON y guárdalo en archivos `.json` separados (por ejemplo `wa-discovery.json`, `wa-book.json`, `wa-cancel.json`).
2) En n8n: Import → pega el JSON o sube el archivo.
3) Ajusta el nodo de entrada (si usas un conector de WhatsApp) y los puntos de selección (los nodos `Pick ... (demo)` usan índices simulados).
