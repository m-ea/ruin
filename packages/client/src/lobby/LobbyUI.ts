/**
 * LobbyUI — Pre-game lobby for creating, loading, and joining world saves.
 * Plain DOM component, no Phaser dependency. Shown before the Phaser game starts.
 */

import { NetworkClient } from '../network/client';

export class LobbyUI {
  private container: HTMLElement;
  private onJoinWorld: (worldId: string, characterName: string) => void;
  private token: string = '';
  private accountId: string = '';

  constructor(
    container: HTMLElement,
    onJoinWorld: (worldId: string, characterName: string) => void,
  ) {
    this.container = container;
    this.onJoinWorld = onJoinWorld;
    this.render('Connecting...');
    void this.init();
  }

  getToken(): string {
    return this.token;
  }

  getAccountId(): string {
    return this.accountId;
  }

  private render(content: string): void {
    this.container.innerHTML = content;
  }

  private async init(): Promise<void> {
    try {
      const auth = await NetworkClient.autoRegister();
      this.token = auth.token;
      this.accountId = auth.accountId;
      await this.renderLobby();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.render(
        `<div style="color: #e74c3c; padding: 20px;">Connection failed: ${this.escapeHtml(msg)}</div>`,
      );
    }
  }

  private async renderLobby(): Promise<void> {
    let worlds: Array<{ id: string; name: string; updatedAt: string }> = [];
    let worldsError = '';

    try {
      worlds = await NetworkClient.listWorlds(this.token);
    } catch (err) {
      worldsError = err instanceof Error ? err.message : String(err);
    }

    const worldListHtml = worlds.length === 0
      ? '<p style="color: #aaa;">No worlds yet. Create one below.</p>'
      : worlds
          .map(
            (w) => `
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px;
              border: 1px solid #444;
              margin-bottom: 6px;
            ">
              <span style="flex: 1;">${this.escapeHtml(w.name)}</span>
              <span style="color: #888; font-size: 12px;">${this.formatDate(w.updatedAt)}</span>
              <button
                style="${this.btnStyle()}"
                onclick="window.__lobby.loadWorld('${w.id}')"
              >Load</button>
              <button
                style="${this.btnStyle('danger')}"
                onclick="window.__lobby.deleteWorld('${w.id}', '${this.escapeHtml(w.name)}')"
              >Delete</button>
            </div>`,
          )
          .join('');

    this.container.innerHTML = `
      <div style="
        max-width: 600px;
        width: 100%;
        padding: 20px;
        box-sizing: border-box;
      ">
        <h1 style="margin: 0 0 24px; font-size: 2em; letter-spacing: 2px;">RUIN</h1>

        <section style="margin-bottom: 32px;">
          <h2 style="margin: 0 0 12px; font-size: 1.1em; color: #aaa; text-transform: uppercase;">Your Worlds</h2>
          ${worldsError ? `<p style="color: #e74c3c;">${this.escapeHtml(worldsError)}</p>` : ''}
          <div id="world-list">${worldListHtml}</div>
          <div id="worlds-error" style="color: #e74c3c; margin-top: 6px;"></div>
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <input
              id="new-world-name"
              type="text"
              placeholder="World name"
              maxlength="100"
              style="${this.inputStyle()}"
            />
            <button
              style="${this.btnStyle('primary')}"
              onclick="window.__lobby.createWorld()"
            >Create New World</button>
          </div>
          <div id="create-error" style="color: #e74c3c; margin-top: 6px;"></div>
        </section>

        <section>
          <h2 style="margin: 0 0 12px; font-size: 1.1em; color: #aaa; text-transform: uppercase;">Join a World</h2>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <input
              id="join-world-id"
              type="text"
              placeholder="World ID (UUID)"
              style="${this.inputStyle()}"
            />
            <input
              id="join-char-name"
              type="text"
              placeholder="Character name"
              value="Adventurer"
              style="${this.inputStyle()}"
            />
            <button
              style="${this.btnStyle('primary')}"
              onclick="window.__lobby.joinById()"
            >Join</button>
          </div>
          <div id="join-error" style="color: #e74c3c; margin-top: 6px;"></div>
        </section>
      </div>
    `;

    // Expose methods for inline onclick handlers
    (window as any).__lobby = {
      loadWorld: (worldId: string) => this.loadWorld(worldId),
      deleteWorld: (worldId: string, name: string) => void this.deleteWorld(worldId, name),
      createWorld: () => void this.createWorld(),
      joinById: () => this.joinById(),
    };
  }

  private loadWorld(worldId: string): void {
    // Character already exists — pass empty characterName
    this.onJoinWorld(worldId, '');
  }

  private async createWorld(): Promise<void> {
    const input = document.getElementById('new-world-name') as HTMLInputElement | null;
    const errorEl = document.getElementById('create-error');
    if (!input || !errorEl) return;

    const name = input.value.trim();
    if (!name) {
      errorEl.textContent = 'Please enter a world name.';
      return;
    }
    errorEl.textContent = '';

    try {
      const world = await NetworkClient.createWorld(this.token, name);
      // Join immediately after creation — no character exists yet, use empty name
      // (server will fall back to email; user can set a real name via Join flow)
      this.onJoinWorld(world.id, '');
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  private async deleteWorld(worldId: string, name: string): Promise<void> {
    if (!window.confirm(`Delete world "${name}"? This cannot be undone.`)) return;

    const errorEl = document.getElementById('worlds-error');
    try {
      await NetworkClient.deleteWorld(this.token, worldId);
      // Re-render lobby to refresh world list
      await this.renderLobby();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : String(err);
      }
    }
  }

  private joinById(): void {
    const worldIdInput = document.getElementById('join-world-id') as HTMLInputElement | null;
    const charNameInput = document.getElementById('join-char-name') as HTMLInputElement | null;
    const errorEl = document.getElementById('join-error');
    if (!worldIdInput || !charNameInput || !errorEl) return;

    const worldId = worldIdInput.value.trim();
    const characterName = charNameInput.value.trim() || 'Adventurer';

    if (!worldId) {
      errorEl.textContent = 'Please enter a world ID.';
      return;
    }
    errorEl.textContent = '';
    this.onJoinWorld(worldId, characterName);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  private inputStyle(): string {
    return `
      background: #2a2a3e;
      border: 1px solid #555;
      color: #ffffff;
      padding: 8px 10px;
      font-family: monospace;
      font-size: 14px;
      flex: 1;
    `.trim();
  }

  private btnStyle(variant: 'primary' | 'danger' | 'default' = 'default'): string {
    const bg =
      variant === 'primary'
        ? '#2980b9'
        : variant === 'danger'
          ? '#c0392b'
          : '#444';
    return `
      background: ${bg};
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      font-family: monospace;
      font-size: 14px;
      cursor: pointer;
      white-space: nowrap;
    `.trim();
  }
}
