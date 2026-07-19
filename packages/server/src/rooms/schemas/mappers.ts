/**
 * Conversion helpers between the shared plain-data character types and their
 * Colyseus schema counterparts. Phase 3d needs both directions: hydrating
 * PlayerState from a loaded CharacterRow on join (plain -> schema), and
 * persisting live stats/health back to the DB (schema -> plain).
 *
 * These just copy values between the two shapes — no validation or clamping
 * logic (that's already handled where the data is produced).
 */

import type { Resource, Stats, BodyHealth } from '@ruin/shared';
import { ResourceSchema, StatsSchema, BodyHealthSchema } from './WorldState.js';

export function statsToSchema(stats: Stats): StatsSchema {
  const schema = new StatsSchema();
  schema.health.current = stats.health.current;
  schema.health.max = stats.health.max;
  schema.stamina.current = stats.stamina.current;
  schema.stamina.max = stats.stamina.max;
  schema.essence.current = stats.essence.current;
  schema.essence.max = stats.essence.max;
  return schema;
}

export function bodyHealthToSchema(bodyHealth: BodyHealth): BodyHealthSchema {
  const schema = new BodyHealthSchema();
  schema.head.current = bodyHealth.head.current;
  schema.head.max = bodyHealth.head.max;
  schema.torso.current = bodyHealth.torso.current;
  schema.torso.max = bodyHealth.torso.max;
  schema.leftArm.current = bodyHealth.leftArm.current;
  schema.leftArm.max = bodyHealth.leftArm.max;
  schema.rightArm.current = bodyHealth.rightArm.current;
  schema.rightArm.max = bodyHealth.rightArm.max;
  schema.leftLeg.current = bodyHealth.leftLeg.current;
  schema.leftLeg.max = bodyHealth.leftLeg.max;
  schema.rightLeg.current = bodyHealth.rightLeg.current;
  schema.rightLeg.max = bodyHealth.rightLeg.max;
  return schema;
}

function resourceToPlain(resource: ResourceSchema): Resource {
  return { current: resource.current, max: resource.max };
}

export function schemaToStats(schema: StatsSchema): Stats {
  return {
    health: resourceToPlain(schema.health),
    stamina: resourceToPlain(schema.stamina),
    essence: resourceToPlain(schema.essence),
  };
}

export function schemaToBodyHealth(schema: BodyHealthSchema): BodyHealth {
  return {
    head: resourceToPlain(schema.head),
    torso: resourceToPlain(schema.torso),
    leftArm: resourceToPlain(schema.leftArm),
    rightArm: resourceToPlain(schema.rightArm),
    leftLeg: resourceToPlain(schema.leftLeg),
    rightLeg: resourceToPlain(schema.rightLeg),
  };
}
