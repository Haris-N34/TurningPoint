import { notFound } from "next/navigation";
import { TemplatePlay } from "@/components/play/TemplatePlay";
import { getScenario, SCENARIO_IDS } from "@/content/scenarios";

export function generateStaticParams() {
  return SCENARIO_IDS.map((scenarioId) => ({ scenarioId }));
}

export default async function PlayPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  if (!getScenario(scenarioId)) notFound();
  return <TemplatePlay scenarioId={scenarioId} />;
}
