/**
 * (admin)/backups/+page.server.ts — Página de backups da empresa (M8)
 *
 * R: BUILD_PLAN.md §M8.4
 */

import { isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

interface BackupItem {
  id: string;
  type: 'db_only' | 'full';
  status: 'pending' | 'running' | 'done' | 'failed';
  size_bytes: number | null;
  r2_key: string | null;
  download_expires_at: number | null;
  error_msg: string | null;
  created_by: string;
  created_at: number;
  completed_at: number | null;
}

interface BackupAutoConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number;
  retention_days: number;
}

export const load: PageServerLoad = async ({ fetch }) => {
  const [backupsRes, configRes] = await Promise.all([
    fetch('/api/admin/backups'),
    fetch('/api/admin/backups/config'),
  ]);

  const backupsData = backupsRes.ok
    ? (await backupsRes.json()) as { items: BackupItem[]; nextCursor: number | null }
    : { items: [], nextCursor: null };

  const config: BackupAutoConfig = configRes.ok
    ? await configRes.json()
    : { enabled: false, frequency: 'weekly', day_of_week: 0, retention_days: 30 };

  return {
    backups: backupsData.items,
    nextCursor: backupsData.nextCursor,
    config,
  };
};

export const actions: Actions = {
  create: async ({ fetch, request }) => {
    try {
      const form = await request.formData();
      const type = (form.get('type') as string) || 'db_only';
      const csrf = form.get('_csrf')?.toString() ?? '';

      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { detail?: string };
        return { success: false, error: err.detail ?? 'Erro ao criar backup' };
      }

      return { success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return { success: false, error: 'Erro inesperado' };
    }
  },

  delete: async ({ fetch, request }) => {
    try {
      const form = await request.formData();
      const id = form.get('id') as string;
      const csrf = form.get('_csrf')?.toString() ?? '';

      const res = await fetch(`/api/admin/backups/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrf }
      });
      if (!res.ok) {
        const err = (await res.json()) as { detail?: string };
        return { success: false, error: err.detail ?? 'Erro ao eliminar backup' };
      }

      return { success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return { success: false, error: 'Erro inesperado' };
    }
  },

  update_config: async ({ fetch, request }) => {
    try {
      const form = await request.formData();
      const csrf = form.get('_csrf')?.toString() ?? '';
      const config = {
        enabled: form.get('enabled') === 'true',
        frequency: form.get('frequency') as string,
        day_of_week: Number(form.get('day_of_week') ?? 0),
        retention_days: Number(form.get('retention_days') ?? 30),
      };

      const res = await fetch('/api/admin/backups/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = (await res.json()) as { detail?: string };
        return { success: false, error: err.detail ?? 'Erro ao actualizar configuração' };
      }

      return { success: true };
    } catch (e) {
      if (isRedirect(e)) throw e;
      return { success: false, error: 'Erro inesperado' };
    }
  },
};
