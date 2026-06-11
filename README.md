# Lead Meet - Executive Portal

Plataforma web tipo Teams/Google Meet/Zoom orientada a ejecutivos.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 17 + Tailwind CSS + WebRTC API |
| Backend | NestJS + TypeScript + Socket.io |
| Base de Datos | PostgreSQL 16 (Docker) |
| ORM | TypeORM |

---

## Módulo 1 — Dashboard (Inicio)

### Tareas implementadas

| # | Tarea | Estado |
|---|---|---|
| 2.1 | `DashboardStatsComponent` — Métricas en tiempo real (reuniones + tiempo total + % cambio) | ✅ |
| 2.2 | `NextMeetingHeroComponent` — Próximo hito con countdown en vivo | ✅ |
| 2.3 | `UpcomingMeetingsListComponent` — Lista con botón **Entrar** / **Programado** | ✅ |
| 2.4 | `GET /dashboard/stats` — Endpoint consolidado (NestJS) | ✅ |
| 2.5 | Validación `TIMESTAMPTZ` y estados `scheduled`/`completed` (PostgreSQL) | ✅ |

### Arquitectura Módulo 1

```
frontend/src/app/
├── features/dashboard/
│   ├── dashboard.component           ← página principal
│   └── components/
│       ├── dashboard-stats/          ← tarjetas de métricas
│       ├── next-meeting-hero/        ← countdown próxima reunión
│       └── upcoming-meetings-list/   ← lista de reuniones
├── core/
│   ├── models/dashboard.model.ts
│   └── services/dashboard.service.ts
└── layout/sidebar/                   ← navegación lateral

backend/src/
├── dashboard/
│   ├── dashboard.controller.ts       ← GET /dashboard/stats
│   ├── dashboard.service.ts
│   └── dto/dashboard-stats.dto.ts
└── database/migrations/init.sql      ← schema + seed data
```

---

## Módulo 2 — Sala de Reunión (Core WebRTC)

### Tareas implementadas

| # | Tarea | Estado |
|---|---|---|
| 4.1 | `MeetingGateway` — Señalización WebRTC con Socket.io (offer/answer/ICE) | ✅ |
| 4.2 | `MeetingRoomComponent` — Sala de video dinámica con cuadrícula + panel lateral | ✅ |
| 4.3 | `MeetingControlsComponent` — Barra flotante (Mic, Cámara, Compartir, Chat, Salir) | ✅ |
| 4.4 | `MediaStreamService` + `SignalingService` — Gestión de streams y WebSockets | ✅ |
| 4.5 | Persistencia de sesión — `joined_at` / `left_at` en PostgreSQL + `endMeeting` | ✅ |

### Arquitectura Módulo 2

```
frontend/src/app/
├── features/meeting-room/
│   ├── meeting-room.component        ← orquestador WebRTC (RTCPeerConnection mesh)
│   └── components/
│       ├── video-tile/               ← tile de video individual con avatar fallback
│       └── meeting-controls/         ← barra flotante backdrop-blur
├── core/
│   ├── models/meeting-room.model.ts  ← RoomParticipant, ChatMessage, RoomStatePayload
│   └── services/
│       ├── signaling.service.ts      ← cliente Socket.io /meeting
│       └── media-stream.service.ts   ← getUserMedia, toggleMute/Camera, screenShare

backend/src/
├── auth/
│   ├── auth.module.ts                ← JwtModule
│   └── ws-jwt.guard.ts               ← WsJwtGuard (dev: modo guest sin token)
└── meetings/
    ├── meeting.gateway.ts            ← WebSocket Gateway /meeting namespace
    ├── meetings.module.ts
    ├── meetings.service.ts           ← recordJoin, recordLeave, endMeeting
    ├── dto/join-room.dto.ts
    └── entities/
        ├── meeting.entity.ts
        └── meeting-participant.entity.ts  ← + left_at + participant_role
```

### Flujo WebRTC (mesh topology)

```
Usuario A entra a la sala
  └── Server envía room-state [B, C] a A
        └── A crea RTCPeerConnection para B y C
              └── A envía offers a B y C
                    └── B y C responden con answers
                          └── Intercambio de ICE candidates (STUN: Google)

Nuevo usuario D entra
  └── Server notifica user-joined a A, B, C
        └── A, B, C envían offers a D
              └── D responde con answers
```

### Eventos Socket.io

| Evento (emit) | Dirección | Descripción |
|---|---|---|
| `join-room` | client → server | Entrar a sala con nombre/userId |
| `webrtc-offer` | client → server → peer | Relay de offer SDP |
| `webrtc-answer` | client → server → peer | Relay de answer SDP |
| `ice-candidate` | client → server → peer | Relay de ICE candidate |
| `toggle-mute` | client → server → room | Sincronizar estado de micrófono |
| `toggle-camera` | client → server → room | Sincronizar estado de cámara |
| `chat-message` | client → server → room | Mensaje de chat en sala |
| `leave-room` | client → server | Salir de sala |
| `end-meeting` | host → server → room | Finalizar reunión para todos |

### Restricción crítica — Privacy First

> **Sin grabación.** El gateway no implementa ningún mecanismo de `MediaRecorder` ni almacenamiento de streams. Solo señalización peer-to-peer.

---

## Inicio rápido

### 1. Base de datos (Docker)

```bash
docker compose up -d
```

Crea la BD `leadmeet` con datos semilla automáticamente.

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```

API disponible en `http://localhost:3000`  
Swagger UI en `http://localhost:3000/api`  
WebSocket en `ws://localhost:3000/meeting`

### 3. Frontend

```bash
cd frontend
npm install
npx ng serve
```

App disponible en `http://localhost:4200`

Para entrar a la sala de prueba: clic en **"Unirse a demo"** en el dashboard.

---

## Endpoints

### Módulo 1

```
GET /dashboard/stats?userId=<uuid>
```

Responde con JSON consolidado:
- `meetingsCompleted` — total de reuniones finalizadas
- `totalHours` — tiempo acumulado (ej. `18.5h`)
- `percentageChange` — % cambio hoy vs ayer
- `upcomingMeetings` — próximas 3 reuniones ordenadas por `start_time`
- `nextMeeting` + `minutesUntilNext` — para el countdown

### Módulo 2 — WebSocket `/meeting`

| Namespace | Puerto | Transporte |
|---|---|---|
| `/meeting` | 3000 | WebSocket |

Ruta de sala en frontend: `/meeting/:roomId`

---

## Guía de estilo aplicada

```
Fondo sala:   bg-[#101415]
Video tile:   bg-black rounded-2xl border border-white/5 overflow-hidden
Barra ctrl:   bg-[#1d2022]/80 backdrop-blur-xl border border-white/10 rounded-2xl
Panel lateral: bg-[#131313] border-l border-white/5
Acento:       #0055ff  (hover: #0044cc)
Botón salir:  bg-red-600 hover:bg-red-700 text-white
Tipografía:   Geist, Inter, ui-sans-serif
```

---

## Ramas del repositorio

| Rama | Contenido |
|---|---|
| `main` | Módulo 1 + Módulo 2 (producción) |
| `modelo1` | Solo Módulo 1 — Dashboard |
| `modelo2` | Módulo 2 — Sala de Reunión WebRTC |
