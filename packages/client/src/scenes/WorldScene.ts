/**
 * WorldScene - Main gameplay scene.
 * Handles world rendering, network connection, player input,
 * client-side prediction, and server reconciliation.
 */

import Phaser from 'phaser';
import type { Room } from 'colyseus.js';
import {
  Direction,
  processPlayerInput,
  TOWN_MAP,
  TILE_SIZE,
  TICK_RATE,
  TileType,
} from '@ruin/shared';
import { NetworkClient, networkClient } from '../network/client';
import { InputManager } from '../input/InputManager';
import { PredictionBuffer } from '../network/PredictionBuffer';

/** Remote player colors by add order. Cosmetic only — may differ across clients. */
const REMOTE_COLORS = [
  0xe74c3c, // Red
  0x2ecc71, // Green
  0xf39c12, // Orange
  0x9b59b6, // Purple
];

const TILE_COLORS: Record<TileType, number> = {
  [TileType.GROUND]: 0x4a7c59,
  [TileType.WALL]: 0x8b7355,
  [TileType.WATER]: 0x2980b9,
};

export class WorldScene extends Phaser.Scene {
  private inputManager!: InputManager;
  private predictionBuffer!: PredictionBuffer;
  private room: Room | null = null;
  private localSessionId: string | null = null;
  private localPlayerSprite: Phaser.GameObjects.Rectangle | null = null;
  private remotePlayerSprites: Map<string, Phaser.GameObjects.Rectangle> =
    new Map();
  private sequenceNumber: number = 0;
  private localPredictedX: number = 0;
  private localPredictedY: number = 0;
  private lastReconcileSeq: number = 0;
  private connected: boolean = false;
  private tickEvent: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'World' });
  }

  async create(): Promise<void> {
    // 1. Render TOWN_MAP as colored rectangles
    this.renderTilemap();

    // 2. Create input and prediction systems
    this.inputManager = new InputManager(this);
    this.predictionBuffer = new PredictionBuffer();

    // 3. Connect to server
    try {
      const { token } = await NetworkClient.autoRegister();
      this.room = await networkClient.joinWorld(token, 'dev-world');
      this.localSessionId = this.room.sessionId;
      this.connected = true;
      console.log('Connected to server, sessionId:', this.localSessionId);
    } catch (error) {
      console.error('Failed to connect to game server:', error);
      this.add
        .text(400, 300, 'Connection failed — see console for details', {
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      return;
    }

    // 4. Set up state listeners
    this.setupRoomListeners();

    // 5. Start client tick loop
    this.tickEvent = this.time.addEvent({
      delay: 1000 / TICK_RATE,
      loop: true,
      callback: () => this.clientTick(),
    });
  }

  private renderTilemap(): void {
    for (let y = 0; y < TOWN_MAP.height; y++) {
      const row = TOWN_MAP.tiles[y]!;
      for (let x = 0; x < TOWN_MAP.width; x++) {
        const tile = row[x]!;
        const color = TILE_COLORS[tile];
        this.add
          .rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, color)
          .setOrigin(0, 0);
      }
    }
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    this.room.state.players.onAdd((player: any, sessionId: string) => {
      const isLocal = sessionId === this.localSessionId;

      if (isLocal) {
        this.localPlayerSprite = this.add.rectangle(
          player.x * TILE_SIZE + TILE_SIZE / 2,
          player.y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
          0x3498db,
        );
        this.localPredictedX = player.x;
        this.localPredictedY = player.y;

        this.cameras.main.startFollow(this.localPlayerSprite);
        this.cameras.main.setBounds(
          0,
          0,
          TOWN_MAP.width * TILE_SIZE,
          TOWN_MAP.height * TILE_SIZE,
        );

        player.onChange(() => {
          if (!this.room || !this.localSessionId) return;
          if (player.lastProcessedSequenceNumber > this.lastReconcileSeq) {
            this.lastReconcileSeq = player.lastProcessedSequenceNumber;
            this.reconcile();
          }
        });
      } else {
        // Note: color assignment is based on local add order, which may differ across clients. This is cosmetic only.
        const colorIndex = this.remotePlayerSprites.size;
        const color =
          REMOTE_COLORS[colorIndex] ?? REMOTE_COLORS[REMOTE_COLORS.length - 1]!;

        const sprite = this.add.rectangle(
          player.x * TILE_SIZE + TILE_SIZE / 2,
          player.y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
          color,
        );
        this.remotePlayerSprites.set(sessionId, sprite);

        player.onChange(() => {
          sprite.setPosition(
            player.x * TILE_SIZE + TILE_SIZE / 2,
            player.y * TILE_SIZE + TILE_SIZE / 2,
          );
        });
      }
    });

    this.room.state.players.onRemove((_player: any, sessionId: string) => {
      const sprite = this.remotePlayerSprites.get(sessionId);
      if (sprite) {
        sprite.destroy();
        this.remotePlayerSprites.delete(sessionId);
      }
    });
  }

  private clientTick(): void {
    if (!this.connected || !this.localPlayerSprite) return;

    this.inputManager.cleanup();
    const direction = this.inputManager.getCurrentDirection();
    if (!direction) return;

    this.sequenceNumber++;

    // Predict locally using the same shared movement logic as the server
    const result = processPlayerInput(
      TOWN_MAP,
      this.localPredictedX,
      this.localPredictedY,
      direction,
    );
    if (result.moved) {
      this.localPredictedX = result.x;
      this.localPredictedY = result.y;
    }
    this.localPlayerSprite.setPosition(
      this.localPredictedX * TILE_SIZE + TILE_SIZE / 2,
      this.localPredictedY * TILE_SIZE + TILE_SIZE / 2,
    );

    // Record prediction and send to server regardless of whether move succeeded
    this.predictionBuffer.addPrediction({
      sequenceNumber: this.sequenceNumber,
      direction,
    });
    networkClient.sendInput({
      sequenceNumber: this.sequenceNumber,
      direction,
    });
  }

  private reconcile(): void {
    if (!this.room || !this.localSessionId) return;

    const player = this.room.state.players.get(this.localSessionId);
    if (!player) return;

    const reconciled = this.predictionBuffer.reconcile(
      player.x,
      player.y,
      player.lastProcessedSequenceNumber,
      TOWN_MAP,
    );
    this.localPredictedX = reconciled.x;
    this.localPredictedY = reconciled.y;

    if (this.localPlayerSprite) {
      this.localPlayerSprite.setPosition(
        this.localPredictedX * TILE_SIZE + TILE_SIZE / 2,
        this.localPredictedY * TILE_SIZE + TILE_SIZE / 2,
      );
    }
  }

  destroy(): void {
    this.inputManager?.destroy();
    this.predictionBuffer?.clear();
    this.tickEvent?.remove();
    this.room?.leave();
  }
}
