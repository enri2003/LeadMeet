# Lead Meet - Executive Portal

Plataforma web tipo Teams/Google Meet/Zoom orientada a ejecutivos.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 17 + Tailwind CSS + Screen Capture API |
| Backend | NestJS + TypeScript + Socket.IO |
| Base de Datos | PostgreSQL 16 (Docker) |
| ORM | TypeORM |
| Tiempo real | WebSockets + WebRTC vía @nestjs/platform-socket.io |

---

## Inicio rápido

### 1. Base de datos (Docker)

```bash
docker compose up -d
```

Crea la base de datos `leadmeet` con datos semilla automáticamente.  
Ejecuta también la migración `002_meeting_logs.sql` para la tabla de logs.

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```

- API REST: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api`
- Socket.IO: `ws://localhost:3000`

### 3. Frontend

```bash
cd frontend
npm install
npx ng serve
```

App disponible en `http://localhost:4200`

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

### Endpoint principal

```
GET /dashboard/stats?userId=<uuid>
```

Devuelve: `meetingsCompleted`, `totalHours`, `percentageChange`, `upcomingMeetings[]`, `nextMeeting`, `minutesUntilNext`

---

## Módulo 2 — Sala de Reunión WebRTC

| # | Tarea | Estado |
|---|---|---|
| 4.1 | `MeetingRoomComponent` — Sala WebRTC con video/audio en tiempo real | ✅ |
| 4.2 | `SignalingService` — Señalización WebRTC vía Socket.IO | ✅ |
| 4.3 | `MeetingGateway` (Módulo 2) — Eventos de sala: join, offer, answer, ice | ✅ |
| 4.4 | `MediaStreamService` — Gestión de cámara, micrófono y streams | ✅ |

Ruta: `/meeting/:roomId`

---

## Módulo 3 — Compartir Pantalla

### Tareas implementadas

| # | Tarea | Estado |
|---|---|---|
| 5.1 | `ShareScreenModalComponent` — Modal de selección de fuente con pestañas | ✅ |
| 5.2 | `ScreenShareService` — Captura real con `getDisplayMedia` | ✅ |
| 5.3 | `MeetingRoomComponent` — Gestión del stream en sala con RTCPeerConnection | ✅ |
| 5.4 | `MeetingGateway` — Eventos Socket.IO en NestJS | ✅ |
| 5.5 | `meeting_logs` — Registro de actividad en PostgreSQL | ✅ |

### Descripción de componentes

#### Frontend

**`ShareScreenModalComponent`** (`/features/meeting-room/components/share-screen-modal/`)
- Modal con `backdrop-blur`, fondo `bg-[#131313]`, `rounded-3xl`
- 3 pestañas: Toda la pantalla, Ventana de aplicación, Pestaña del navegador
- Tarjetas de fuente con `border-2 hover:border-blue-500` y checkmark al seleccionar
- Vista cuadrícula / lista (toggle)
- Toggles: **Compartir audio del sistema** y **Optimizar para videoclip**
- Botón **COMPARTIR AHORA** (`bg-white text-black rounded-xl`) con spinner de carga
- Banner de error en rojo si el browser niega el permiso

**`ScreenShareService`** (`/core/services/screen-share.service.ts`)
- Llama `navigator.mediaDevices.getDisplayMedia()` con restricciones dinámicas
- `optimizeForVideo = true` → 60 fps + `contentHint = 'motion'`
- `optimizeForVideo = false` → 30 fps + `contentHint = 'detail'` (texto nítido)
- `withAudio = true` → captura audio del sistema sin echoCancellation
- Evento `onended` del track → limpia stream y emite `sharingStopped$`
- `replaceTrackInSender(pc, track)` → reemplaza el track en `RTCPeerConnection`
- Estado reactivo en `BehaviorSubject<ScreenShareState>`

**`MeetingRoomComponent`** (`/features/meeting-room/`)
- Ruta: `/room/:roomId`
- Video de pantalla compartida ocupa el área central (`object-contain`)
- Cámara local como ventana flotante (esquina inferior derecha)
- Controles: Mic, Cámara, Share, Chat, Colgar — con toggle real de los tracks
- Banner azul cuando otro participante está compartiendo

**`MeetingSocketService`** (`/core/services/meeting-socket.service.ts`)
- Wrapper de `socket.io-client`
- Subjects: `userStartedSharing$`, `userStoppedSharing$`
- Métodos: `connect()`, `emitStartSharing()`, `emitStopSharing()`, `disconnect()`

#### Backend

**`MeetingGateway`** (`/backend/src/meetings/gateway/`)

| Evento (recibe) | Acción |
|---|---|
| `startSharing` | Valida exclusividad por sala → emite `userStartedSharing` a todos → registra log |
| `stopSharing` | Limpia estado → emite `userStoppedSharing` → cierra log |
| `getSharingStatus` | Responde con quién comparte actualmente |

| Evento (emite) | Descripción |
|---|---|
| `userStartedSharing` | Broadcast `{ userId, userName, roomId, timestamp }` |
| `userStoppedSharing` | Broadcast al detener o al desconectarse |
| `sharingStatus` | Al conectarse, informa si alguien ya comparte |

**`MeetingLogService`** + **tabla `meeting_logs`**
- `logShareStarted()` → inserta registro con `event_type = 'share_started'`
- `logShareStopped()` → actualiza `stopped_at`, calcula duración automática
- Columna `duration_sec` generada por PostgreSQL (`EXTRACT EPOCH`)
- Vista `v_sharing_stats` para analítica por usuario
- `GET /meeting-logs/user/:userId` → historial de sesiones

### Flujo completo de compartición

```
Usuario hace clic en "Share"
  → Abre ShareScreenModalComponent
  → Selecciona fuente + opciones (audio, videoclip)
  → Clic en "COMPARTIR AHORA"
  → ScreenShareService.startCapture() → getDisplayMedia()
  → Browser muestra selector nativo de pantalla
  → MediaStream listo → MeetingRoomComponent.onShareStarted(stream)
  → Stream en <video> + replaceTrackInSender(RTCPeerConnection)
  → MeetingSocketService.emitStartSharing() → Socket.IO → servidor
  → MeetingGateway.handleStartSharing() → MeetingLogService.logShareStarted()
  → server.emit('userStartedSharing') → todos los participantes
  → Otros ven banner "X está compartiendo pantalla"

Usuario hace clic en "Detener" (o cierra el picker nativo del browser)
  → ScreenShareService.stopCapture() → track.stop()
  → sharingStopped$ → MeetingSocketService.emitStopSharing()
  → MeetingGateway.handleStopSharing() → MeetingLogService.logShareStopped()
  → server.emit('userStoppedSharing') → banners desaparecen
```

---

## Guía de estilo

```
Dashboard:  bg-[#1d2022]  |  border border-white/5  |  text-gray-400
Modal:      bg-[#131313]  |  border border-white/10  |  rounded-3xl
Sala:       bg-[#101415]
Botón Entrar:    bg-[#0055ff] hover:bg-[#0044cc]  text-white  rounded-lg   px-6 py-2
Botón Compartir: bg-white     hover:bg-gray-200    text-black  rounded-xl  px-8 py-3
```
