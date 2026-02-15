/**
 * WorldRoom - Colyseus room representing a persistent world instance.
 * Each WorldRoom corresponds to a single persistent world save, not a lobby or match.
 * This distinction matters for future persistence logic.
 */

import { Room, Client } from '@colyseus/core';
import type { Logger } from 'pino';
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
 * Handles player join/leave, authentication, and state synchronization.
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

  /**
   * Called when the room is created.
   * Initializes state and stores room metadata.
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

    this.roomLogger.info('WorldRoom created');
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

    // Create and add PlayerState to synchronized state
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.name = email; // Temporary - proper character names come in Phase 2
    player.x = 0;
    player.y = 0;

    this.state.players.set(client.sessionId, player);

    sessionLogger.info('Client joined room');
  }

  /**
   * Called when a client leaves the room.
   * Removes player from synchronized state.
   */
  onLeave(client: Client, consented: boolean): void {
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
