// The shared skill framework (PRD E1, extended to 12 in v2 A12). Merged from the case's ET-7 and WEF skills.
export const SKILLS = [
  { slug: "problem-solving", name: "Problem-solving", definition: "Breaks a messy situation into parts and finds a workable fix." },
  { slug: "adaptability", name: "Adaptability", definition: "Changes the plan when the situation changes, without losing the goal." },
  { slug: "resilience", name: "Resilience (failing forward)", definition: "Recovers from a setback and uses it to do better next time." },
  { slug: "ambiguity", name: "Decision-making under ambiguity", definition: "Makes a reasoned call when information is missing or unclear." },
  { slug: "prioritization", name: "Prioritization", definition: "Chooses what matters most when time, money or people are limited." },
  { slug: "creativity", name: "Creativity with limited resources", definition: "Finds new ways to get results with less." },
  { slug: "collaboration", name: "Collaboration", definition: "Shares work, listens, and brings people along." },
  { slug: "empathy", name: "Empathy", definition: "Notices how decisions land on other people and acts on it." },
  { slug: "communication", name: "Communication", definition: "Explains decisions clearly to the people affected." },
  { slug: "feedback", name: "Responding to feedback", definition: "Takes critical feedback on board and changes something because of it." },
  { slug: "analytical", name: "Analytical thinking", definition: "Reads data and evidence carefully and draws the conclusion it actually supports." },
  { slug: "curiosity", name: "Curiosity and discovery", definition: "Goes looking for information nobody handed over, and uses what they find." },
] as const;

export type SkillSlug = (typeof SKILLS)[number]["slug"];
export const SKILL_SLUGS = SKILLS.map((s) => s.slug) as [SkillSlug, ...SkillSlug[]];
