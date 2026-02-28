/**
 * Ruin client entry point.
 * Shows lobby first. When the player selects a world, initializes the Phaser game.
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { LobbyUI } from './lobby/LobbyUI';

const lobbyContainer = document.getElementById('lobby-container')!;
const gameContainer = document.getElementById('game-container')!;

const lobby = new LobbyUI(lobbyContainer, (worldId, characterName) => {
  // Hide lobby, show game container
  lobbyContainer.style.display = 'none';
  gameContainer.style.display = 'block';

  // Store params for WorldScene to read in create()
  (window as any).__gameParams = {
    worldId,
    token: lobby.getToken(),
    characterName,
    accountId: lobby.getAccountId(),
  };

  // Create Phaser game (only after lobby selection so game-container has non-zero dimensions)
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 600,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, WorldScene],
    backgroundColor: '#1a1a2e',
  });
});
