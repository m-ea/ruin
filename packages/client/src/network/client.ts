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
   * @param characterName - Optional character name for first-time creation
   * @returns Promise resolving to the joined room
   */
  async joinWorld(
    token: string,
    worldSaveId: string,
    characterName?: string,
  ): Promise<Colyseus.Room> {
    this.room = await this.client.joinOrCreate('world', {
      token,
      worldSaveId,
      characterName,
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

  /**
   * Registers or re-logs in an account, with localStorage credential persistence.
   *
   * On first run: registers a new random account and saves credentials to localStorage.
   * On subsequent runs: attempts login with stored credentials; re-registers if they fail.
   *
   * @returns Promise resolving to token and accountId
   */
  static async autoRegister(): Promise<{ token: string; accountId: string }> {
    // Check localStorage for existing credentials
    const stored = localStorage.getItem('ruin_credentials');
    if (stored) {
      try {
        const { email, password } = JSON.parse(stored) as { email: string; password: string };
        const loginResponse = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (loginResponse.ok) {
          return await loginResponse.json() as { token: string; accountId: string };
        }
        // Login failed — stored credentials are invalid, fall through to register
        localStorage.removeItem('ruin_credentials');
      } catch {
        localStorage.removeItem('ruin_credentials');
      }
    }

    // Register new account (retry on email conflicts)
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

      // Save credentials to localStorage for next session
      localStorage.setItem('ruin_credentials', JSON.stringify({ email, password }));

      return data;
    }

    throw new Error('Registration failed after 3 attempts');
  }

  /**
   * Creates a new world save.
   */
  static async createWorld(
    token: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const response = await fetch('/worlds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(`Create world failed: ${response.status}`);
    const data = (await response.json()) as { world: { id: string; name: string } };
    return data.world;
  }

  /**
   * Lists all world saves owned by the authenticated user.
   */
  static async listWorlds(
    token: string,
  ): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
    const response = await fetch('/worlds', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`List worlds failed: ${response.status}`);
    const data = (await response.json()) as {
      worlds: Array<{ id: string; name: string; updatedAt: string }>;
    };
    return data.worlds;
  }

  /**
   * Deletes a world save (owner only).
   */
  static async deleteWorld(token: string, worldId: string): Promise<void> {
    const response = await fetch(`/worlds/${worldId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Delete world failed: ${response.status}`);
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
