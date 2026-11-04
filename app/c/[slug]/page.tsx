import { ChallengePlay } from "@/components/play/ChallengePlay";

export default async function ChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ChallengePlay slug={slug} />;
}
