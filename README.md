# 🌴 Palma Coin

Sistema de Economía Conductual para 5to de Primaria - Las Palmas School

## Descripción

Palma Coin es un sistema de microeconomía de aula donde los estudiantes:
- Acumulan valor por esfuerzo y responsabilidad
- Aprenden a tomar decisiones colectivas
- Descubren que la confianza y el mérito valen

## Stack Tecnológico

- **Frontend:** React 19 + Vite
- **Backend:** Node.js + Express
- **Base de Datos:** SQLite (better-sqlite3)
- **Tiempo Real:** WebSocket

## Inicio Rápido

### 1. Instalar dependencias

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Iniciar el servidor

```bash
cd server
npm start
```

El servidor estará disponible en http://localhost:3001

### 3. Iniciar el cliente (en otra terminal)

```bash
cd client
npm run dev
```

El cliente estará disponible en http://localhost:5173

## Uso

1. Abre http://localhost:5173 en tu navegador
2. Ingresa tu nombre y selecciona tu rol:
   - **Docente** - Acceso completo (registrar likes, canjear recompensas, gestionar estudiantes)
   - **Estudiante** - Solo vista (ver saldos y participar en votaciones)

## Características

### 📊 Dashboard
- Resumen de estadísticas globales
- Top estudiantes por saldo
- Actividad reciente

### 📝 Registro Diario
- Registrar 👍 Likes y ❤️ Hearts por materia
- Seleccionar fecha y materia
- Guardado en lote

### 🎁 Recompensas
- Catálogo de premios canjeables
- Sistema de canje con validación de saldo
- Historial de compras

### 🏛️ Gobierno Estudiantil
- Asignación de roles (Presidente, Secretario, Tesorero)
- Lista completa de estudiantes

### 🗳️ Asambleas
- Crear votaciones
- Votación en tiempo real
- Estados: activa/cerrada

## API Endpoints

### Estudiantes
- `GET /api/students` - Listar todos
- `POST /api/students` - Crear
- `PUT /api/students/:id` - Actualizar
- `DELETE /api/students/:id` - Eliminar

### Materias
- `GET /api/subjects` - Listar
- `POST /api/subjects` - Crear

### Transacciones
- `GET /api/transactions` - Listar con filtros
- `POST /api/transactions` - Crear
- `POST /api/transactions/bulk` - Crear múltiples

### Recompensas
- `GET /api/rewards` - Listar
- `POST /api/rewards` - Crear
- `POST /api/purchases` - Canjear

### Asambleas
- `GET /api/assemblies` - Listar
- `POST /api/assemblies` - Crear
- `POST /api/assemblies/:id/vote` - Votar

## Autor

Ruddy Ribera S.
Docente de 5to de Primaria
Las Palmas School, Santa Cruz, Bolivia
Marzo 2026

## Licencia

MIT
