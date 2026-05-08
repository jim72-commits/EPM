// Stub the `server-only` import so we can run templates outside Next.
// Templates are pure functions; the marker only enforces server-side import
// at build time. We bypass it for this dry-run.
import { Module, createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const requireFromHere = createRequire(import.meta.url);

const originalResolve = (Module as unknown as { _resolveFilename: typeof Function })
  ._resolveFilename;
(Module as unknown as { _resolveFilename: (...args: unknown[]) => string })._resolveFilename =
  function (request: string, ...rest: unknown[]) {
    if (request === "server-only") {
      return requireFromHere.resolve(path.join(here, "server-only-stub.js"));
    }
    return (originalResolve as unknown as (...args: unknown[]) => string).call(
      this,
      request,
      ...rest,
    );
  };

const {
  applicationShortlistedEmail,
  applicationRejectedEmail,
  applicationHiredEmail,
  listingClosedEmail,
} = await import("../lib/email/status-templates.ts");

const common = {
  candidateName: "Pat Lin",
  jobTitle: "Senior Anaplan Modeler",
  organizationName: "Acme Inc",
  applicationUrl: "https://thecoe.com/me/applications/abc-123",
};

const cases = [
  { name: "shortlisted", payload: applicationShortlistedEmail(common) },
  { name: "rejected_pre_close", payload: applicationRejectedEmail(common) },
  { name: "hired_on_close", payload: applicationHiredEmail(common) },
  {
    name: "closed_hired_elsewhere",
    payload: listingClosedEmail({ ...common, kind: "hired_elsewhere" }),
  },
  {
    name: "closed_no_hire",
    payload: listingClosedEmail({ ...common, kind: "not_hired_no_fit" }),
  },
  {
    name: "closed_cancelled",
    payload: listingClosedEmail({ ...common, kind: "not_hired_cancelled" }),
  },
];

let bad = 0;

for (const { name, payload } of cases) {
  console.log("\n=== " + name + " ===");
  console.log("Subject: " + payload.subject);
  console.log("---- text ----");
  console.log(payload.text);

  const checks: Array<[string, boolean]> = [
    ["subject populated", payload.subject.length > 5],
    ["no unsubstituted ${} markers in subject", !/\$\{/.test(payload.subject)],
    ["no unsubstituted ${} markers in text", !/\$\{/.test(payload.text)],
    ["no unsubstituted ${} markers in html", !/\$\{/.test(payload.html)],
    ["html starts with doctype", payload.html.startsWith("<!DOCTYPE html>")],
    ["html includes candidate name", payload.html.includes(common.candidateName)],
    ["html includes job title", payload.html.includes(common.jobTitle)],
    ["html includes org name", payload.html.includes(common.organizationName)],
    ["text includes application url", payload.text.includes(common.applicationUrl)],
  ];
  for (const [label, ok] of checks) {
    if (!ok) {
      console.error("FAIL[" + name + "]: " + label);
      bad++;
    }
  }
}

console.log("\nFinished. Failures: " + bad);
process.exit(bad === 0 ? 0 : 1);
