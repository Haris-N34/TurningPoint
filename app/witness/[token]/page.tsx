import { WitnessConfirm } from "@/components/witness/WitnessConfirm";

export default async function WitnessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <WitnessConfirm token={token} />;
}
