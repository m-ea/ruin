-- ============================================================
-- This schema is intentionally created in Phase 0 to establish
-- the long-term simulation and persistence model for Ruin.
-- Tables may be unused until later phases. Do not remove them.
-- ============================================================

-- UP

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE world_saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    seed BIGINT NOT NULL,
    world_data JSONB NOT NULL DEFAULT '{}',
    last_simulated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_world_saves_owner ON world_saves(owner_id);

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES world_saves(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    stats JSONB NOT NULL DEFAULT '{}',
    skills JSONB NOT NULL DEFAULT '{}',
    inventory JSONB NOT NULL DEFAULT '[]',
    equipment JSONB NOT NULL DEFAULT '{}',
    body_health JSONB NOT NULL DEFAULT '{}',
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, world_id)
);

CREATE INDEX idx_characters_account ON characters(account_id);
CREATE INDEX idx_characters_world ON characters(world_id);

CREATE TABLE npcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES world_saves(id) ON DELETE CASCADE,
    npc_type VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    state JSONB NOT NULL DEFAULT '{}',
    goals JSONB NOT NULL DEFAULT '[]',
    inventory JSONB NOT NULL DEFAULT '[]',
    relationships JSONB NOT NULL DEFAULT '{}',
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    last_simulated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_npcs_world ON npcs(world_id);
CREATE INDEX idx_npcs_type ON npcs(world_id, npc_type);

CREATE TABLE game_events (
    id BIGSERIAL PRIMARY KEY,
    world_id UUID NOT NULL REFERENCES world_saves(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    actor_id UUID,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_events_world ON game_events(world_id);
CREATE INDEX idx_game_events_type ON game_events(world_id, event_type);
CREATE INDEX idx_game_events_created ON game_events(created_at);

-- DOWN

DROP TABLE IF EXISTS game_events;
DROP TABLE IF EXISTS npcs;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS world_saves;
DROP TABLE IF EXISTS accounts;
DROP EXTENSION IF EXISTS "pgcrypto";
