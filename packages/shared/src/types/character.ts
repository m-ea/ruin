/**
 * Character stats and body-part health data model.
 * Plain-data shapes — no Colyseus dependency — consumed by both client and server.
 */

/** A bounded numeric quantity: a current value that can never exceed max. */
export interface Resource {
  current: number;
  max: number;
}

/** Top-level character stats. */
export interface Stats {
  health: Resource;
  stamina: Resource;
  essence: Resource;
}

/** Per-body-part health tracking. */
export interface BodyHealth {
  head: Resource;
  torso: Resource;
  leftArm: Resource;
  rightArm: Resource;
  leftLeg: Resource;
  rightLeg: Resource;
}
