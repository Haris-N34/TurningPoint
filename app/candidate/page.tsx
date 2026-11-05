import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RoleHome } from "@/components/site/RoleHome";
export default function CandidateHome() {
  return <RoleHome eyebrow="Candidate" title="Let your next move speak for you."><p>Step into a short sample challenge. Make choices, face a change of plan and explain your thinking at surprise checkpoints.</p><p>Answer by video, voice or text. You can change formats at every checkpoint. Only your words and choices matter, never your face or voice tone.</p><p>This demo saves your progress in this browser. You can pause and return.</p><Button asChild size="lg"><Link href="/candidate/intro">Prepare for your challenge <span aria-hidden>↗</span></Link></Button><Button asChild variant="outline" size="lg"><Link href="/play/sample">Start the sample challenge <span aria-hidden>↗</span></Link></Button><Button asChild variant="outline" size="lg"><Link href="/practice">Practice run, never shared <span aria-hidden>↗</span></Link></Button></RoleHome>;
}
