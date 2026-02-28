/**
 * Client-to-server and server-to-client message definitions.
 */

import type { InputMessage } from './input.js';
import { MessageType } from '../constants/network.js';

/**
 * Client-to-server message definitions.
 */
export interface ClientToServerMessages {
  [MessageType.INPUT]: InputMessage;
}

export interface IdleWarningMessage {
  /** Seconds until the player is kicked */
  secondsRemaining: number;
}

export interface IdleKickMessage {
  /** Reason for the kick */
  reason: string;
}

/**
 * Server-to-client message definitions.
 * State updates are handled by Colyseus schema sync, not explicit messages.
 */
export interface ServerToClientMessages {
  [MessageType.IDLE_WARNING]: IdleWarningMessage;
  [MessageType.IDLE_KICK]: IdleKickMessage;
}
