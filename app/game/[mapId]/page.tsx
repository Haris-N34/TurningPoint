import { notFound } from "next/navigation";
import { GameShell } from "@/components/game2/GameShell";
import { getMapScenario, MAP_IDS } from "@/content/maps";

export function generateStaticParams() {
  return MAP_IDS.map((mapId) => ({ mapId }));
}

export default async function GamePage({ params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const s = getMapScenario(mapId);
  if (!s) notFound();
  return <GameShell mapId={mapId} challenge={{ id: `map-${mapId}`, title: s.title, company: "Turning Point demo" }} />;
}
