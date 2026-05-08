"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import {
  upsertEmployerJob,
  type UpsertEmployerJobFields,
  type UpsertEmployerJobState,
} from "@/app/employer/[orgSlug]/jobs/actions";
import { slugify } from "@/lib/slugify";

type Option = { id: string; name: string; slug: string };

export type EmployerJobFormDefaults = {
  id?: string;
  slug: string;
  title: string;
  primary_platform_id: string;
  role_family_id: string;
  country_code: "US" | "CA";
  location_label: string;
  remote_policy: "remote" | "hybrid" | "onsite" | "flexible";
  employment_type: "full_time" | "part_time" | "contract";
  summary: string;
  full_description: string;
};

type Props = {
  orgSlug: string;
  defaultValues: EmployerJobFormDefaults;
  platforms: Option[];
  roleFamilies: Option[];
};

const SUMMARY_LIMIT = 280;

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const inputClass =
  "mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

const INITIAL_STATE: UpsertEmployerJobState = {};

export function EmployerJobForm({
  orgSlug,
  defaultValues,
  platforms,
  roleFamilies,
}: Props) {
  const [state, formAction, pending] = useActionState(
    upsertEmployerJob,
    INITIAL_STATE,
  );
  const fields = state.fields;
  const valueFor = <K extends keyof UpsertEmployerJobFields>(
    key: K,
  ): UpsertEmployerJobFields[K] => {
    if (fields && fields[key] !== undefined) return fields[key];
    // defaultValues uses the same keys; cast is safe by construction.
    return defaultValues[key as keyof EmployerJobFormDefaults] as UpsertEmployerJobFields[K];
  };

  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  // Mirror the slug field so we can detect "user has touched it" without
  // ripping the form into a fully controlled component. Only auto-derive
  // when the user hasn't started typing a slug themselves.
  const initialSlug = valueFor("slug");
  const [slugTouched, setSlugTouched] = useState<boolean>(
    initialSlug.length > 0,
  );

  // The summary field needs a live character counter, so it's controlled.
  const [summary, setSummary] = useState<string>(valueFor("summary"));

  function maybeDeriveSlug() {
    if (slugTouched) return;
    const t = titleRef.current?.value ?? "";
    if (slugRef.current) slugRef.current.value = slugify(t);
  }

  return (
    <form action={formAction} className="mx-auto max-w-3xl space-y-8 py-10">
      <input type="hidden" name="org_slug" value={orgSlug} />
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
            onBlur={maybeDeriveSlug}
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
              defaultValue={initialSlug}
              key={`slug-${initialSlug}`}
              onChange={() => setSlugTouched(true)}
              className={`${inputClass} mt-0 flex-1`}
            />
            <button
              type="button"
              className="h-10 shrink-0 border border-hairline bg-page px-3 text-xs font-medium uppercase tracking-[0.1em] text-muted hover:border-foreground hover:text-foreground"
              onClick={() => {
                const t = titleRef.current?.value ?? "";
                if (slugRef.current) slugRef.current.value = slugify(t);
                setSlugTouched(true);
              }}
            >
              From title
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Auto-fills from the title until you edit it. Lowercase, hyphens,
            no spaces.
          </p>
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
            className={inputClass}
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
            className={inputClass}
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
            defaultValue={valueFor("country_code")}
            key={`country-${valueFor("country_code")}`}
            className={inputClass}
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
            defaultValue={valueFor("remote_policy")}
            key={`remote-${valueFor("remote_policy")}`}
            className={inputClass}
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
            defaultValue={valueFor("employment_type")}
            key={`employment-${valueFor("employment_type")}`}
            className={inputClass}
          >
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contract">Contract</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="summary" className={labelClass}>
          Summary (optional)
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={2}
          maxLength={SUMMARY_LIMIT}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One or two sentences candidates see at the top of the listing and on cards."
          className={inputClass}
        />
        <p className="mt-1 flex items-center justify-between text-[11px] text-muted">
          <span>Skip and we&apos;ll show the first lines of the description.</span>
          <span>
            {summary.length}/{SUMMARY_LIMIT}
          </span>
        </p>
      </div>

      <div>
        <label htmlFor="full_description" className={labelClass}>
          Full description (Markdown)
        </label>
        <textarea
          id="full_description"
          name="full_description"
          rows={14}
          required
          defaultValue={valueFor("full_description")}
          key={`fd-${valueFor("full_description")}`}
          className={inputClass}
        />
      </div>

      <p className="border border-hairline bg-page px-4 py-3 text-xs leading-relaxed text-muted">
        Drafts are private. When you submit for review, our moderation team
        typically responds within one business day. Approved listings go
        live immediately and stay free.
      </p>

      <div className="flex flex-wrap gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        <Link
          href={`/employer/${orgSlug}/jobs`}
          className="inline-flex h-11 items-center justify-center border border-hairline px-6 text-sm font-medium text-foreground transition-colors hover:border-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
