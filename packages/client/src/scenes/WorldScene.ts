/**
 * WorldScene - Main gameplay scene.
 * Handles world rendering, network connection, and player state synchronization.
 */

import Phaser from 'phaser';
import type { Room } from 'colyseus.js';
import { networkClient } from '../network/client';

/**
 * Player colors by join order (index 0-7).
 */
const PLAYER_COLORS = [
  0x3498db, // Blue
  0xe74c3c, // Red
  0x2ecc71, // Green
  0xf39c12, // Orange
  0x9b59b6, // Purple
  0x9b59b6, // Purple
  0x9b59b6, // Purple
  0x9b59b6, // Purple
];

export class WorldScene extends Phaser.Scene {
  /** Map of player session IDs to their sprite game objects */
  private playerSprites = new Map<string, Phaser.GameObjects.Rectangle>();

  /** Reference to the current Colyseus room (if connected) */
  private room: Room | null = null;

  constructor() {
    super({ key: 'World' });
  }

  /**
   * Create phase - set up the world and attempt network connection.
   */
  async create(): Promise<void> {
    // Recreate the tilemap (same as BootScene)
    this.createTilemap();

    // Attempt to connect to the game server
    await this.connectToServer();
  }

  /**
   * Recreates the 10x10 grass tilemap.
   */
  private createTilemap(): void {
    // Create tilemap data programmatically
    const mapData: number[][] = [];
    for (let y = 0; y < 10; y++) {
      const row: number[] = [];
      for (let x = 0; x < 10; x++) {
        row.push(0); // Tile index 0 = grass
      }
      mapData.push(row);
    }

    // Create tilemap from data
    const map = this.make.tilemap({
      data: mapData,
      tileWidth: 16,
      tileHeight: 16,
    });

    // Add the tileset using our generated texture
    const tileset = map.addTilesetImage('tiles', 'tiles');

    if (!tileset) {
      console.error('Failed to create tileset');
      return;
    }

    // Create layer from tileset
    map.createLayer(0, tileset, 0, 0);
  }

  /**
   * Attempts to connect to the Colyseus game server.
   * Uses a placeholder token that will fail authentication (expected for Phase 0b).
   */
  private async connectToServer(): Promise<void> {
    try {
      // Attempt to join with placeholder credentials
      // This WILL fail because the token is invalid - that is expected for this phase
      this.room = await networkClient.joinWorld(
        'DEV_TOKEN_PLACEHOLDER',
        'test-world',
      );

      // If connection succeeds (future phases with real auth), set up state listeners
      this.setupRoomListeners();
    } catch (error) {
      // Connection failed - display error message
      console.error('Failed to connect to game server:', error);

      this.add
        .text(400, 300, 'Connection failed — see console for details', {
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    }
  }

  /**
   * Sets up listeners for room state changes.
   * Handles player add/remove/update events.
   */
  private setupRoomListeners(): void {
    if (!this.room) return;

    // Listen for players being added to the room
    this.room.state.players.onAdd((player, sessionId) => {
      console.log('Player joined:', sessionId, player.name);

      // Determine player color by join order (index in the map)
      const playerIndex = Array.from(this.room!.state.players.keys()).indexOf(
        sessionId,
      );
      const color = PLAYER_COLORS[playerIndex] ?? PLAYER_COLORS[4]; // Default to purple

      // Create player sprite (16x16 colored rectangle)
      const sprite = this.add.rectangle(
        player.x * 16, // Convert tile coordinates to pixels
        player.y * 16,
        16,
        16,
        color,
      );

      // Store sprite reference
      this.playerSprites.set(sessionId, sprite);

      // Listen for position changes on this player
      player.onChange(() => {
        sprite.setPosition(player.x * 16, player.y * 16);
      });
    });

    // Listen for players being removed from the room
    this.room.state.players.onRemove((player, sessionId) => {
      console.log('Player left:', sessionId);

      // Destroy sprite and remove from map
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) {
        sprite.destroy();
        this.playerSprites.delete(sessionId);
      }
    });
  }
}
