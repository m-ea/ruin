/**
 * NetworkClient - Manages connection to the Colyseus game server.
 * Provides methods to join/leave rooms and maintain connection state.
 */

import * as Colyseus from 'colyseus.js';

/**
 * NetworkClient handles all Colyseus server communication.
 * Singleton instance is exported for use across the application.
 */
export class NetworkClient {
  /** Colyseus client instance */
  private client: Colyseus.Client;

  /** Current room connection (null if not connected) */
  private room: Colyseus.Room | null = null;

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
}

/**
 * Singleton NetworkClient instance.
 * Use this instance throughout the application for server communication.
 */
export const networkClient = new NetworkClient();
