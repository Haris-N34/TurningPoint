import { ChallengePlay } from "@/components/play/ChallengePlay";

export default async function PreviewPage({ params }: { params: Promise<{ challengeId: string }> }) {
  const { challengeId } = await params;
  return <ChallengePlay challengeId={challengeId} sandbox />;
}
