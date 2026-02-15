/**
 * @ruin/shared - Shared types and constants for the Ruin RPG project
 * This package contains no runtime code, only TypeScript type definitions
 * and constant values used across both client and server.
 */

// Export all types
export type { IPlayer } from './types/player.js';
export type { IWorldSave } from './types/world.js';
export type { INpc } from './types/npc.js';
export type { ClientToServerMessages, ServerToClientMessages } from './types/messages.js';

// Export all constants
export { TICK_RATE, MAX_PARTY_SIZE, TILE_SIZE } from './constants/game.js';
export { MessageType } from './constants/network.js';
