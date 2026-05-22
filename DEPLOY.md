# Palma Coin 🌴

Sistema de Economía Conductual para Las Palmas School - Bolivia

## Deploy en Render (recomendado)

### Opción A — Blueprint (infraestructura como código, 1-click)

El archivo `render.yaml` ya está en el repo. Solo conectalo:

1. Ve a [dashboard.render.com](https://dashboard.render.com)
2. **New → Blueprint**
3. Conectá tu GitHub y seleccioná `ruddyribera-ops/palma-coin`
4. Render va a:
   - Detectar `render.yaml`
   - Crear el **Web Service** (Docker) automáticamente
   - Crear la **base de datos PostgreSQL** gratis
   - Vincular `DATABASE_URL` al web service
5. En el dashboard del Web Service, andá a **Environment** y cambiá `JWT_SECRET` por un valor seguro
6. Esperá el deploy (~3-5 min la primera vez)
7. Tu app vive en `https://palma-coin.onrender.com`

### Opción B — Manual (dashboard)

1. Ve a [dashboard.render.com](https://dashboard.render.com)
2. **New → Web Service** → conectá GitHub
3. Seleccioná `ruddyribera-ops/palma-coin`
4. Runtime: **Docker** (Render detecta el Dockerfile solo)
5. Nombre: `palma-coin`
6. Plan: **Free**
7. **Create Web Service**
8. Una vez creado, andá a **New → PostgreSQL**
   - Nombre: `palma-coin-db`
   - Plan: **Free**
   - **Create**
9. En la DB creada, copiá **Internal Connection String**
10. Andá al Web Service → **Environment** → agregá:
    - `DATABASE_URL`: (lo que copiaste)
    - `JWT_SECRET`: (poné algo seguro, ej: 64 chars aleatorios)
    - `NODE_ENV`: `production`
11. **Manual Deploy → Deploy latest commit**

### Post-deploy

```bash
# Verificá que funciona
curl https://palma-coin.onrender.com/health
# → {"status":"ok","db":"connected","timestamp":"..."}
```

### Variables de entorno usadas

| Variable | Quién la setea | Propósito |
|----------|---------------|-----------|
| `PORT` | Render (automático) | Puerto del web service |
| `DATABASE_URL` | Render PostgreSQL | Connection string |
| `JWT_SECRET` | Vos (en dashboard) | Firma de tokens JWT |
| `NODE_ENV` | `render.yaml` o dashboard | `production` |

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Docente** | `ruddy@laspalmas.edu.bo` | `palma2026` |
| **Estudiantes** | `[nombre.apellido]@laspalmas.edu.bo` | `estudiante123` |

## Local Development

```bash
npm run setup       # Instalar todo
npm run build       # Build frontend
npm start           # Servir backend + frontend en :3001

# O dev mode (hot reload, sin build):
cd server && npm run dev     # Backend en :3001
cd client && npm run dev     # Frontend en :5173
```

## Tech Stack

- **Backend:** Node.js + Express + PostgreSQL (pg) + JWT + SSE
- **Frontend:** React 19 + Vite + plain CSS
- **Deployment:** Render (Docker)
- **Local DB:** SQLite via better-sqlite3 (auto-detect)

## Known issues

- Railway deploy URL returns 404 — migrado a Render
- No dark mode (CSS vars listas)
- No student dashboard (los chicos ven la vista del teacher)
- No tests
