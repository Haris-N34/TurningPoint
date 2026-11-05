import { AddonRun } from "@/components/addon/AddonRun";

export default async function AddonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AddonRun id={id} />;
}
