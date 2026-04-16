# Palma Coin 🌴

Sistema de Economía Conductual para Las Palmas School - Bolivia

## Deployment to Railway

### Prerequisites
- GitHub account
- Railway account (railway.app)

### Steps to Deploy

1. **Push to GitHub**
   ```bash
   cd palma-coin-app
   git init
   git add .
   git commit -m "Initial commit - Palma Coin"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/palma-coin.git
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Railway will auto-detect the Dockerfile
   - Click "Deploy"

3. **Configure Environment (if needed)**
   - Railway sets `PORT` automatically
   - No other environment variables required

4. **Access Your App**
   - Railway provides a URL like: `https://palma-coin.up.railway.app`
   - Share this URL with your students

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Docente** | `ruddy@laspalmas.edu.bo` | `palma2026` |
| **Estudiantes** | `nombre.apellido@laspalmas.edu.bo` | `estudiante123` |

### Local Development

```bash
# Install all dependencies
npm run setup

# Start backend (port 3001)
npm run server

# Start frontend (port 5173)
npm run client

# Or start both together
npm run dev
```

### Tech Stack
- **Backend:** Node.js + Express + sql.js (SQLite)
- **Frontend:** React + Vite
- **Real-time:** WebSocket
- **Deployment:** Railway (Docker)