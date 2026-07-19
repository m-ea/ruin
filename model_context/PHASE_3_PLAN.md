# Phase 3 Implementation Plan — Core Character Systems

**Overall Progress:** `0%`

## TLDR
Phase 3 adds the character data model on top of the networked-movement/persistence foundation from Phases 0–2: stats + body-part health, a skill/XP/leveling system, and inventory & equipment. It is split into four sub-phases (3a–3d) so each system lands independently before they're wired together and persisted end-to-end.

## Critical Decisions
- **Sub-phase split mirrors the four CLAUDE.md bullets, in dependency order**: stats/health → skills → inventory/equipment → full persistence integration. Each earlier system is a prerequisite building block for later ones (e.g., skills may reference stats; equipment may modify stats).
- **Build data model + per-column DB read/write together in 3a–3c**, but defer wiring into `WorldRoom`'s join/save lifecycle to 3d. The `characters` table already has `stats`, `skills`, `inventory`, `equipment`, and `body_health` JSONB columns from the Phase 0 migration ([001_initial_schema.sql](packages/server/src/db/migrations/001_initial_schema.sql)) — no new migration is needed, only reading/writing them. Doing the `WorldRoom` integration once in 3d (instead of three times) avoids repeated churn on `onJoin`/`saveAll`.
- **Extend the existing `PlayerState` Colyseus schema** ([WorldState.ts](packages/server/src/rooms/schemas/WorldState.ts)) incrementally in each sub-phase rather than redesigning it — it currently only tracks position/session identity.
- **Extend the existing `CharacterRow`/`IPlayer` shapes** ([WorldPersistence.ts](packages/server/src/persistence/WorldPersistence.ts), [player.ts](packages/shared/src/types/player.ts)) rather than introducing parallel types, since the field names (`stats`, `skills`, `inventory`, `equipment`, `bodyHealth`) already line up with the DB columns.

## Tasks:

- [ ] 🟥 **Step 3a: Character Stats & Body-Part Health Model**
  - [ ] 🟥 Define stat and body-part health types in `@ruin/shared` (replacing the generic `Record<string, number>` placeholders in `IPlayer` where a concrete shape is warranted)
  - [ ] 🟥 Add synced `stats` and `bodyHealth` fields to the `PlayerState` Colyseus schema
  - [ ] 🟥 Update `CharacterRow`, `createCharacter`, and `getCharacter` in `WorldPersistence.ts` to read/write the `stats` and `body_health` JSONB columns
  - [ ] 🟥 Generate default stats and full body-part health on new character creation
  - [ ] 🟥 Unit tests: default stat/health generation, schema sync, DB round-trip for the two columns

- [ ] 🟥 **Step 3b: Skill System (XP-on-use, leveling curves)**
  - [ ] 🟥 Define skill list and leveling-curve function in `@ruin/shared` (XP required per level, level-from-XP lookup)
  - [ ] 🟥 Add synced `skills` field to the `PlayerState` schema
  - [ ] 🟥 Implement a pure `gainSkillXp(skills, skillName, amount)` function handling XP accumulation and level-up (no combat/gameplay hook yet — that lands in Phase 4)
  - [ ] 🟥 Update `CharacterRow`, `createCharacter`, and `getCharacter` to read/write the `skills` JSONB column
  - [ ] 🟥 Unit tests: leveling curve boundaries, XP gain/level-up, DB round-trip for the `skills` column

- [ ] 🟥 **Step 3c: Inventory & Equipment**
  - [ ] 🟥 Define `Item`, inventory slot, and equipment slot types in `@ruin/shared`
  - [ ] 🟥 Add synced `inventory` and `equipment` fields to the `PlayerState` schema
  - [ ] 🟥 Implement pure inventory/equipment functions: add item, remove item, equip item, unequip item (with slot validation)
  - [ ] 🟥 Update `CharacterRow`, `createCharacter`, and `getCharacter` to read/write the `inventory` and `equipment` JSONB columns
  - [ ] 🟥 Unit tests: add/remove item, equip/unequip, invalid slot rejection, DB round-trip for both columns

- [ ] 🟥 **Step 3d: Full Character Persistence & WorldRoom Integration**
  - [ ] 🟥 Extend `saveAll` in `WorldPersistence.ts` to persist stats, skills, inventory, equipment, and body health alongside position
  - [ ] 🟥 Update `WorldRoom.onJoin` to fully hydrate `PlayerState` from the loaded `CharacterRow` (currently only position/name are restored)
  - [ ] 🟥 Verify autosave, `onLeave`, and `onDispose` save paths cover the full character shape, not just position
  - [ ] 🟥 Integration tests: create character → disconnect → reconnect → stats/skills/inventory/equipment/health all restored correctly
  - [ ] 🟥 Update `LESSONS_LEARNED.md` Quick Reference section with the finalized character state shape
