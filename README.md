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

## Módulo 4 — Registro de Cuenta

### Tareas implementadas

| # | Tarea | Estado |
|---|---|---|
| 1.1 | `003_auth_users.sql` — Campos `full_name`, `password_hash`, `is_verified`, `otp_code`, `otp_expires_at` en PostgreSQL | ✅ |
| 1.2 | `CryptoService` — Hashing bcrypt (12 rounds) + generación OTP 6 dígitos con expiración 5 min | ✅ |
| 1.3 | `SignUpComponent` — Interfaz de registro con validaciones reactivas (Angular + Tailwind) | ✅ |
| 1.4 | `POST /auth/register` — Endpoint con Nodemailer: hashea contraseña, guarda usuario y envía OTP por correo | ✅ |
| 1.5 | `OtpVerificationComponent` — 6 inputs individuales + countdown SVG + reenvío de código | ✅ |

### Endpoints

```
POST /auth/register      → Crea cuenta, envía OTP al correo
POST /auth/verify-otp    → Verifica código, activa cuenta (is_verified = true)
POST /auth/resend-otp    → Regenera y reenvía OTP
```

### Descripción de componentes

#### Frontend

**`SignUpComponent`** (`/features/auth/sign-up/`)
- Ruta: `/register`
- Fondo `bg-[#101415]`, card `bg-[#181c1e]`, inputs `bg-[#1d2022] border-white/10 focus:border-[#0055ff]`
- Formulario reactivo: `fullName` (min 3), `email`, `password` (min 8), `confirmPassword`, `acceptTerms`
- Validador personalizado `passwordsMatch` a nivel de FormGroup
- Toggle mostrar/ocultar contraseña en cada campo
- Checkbox de términos con estilo personalizado azul al marcar
- Botón **CREAR CUENTA** con spinner durante carga
- Redirige a `/verify-otp?email=...` tras registro exitoso

**`OtpVerificationComponent`** (`/features/auth/otp-verification/`)
- Ruta: `/verify-otp?email=...`
- 6 inputs individuales: navegación con `ArrowLeft/Right`, `Backspace`, soporte de pegado
- Auto-submit al completar el último dígito
- Anillo SVG de countdown: 5 min → color azul, expirado → rojo
- Botón **Reenviar código** visible cuando quedan < 30 s o ya expiró
- Al verificar con éxito: mensaje verde + redirige a `/login` en 2 s

#### Backend

**`AuthService`** (`/backend/src/auth/`)
- `register()`: verifica duplicado (409), hashea contraseña, guarda con `is_verified=false`, envía OTP
- `verifyOtp()`: valida código y expiración, activa cuenta en DB
- `resendOtp()`: regenera OTP y reenvía correo

**`MailService`** — Nodemailer con Gmail (contraseña de aplicación)
- Email HTML premium con código OTP resaltado y fondo oscuro `#101415`
- Configurar en `backend/.env`: `MAIL_USER` y `MAIL_APP_PASSWORD`

**`CryptoService`**
- `hashPassword(plain)` → bcrypt con 12 salt rounds
- `generateOtp()` → código 6 dígitos + `expiresAt = NOW + 5 min`
- `isOtpValid(code, stored, expiresAt)` → valida código y expiración en una sola llamada

### Flujo completo de registro

```
Usuario entra a /register
  → Llena formulario (nombre, correo, contraseña)
  → POST /auth/register
  → Backend hashea contraseña (bcrypt) + genera OTP
  → Guarda usuario con is_verified = false
  → Nodemailer envía email con código OTP
  → Frontend redirige a /verify-otp?email=...

Usuario ingresa código en /verify-otp
  → POST /auth/verify-otp { email, code }
  → Backend valida código y expiración
  → Actualiza is_verified = true en PostgreSQL
  → Frontend muestra éxito + redirige a /login
```

### Manejo de errores

| Código | Situación |
|---|---|
| 409 Conflict | Correo ya registrado |
| 401 Unauthorized | Código OTP incorrecto o expirado |
| 404 Not Found | Usuario no encontrado |
| 500 | Error al enviar correo SMTP |

---

## Módulo 5 — Ajustes Avanzados (Advanced Settings)

### Tareas implementadas

