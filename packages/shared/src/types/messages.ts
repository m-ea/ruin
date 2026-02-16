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

/**
 * Server-to-client message definitions.
 * State updates are handled by Colyseus schema sync, not explicit messages.
 */
export interface ServerToClientMessages {}
