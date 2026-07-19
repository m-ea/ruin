import Phaser from 'phaser';
import type { Resource } from '@ruin/shared';
import { computeFillWidth, formatResourceText } from './StatBar';

const BAR_WIDTH = 180;
const BAR_HEIGHT = 20;
const BAR_GAP = 4;
const MARGIN = 10;
const BACKGROUND_COLOR = 0x333333;

// Deliberately different exact shades from WorldScene's REMOTE_COLORS[0]/[1] (0xe74c3c/0x2ecc71),
// the local player sprite color (0x3498db), and the water tile color (0x2980b9) — reusing an
// identical hex already meaning something else on screen would create a confusing visual
// association. Centralizing every on-screen color into one shared module is a reasonable
// future cleanup; these three constants living here is sufficient for now.
const HEALTH_COLOR = 0xc0392b;
const STAMINA_COLOR = 0x27ae60;
const ESSENCE_COLOR = 0x2e86de;

// Low enough to sit below the idle-warning banner (999) and disconnect overlay (1000) defined
// in WorldScene.ts. There is no shared z-index scheme in this codebase yet — 500 is simply
// chosen to stay clear of both.
const HUD_DEPTH = 500;

interface BarElements {
  fill: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

/**
 * Renders the local player's Health, Stamina, and Essence as three fixed-width bars
 * anchored to the bottom-left of the screen.
 *
 * Owns Phaser display objects only — receives plain { current, max } data from
 * WorldScene via update(), and never reads room.state itself.
 */
export class StatHud {
  private container: Phaser.GameObjects.Container;
  private health: BarElements;
  private stamina: BarElements;
  private essence: BarElements;

  constructor(scene: Phaser.Scene) {
    // Read camera dimensions at construction time rather than hardcoding 800x600 —
    // matches how showIdleWarningOverlay/showDisconnectOverlay get screen dimensions.
    const { width, height } = scene.cameras.main;

    // Single container for the whole HUD (not one per bar), matching the existing
    // overlay pattern. setScrollFactor(0) is required because the camera follows the
    // local player — without it the HUD would scroll with the world instead of
    // staying pinned to the screen corner.
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(HUD_DEPTH);

    // Stack bottom-up from the bottom-left corner so Health ends up on top,
    // Stamina in the middle, and Essence at the bottom.
    const barX = MARGIN;
    const essenceY = height - MARGIN - BAR_HEIGHT / 2;
    const staminaY = essenceY - BAR_HEIGHT - BAR_GAP;
    const healthY = staminaY - BAR_HEIGHT - BAR_GAP;

    this.health = this.buildBar(scene, barX, healthY, HEALTH_COLOR);
    this.stamina = this.buildBar(scene, barX, staminaY, STAMINA_COLOR);
    this.essence = this.buildBar(scene, barX, essenceY, ESSENCE_COLOR);
  }

  /**
   * Builds one bar's display objects (background, fill, centered text) and adds
   * them to the shared container. The fill rectangle is left-anchored (origin 0, 0.5)
   * so update() can shrink it from the right by changing only its width, never its x.
   */
  private buildBar(scene: Phaser.Scene, x: number, y: number, color: number): BarElements {
    const background = scene.add
      .rectangle(x, y, BAR_WIDTH, BAR_HEIGHT, BACKGROUND_COLOR)
      .setOrigin(0, 0.5);
    const fill = scene.add.rectangle(x, y, BAR_WIDTH, BAR_HEIGHT, color).setOrigin(0, 0.5);
    // Centered on the fixed bar bounds, independent of the fill's current width.
    const text = scene.add
      .text(x + BAR_WIDTH / 2, y, '', { fontSize: '12px', color: '#ffffff' })
      .setOrigin(0.5);

    this.container.add([background, fill, text]);
    return { fill, text };
  }

  /** Recomputes fill widths and text for all three bars from live { current, max } data. */
  update(stats: { health: Resource; stamina: Resource; essence: Resource }): void {
    this.updateBar(this.health, stats.health);
    this.updateBar(this.stamina, stats.stamina);
    this.updateBar(this.essence, stats.essence);
  }

  /** Mutates the existing fill/text objects in place — never destroys/recreates them. */
  private updateBar(bar: BarElements, resource: Resource): void {
    bar.fill.width = computeFillWidth(resource.current, resource.max, BAR_WIDTH);
    bar.text.setText(formatResourceText(resource.current, resource.max));
  }

  /** Destroys the container and all its children. */
  destroy(): void {
    this.container.destroy(true);
  }
}
