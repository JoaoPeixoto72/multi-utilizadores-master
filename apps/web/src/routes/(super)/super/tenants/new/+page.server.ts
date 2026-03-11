/**
 * (super)/super/tenants/new/+page.server.ts — Criar nova empresa
 *
 * R: BUILD_PLAN.md §M2.6
 * R: briefing.md §1.2 — super user cria empresa + envia convite ao owner
 */
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const { csrfToken } = await parent();
  return { csrfToken };
};

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const data = await request.formData();

    const name              = data.get("name")?.toString() ?? "";
    const email             = data.get("email")?.toString() ?? "";
    const owner_email       = data.get("owner_email")?.toString() ?? "";
    const address           = data.get("address")?.toString() || undefined;
    const phone             = data.get("phone")?.toString() || undefined;
    const website           = data.get("website")?.toString() || undefined;
    const admin_seat_limit  = Number(data.get("admin_seat_limit") ?? 3);
    const member_seat_limit = Number(data.get("member_seat_limit") ?? 0);
    const client_seat_limit = Number(data.get("client_seat_limit") ?? 0);
    const storage_limit_bytes = Number(data.get("storage_limit_bytes") ?? 1073741824);
    const csrf              = data.get("_csrf")?.toString() ?? "";

    if (!name || !email || !owner_email) {
      return fail(422, { error: "validation", name, email, owner_email });
    }

    const res = await fetch("/api/super/tenants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify({
        name,
        email,
        owner_email,
        address,
        phone,
        website,
        admin_seat_limit,
        member_seat_limit,
        client_seat_limit,
        storage_limit_bytes,
      }),
    });

    if (res.status === 409) {
      const body = await res.json().catch(() => ({ detail: "" })) as { detail?: string };
      const isOwnerEmail = body.detail?.includes("owner") || body.detail?.includes("convite");
      return fail(409, { error: isOwnerEmail ? "owner_email_taken" : "email_taken", name, email, owner_email });
    }

    if (!res.ok) {
      return fail(500, { error: "generic", name, email, owner_email });
    }

    const body = (await res.json()) as { tenant: { id: string } };
    redirect(303, `/super/tenants/${body.tenant.id}?created=1`);
  },
};
