"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { captureException, logEvent } from "@/lib/observability";

const RESOLUTION = ["dismissed", "actioned"] as const;

const resolveSchema = z.object({
  report_id: z.string().uuid(),
  status: z.enum(RESOLUTION),
  admin_notes: z.string().trim().max(4000).nullable(),
});

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function errorRedirect(message: string): never {
  redirect(`/admin/reports?error=${encodeURIComponent(message)}`);
}

/**
 * Resolve a listing report. Admins move open reports to either:
 *  - `dismissed` (false alarm, no action needed)
 *  - `actioned` (took the listing down or warned the org — done out-of-band)
 *
 * The trigger on listing_reports auto-stamps resolved_at; we set
 * resolved_by_user_id explicitly so audit logs are honest.
 */
export async function resolveListingReport(formData: FormData) {
  const { user, supabase } = await requireAdmin();

  const parsed = resolveSchema.safeParse({
    report_id: formData.get("report_id"),
    status: formData.get("status"),
    admin_notes: emptyToNull(formData.get("admin_notes")),
  });

  if (!parsed.success) {
    errorRedirect(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { report_id, status, admin_notes } = parsed.data;

  const { data: report } = await supabase
    .from("listing_reports")
    .select("id, status")
    .eq("id", report_id)
    .maybeSingle();

  if (!report) {
    errorRedirect("Report not found.");
  }
  if (report.status !== "open") {
    errorRedirect("That report is already resolved.");
  }

  const { error: updateErr } = await supabase
    .from("listing_reports")
    .update({
      status,
      admin_notes,
      resolved_by_user_id: user.id,
    })
    .eq("id", report_id);

  if (updateErr) {
    captureException(updateErr, {
      scope: "admin.reports.resolve",
      report_id,
    });
    errorRedirect(updateErr.message);
  }

  logEvent("listing_report_resolved", {
    report_id,
    new_status: status,
    actor_user_id: user.id,
  });

  revalidatePath("/admin/reports");
  redirect(`/admin/reports?resolved=${status}`);
}
