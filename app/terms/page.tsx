import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "TheCOE terms of service for employers, job applicants, and subscribers. Acceptable use and liability.",
};

const EFFECTIVE_DATE = "April 24, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Legal
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-4 text-xs text-muted">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
        <section>
          <p className="text-muted">
            These terms (&ldquo;<strong className="text-foreground">Terms</strong>&rdquo;)
            govern your use of <strong className="text-foreground">TheCOE</strong>{" "}
            (&ldquo;TheCOE&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a job
            board for the Anaplan ecosystem in the United States and Canada.
            By creating an account, posting a job, or subscribing to a
            newsletter or alert, you agree to these Terms.
          </p>
        </section>

        <Section title="1. Who may use TheCOE">
          <p className="text-muted">
            You must be at least 16 years old and able to form a binding
            contract under the laws of your jurisdiction. If you act on
            behalf of an employer or staffing agency, you represent that
            you&rsquo;re authorized to bind that organization to these
            Terms.
          </p>
        </Section>

        <Section title="2. Accounts">
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              Provide accurate information and keep it current.
            </li>
            <li>
              You&rsquo;re responsible for all activity on your account.
              Keep credentials confidential; one login per human.
            </li>
            <li>
              Notify us immediately if you suspect unauthorized access.
            </li>
          </ul>
        </Section>

        <Section title="3. Posting jobs">
          <p className="text-muted">
            Employers and staffing agencies may post job listings subject to
            the following:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              Listings must be for bona-fide, currently-open Anaplan roles
              located in or remote-eligible for the United States or Canada.
            </li>
            <li>
              Listings must comply with all applicable employment and
              anti-discrimination laws. Compensation disclosure is required
              where mandated (e.g. US states with pay-transparency
              requirements).
            </li>
            <li>
              No multi-level marketing, bait-and-switch, franchise-fee, or
              training-for-fee schemes.
            </li>
            <li>
              No illegal, deceptive, harassing, or hateful content. No
              requests for applicants to pay fees to apply or to receive an
              offer.
            </li>
            <li>
              You grant TheCOE a non-exclusive, royalty-free, worldwide
              license to host, display, reformat, and distribute your
              listing solely for the purpose of operating the directory.
              You retain all other rights in your content.
            </li>
            <li>
              We may remove, edit, or reject any listing that violates
              these Terms or that we reasonably believe is fraudulent,
              misleading, or outside scope.
            </li>
          </ul>
        </Section>

        <Section title="4. Free listings and moderation">
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              Listing on TheCOE is free. We do not charge employers,
              candidates, or subscribers any fee to use the core service.
            </li>
            <li>
              All listings are reviewed by our moderation team before going
              live. We aim to respond within one business day. Approved
              listings remain visible until you mark them filled, unpublish
              them, or we remove them for a Terms violation.
            </li>
            <li>
              We may decline or remove a listing that, in our reasonable
              judgement, is fraudulent, misleading, off-topic, or otherwise
              outside the scope described in section 3. We will provide a
              short note explaining the reason.
            </li>
            <li>
              The service is supported in part by third-party display
              advertising. By using the service you understand that ads
              may appear on listing and content pages. See our Privacy
              Policy for details on advertising and cookies.
            </li>
          </ul>
        </Section>

        <Section title="5. Candidates and applicants">
          <p className="text-muted">
            TheCOE is a directory and introduction platform. We are not an
            employer, recruiter, or party to any employment relationship
            between a candidate and an employer. We do not verify the
            accuracy of listings or the identities of posters. Any
            agreement you enter into with an employer or candidate is
            solely between the two of you.
          </p>
        </Section>

        <Section title="6. Newsletter and job alerts">
          <p className="text-muted">
            Newsletter and alert subscriptions use double opt-in. Every
            email contains a one-click unsubscribe link, and we honour
            unsubscribe requests promptly. You may subscribe any address
            for which you have permission to do so.
          </p>
        </Section>

        <Section title="7. Prohibited conduct">
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>
              Do not scrape, bulk-download, or resell the directory or any
              part of it.
            </li>
            <li>
              Do not attempt to reverse-engineer, disrupt, or overload the
              service, or probe it for vulnerabilities without our written
              permission.
            </li>
            <li>
              Do not harvest contact information from listings to send
              unsolicited commercial communications.
            </li>
            <li>
              Do not impersonate another person or organization, or
              misrepresent your affiliation with one.
            </li>
            <li>
              Do not use the service to transmit malware, spam, phishing,
              or other unlawful content.
            </li>
          </ul>
          <p className="mt-4 text-muted">
            Violation may result in immediate termination of your account
            and removal of any listings, and may be reported to appropriate
            authorities.
          </p>
        </Section>

        <Section title="8. Intellectual property">
          <p className="text-muted">
            TheCOE&rsquo;s name, logo, design, and software are our
            property or licensed to us. These Terms do not grant you any
            right to use our marks without our written permission. Content
            that you submit remains yours, subject to the license in
            section 3.
          </p>
        </Section>

        <Section title="9. Termination">
          <p className="text-muted">
            You may stop using the service and close your account at any
            time. We may suspend or terminate your access if you breach
            these Terms, if required by law, or if we discontinue the
            service. Sections that by their nature should survive
            (ownership, disclaimers, liability limits, indemnity, dispute
            resolution) will survive termination.
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p className="text-muted">
            The service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, whether
            express, implied, or statutory, including warranties of
            merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that listings are
            accurate, that the service will be uninterrupted or error-
            free, or that any specific hiring outcome will occur.
          </p>
        </Section>

        <Section title="11. Limitation of liability">
          <p className="text-muted">
            To the maximum extent permitted by law, TheCOE and its
            officers, employees, and suppliers will not be liable for any
            indirect, incidental, special, consequential, or punitive
            damages, or for lost profits, revenue, data, or business
            opportunities, arising out of or relating to your use of the
            service. Our total aggregate liability for all claims relating
            to the service will not exceed one hundred US dollars.
          </p>
        </Section>

        <Section title="12. Indemnity">
          <p className="text-muted">
            You agree to indemnify and hold TheCOE harmless from any
            claims, damages, liabilities, and expenses (including
            reasonable legal fees) arising from content you submit, your
            use of the service, or your violation of these Terms or any
            law.
          </p>
        </Section>

        <Section title="13. Governing law and disputes">
          <p className="text-muted">
            These Terms are governed by the laws of the State of Delaware,
            United States, without regard to conflict-of-laws rules. Any
            dispute will be resolved exclusively in the state or federal
            courts located in Delaware, unless applicable consumer-
            protection law of your province or state entitles you to a
            different forum.
          </p>
        </Section>

        <Section title="14. Changes">
          <p className="text-muted">
            We may update these Terms from time to time. Material changes
            will be posted on this page, and for active employer accounts
            we will send notice by email at least 30 days in advance.
            Continued use of the service after the effective date
            constitutes acceptance.
          </p>
        </Section>

        <Section title="15. Contact">
          <p className="text-muted">
            Questions about these Terms:{" "}
            <a
              href="mailto:legal@thecoe.com"
              className="text-accent underline"
            >
              legal@thecoe.com
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
