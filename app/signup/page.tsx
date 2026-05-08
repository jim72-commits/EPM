import Link from "next/link";
import { redirect } from "next/navigation";

import { getOptionalAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function SignupPickerPage() {
  const auth = await getOptionalAuth();

  if (auth.user) {
    // Signed in users get routed to the most relevant dashboard instead of
    // seeing the picker.
    const firstOrg = auth.memberships[0]?.organization.slug;
    if (auth.hasCandidateProfile) redirect("/me/profile");
    if (firstOrg) redirect(`/employer/${firstOrg}/jobs/new`);
    if (auth.isAdmin) redirect("/admin/jobs");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-20 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Create an account
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        What brings you to TheCOE?
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Two sides of the same Anaplan niche. Pick the one that fits — you can
        always add the other later from the same account.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Link
          href="/signup/candidate"
          className="group flex flex-col justify-between border border-hairline bg-surface p-6 transition-colors duration-150 hover:border-accent"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Looking for work
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground group-hover:text-accent">
              Create a candidate account
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Build your Anaplan profile, upload a resume, and apply to roles
              at companies that run on Anaplan — with one click, no ATS
              re-entry.
            </p>
          </div>
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.12em] text-accent group-hover:text-accent-hover">
            Candidate signup →
          </p>
        </Link>

        <Link
          href="/signup/employer"
          className="group flex flex-col justify-between border border-hairline bg-surface p-6 transition-colors duration-150 hover:border-accent"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Hiring
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground group-hover:text-accent">
              Create an employer account
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Post roles at your company or on behalf of a client. Every
              applicant comes with verified Anaplan experience — no generalist
              noise to filter.
            </p>
          </div>
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.12em] text-accent group-hover:text-accent-hover">
            Employer signup →
          </p>
        </Link>
      </div>

      <p className="mt-16 text-xs uppercase tracking-[0.1em] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="hover:text-foreground">
          Sign in
        </Link>
      </p>
    </main>
  );
}
