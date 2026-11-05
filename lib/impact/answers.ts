import type { SkillSlug } from "@/lib/engine/skills";

// Synthetic answer variants for the 200-candidate demo cohort (E7.4), so the compare view (E4.1)
// shows different people saying different things. Each variant names the exact quote that backs
// its skill; the seed checks the quote is a substring of the text before using it (G1).
// Index 0 is the fixture's original answer. All stories are fictional.

export type AnswerVariant = { text: string; quote: string; sentence: string };
export type CheckpointVariants = { checkpointId: string; skill: SkillSlug; variants: AnswerVariant[] };

export const ANSWER_VARIANTS: CheckpointVariants[] = [
  {
    checkpointId: "cp1",
    skill: "collaboration",
    variants: [
      { text: "I asked who was free when, because two volunteers already wanted social media and nobody wanted deliveries or set-up. Then I paired Ari, who has run markets before, with a new volunteer on logistics. If I had just assigned it, whoever got stuck alone with logistics would check out by Wednesday. It cost us fifteen minutes on Monday, but I'd rather lose fifteen minutes than lose a volunteer.", quote: "It cost us fifteen minutes on Monday, but I'd rather lose fifteen minutes than lose a volunteer.", sentence: "Weighs fifteen minutes against losing a volunteer and pairs people up." },
      { text: "Honestly I didn't know who was good at what yet. Asking who was free when showed me who could actually do Saturday deliveries. I paired the two people who wanted social media with one logistics shift each, so nobody was stuck alone.", quote: "I paired the two people who wanted social media with one logistics shift each, so nobody was stuck alone.", sentence: "Shares the logistics work so nobody carries it alone." },
      { text: "Assigning logistics would have been faster. But the last club I was in fell apart because one person decided everything. I asked when people were free, then let each pair split deliveries and set-up between them.", quote: "I asked when people were free, then let each pair split deliveries and set-up between them.", sentence: "Lets each pair own how they split the logistics." },
      { text: "I asked each person what they had done before and when they were free. Logistics went to someone who had run a bake sale, paired with a first-timer. It took an extra fifteen minutes, which was the cost.", quote: "Logistics went to someone who had run a bake sale, paired with a first-timer.", sentence: "Pairs experience with a newcomer on the hardest job." },
    ],
  },
  {
    checkpointId: "cp2",
    skill: "prioritization",
    variants: [
      { text: "I kept Saturday and Sunday because the vendors had already paid for two days of stock, and families come for the food, not the stage. So I cut promotion, decorations and the stage, and protected both market days. That hurts the two bands we booked and the market looks plainer, so I called both bands myself that morning. Losing a day would have cost the vendors more than it cost us.", quote: "So I cut promotion, decorations and the stage, and protected both market days.", sentence: "Protects both market days for vendors over the stage and promotion, and says why." },
      { text: "We could not afford the full programme. Both days already had vendor bookings, so I kept the days whole and cut the stage and the decorations. It cost us the music people hoped for, but no vendor lost money they had already spent.", quote: "Both days already had vendor bookings, so I kept the days whole and cut the stage and the decorations.", sentence: "Keeps the booked days whole and drops the extras." },
      { text: "I listed what each cut would break. Losing a day broke the vendors' sales. Losing the stage and the posters just made it quieter. So the stage went. It cost us some of the walk-in crowd.", quote: "Losing a day broke the vendors' sales. Losing the stage and the posters just made it quieter.", sentence: "Compares what each cut would break before choosing." },
      { text: "It cost us goodwill with the bands who had planned around the stage. I picked it anyway because the vendor days were promises to people whose income depended on them, and I thought those mattered more.", quote: "the vendor days were promises to people whose income depended on them, and I thought those mattered more.", sentence: "Puts commitments to vendors ahead of the programme extras." },
    ],
  },
  {
    checkpointId: "rl",
    skill: "adaptability",
    variants: [
      { text: "Two summers ago I ran a community garden with about fifty student volunteers. In the second summer our funder pulled out in June. I sat down with the three team leads, we dropped the workshop series, and we asked the local hardware store for donated soil instead of buying it. We finished the season with half the budget.", quote: "we asked the local hardware store for donated soil instead of buying it.", sentence: "Replaced bought soil with a donation after funding fell through." },
      { text: "Last year I tutored at a homework club and the room we used was closed for repairs with a week's notice. I moved sessions to the public library and switched half of them to video calls. Attendance dropped at first, then came back. We kept every student through the term.", quote: "I moved sessions to the public library and switched half of them to video calls.", sentence: "Moves sessions to a new place and format when the room closes." },
      { text: "At my part-time job the scheduling app went down during the holiday rush. I made a paper schedule on the back room wall and texted everyone a photo each morning. It was messy for two weeks. We covered every shift.", quote: "I made a paper schedule on the back room wall and texted everyone a photo each morning.", sentence: "Builds a paper fallback when the scheduling app fails." },
      { text: "In a group project our data source got taken offline halfway through. I suggested we survey students ourselves instead. It was smaller data but it was ours. We handed it in on time and explained the limits in the report.", quote: "I suggested we survey students ourselves instead.", sentence: "Replaces a lost data source with the team's own survey." },
    ],
  },
  {
    checkpointId: "fu",
    skill: "resilience",
    variants: [
      { text: "I wrote to every volunteer myself before the group chat found out. I said what we were cutting and what we were keeping, and I asked who still had time. Most people stayed, a few left, and that was fine.", quote: "Most people stayed, a few left, and that was fine.", sentence: "Keeps most volunteers after sharing hard news directly." },
      { text: "I told them at the start of the next session, in person. I said it was going to be harder for a while and that I had underestimated it. Next time I would check the backup plan before anything goes wrong.", quote: "Next time I would check the backup plan before anything goes wrong.", sentence: "Owns a misjudgment and names what to do differently." },
      { text: "I messaged the team that night. Some people were annoyed and said so. I listened, changed one thing they asked for, and we kept going. I learned to share bad news early instead of fixing it alone first.", quote: "I learned to share bad news early instead of fixing it alone first.", sentence: "Takes pushback, changes something, and learns from it." },
      { text: "I called the two people most affected first, then posted to everyone. It didn't go perfectly. One person quit. After that I started keeping a short list of who to tell first when plans change.", quote: "I started keeping a short list of who to tell first when plans change.", sentence: "Turns a hard moment into a habit for next time." },
    ],
  },
];
