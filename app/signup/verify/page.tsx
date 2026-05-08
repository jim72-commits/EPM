import Link from "next/link";

import { ResendConfirmationButton } from "@/app/signup/verify/resend-button";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupVerifyPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  const org = typeof sp.org === "string" ? sp.org : "";
  const role =
    sp.role === "candidate" || sp.role === "employer" ? sp.role : undefined;

  const heading = role === "candidate" ? "Candidate account" : "Employer account";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-20 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {heading}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Check your email
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        We sent a confirmation link to{" "}
        <span className="text-foreground">{email || "your email"}</span>. Click
        it to activate your account.
      </p>
      {role === "employer" && org ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Your company workspace (
          <code className="font-mono text-xs text-foreground">{org}</code>) is
          ready once you confirm.
        </p>
      ) : null}
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {role === "candidate"
          ? "After confirming, sign in and finish your profile — resume, credentials, and work preferences."
          : "After confirming, sign in to continue."}
      </p>

      <div className="mt-10 border-t border-hairline pt-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Didn&apos;t get the email?
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Check your spam folder, then use the button below to send another
          copy.
        </p>
        <ResendConfirmationButton email={email} role={role} />
      </div>

      <p className="mt-10 text-xs uppercase tracking-[0.1em] text-muted">
        <Link href="/login" className="hover:text-foreground">
          Go to sign in
        </Link>
      </p>
    </main>
  );
}
