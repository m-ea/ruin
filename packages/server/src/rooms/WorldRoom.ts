/**
 * WorldRoom - Colyseus room representing a persistent world instance.
 * Each WorldRoom corresponds to a single persistent world save, not a lobby or match.
 */

import { Room, Client } from '@colyseus/core';
import type { Logger } from 'pino';
import {
  type InputMessage,
  DEFAULT_WORLD_DATA,
  isValidDirection,
  MessageType,
  processPlayerInput,
  TICK_RATE,
  TOWN_MAP,
} from '@ruin/shared';
import { WorldState, PlayerState } from './schemas/WorldState.js';
import { verifyToken } from '../auth/jwt.js';
import { logger } from '../logging/logger.js';
import { pool } from '../db/pool.js';
import {
  getWorld,
  getCharacter,
  createCharacter,
  saveAll,
  type CharacterSaveData,
} from '../persistence/WorldPersistence.js';

/**
 * Options provided when a WorldRoom is created.
 * hostAccountId is NOT accepted from the client — it is loaded from the DB.
 */
interface WorldRoomOptions {
  /** UUID of the world save this room represents */
  worldSaveId: string;
}

/**
 * Options provided when a client attempts to join the room.
 */
interface ClientJoinOptions {
  /** JWT authentication token */
  token: string;

  /** World save ID (optional - validated against room's worldSaveId) */
  worldSaveId?: string;

  /** Character name for first-time character creation. Falls back to email if empty. */
  characterName?: string;
}

/**
 * WorldRoom manages a single persistent world instance with up to 8 concurrent players.
 * Handles player join/leave, authentication, tick-based input processing,
 * state synchronization, and character persistence.
 */
export class WorldRoom extends Room<WorldState> {
  /** Maximum number of concurrent clients */
  maxClients = 8;

  /** UUID of the world save this room represents */
  private worldSaveId!: string;

  /** Account ID of the world save owner (loaded from DB in onCreate) */
  private hostAccountId!: string;

  /** Room-scoped logger with context */
  private roomLogger!: Logger;

  /** Counter for join order - used by client for player color assignment */
  private joinCounter = 0;

  /** Input queues keyed by sessionId — inputs received between ticks are queued here */
  private inputQueues: Map<string, InputMessage[]> = new Map();

  /** Maps sessionId → accountId for auto-save and ownership checks */
  private accountIdBySession: Map<string, string> = new Map();

  /** Maps sessionId → character DB row ID for auto-save */
  private characterIdBySession: Map<string, string> = new Map();

  /** Auto-save interval handle */
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;

  /** Overlap protection: true while a save is in progress */
  private saving: boolean = false;

  /**
   * Called when the room is created.
   * Loads world from DB, initializes state, registers handlers, and starts tick loop.
   * Throws if world not found — causes client's joinOrCreate to reject.
   */
  async onCreate(options: WorldRoomOptions): Promise<void> {
    // Initialize synchronized state
    this.setState(new WorldState());

    // Store room metadata
    this.worldSaveId = options.worldSaveId;

    // Create room-scoped logger
    this.roomLogger = logger.child({
      roomId: this.roomId,
      worldSaveId: this.worldSaveId,
    });

    // Load world from DB — ownership comes from DB, never from client options
    const world = await getWorld(pool, this.worldSaveId);
    if (!world) {
      this.roomLogger.error('World not found in database: %s', this.worldSaveId);
      // Throw to reject room creation. Do NOT use this.disconnect() — no clients exist yet.
      throw new Error(`World not found: ${this.worldSaveId}`);
    }

    // Store owner from DB (not from client-supplied options)
    this.hostAccountId = world.owner_id;

    this.roomLogger.info(
      'WorldRoom loaded world from database (owner: %s)',
      this.hostAccountId,
    );

    // Register input message handler
    this.onMessage(MessageType.INPUT, (client, message: unknown) => {
      this.handleInput(client, message);
    });

    // Start the server tick loop at 20Hz (50ms per tick)
    this.setSimulationInterval(() => this.tick(), 1000 / TICK_RATE);

    // Start auto-save every 60 seconds
    this.autoSaveInterval = setInterval(() => {
      void this.autoSave();
    }, 60_000);

    this.roomLogger.info('WorldRoom created (tick loop started at %dHz)', TICK_RATE);
  }

  /**
   * Validates and queues an input message from a client.
   */
  private handleInput(client: Client, message: unknown): void {
    const msg = message as Record<string, unknown>;
    if (
      typeof msg?.sequenceNumber !== 'number' ||
      !isValidDirection(msg?.direction)
    ) {
      this.roomLogger.warn(
        { sessionId: client.sessionId, message },
        'Invalid input message - bad shape',
      );
      return;
    }

    const input: InputMessage = {
      sequenceNumber: msg.sequenceNumber,
      direction: msg.direction,
    };

    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    if (input.sequenceNumber <= player.lastProcessedSequenceNumber) {
      this.roomLogger.debug(
        { sessionId: client.sessionId, seq: input.sequenceNumber },
        'Stale input rejected',
      );
      return;
    }

    const queue = this.inputQueues.get(client.sessionId);
    if (queue) {
      queue.push(input);
      // TODO: Phase 2+ — add server-side queue cap to prevent input flooding
    }
  }

  /**
   * Server tick — processes one queued input per player per tick.
   * Colyseus automatically broadcasts state patches after this callback completes.
   */
  private tick(): void {
    this.state.players.forEach((player, sessionId) => {
      const queue = this.inputQueues.get(sessionId);
      if (!queue || queue.length === 0) {
        return;
      }

      const input = queue.shift()!;
      const result = processPlayerInput(TOWN_MAP, player.x, player.y, input.direction);

      player.x = result.x;
      player.y = result.y;

      // ALWAYS update sequence number, even on blocked moves (critical for reconciliation).
      player.lastProcessedSequenceNumber = input.sequenceNumber;
    });
  }

