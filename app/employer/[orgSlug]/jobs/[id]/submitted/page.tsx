import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/auth/employer";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string }>;
};

/**
 * Confirmation page after an employer submits a listing for review.
 *
 * Three states are possible by the time the page renders:
 *   - `pending_review` — the most common case immediately after submit.
 *   - `open`           — the admin already approved while the user was on
 *                        an old session (rare but reachable, e.g. resubmit
 *                        of a previously approved listing).
 *   - `rejected`       — admin rejected it before the user landed here
 *                        (also rare, but we render the rejection note so
 *                        the page stays useful).
 *
 * Anything else means the user navigated here directly with a stale URL;
 * we send them back to the dashboard.
 */
export default async function SubmittedPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const { supabase, org } = await requireOrgMember(orgSlug);

  const { data: job } = await supabase
    .from("jobs")
    .select("id, slug, title, status, moderation_note, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!job || job.organization_id !== org.id) notFound();

  const { heading, body } = renderCopy(job.status, job.moderation_note);

  return (
    <div className="py-10">
      <div className="mx-auto max-w-2xl border border-hairline bg-surface px-8 py-10">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          {org.name}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          {heading}
        </h1>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          {body.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          {job.status === "open" ? (
            <Link
              href={`/jobs/${job.slug}`}
              className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent hover:bg-accent-hover"
            >
              View public listing
            </Link>
          ) : null}
          {job.status === "rejected" ? (
            <Link
              href={`/employer/${orgSlug}/jobs/${job.id}/edit`}
              className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent hover:bg-accent-hover"
            >
              Edit and resubmit
            </Link>
          ) : null}
          <Link
            href={`/employer/${orgSlug}/jobs`}
            className="inline-flex h-11 items-center justify-center border border-hairline bg-page px-6 text-sm font-medium text-foreground hover:border-foreground"
          >
            Back to dashboard
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted">
          Questions? Email{" "}
          <a
            href={SUPPORT_MAILTO}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function renderCopy(
  status: string,
  moderationNote: string | null,
): { heading: string; body: string[] } {
  switch (status) {
    case "pending_review":
      return {
        heading: "Submitted for review",
        body: [
          "Thanks — your listing is now in our moderation queue. We typically review submissions within one business day.",
          "We'll email you the moment it's approved or if we need any changes. In the meantime you can keep editing the company profile or post additional roles.",
        ],
      };
    case "open":
      return {
        heading: "Your listing is live",
        body: [
          "Approved — your listing is now visible to candidates on TheCOE.",
          "You'll get an email each time someone applies. Review applicants from the dashboard whenever you're ready.",
        ],
      };
    case "rejected":
      return {
        heading: "Listing needs an update",
        body: [
          moderationNote
            ? `Our moderator left this note: ${moderationNote}`
            : "Our moderator flagged this listing and returned it for changes.",
          "Edit the listing and resubmit when ready — most rejected listings are approved on the second pass.",
        ],
      };
    default:
      return {
        heading: "Listing not in review",
        body: [
          "This listing isn't in the moderation queue right now. Open it from your dashboard to see its current status.",
        ],
      };
  }
}
