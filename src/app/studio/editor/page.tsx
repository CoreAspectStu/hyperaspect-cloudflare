import TemplateEditorClient from "./TemplateEditorClient";

/**
 * Dev entry to open the timeline editor directly on a template, pre-render.
 * Reachable at /studio/editor?template=<id> (defaults to "deal-01").
 * Server component: Next 16 hands `searchParams` as a Promise, so we await it
 * and pass the resolved id to the client host that mounts <TimelineEditor>.
 */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  return <TemplateEditorClient templateId={template || "deal-01"} />;
}