  /**
   * Called when a client attempts to join the room.
   * Verifies JWT, checks ownership for first joiner, restores or creates character.
   */
  async onJoin(client: Client, options: ClientJoinOptions): Promise<void> {
    // Verify JWT token
    let accountId: string;
    let email: string;

    try {
      const decoded = verifyToken(options.token);
      accountId = decoded.sub;
      email = decoded.email;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.roomLogger.warn(
        { sessionId: client.sessionId, error: errorMessage },
        'Client join rejected - invalid token',
      );
      client.leave(4001); // 4001 = authentication failed
      return;
    }

    // First-joiner ownership check — only the world owner can open (create) the room
    if (this.state.players.size === 0 && accountId !== this.hostAccountId) {
      this.roomLogger.warn(
        { sessionId: client.sessionId, accountId },
        'Non-owner attempted to create room for world %s (owner: %s)',
        this.worldSaveId,
        this.hostAccountId,
      );
      client.leave(4002); // 4002 = not the world owner
      return;
    }

    // Increment join counter for this client
    this.joinCounter++;

    const sessionLogger = this.roomLogger.child({
      sessionId: client.sessionId,
      accountId,
      joinCounter: this.joinCounter,
    });

    // Store accountId mapping for auto-save
    this.accountIdBySession.set(client.sessionId, accountId);

    // Look up existing character or create a new one
    const character = await getCharacter(pool, accountId, this.worldSaveId);

    // Build PlayerState BEFORE adding to synced state so position is correct on first sync
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.accountId = accountId;

    if (character) {
      // Restore existing character
      player.x = character.position_x;
      player.y = character.position_y;
      player.name = character.name;
      this.characterIdBySession.set(client.sessionId, character.id);
      sessionLogger.info(
        'Restored character "%s" at (%d, %d)',
        character.name,
        character.position_x,
        character.position_y,
      );
    } else {
      // Create new character — use provided name, fall back to email if empty/missing
      const characterName =
        options.characterName && options.characterName.trim().length > 0
          ? options.characterName.trim()
          : email;
      const newChar = await createCharacter(
        pool,
        accountId,
        this.worldSaveId,
        characterName,
        TOWN_MAP.spawnX,
        TOWN_MAP.spawnY,
      );
      player.x = TOWN_MAP.spawnX;
      player.y = TOWN_MAP.spawnY;
      player.name = newChar.name;
      this.characterIdBySession.set(client.sessionId, newChar.id);
      sessionLogger.info(
        'Created new character "%s" at spawn (%d, %d)',
        newChar.name,
        TOWN_MAP.spawnX,
        TOWN_MAP.spawnY,
      );
    }

    // Initialize input queue
    this.inputQueues.set(client.sessionId, []);

    // Add to synced state AFTER position/name/accountId are set
    this.state.players.set(client.sessionId, player);
  }

  /**
   * Called when a client leaves the room.
   * Fire-and-forget save for this player's position.
   * Colyseus does not guarantee async onLeave blocks the removal lifecycle.
   */
  onLeave(client: Client, consented: boolean): void {
    const charId = this.characterIdBySession.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);

    if (charId && player) {
      void saveAll(pool, this.worldSaveId, DEFAULT_WORLD_DATA, [
        { characterId: charId, x: player.x, y: player.y },
      ]).catch((err) => {
        this.roomLogger.error({ err }, 'Failed to save character on leave');
      });
    }

    // Clean up session maps
    this.accountIdBySession.delete(client.sessionId);
    this.characterIdBySession.delete(client.sessionId);
    this.inputQueues.delete(client.sessionId);

    // Remove from synced state
    this.state.players.delete(client.sessionId);

    this.roomLogger.info({ sessionId: client.sessionId, consented }, 'Client left room');
  }

  /**
   * Auto-save: persist all character positions. Runs every 60 seconds.
   * Uses saving flag to prevent overlap with dispose save.
   */
  private async autoSave(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      const characters: CharacterSaveData[] = [];
      for (const [sessionId, player] of this.state.players.entries()) {
        const charId = this.characterIdBySession.get(sessionId);
        if (charId) {
          characters.push({ characterId: charId, x: player.x, y: player.y });
        }
      }
      await saveAll(pool, this.worldSaveId, DEFAULT_WORLD_DATA, characters);
      this.roomLogger.debug('Auto-saved %d characters', characters.length);
    } catch (err) {
      this.roomLogger.error({ err }, 'Auto-save failed');
    } finally {
      this.saving = false;
    }
  }

  /**
   * Called when the room is disposed (all clients gone, room being destroyed).
   * Clears auto-save interval and performs a final save of all character positions.
   */
  async onDispose(): Promise<void> {
    // Clear auto-save interval before final save
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    if (this.saving) {
      this.roomLogger.warn('Dispose while auto-save in progress — skipping final save');
    } else {
      this.saving = true;
      try {
        const characters: CharacterSaveData[] = [];
        for (const [sessionId, player] of this.state.players.entries()) {
          const charId = this.characterIdBySession.get(sessionId);
          if (charId) {
            characters.push({ characterId: charId, x: player.x, y: player.y });
          }
        }
        await saveAll(pool, this.worldSaveId, DEFAULT_WORLD_DATA, characters);
        this.roomLogger.info('Final save on dispose (%d characters)', characters.length);
      } catch (err) {
        this.roomLogger.error({ err }, 'Final save on dispose failed');
      } finally {
        this.saving = false;
      }
    }

    this.roomLogger.info('WorldRoom disposed');
  }
}