| # | Tarea | Estado |
|---|---|---|
| 6.1 | `004_user_settings.sql` — Tabla `user_settings` con FK a `users` + tabla `refresh_tokens` + seeds | ✅ |
| 6.2 | `UserSettings` entity (TypeORM) + `UpdateSettingsDto` (class-validator) | ✅ |
| 6.3 | `UsersService.getSettings / updateSettings` — Auto-crea fila si no existe | ✅ |
| 6.4 | `GET /users/settings` y `PATCH /users/settings` — Endpoints REST | ✅ |
| 6.5 | `POST /auth/logout-all` — Invalida todas las sesiones activas del usuario | ✅ |
| 6.6 | `SettingsService` (Angular) — BehaviorSubject + `load()`, `save()`, `logoutAll()` | ✅ |
| 6.7 | `AdvancedSettingsComponent` — UI completa con OnPush + enumeración de dispositivos | ✅ |
| 6.8 | Privacidad en sala: `WebRtcGateway` omite `user-joined` si `hidePresence: true` | ✅ |

### Endpoints

```
GET   /users/settings?userId=<uuid>   → Devuelve (o crea) la configuración del usuario
PATCH /users/settings?userId=<uuid>   → Actualiza campos parciales
POST  /auth/logout-all?userId=<uuid>  → Cierra todas las sesiones activas
```

### Descripción de componentes

#### Frontend

**`AdvancedSettingsComponent`** (`/features/advanced-settings/`)
- Ruta lazy-loaded: `/settings`
- Standalone, `ChangeDetectionStrategy.OnPush`
- **Audio & Video card**: dropdowns de micrófono (audioinput) y salida de audio (audiooutput) enumerados con `navigator.mediaDevices.enumerateDevices()`; toggles de Cancelación de Ruido AI y Enfoque Ejecutivo (Face Link)
- **Privacidad card**: radio group (`organization` / `anyone` / `verified`) para permisos de entrada; toggle "Ocultar estado de conexión" (`hidePresence`)
- **Interfaz & Accesibilidad card**: slider de tamaño de fuente (12-24px, etiquetado en español); tarjetas de tema Oscuro Lead / Claro Lead; toggle de subtítulos con selector de idioma (ES/EN/PT/FR)
- **Cerrar Sesión Global**: botón peligroso — llama `POST /auth/logout-all`, limpia localStorage/sessionStorage y redirige a `/register`
- Barra inferior fija: **Deshacer** (revierte al snapshot guardado), **Restablecer** (vuelve a `DEFAULT_SETTINGS`), **Guardar Cambios** (activo solo si `isDirty`)
- Toast verde de confirmación al guardar; fallback optimista si el backend está offline

**`SettingsService`** (`/core/services/settings.service.ts`)
- `BehaviorSubject<UserSettings>` como fuente reactiva de verdad
- `load(userId)` → `GET /users/settings` + actualiza el subject
- `save(patch, userId)` → `PATCH /users/settings`
- `logoutAll(userId)` → `POST /auth/logout-all`

**`settings.model.ts`** (`/core/models/`)
- `UserSettings` interface con tipos estrictos (`PrivacyLevel`, `Theme`, `CaptionLang`)
- `DEFAULT_SETTINGS` y `FONT_LABELS` exportados

#### Backend

**`UserSettings` entity** (`/users/entities/user-settings.entity.ts`)
- OneToOne con `User` (cascade, FK `userId`)
- Campos: `micDeviceId`, `audioOutId`, `noiseCancel`, `faceLink`, `privacyLevel`, `hidePresence`, `fontSize`, `theme`, `captions`, `captionLang`

**`WebRtcGateway`** (`/meetings/meeting.gateway.ts`)
- Al procesar `joinRoom`, consulta `UsersService.getSettings(userId)` e inhibe el broadcast `user-joined` si `hidePresence: true`

### Flujo de guardado de ajustes

```
Usuario edita cualquier campo en /settings
  → working copy en memoria (settings object)
  → isDirty = true → botón "Guardar Cambios" se activa
  → Clic en "Guardar Cambios"
  → SettingsService.save(settings) → PATCH /users/settings
  → Backend: UsersService.updateSettings() → TypeORM upsert
  → Respuesta: objeto UserSettings actualizado
  → savedSnapshot ← settings → isDirty = false → toast verde 2.5 s

Clic en "Deshacer" → settings ← savedSnapshot (sin petición HTTP)
Clic en "Restablecer" → settings ← DEFAULT_SETTINGS (sin petición HTTP)
Clic en "Cerrar Sesión" → confirm() → POST /auth/logout-all → clear storage → /register
```

---

## Módulo 6 — Mis Reuniones (My Meetings)

### Tareas implementadas

