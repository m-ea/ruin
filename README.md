# Ruin

A 2D cooperative multiplayer browser-based RPG built with pixel art and tile-based rendering. Features deep NPC systems, crafting, and real-time combat in a persistent world.

**⚠️ Early Development:** This is an early development scaffold. Core multiplayer infrastructure is in place, but game logic and content are still in development.

---

## 🎮 Tech Stack

- **Client**: Phaser 3 (rendering and input)
- **Server**: Colyseus (multiplayer game server)
- **API**: Express (authentication and REST endpoints)
- **Database**: PostgreSQL (persistent storage)
- **Language**: TypeScript (strict mode, full ESM)
- **Build Tools**: pnpm workspaces (monorepo), Vite (client bundler)
- **Infrastructure**: Docker (containerized Postgres + optional server)

---

## 📋 Prerequisites

- **Node.js** 20 LTS ([Download](https://nodejs.org/))
- **pnpm** - Install globally: `npm install -g pnpm`
- **Docker & Docker Compose** - For PostgreSQL ([Download](https://www.docker.com/))
- **PostgreSQL client tools** (optional) - For manual database management

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd ruin
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` if needed. The defaults work for local development with Docker.

### 4. Start PostgreSQL

```bash
docker compose up postgres -d
```

This starts PostgreSQL on port 5432 with user `ruin` and password `ruin`.

### 5. Create databases

**Option 1: Using Docker Compose PostgreSQL**

```bash
# You may be prompted for the password: ruin
createdb -h localhost -U ruin ruin
createdb -h localhost -U ruin ruin_test
```

**Option 2: Using pgAdmin or another PostgreSQL GUI**

Connect to `localhost:5432` with user `ruin`, password `ruin`, and create two databases:
- `ruin` (development)
- `ruin_test` (testing)

**Option 3: Using psql**

```bash
psql -h localhost -U ruin -c "CREATE DATABASE ruin;"
psql -h localhost -U ruin -c "CREATE DATABASE ruin_test;"
```

### 6. Run database migrations

```bash
pnpm db:migrate
```

This applies all pending migrations to the development database. Migrations run automatically on server startup as well.

### 7. Start development servers

```bash
pnpm dev
```

This starts:
- **Server** (Colyseus + Express) on port `2567`
- **Client** (Vite dev server) on port `3009`

### 8. Open the game

Navigate to [http://localhost:3009](http://localhost:3009) in your browser.

You'll see a green 10x10 tilemap. The connection will fail with "Connection failed — see console for details" because there's no login UI yet. This is expected for Phase 0b.

---

## 📁 Project Structure

```
ruin/
├── packages/
│   ├── shared/          # Shared TypeScript types and constants
│   ├── server/          # Colyseus game server + Express API
│   └── client/          # Phaser 3 browser client
├── docker-compose.yml   # Docker services (Postgres + optional server)
├── Dockerfile.server    # Multi-stage build for server deployment
└── .env.example         # Environment variable template
```

### Package Responsibilities

#### `@ruin/shared`
TypeScript types and constants shared between client and server. **No runtime code** — only type definitions and constant values. No dependencies.

**Example exports:**
- `IPlayer`, `IWorldSave`, `INpc` (TypeScript interfaces)
- `TICK_RATE`, `MAX_PARTY_SIZE`, `TILE_SIZE` (constants)

#### `@ruin/server`
Authoritative game server. **All game logic runs here**. The server validates inputs, simulates the world, and sends state updates to clients.

**Includes:**
- Colyseus WorldRoom (multiplayer room logic)
- Express API (authentication, registration)
- PostgreSQL persistence layer
- Database migrations
- Structured logging (Pino)

#### `@ruin/client`
Phaser 3 browser client. **Dumb renderer and input sender**. The client displays the game world and sends player inputs to the server, but contains no game logic.

**Includes:**
- Phaser scenes (BootScene, WorldScene)
- Colyseus client SDK integration
- Network client wrapper

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start server (port 2567) and client (port 3009) concurrently |
| `pnpm build` | Build `@ruin/shared` and `@ruin/server` (production) |
| `pnpm test` | Run all tests (requires Postgres with `ruin_test` database) |
| `pnpm db:migrate` | Run database migrations on development database |
| `pnpm lint` | Lint all packages with ESLint |
| `pnpm format` | Format all files with Prettier |
| `pnpm -F @ruin/client build` | Build client for production (static files) |
| `pnpm -F @ruin/server dev` | Start only the server (useful for debugging) |
| `pnpm -F @ruin/client dev` | Start only the client (useful for debugging) |

**Note:** `pnpm build` does NOT build the client. The client is built separately for production deployment using `pnpm -F @ruin/client build`, which generates static files for hosting.

---

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment (`development`, `production`) | `development` |
| `PORT` | Server port | `2567` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ruin:ruin@localhost:5432/ruin` |
| `JWT_SECRET` | Secret for signing JWT tokens | `change-me-in-production` |
| `LOG_LEVEL` | Logging level (`debug`, `info`, `warn`, `error`) | `info` |
| `ADMIN_PASSWORD` | Password for Colyseus monitoring dashboard (dev-only) | `admin` |

**⚠️ Security Warning:** Change `JWT_SECRET` and `ADMIN_PASSWORD` before deploying to production!

---

## 🐳 Docker

### Development (PostgreSQL only)

For local development, run only the PostgreSQL service:

```bash
docker compose up postgres -d
```

Then run the server and client directly with `pnpm dev`.

### Full Stack (Server + PostgreSQL)

To test the full containerized deployment:

```bash
docker compose up
```

This starts:
- **postgres** service on port `5432`
- **server** service on port `2567`

The server container:
- Builds the server from source using a multi-stage Dockerfile
- Connects to the `postgres` service
- Runs migrations automatically on startup
- Serves the Colyseus game server and Express API

**Note:** The client is not containerized. For production, build the client (`pnpm -F @ruin/client build`) and serve the static files from `packages/client/dist/` using a CDN, Nginx, or static hosting service.

---

## 🏗️ Architecture Notes

### Server Authority

The server is **authoritative** — all game logic and simulation run server-side. Clients send inputs (e.g., movement commands), and the server validates, simulates, and broadcasts state updates.

**Client responsibilities:**
- Render the current game state
- Send input commands to the server
- Interpolate/smooth visual updates

**Server responsibilities:**
- Validate all client inputs
- Simulate game world (movement, combat, NPCs, etc.)
- Persist game state to database
- Broadcast state updates to clients

### Colyseus Rooms

Each `WorldRoom` corresponds to a **single persistent world save**, not a lobby or match. This distinction is important for future persistence logic:

- A world save is owned by a specific player (the "host")
- The world persists across sessions
- When all players leave, the room is disposed, but the world save remains in the database
- When the host rejoins, a new WorldRoom is created and loads the saved world state

### Shared Package

The `@ruin/shared` package contains **no runtime code** — only TypeScript type definitions and constants. This keeps the shared package lightweight and ensures types are consistent across client and server.

### Database Schema

The database includes tables for future systems (NPCs, game events, crafting recipes) even though they're currently unused. This is intentional — the schema is designed for the full game architecture, not just Phase 0.

**Current tables:**
- `accounts` — User accounts (email, password hash)
- `world_saves` — Persistent world instances
- `characters` — Player characters (linked to accounts)
- `npcs` — Non-player characters (future use)
- `game_events` — World events and quests (future use)

---

## 🧪 Running Tests

### Prerequisites

1. PostgreSQL must be running
2. Test database `ruin_test` must exist (see [Getting Started](#-getting-started))

### Run Tests

```bash
pnpm test
```

**Expected output:**
```
Test Files  2 passed (2)
     Tests  11 passed (11)
```

**Test breakdown:**
- `auth.test.ts` — 7 integration tests for authentication (register, login, validation)
- `schema.test.ts` — 4 unit tests for Colyseus state schemas

### Troubleshooting

#### bcrypt native module errors

If tests fail with `Cannot find module 'bcrypt_lib.node'`, rebuild the bcrypt native module:

```bash
pnpm rebuild bcrypt
```

#### Database connection errors

Ensure PostgreSQL is running and the `ruin_test` database exists:

```bash
docker compose up postgres -d
createdb -h localhost -U ruin ruin_test
```

---

## 📝 Development Workflow

### Typical workflow for local development:

1. Start Docker Compose PostgreSQL: `docker compose up postgres -d`
2. Start dev servers: `pnpm dev`
3. Make changes to code (client or server)
4. Server auto-restarts on changes (via `tsx watch`)
5. Client hot-reloads on changes (via Vite HMR)
6. Run tests: `pnpm test`
7. Lint and format: `pnpm lint && pnpm format`

### Adding a new migration

1. Create a new `.sql` file in `packages/server/src/db/migrations/`
2. Name it with an incrementing number (e.g., `002_add_items_table.sql`)
3. Add `-- UP` and `-- DOWN` sections:

```sql
-- UP
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ...
);

-- DOWN
DROP TABLE items;
```

4. Run migrations: `pnpm db:migrate`

---

## 📦 Deployment

### Server Deployment

1. Build the Docker image:

```bash
docker build -f Dockerfile.server -t ruin-server .
```

2. Run the container with environment variables:

```bash
docker run -p 2567:2567 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/ruin" \
  -e JWT_SECRET="your-secure-secret" \
  -e NODE_ENV="production" \
  ruin-server
```

Or use `docker compose up` for full stack deployment.

### Client Deployment

1. Build the client:

```bash
pnpm -F @ruin/client build
```

2. Deploy static files from `packages/client/dist/` to:
   - CDN (Cloudflare, AWS CloudFront)
   - Static hosting (Vercel, Netlify, GitHub Pages)
   - Nginx or Apache

**Example Nginx config:**

```nginx
server {
  listen 80;
  server_name yourdomain.com;
  root /var/www/ruin/client/dist;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 🤝 Contributing

This project is in early development. Contributions are welcome once core systems stabilize.

---

## 📄 License

[Your license here]

---

## 🔗 Links

- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [Colyseus Documentation](https://docs.colyseus.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
