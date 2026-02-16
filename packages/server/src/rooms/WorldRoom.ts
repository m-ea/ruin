/**
 * WorldRoom - Colyseus room representing a persistent world instance.
 * Each WorldRoom corresponds to a single persistent world save, not a lobby or match.
 * This distinction matters for future persistence logic.
 */

import { Room, Client } from '@colyseus/core';
import type { Logger } from 'pino';
import {
  type InputMessage,
  isValidDirection,
  MessageType,
  processPlayerInput,
  TICK_RATE,
  TOWN_MAP,
} from '@ruin/shared';
import { WorldState, PlayerState } from './schemas/WorldState.js';
import { verifyToken } from '../auth/jwt.js';
import { logger } from '../logging/logger.js';

/**
 * Options provided when a WorldRoom is created.
 */
interface WorldRoomOptions {
  /** UUID of the world save this room represents */
  worldSaveId: string;

  /** Account ID of the player who owns/hosts this world save */
  hostAccountId: string;
}

/**
 * Options provided when a client attempts to join the room.
 */
interface ClientJoinOptions {
  /** JWT authentication token */
  token: string;

  /** World save ID (optional - validated against room's worldSaveId) */
  worldSaveId?: string;
}

/**
 * WorldRoom manages a single persistent world instance with up to 8 concurrent players.
 * Handles player join/leave, authentication, tick-based input processing,
 * and state synchronization.
 */
export class WorldRoom extends Room<WorldState> {
  /** Maximum number of concurrent clients */
  maxClients = 8;

  /** UUID of the world save this room represents */
  private worldSaveId!: string;

  /** Account ID of the world save owner */
  private hostAccountId!: string;

  /** Room-scoped logger with context */
  private roomLogger!: Logger;

  /** Counter for join order - used by client for player color assignment */
  private joinCounter = 0;

  /** Input queues keyed by sessionId — inputs received between ticks are queued here */
  private inputQueues: Map<string, InputMessage[]> = new Map();

  /**
   * Called when the room is created.
   * Initializes state, registers message handlers, and starts the tick loop.
   */
  onCreate(options: WorldRoomOptions): void {
    // Initialize synchronized state
    this.setState(new WorldState());

    // Store room metadata
    this.worldSaveId = options.worldSaveId;
    this.hostAccountId = options.hostAccountId;

    // Create room-scoped logger
    this.roomLogger = logger.child({
      roomId: this.roomId,
      worldSaveId: this.worldSaveId,
      hostAccountId: this.hostAccountId,
    });

    // Register input message handler
    this.onMessage(MessageType.INPUT, (client, message: unknown) => {
      this.handleInput(client, message);
    });

    // Start the server tick loop at 20Hz (50ms per tick)
    this.setSimulationInterval(() => this.tick(), 1000 / TICK_RATE);

    this.roomLogger.info('WorldRoom created (tick loop started at %dHz)', TICK_RATE);
  }

  /**
   * Validates and queues an input message from a client.
   */
  private handleInput(client: Client, message: unknown): void {
    // Validate message shape
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

    // Verify player exists in state
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    // Reject stale or duplicate inputs
    if (input.sequenceNumber <= player.lastProcessedSequenceNumber) {
      this.roomLogger.debug(
        { sessionId: client.sessionId, seq: input.sequenceNumber },
        'Stale input rejected',
      );
      return;
    }

    // Queue the validated input for processing on the next tick
    const queue = this.inputQueues.get(client.sessionId);
    if (queue) {
      queue.push(input);
      // TODO: In a future phase, add server-side queue cap (e.g., 10 entries)
      // to prevent abuse from malicious clients flooding inputs at high frequency
    }
  }

  /**
   * Server tick — processes one queued input per player per tick.
   *
   * Colyseus automatically broadcasts state patches after this callback completes.
   * The queue drains naturally at one input per tick per player (20Hz).
   */
  private tick(): void {
    this.state.players.forEach((player, sessionId) => {
      const queue = this.inputQueues.get(sessionId);
      if (!queue || queue.length === 0) {
        return;
      }

      // Process the oldest input (one per tick per player)
      const input = queue.shift()!;
      const result = processPlayerInput(TOWN_MAP, player.x, player.y, input.direction);

      // Update position (may be unchanged if move was blocked)
      player.x = result.x;
      player.y = result.y;

      // ALWAYS update sequence number, even on blocked moves.
      // This is critical for client-side reconciliation.
      player.lastProcessedSequenceNumber = input.sequenceNumber;
    });
  }

  /**
   * Called when a client attempts to join the room.
   * Verifies JWT authentication and adds player to state.
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
      // Token verification failed - log and reject the client
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.roomLogger.warn(
        { sessionId: client.sessionId, error: errorMessage },
        'Client join rejected - invalid token',
      );
      client.leave(4001); // Close code 4001 = authentication failed
      return;
    }

    // Increment join counter for this client
    this.joinCounter++;

    // Create session-scoped logger
    const sessionLogger = this.roomLogger.child({
      sessionId: client.sessionId,
      accountId,
      joinCounter: this.joinCounter,
    });

    // Initialize input queue for this player
    this.inputQueues.set(client.sessionId, []);

    // Create and add PlayerState to synchronized state
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.name = email; // Temporary - proper character names come in Phase 2
    player.x = TOWN_MAP.spawnX;
    player.y = TOWN_MAP.spawnY;

    this.state.players.set(client.sessionId, player);

    sessionLogger.info('Client joined room at spawn (%d, %d)', TOWN_MAP.spawnX, TOWN_MAP.spawnY);
  }

  /**
   * Called when a client leaves the room.
   * Removes player from synchronized state and cleans up input queue.
   */
  onLeave(client: Client, consented: boolean): void {
    // Clean up input queue to prevent memory leaks
    this.inputQueues.delete(client.sessionId);

    // Remove player from state
    this.state.players.delete(client.sessionId);

    this.roomLogger.info(
      { sessionId: client.sessionId, consented },
      'Client left room',
    );
  }

  /**
   * Called when the room is disposed (no more clients and room is being destroyed).
   * Future phases will implement persistence logic here.
   */
  onDispose(): void {
    this.roomLogger.info('WorldRoom disposed');
    // TODO Phase 2: Persist world state to database
  }
}