| # | Tarea | Estado |
|---|---|---|
| 3.1 | `MyMeetingsComponent` — Tabs Próximas/Pasadas/Archivadas + filtros rápidos por fecha y tipo | ✅ |
| 3.2 | `LiveMeetingCardComponent` — Tarjeta EN VIVO con badge pulsante + tiempo transcurrido + botón Entrar | ✅ |
| 3.3 | `PastMeetingsListComponent` — Tabla con columnas Reunión/Fecha/Duración/Participantes/Acción + empty states | ✅ |
| 3.4 | `GET /meetings` — Endpoint con filtros `status`, `startDate`, `endDate` y cálculo de `durationMinutes` | ✅ |
| 3.5 | `005_meetings_archive.sql` + `PATCH /meetings/:id/archive` — Estado archived con validación de host | ✅ |

### Endpoints

```
GET   /meetings?userId=<uuid>&status=upcoming|live|past|archived&startDate=&endDate=
PATCH /meetings/:id/archive?userId=<uuid>   → 403 si no es el host
```

### Descripción de componentes

#### Frontend

**`MyMeetingsComponent`** (`/features/my-meetings/`)
- Ruta lazy-loaded: `/meetings`
- Barra de filtros: `bg-[#1d2022] border border-white/5 rounded-2xl p-4`
- 3 tabs con toggle visual (blanco activo / transparente inactivo): Próximas · Pasadas · Archivadas
- Filtros rápidos: "Esta semana" / "Este mes" (calculan startDate/endDate automáticamente)
- Inputs de fecha y dropdown de tipo de reunión
- Skeleton loader mientras carga (`animate-pulse`)
- Tab "Próximas": tarjetas individuales con ícono de tipo, fecha/hora, badge "Programada", botón Entrar
- Tabs "Pasadas" / "Archivadas": delega a `PastMeetingsListComponent`

**`LiveMeetingCardComponent`** (`/features/my-meetings/components/live-meeting-card/`)
- Se muestra siempre en la parte superior si hay una reunión activa (`GET /meetings?status=live`)
- Estilo: `bg-gradient-to-br from-[#1d2022] to-[#131313] border border-white/10 rounded-3xl p-8`
- Badge **EN VIVO** con punto rojo pulsante (`animate-ping`)
- Muestra tiempo transcurrido en minutos/horas
- Avatares de participantes apilados (max 4 + contador +N)
- Botón **Entrar a la Reunión** `bg-[#0055ff]` → navega a `/meeting/:roomId`

**`PastMeetingsListComponent`** (`/features/my-meetings/components/past-meetings-list/`)
- `@Input() meetings`: lista de `MeetingDto`
- `@Input() showArchiveButton`: muestra botón Archivar solo en tab Pasadas
- `@Output() archive`: emite el id cuando el host quiere archivar
- Columnas: **Reunión** (nombre + badge de tipo coloreado) | **Fecha** | **Duración** (formateada como "1h 30min") | **Participantes** | **Acción** (Resumen + Archivar)
- Empty state elegante con ícono y mensajes contextuales por tab

**`MeetingsApiService`** (`/core/services/meetings-api.service.ts`)
- `getMeetings(filter, startDate?, endDate?)` → `GET /meetings`
- `getLiveMeeting()` → filtra por `status=live`, devuelve el primero o `null`
- `archiveMeeting(id)` → `PATCH /meetings/:id/archive`

#### Backend

**`MeetingsController`** (`/backend/src/meetings/meetings.controller.ts`)
- `GET /meetings` → `MeetingsService.getMeetings(userId, opts)`
- `PATCH /meetings/:id/archive` → `MeetingsService.archiveMeeting(id, requesterId)`

**`MeetingsService`** — nuevos métodos (Tasks 3.4, 3.5)
- `getMeetings()`: QueryBuilder con switch por status (upcoming=scheduled+futuro, live=scheduled+ahora, past=completed, archived=archived), rango de fechas, calcula `durationMinutes`
- `archiveMeeting()`: lanza `NotFoundException` si no existe, `ForbiddenException` si no es el host (`createdById`)

### Flujo de archivado

```
Usuario en tab "Pasadas"
  → Ve lista con botón "Archivar" en cada fila
  → Clic en "Archivar"
  → MeetingsApiService.archiveMeeting(id) → PATCH /meetings/:id/archive?userId=...
  → Backend: verifica meeting existe + requesterId === createdById
  → meeting.status = 'archived' → TypeORM save
  → Frontend: recarga la tab → reunión desaparece de "Pasadas"
  → Aparece en tab "Archivadas"
```

---

## Módulo 7 — Calendario Ejecutivo (Executive Calendar)

### Tareas implementadas

