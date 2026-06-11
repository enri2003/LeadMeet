# Lead Meet - Executive Portal

Plataforma web tipo Teams/Google Meet/Zoom orientada a ejecutivos.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 17 + Tailwind CSS |
| Backend | NestJS + TypeScript |
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

### 3. Frontend

```bash
cd frontend
npm install
npx ng serve
```

App disponible en `http://localhost:4200`

---

## Endpoint principal

```
GET /dashboard/stats?userId=<uuid>
```

Responde con JSON consolidado:
- `meetingsCompleted` — total de reuniones finalizadas
- `totalHours` — tiempo acumulado (ej. `18.5h`)
- `percentageChange` — % cambio hoy vs ayer
- `upcomingMeetings` — próximas 3 reuniones ordenadas por `start_time`
- `nextMeeting` + `minutesUntilNext` — para el countdown

---

## Guía de estilo aplicada

```
bg-[#1d2022]  |  border border-white/5  |  text-gray-400
Botón Entrar: bg-[#0055ff] hover:bg-[#0044cc]  text-white  rounded-lg  px-6  py-2
```
