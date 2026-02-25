/**
 * BootScene - Loads and generates initial game assets.
 * Creates programmatic placeholder textures for tiles and player sprites.
 */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  /**
   * Preload phase - generate placeholder textures programmatically.
   * No external asset files are loaded in this phase.
   */
  preload(): void {
    this.generateTileTexture('tiles', '#4a7c59', '#3a6c49');
    this.generateTileTexture('tile_wall', '#8b7355', '#6b5335');
    this.generateTileTexture('tile_water', '#2980b9', '#3498db');
    this.generatePlayerTexture();
  }

  /**
   * Create phase - transition to WorldScene.
   */
  create(): void {
    this.scene.start('World');
  }

  /**
   * Generates a 16x16 tile texture with a fill color and 1px border.
   */
  private generateTileTexture(
    key: string,
    fillColor: string,
    borderColor: string,
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, 16, 16);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);

    this.textures.addCanvas(key, canvas);
  }

  /**
   * Generates a player sprite texture programmatically.
   */
  private generatePlayerTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, 0, 16, 16);

    this.textures.addCanvas('player', canvas);
  }
}