| # | Tarea | Estado |
|---|---|---|
| 3.1 | `ExecutiveCalendarComponent` — Cuadrícula mensual 6×7 con indicadores de color por tipo de reunión | ✅ |
| 3.2 | `DailyAgendaSidebarComponent` — Panel derecho con lista cronológica + botón "Programar" | ✅ |
| 3.3 | `QuickNotesComponent` — Área de notas con autoguardado por debounce (800ms) | ✅ |
| 3.4 | `GET /calendar/events?userId&year&month` — Reuniones agrupadas por día del mes | ✅ |
| 3.5 | `006_calendar_notes.sql` + `GET|POST /calendar/notes` — Tabla `daily_notes` con UNIQUE(userId, date) | ✅ |

### Endpoints

```
GET  /calendar/events?userId=<uuid>&year=2026&month=6   → Record<number, CalendarEventItem[]>
GET  /calendar/notes?userId=<uuid>&date=2026-06-13       → DailyNoteDto | null
POST /calendar/notes  { userId, date, content }          → DailyNoteDto (upsert)
```

### Descripción de componentes

#### Frontend

**`ExecutiveCalendarComponent`** (`/features/executive-calendar/`)
- Ruta lazy-loaded: `/calendar`
- Standalone, `ChangeDetectionStrategy.OnPush`
- Layout de 2 columnas: cuadrícula mensual izquierda (flex-1) + sidebar derecha (w-72)
- Cuadrícula 42 celdas (6 filas × 7 columnas, inicio lunes)
- Navegación de mes: flechas prev/next recalculan año si cruzan enero/diciembre
- Celdas: `bg-[#1d2022] border border-white/5 rounded-xl` — activo: `bg-white border-white` — hoy: `border-[#0055ff]/40`
- Dots de eventos (máx 3 + contador +N): azul=strategy, amarillo=negotiation, morado=interview, gris=general
- Leyenda de colores en la parte inferior
- Al seleccionar un día: actualiza `selectedMeetings` desde `monthData[day]` + carga la nota para ese día

**`DailyAgendaSidebarComponent`** (`/components/daily-agenda-sidebar/`)
- `@Input() selectedDate`, `@Input() meetings`, `@Output() schedule`
- Muestra fecha seleccionada + badge "Hoy" o conteo de eventos
- Botón **Programar** `bg-[#0055ff]` navega a `/meetings`
- Tarjetas `bg-[#1d2022] border border-white/5 rounded-xl p-4` con barra de color vertical izquierda según tipo
- Muestra: rango horario, título, badge de tipo coloreado, participantes, candado si confidencial
- Botón **Entrar →** aparece en hover solo para reuniones `scheduled`
- Empty state con ícono y mensaje contextual

**`QuickNotesComponent`** (`/components/quick-notes/`)
- `@Input() content`, `@Output() save: EventEmitter<string>`
- Debounce 800ms: usa `Subject<string>` + `debounceTime(800)` + `takeUntil(destroy$)` de RxJS
- Textarea sin estilo (`bg-transparent`) integrada en card
- Indicadores: "Guardando..." mientras pide al API; "✓ Guardado" 2.5s tras éxito

**`CalendarApiService`** (`/core/services/calendar-api.service.ts`)
- `getEvents(year, month)` → `GET /calendar/events`
- `getNote(date)` → `GET /calendar/notes` (devuelve `null` si no existe)
- `upsertNote(date, content)` → `POST /calendar/notes`

#### Backend

**`CalendarService`** (`/backend/src/calendar/`)
- `getEvents()`: QueryBuilder filtra meetings del mes por `createdById`, ordena ASC, agrupa en `Record<number, CalendarEventItem[]>` por `getDate()`
- `getNote()`: `findOne({ where: { userId, date } })`
- `upsertNote()`: find-or-create pattern, luego `save()`

**`DailyNote` entity** — tabla `daily_notes`
- `UNIQUE(user_id, date)` garantiza una nota por usuario por día
- `updated_at` trigger reutiliza `update_updated_at()` del schema inicial

### Flujo de notas rápidas

```
Usuario selecciona un día en la cuadrícula
  → ExecutiveCalendarComponent.selectDay(date)
  → CalendarApiService.getNote('2026-06-13') → GET /calendar/notes
  → Nota cargada en QuickNotesComponent [content]

Usuario escribe en el textarea
  → QuickNotesComponent.onInput() → noteSubject.next(value)
  → debounceTime(800ms) — espera a que el usuario pause
  → save.emit(content)
  → ExecutiveCalendarComponent.onNoteSave(content)
  → CalendarApiService.upsertNote('2026-06-13', content) → POST /calendar/notes
  → Backend: findOne + save (upsert) → UNIQUE(user_id, date) protege duplicados
  → Indicador "✓ Guardado" aparece 2.5s
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
