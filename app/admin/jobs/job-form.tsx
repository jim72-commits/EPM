"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";

import {
  upsertJob,
  type UpsertJobState,
} from "@/app/admin/jobs/actions";
import { slugify } from "@/lib/slugify";
import type { ListingKind } from "@/lib/types/jobs";

function labelForStatus(s: JobFormDefaults["status"]): string {
  switch (s) {
    case "draft":
      return "Draft";
    case "pending_review":
      return "In review";
    case "open":
      return "Open";
    case "filled":
      return "Filled";
    case "unpublished":
      return "Unpublished";
    case "rejected":
      return "Rejected";
  }
}

type Option = { id: string; name: string; slug: string };

export type JobFormDefaults = {
  id?: string;
  organization_id: string;
  slug: string;
  title: string;
  primary_platform_id: string;
  role_family_id: string;
  country_code: "US" | "CA";
  location_label: string;
  remote_policy: "remote" | "hybrid" | "onsite" | "flexible";
  employment_type: "full_time" | "part_time" | "contract";
  listing_kind: ListingKind;
  status:
    | "draft"
    | "pending_review"
    | "open"
    | "filled"
    | "unpublished"
    | "rejected";
  summary: string;
  full_description: string;
  external_apply_url: string;
  is_featured: boolean;
  featured_until: string;
};

type Props = {
  defaultValues: JobFormDefaults;
  organizations: Option[];
  platforms: Option[];
  roleFamilies: Option[];
  /**
   * Count of applications still awaiting an outcome (submitted, under_review,
   * shortlisted). Used to gate destructive status transitions so admins can't
   * silently strand applicants. 0 for new jobs.
   */
  activeApplicationsCount: number;
};

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const inputClass =
  "mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
const selectClass = inputClass;

const INITIAL_STATE: UpsertJobState = {};

