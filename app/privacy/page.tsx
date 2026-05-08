import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How TheCOE collects, uses, and protects personal information of employers, candidates, and newsletter subscribers.",
};

const EFFECTIVE_DATE = "April 24, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Legal
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-4 text-xs text-muted">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
        <section>
          <p className="text-muted">
            This policy describes the personal information we collect when
            you use <strong className="text-foreground">TheCOE</strong>{" "}
            (&ldquo;TheCOE&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) — the
            job board for the Anaplan ecosystem in the United States and
            Canada — and how we use, share, and protect it.
          </p>
        </section>

        <Section title="1. Information we collect">
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              <span className="text-foreground">Account data.</span> When an
              employer creates an account, we collect their email address,
              organization name, and authentication credentials (handled by
              our identity provider; see section 3).
            </li>
            <li>
              <span className="text-foreground">Job postings.</span> Any
              content an employer submits for listing — title, description,
              compensation, location, and contact details — is stored to
              operate the directory.
            </li>
            <li>
              <span className="text-foreground">Newsletter &amp; alert
              subscribers.</span> If you opt in, we store your email address,
              any filter criteria attached to a job alert, and confirmation
              tokens. We use double opt-in; no email is sent without your
              explicit confirmation.
            </li>
            <li>
              <span className="text-foreground">Server logs.</span> Standard
              request metadata — IP address, user agent, URL, timestamp,
              status — is retained for operational security and fraud
              prevention.
            </li>
            <li>
              <span className="text-foreground">Analytics.</span> If enabled
              for a deployment, we use a privacy-preserving analytics
              provider that does not set tracking cookies or collect
              personally identifiable information. It records aggregate
              pageview counts, referrers, and countries only.
            </li>
            <li>
              <span className="text-foreground">Advertising.</span> The
              service is supported in part by third-party display
              advertising. When advertising is enabled, ad providers may
              place cookies or similar identifiers on your device to
              measure ad performance and (subject to your consent where
              required) personalize ads. See section 4 for details on
              cookies and your choices.
            </li>
          </ul>
        </Section>

        <Section title="2. How we use information">
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>Operate the job directory and employer dashboard.</li>
            <li>
              Send transactional email (confirmations, receipts, job-alert
              digests) to addresses that have explicitly opted in.
            </li>
            <li>
              Detect abuse, spam, or fraud, and comply with legal
              obligations.
            </li>
            <li>
              Measure aggregate traffic and feature usage to improve the
              product.
            </li>
          </ul>
          <p className="mt-4 text-muted">
            We do not sell or rent personal information. We do not use your
            data to train machine-learning models.
          </p>
        </Section>

        <Section title="3. Service providers we rely on">
          <p className="text-muted">
            TheCOE uses the following sub-processors. Each is bound by the
            relevant data-protection terms:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              <span className="text-foreground">Vercel</span> — application
              hosting, edge delivery, and logs.
            </li>
            <li>
              <span className="text-foreground">Supabase</span> — Postgres
              database, authentication, and file storage.
            </li>
            <li>
              <span className="text-foreground">Resend</span> (or equivalent
              provider) — delivery of transactional email for double opt-in,
              newsletter, and alerts.
            </li>
            <li>
              <span className="text-foreground">Plausible</span> (if enabled)
              — cookieless aggregate analytics.
            </li>
            <li>
              <span className="text-foreground">Google AdSense / Google Ad
              Manager</span> (when display advertising is enabled) — programmatic
              ad serving and measurement. Subject to{" "}
              <a
                href="https://policies.google.com/technologies/ads"
                rel="noopener noreferrer"
                target="_blank"
                className="text-accent underline"
              >
                Google&rsquo;s advertising policies
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="4. Cookies and similar technologies">
          <p className="text-muted">
            TheCOE uses a session cookie set by our identity provider to
            keep logged-in users authenticated, and a small number of
            functional cookies to remember preferences such as your cookie
            consent choice.
          </p>
          <p className="mt-3 text-muted">
            When display advertising is enabled, our ad partners may set
            additional cookies and similar identifiers to deliver and
            measure ads. Where required by law (for example, in the
            European Economic Area, the United Kingdom, and California), we
            ask for your consent before setting non-essential cookies, and
            you can change your choice at any time from the cookie banner
            or footer link.
          </p>
        </Section>

        <Section title="5. Data retention">
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              <span className="text-foreground">Employer accounts &amp; job
              postings.</span> Retained while the account is active. You can
              delete an account by writing to the address below; we will
              remove it within 30 days, except where law requires longer
              retention.
            </li>
            <li>
              <span className="text-foreground">Newsletter subscribers.</span>{" "}
              Retained until you unsubscribe, at which point the record is
              deleted.
            </li>
            <li>
              <span className="text-foreground">Job alerts.</span> Retained
              until you unsubscribe via the link in any digest email. Pending
              (unconfirmed) alerts expire after 30 days.
            </li>
            <li>
              <span className="text-foreground">Server logs.</span> Retained
              for up to 90 days.
            </li>
          </ul>
        </Section>

        <Section title="6. Your rights">
          <p className="text-muted">
            Depending on where you live, you may have rights to access,
            correct, delete, or restrict our use of your personal
            information, and to request a portable copy of it. Residents of
            California have rights under the CCPA/CPRA; residents of certain
            Canadian provinces have rights under PIPEDA or provincial
            statutes. To exercise any of these rights, email the address
            below. We will verify your identity before acting and respond
            within the timeframes required by law.
          </p>
        </Section>

        <Section title="7. International transfers">
          <p className="text-muted">
            Our service providers may process data in the United States or
            other jurisdictions outside your country of residence. We rely
            on standard contractual protections offered by each provider
            and limit data processing to the minimum necessary.
          </p>
        </Section>

        <Section title="8. Security">
          <p className="text-muted">
            Data is transmitted over TLS and stored in managed, access-
            controlled databases. While no system is completely immune
            from risk, we take reasonable precautions and will notify
            affected users and regulators if we become aware of a
            qualifying breach.
          </p>
        </Section>

        <Section title="9. Children">
          <p className="text-muted">
            TheCOE is intended for users aged 16 and older. We do not
            knowingly collect information from anyone younger. If you
            believe we have done so, contact us and we will delete it.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p className="text-muted">
            We may update this policy from time to time. Material changes
            will be announced on this page and, for subscribers, by email at
            least 30 days before taking effect.
          </p>
        </Section>

        <Section title="11. Contact">
          <p className="text-muted">
            Privacy questions or rights requests: write to{" "}
            <a
              href="mailto:privacy@thecoe.com"
              className="text-accent underline"
            >
              privacy@thecoe.com
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
