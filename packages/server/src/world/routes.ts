/**
 * World REST routes — create, list, get, and delete world saves.
 *
 * Auth middleware is applied at mount time in index.ts.
 * Do NOT import or apply authMiddleware here — req.accountId is already set.
 */

import { Router, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  createWorld,
  listWorldsByOwner,
  getWorld,
  deleteWorld,
} from '../persistence/WorldPersistence.js';

export function createWorldRoutes(dbPool: Pool): Router {
  const router = Router();

  /**
   * POST / — Create a new world save.
   * Body: { name: string }
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.body as { name?: unknown };

      if (
        !name ||
        typeof name !== 'string' ||
        name.trim().length === 0 ||
        name.length > 100
      ) {
        res.status(400).json({
          error: 'World name is required (max 100 characters)',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const world = await createWorld(dbPool, req.accountId!, name.trim());

      res.status(201).json({
        world: {
          id: world.id,
          name: world.name,
          seed: world.seed,
          createdAt: world.created_at,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to create world');
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  });

  /**
   * GET / — List all world saves owned by the authenticated user.
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const worlds = await listWorldsByOwner(dbPool, req.accountId!);

      res.status(200).json({
        worlds: worlds.map((w) => ({
          id: w.id,
          name: w.name,
          seed: w.seed,
          createdAt: w.created_at,
          updatedAt: w.updated_at,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to list worlds');
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  });

  /**
   * GET /:id — Get a specific world save (for guests to verify a world exists).
   */
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const worldId = req.params['id'] as string;
      const world = await getWorld(dbPool, worldId);

      if (!world) {
        res.status(404).json({ error: 'World not found', code: 'NOT_FOUND' });
        return;
      }

      res.status(200).json({
        world: {
          id: world.id,
          ownerId: world.owner_id,
          name: world.name,
          seed: world.seed,
          createdAt: world.created_at,
          updatedAt: world.updated_at,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to get world');
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  });

  /**
   * DELETE /:id — Delete a world save (owner only).
   * NOTE: worldId is first argument, ownerId is second.
   * TODO Phase 2b: Check for active room before allowing delete.
   */
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const worldId = req.params['id'] as string;
      const deleted = await deleteWorld(dbPool, worldId, req.accountId!);

      if (!deleted) {
        res.status(404).json({ error: 'World not found', code: 'NOT_FOUND' });
        return;
      }

      res.status(200).json({ deleted: true });
    } catch (err) {
      req.log.error({ err }, 'Failed to delete world');
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
}