export function JobForm({
  defaultValues,
  organizations,
  platforms,
  roleFamilies,
  activeApplicationsCount,
}: Props) {
  const [state, formAction, pending] = useActionState(upsertJob, INITIAL_STATE);
  // Preserve typed values across validation failures by preferring the
  // server-returned `state.fields` over the row-loaded defaults. On the
  // first render `state.fields` is undefined, so we fall back to the row.
  const fields = state.fields;
  const valueFor = <K extends keyof JobFormDefaults>(
    key: K,
  ): JobFormDefaults[K] => {
    if (fields && key in fields) {
      const raw = (fields as unknown as Record<string, unknown>)[key as string];
      // The state preserves whatever shape the form sent (string or boolean),
      // and JobFormDefaults values are the same shape, so this is safe.
      return raw as JobFormDefaults[K];
    }
    return defaultValues[key];
  };

  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const initialListingKind = valueFor("listing_kind") as ListingKind;
  const initialStatus = valueFor("status") as JobFormDefaults["status"];
  const [listingKind, setListingKind] =
    useState<ListingKind>(initialListingKind);
  const [status, setStatus] =
    useState<JobFormDefaults["status"]>(initialStatus);

  const previousStatus = defaultValues.status;
  const willStrandApplicants =
    activeApplicationsCount > 0 &&
    previousStatus === "open" &&
    (status === "unpublished" || status === "draft");

  const orgOptions = useMemo(
    () =>
      organizations.length ? (
        organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))
      ) : (
        <option value="">Create an organization first</option>
      ),
    [organizations],
  );

  return (
    <form action={formAction} className="mx-auto max-w-3xl space-y-8 py-10">
      {defaultValues.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      {state.error ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input
            ref={titleRef}
            id="title"
            name="title"
            required
            defaultValue={valueFor("title")}
            key={`title-${valueFor("title")}`}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug (URL)
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={slugRef}
              id="slug"
              name="slug"
              required
              defaultValue={valueFor("slug")}
              key={`slug-${valueFor("slug")}`}
              className={`${inputClass} mt-0 flex-1`}
            />
            <button
              type="button"
              className="h-10 shrink-0 border border-hairline bg-page px-3 text-xs font-medium uppercase tracking-[0.1em] text-muted hover:border-foreground hover:text-foreground"
              onClick={() => {
                const t = titleRef.current?.value ?? "";
                if (slugRef.current) slugRef.current.value = slugify(t);
              }}
            >
              From title
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="organization_id" className={labelClass}>
            Organization
          </label>
          <select
            id="organization_id"
            name="organization_id"
            required
            defaultValue={valueFor("organization_id") || ""}
            key={`org-${valueFor("organization_id")}`}
            className={selectClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {orgOptions}
          </select>
        </div>
        <div>
          <label htmlFor="primary_platform_id" className={labelClass}>
            Platform
          </label>
          <select
            id="primary_platform_id"
            name="primary_platform_id"
            required
            defaultValue={valueFor("primary_platform_id")}
            key={`platform-${valueFor("primary_platform_id")}`}
            className={selectClass}
          >
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="role_family_id" className={labelClass}>
            Role family
          </label>
          <select
            id="role_family_id"
            name="role_family_id"
            required
            defaultValue={valueFor("role_family_id")}
            key={`role-${valueFor("role_family_id")}`}
            className={selectClass}
          >
            {roleFamilies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="country_code" className={labelClass}>
            Country
          </label>
          <select
            id="country_code"
            name="country_code"
            required
            defaultValue={valueFor("country_code") as "US" | "CA"}
            key={`country-${valueFor("country_code")}`}
            className={selectClass}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="location_label" className={labelClass}>
            Location label
          </label>
          <input
            id="location_label"
            name="location_label"
            defaultValue={valueFor("location_label")}
            key={`loc-${valueFor("location_label")}`}
            placeholder="e.g. Remote — US or Toronto, ON (hybrid)"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="remote_policy" className={labelClass}>
            Remote policy
          </label>
          <select
            id="remote_policy"
            name="remote_policy"
            required
            defaultValue={valueFor("remote_policy") as JobFormDefaults["remote_policy"]}
            key={`remote-${valueFor("remote_policy")}`}
            className={selectClass}
          >
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>
        <div>
          <label htmlFor="employment_type" className={labelClass}>
            Employment type
          </label>
          <select
            id="employment_type"
            name="employment_type"
            required
            defaultValue={valueFor("employment_type") as JobFormDefaults["employment_type"]}
            key={`employment-${valueFor("employment_type")}`}
            className={selectClass}
          >
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            required
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as JobFormDefaults["status"])
            }
            className={selectClass}
          >
            <option value="draft">Draft</option>
            <option value="pending_review">In review</option>
            <option value="open">Open</option>
            <option value="filled">Filled</option>
            <option value="unpublished">Unpublished</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="hidden" name="previous_status" value={previousStatus} />
          {willStrandApplicants ? (
            <div className="mt-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">
                {activeApplicationsCount} active application
                {activeApplicationsCount === 1 ? " is" : "s are"} still waiting on
                a response.
              </p>
              <p className="mt-1">
                Switching this listing to <em>{labelForStatus(status)}</em>{" "}
                hides the public page and removes the listing from the
                employer&apos;s active queue without telling those applicants.
                The clean way is to{" "}
                <strong>Close with outcome</strong> from the employer dashboard
                (Hired here / Hired elsewhere / Pulled the role) — that fans
                out the right notifications and feeds analytics.
              </p>
              <label className="mt-3 inline-flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="ack_unpublish"
                  value="1"
                  className="mt-0.5 h-4 w-4 border-amber-400"
                />
                <span>
                  I understand and want to{" "}
                  {status === "unpublished" ? "unpublish" : "revert to draft"}{" "}
                  anyway. Applicants will be left without an outcome.
                </span>
              </label>
            </div>
          ) : null}
        </div>
        <fieldset className="sm:col-span-2 border border-hairline bg-page p-4">
          <legend className={`${labelClass} px-1`}>
            Featured slot
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={Boolean(valueFor("is_featured"))}
                key={`featured-${valueFor("is_featured")}`}
              />
              Promote this listing to the featured slot
            </label>
            <div>
              <label htmlFor="featured_until" className={labelClass}>
                Promo ends (optional)
              </label>
              <input
                id="featured_until"
                name="featured_until"
                type="date"
                defaultValue={valueFor("featured_until")}
                key={`featured-until-${valueFor("featured_until")}`}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">
                Leave blank for an open-ended promo. Past dates auto-demote.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Listing kind</legend>
          <div className="mt-3 flex flex-wrap gap-6 text-sm text-foreground">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="listing_kind"
                value="employer"
                checked={listingKind === "employer"}
                onChange={() => {
                  setListingKind("employer");
                }}
              />
              Employer (full description on TheCOE)
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="listing_kind"
                value="syndicated"
                checked={listingKind === "syndicated"}
                onChange={() => setListingKind("syndicated")}
              />
              Syndicated (summary + external apply)
            </label>
          </div>
        </fieldset>
      </div>

      {listingKind === "syndicated" ? (
        <div className="space-y-6">
          <div>
            <label htmlFor="summary" className={labelClass}>
              Short summary
            </label>
            <textarea
              id="summary"
              name="summary"
              rows={4}
              defaultValue={valueFor("summary")}
              key={`summary-${valueFor("summary")}`}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="external_apply_url" className={labelClass}>
              External apply URL
            </label>
            <input
              id="external_apply_url"
              name="external_apply_url"
              type="url"
              defaultValue={valueFor("external_apply_url")}
              key={`apply-${valueFor("external_apply_url")}`}
              placeholder="https://"
              className={inputClass}
            />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="full_description" className={labelClass}>
            Full description (Markdown)
          </label>
          <textarea
            id="full_description"
            name="full_description"
            rows={14}
            defaultValue={valueFor("full_description")}
            key={`fd-${valueFor("full_description")}`}
            className={inputClass}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save job"}
        </button>
        <Link
          href="/admin/jobs"
          className="inline-flex h-11 items-center justify-center border border-hairline bg-surface px-6 text-xs font-medium uppercase tracking-[0.12em] text-muted hover:border-foreground hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
