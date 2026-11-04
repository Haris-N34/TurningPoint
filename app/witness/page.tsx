import { RoleHome } from "@/components/site/RoleHome";
export default function WitnessHome() {
  return <RoleHome eyebrow="Witness" title="You saw it happen. Help tell the story."><p>A candidate can invite someone who saw their real-life turning point to confirm the experience.</p><div className="rounded-xl border bg-card p-6 text-card-foreground"><h2 className="font-semibold">Have an invitation?</h2><p className="mt-2 text-sm text-muted-foreground">Open the personal witness link the candidate shared with you. No account is needed. You can confirm the story or say you cannot confirm it.</p></div><p>A witness adds context. They do not decide whether someone gets hired.</p></RoleHome>;
}
