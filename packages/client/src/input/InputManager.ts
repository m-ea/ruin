import { Direction } from '@ruin/shared';

/**
 * Maps KeyboardEvent.code values to Direction.
 * Uses physical key positions (layout-independent) so WASD works on AZERTY, QWERTZ, etc.
 */
export const KEY_TO_DIRECTION: ReadonlyMap<string, Direction> = new Map([
  ['ArrowUp', Direction.UP],
  ['KeyW', Direction.UP],
  ['ArrowDown', Direction.DOWN],
  ['KeyS', Direction.DOWN],
  ['ArrowLeft', Direction.LEFT],
  ['KeyA', Direction.LEFT],
  ['ArrowRight', Direction.RIGHT],
  ['KeyD', Direction.RIGHT],
]);

/**
 * Resolves which direction to move based on currently held keys.
 * Last-pressed key wins when multiple movement keys are held.
 *
 * @param pressedKeys - Set of currently held key codes (KeyboardEvent.code values)
 * @param keyOrder - Array of key codes in the order they were pressed (oldest first)
 * @returns The direction to move, or null if no movement key is held
 */
export function resolveDirection(
  pressedKeys: Set<string>,
  keyOrder: string[],
): Direction | null {
  const activeKeys = keyOrder.filter(k => pressedKeys.has(k));
  if (activeKeys.length === 0) return null;

  const lastKey = activeKeys[activeKeys.length - 1]!;
  return KEY_TO_DIRECTION.get(lastKey) ?? null;
}

/**
 * InputManager captures keyboard input via Phaser's keyboard plugin and
 * delegates direction resolution to the pure resolveDirection function.
 */
export class InputManager {
  private pressedKeys: Set<string> = new Set();
  private keyOrder: string[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // IMPORTANT: Use event.code (NOT event.key) for layout-independent behavior.
    // event.code returns physical key position (e.g., 'KeyW') regardless of keyboard layout.
    scene.input.keyboard!.on('keydown', this.onKeyDown, this);
    scene.input.keyboard!.on('keyup', this.onKeyUp, this);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const code = event.code;
    if (!KEY_TO_DIRECTION.has(code)) return;
    this.pressedKeys.add(code);
    if (!this.keyOrder.includes(code)) {
      this.keyOrder.push(code);
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
  }

  getCurrentDirection(): Direction | null {
    return resolveDirection(this.pressedKeys, this.keyOrder);
  }

  /**
   * Call once per client tick to prune released keys from keyOrder.
   * Must be called BEFORE getCurrentDirection() in the tick loop
   * so that released keys don't influence direction resolution.
   */
  cleanup(): void {
    this.keyOrder = this.keyOrder.filter(k => this.pressedKeys.has(k));
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.onKeyDown, this);
    this.scene.input.keyboard?.off('keyup', this.onKeyUp, this);
    this.pressedKeys.clear();
    this.keyOrder = [];
  }
}
