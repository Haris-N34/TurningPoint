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
      { text: "I let the team vote because two people already wanted social media and nobody wanted logistics. If I assigned it, the person stuck with logistics would check out by week two. The trade-off is it cost us two days, but I'd rather lose two days than lose a volunteer.", quote: "I'd rather lose two days than lose a volunteer.", sentence: "Weighs losing two days against losing a volunteer and picks the team." },
      { text: "Honestly I didn't know who was good at what yet. A vote let people pick the job they would actually show up for. I asked the two who lost the vote what they wanted next time, and I wrote it down so I would remember.", quote: "I asked the two who lost the vote what they wanted next time", sentence: "Follows up with the people who lost the vote." },
      { text: "Assigning it would have been faster. But the last club I was in fell apart because one person decided everything. I wanted people to own their piece from day one, so I let them choose and stayed out of it.", quote: "I wanted people to own their piece from day one", sentence: "Lets the team choose roles so they own the work." },
      { text: "I asked each person what they had done before, then let them vote with that on the table. Logistics went to someone who had run a bake sale. It took an extra meeting, which was the cost.", quote: "I asked each person what they had done before, then let them vote with that on the table.", sentence: "Gathers each person's experience before the team decides." },
    ],
  },
  {
    checkpointId: "cp2",
    skill: "prioritization",
    variants: [
      { text: "When the sponsor pulled out I cut the second weekend instead of cutting vendor spots. The vendors were the reason people came, and some of them had already paid for stock. I told the team the same day so nobody heard it secondhand.", quote: "I cut the second weekend instead of cutting vendor spots.", sentence: "Protects vendor spots over a second weekend, and says why." },
      { text: "We could not afford both weekends. The first weekend already had bookings, so I kept it whole and dropped the second one. It cost us the bigger crowd we hoped for, but nobody lost money they had already spent.", quote: "The first weekend already had bookings, so I kept it whole and dropped the second one.", sentence: "Keeps the booked weekend whole and drops the other." },
      { text: "I listed what each option would break. Fewer vendors broke the market itself. One weekend just made it smaller. So the weekend went. It cost us about half the visitors.", quote: "Fewer vendors broke the market itself. One weekend just made it smaller.", sentence: "Compares what each cut would break before choosing." },
      { text: "It cost us some goodwill with the volunteers who had planned around the second weekend. I picked it anyway because vendor spots were promises to people outside the team, and I thought those mattered more.", quote: "vendor spots were promises to people outside the team", sentence: "Puts commitments to outside people ahead of team plans." },
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
