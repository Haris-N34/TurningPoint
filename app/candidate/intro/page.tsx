import { Onboarding } from "@/components/onboarding/Onboarding";
import { getScenario } from "@/content/scenarios";
export const metadata = { title: "Before your challenge | Turning Point" };
export default function IntroPage() {
  const scenario = getScenario("launch-week") ?? getScenario("sample")!;
  return <Onboarding scenarioId={scenario.id} title={scenario.title} />;
}
