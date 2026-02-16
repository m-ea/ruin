You are continuing work on "Ruin" — a 2D cooperative multiplayer browser-based RPG. The project is divided into phases, with each phase found below. Reference STATUS_REPORT markdown files in this repository to understand what steps have been completed so far. README.md and LESSONS_LEARNED.md contain important context. The development plan for Ruin is as follows:

## Phase 0 — Foundation (done)

Project scaffolding: monorepo structure, build pipeline, linting, test harness
Colyseus server with room lifecycle (create, join, leave, dispose)
Postgres schema: accounts, characters, world_saves
Auth flow (simple — email/password or OAuth, just enough to tie accounts to world saves)
Logging & observability stack (Pino, Sentry, correlation IDs, Colyseus monitor)
Phaser client shell: loads a tilemap, connects to Colyseus, renders a sprite

## Phase 1 — Networked Movement (the hard milestone)

Server-side movement simulation at fixed tick rate
Client input sending, server validation, state broadcast
Client-side prediction + reconciliation
Client-side interpolation for remote players
Tile-based collision (server-authoritative)
8-player room stress test

## Phase 2 — World Persistence & Hosting Model

World save/load to Postgres (host account linkage)
Room rehydration on host reconnect
Guest join/leave flow
Graceful shutdown + auto-save on host disconnect

## Phase 3 — Core Character Systems

Character stats, body-part health model
Skill system (XP-on-use, leveling curves)
Inventory & equipment
Persistence of character state to Postgres

## Phase 4 — Combat MVP

Basic melee + ranged attack system (real-time, server-authoritative)
Hit detection mapped to body parts
Injury system (wounds, bleeding, broken limbs)
Monster entities with simple AI (aggro, attack, patrol)
Death/KO and respawn logic
Party-size difficulty scaling

## Phase 5 — NPC & World Systems

NPC state machines (schedules, dialogue triggers)
Social relationship graph (opinion values, events that shift them)
Branching dialogue system with skill/reputation checks
Town zone: shops, quest givers, ambient NPCs

## Phase 6 — Crafting & Alchemy

Recipe system (component + tool requirements, skill-gated)
Resource nodes (gathering tied to skills)
Alchemy experimentation mechanic
Crafting stations (shared for coop interaction)

## Phase 7 — MVP Dungeon & Polish

Dungeon zone with encounters, loot, and a boss
Fog of war / exploration reveal
Chat system (proximity + party channels)
Balancing pass using event audit logs
Bug fixing, performance profiling