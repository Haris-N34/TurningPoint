import { RoleHome } from "@/components/site/RoleHome";
export default function AdminHome() {
  return <RoleHome eyebrow="Employer admin" title="Give capability a place to show up."><p>Choose the skills your role needs, then put them in context with a story-based challenge.</p><div className="rounded-xl border bg-card p-6 text-card-foreground"><h2 className="font-semibold">The challenge builder is coming next</h2><p className="mt-2 text-sm text-muted-foreground">For now, switch to Candidate in the demo role picker to explore the sample experience your candidates will see.</p></div><p>One shared skill framework. Evidence you can trace. Decisions that stay with your team.</p></RoleHome>;
}
