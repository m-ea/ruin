/**
 * NetworkClient - Manages connection to the Colyseus game server.
 * Provides methods to join/leave rooms and maintain connection state.
 */

import * as Colyseus from 'colyseus.js';
import { type InputMessage, MessageType } from '@ruin/shared';

/**
 * NetworkClient handles all Colyseus server communication.
 * Singleton instance is exported for use across the application.
 */
export class NetworkClient {
  /** Colyseus client instance */
  private client: Colyseus.Client;

  /** Current room connection (null if not connected) */
  private room: Colyseus.Room | null = null;

  /** Simulated one-way latency in ms (0 = disabled). Used for testing prediction/reconciliation. */
  private simulatedLatencyMs: number = 0;

  constructor() {
    // Initialize Colyseus client with server URL from environment or default
    const serverUrl =
      import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';
    this.client = new Colyseus.Client(serverUrl);
  }

  /**
   * Joins or creates a world room with the given credentials.
   *
   * @param token - JWT authentication token
   * @param worldSaveId - World save identifier
   * @returns Promise resolving to the joined room
   */
  async joinWorld(token: string, worldSaveId: string): Promise<Colyseus.Room> {
    this.room = await this.client.joinOrCreate('world', {
      token,
      worldSaveId,
    });

    return this.room;
  }

  /**
   * Sends a player input message to the server.
   * Silently ignores if not connected to a room.
   * If simulated latency is set, the send is delayed by that amount.
   */
  sendInput(input: InputMessage): void {
    if (!this.room) return;
    if (this.simulatedLatencyMs > 0) {
      setTimeout(() => {
        // Guard against room disconnect during latency delay
        if (this.room) {
          this.room.send(MessageType.INPUT, input);
        }
      }, this.simulatedLatencyMs);
    } else {
      this.room.send(MessageType.INPUT, input);
    }
  }

  /**
   * Set simulated latency in milliseconds.
   * When > 0, outgoing input messages are delayed by this amount and incoming
   * reconciliation triggers in WorldScene are also delayed by this amount.
   *
   * Note: This does NOT delay remote player interpolation updates — only local
   * prediction/reconciliation is affected. This is a pragmatic approximation
   * for testing, not a full network simulation.
   *
   * Set to 0 to disable.
   */
  setSimulatedLatency(ms: number): void {
    this.simulatedLatencyMs = ms;
  }

  getSimulatedLatency(): number {
    return this.simulatedLatencyMs;
  }

  /**
   * Leaves the current room if connected.
   */
  async leave(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }
  }

  /**
   * Gets the current room connection.
   *
   * @returns Current room or null if not connected
   */
  getRoom(): Colyseus.Room | null {
    return this.room;
  }

  // Temporary auto-register for development. Will be replaced with login UI.
  /**
   * Registers a new account with a random email/password.
   * Retries on 409 (email conflict) up to 3 total attempts.
   *
   * @returns Promise resolving to token and accountId
   */
  static async autoRegister(): Promise<{ token: string; accountId: string }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const email = `player_${Math.random().toString(36).slice(2, 10)}@ruin.local`;
      const password = Math.random().toString(36).slice(2, 14);

      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.status === 409) continue;

      if (response.status !== 201) {
        const body = await response.text();
        throw new Error(`Registration failed (${response.status}): ${body}`);
      }

      const data = (await response.json()) as { token: string; accountId: string };
      return data;
    }

    throw new Error('Registration failed after 3 attempts (email conflicts)');
  }
}

/**
 * Singleton NetworkClient instance.
 * Use this instance throughout the application for server communication.
 */
export const networkClient = new NetworkClient();

// Debug only — expose NetworkClient for console access.
// Allows: window.__networkClient.setSimulatedLatency(200)
// Remove or gate behind NODE_ENV for production.
if (typeof window !== 'undefined') {
  (window as any).__networkClient = networkClient;
}
