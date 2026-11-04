import { Results } from "@/components/results/Results";

export default async function ResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <Results attemptId={attemptId} />;
}
