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
    // Generate grass tile texture (16x16 with green fill and darker border)
    this.generateTileTexture();

    // Generate player sprite texture (16x16 with blue fill)
    this.generatePlayerTexture();
  }

  /**
   * Create phase - set up initial tilemap and transition to WorldScene.
   */
  create(): void {
    // Create a simple 10x10 tilemap filled with grass tiles
    this.createTilemap();

    // Start the world scene
    this.scene.start('World');
  }

  /**
   * Generates a grass tile texture programmatically.
   */
  private generateTileTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Fill with grass green
    ctx.fillStyle = '#4a7c59';
    ctx.fillRect(0, 0, 16, 16);

    // Draw darker 1px border
    ctx.strokeStyle = '#3a6c49';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);

    // Convert canvas to Phaser texture
    this.textures.addCanvas('tiles', canvas);
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

    // Fill with blue
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, 0, 16, 16);

    // Convert canvas to Phaser texture
    this.textures.addCanvas('player', canvas);
  }

  /**
   * Creates a simple 10x10 tilemap filled with grass tiles.
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
}
