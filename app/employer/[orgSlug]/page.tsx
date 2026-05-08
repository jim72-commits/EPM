import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function EmployerOrgIndexPage({ params }: PageProps) {
  const { orgSlug } = await params;
  redirect(`/employer/${orgSlug}/jobs`);
}
