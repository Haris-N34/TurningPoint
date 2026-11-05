import type { SkillSlug } from "@/lib/engine/skills";

// Hallucination eval (PRD v2 B3): 20 answers where the truth for the target skill is "Not observed".
// Each answer is real-sounding and on topic, but shows nothing for that skill. The scanner must not
// invent evidence: it has to say "Not observed" on at least 19 of 20.

export type HallucinationCase = { id: string; skill: SkillSlug; transcript: string };

export const HALLUCINATION_CASES: HallucinationCase[] = [
  { id: "h01", skill: "analytical", transcript: "I went with the second option. It felt right at the time and I moved on to the next problem." },
  { id: "h02", skill: "empathy", transcript: "I picked the cheaper venue. The budget was tight and I wanted to keep the money for later in the week." },
  { id: "h03", skill: "curiosity", transcript: "I handed the stall problem to Theo. He was free and he had done it before, which made it easy." },
  { id: "h04", skill: "collaboration", transcript: "Honestly I just chose option C. I can't really remember why now, it was a while ago in the game." },
  { id: "h05", skill: "creativity", transcript: "I deferred the sponsor call until the afternoon. The morning was already full of other things." },
  { id: "h06", skill: "feedback", transcript: "I went to the vendor first. The vendor was closest to where I was standing on the map." },
  { id: "h07", skill: "resilience", transcript: "I picked A. The first answer usually works for me, and it did here as well." },
  { id: "h08", skill: "analytical", transcript: "The client wanted a new plan. I told them we would have it by Thursday and then I wrote it up." },
  { id: "h09", skill: "empathy", transcript: "I kept the original hall. Moving would have meant reprinting all the posters and I did not want that." },
  { id: "h10", skill: "curiosity", transcript: "I chose the faster delivery. It cost a bit more but it arrived on time for the opening." },
  { id: "h11", skill: "communication", transcript: "I ignored the noise complaint for now. There were bigger problems on the board at that point." },
  { id: "h12", skill: "prioritization", transcript: "The data showed sales were flat in the north region. I read the chart and picked the option about the north." },
  { id: "h13", skill: "adaptability", transcript: "I kept the plan exactly as it was. I liked the plan." },
  { id: "h14", skill: "collaboration", transcript: "I did the budget sheet myself. It took about twenty minutes in the game and it balanced at the end." },
  { id: "h15", skill: "creativity", transcript: "I paid the full price the vendor asked for. That was the number on the invoice." },
  { id: "h16", skill: "feedback", transcript: "I moved to the next issue straight away. Nothing else happened with that one after I picked." },
  { id: "h17", skill: "ambiguity", transcript: "I asked Maya to check the stock count. She came back with the number and I wrote it down." },
  { id: "h18", skill: "resilience", transcript: "Everything went fine in that part. I picked B and the vendor was happy with it." },
  { id: "h19", skill: "analytical", transcript: "I talked to the client about the logo colours. They liked blue, so we kept it blue." },
  { id: "h20", skill: "empathy", transcript: "I closed the ticket. The fix was already in from yesterday, I only had to press the button." },
];
