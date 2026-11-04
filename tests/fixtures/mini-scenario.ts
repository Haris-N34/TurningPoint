// A small valid scenario used by unit tests. Real content lives in content/scenarios (Haris).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const miniScenario = (): any => ({
  id: "mini",
  version: 1,
  title: "Mini",
  industryFlavour: "non-profit",
  targetSkills: ["adaptability", "prioritization"],
  start: "s1",
  resources: {
    budget: { label: "Budget", start: 5000, min: 0, unit: "$" },
    morale: { label: "Team morale", start: 70, min: 0, max: 100 },
    time: { label: "Days left", start: 21, min: 0 },
  },
  variation: { "budget.start": [4000, 6000], teamSize: [6, 10] },
  disruptions: [
    { id: "sponsor-pulls-out", title: "Sponsor pulls out", text: "Your main sponsor is gone.", effects: { budget: -3000 }, next: "c4" },
    { id: "venue-cancels", title: "Venue cancels", text: "The venue cancelled.", effects: { time: -5 }, next: "c4" },
    { id: "lead-volunteer-quits", title: "Lead quits", text: "Your lead volunteer quit.", effects: { morale: -30 }, next: "c4" },
  ],
  disruptionPool: ["sponsor-pulls-out", "venue-cancels", "lead-volunteer-quits"],
  nodes: [
    { id: "s1", type: "scene", text: "You lead a team of {teamSize}.", next: "c1" },
    {
      id: "c1", type: "choice", text: "Who runs logistics?", checkpointEligible: true, skillSignals: ["collaboration"],
      options: [
        { id: "a", label: "Assign roles yourself", effects: { morale: -10, time: -1 }, next: "c2" },
        { id: "b", label: "Let the team vote", effects: { morale: 5, time: -2 }, next: "c2" },
      ],
    },
    {
      id: "c2", type: "choice", text: "Vendor mix?", checkpointEligible: true,
      options: [
        { id: "a", label: "Cheap vendors", effects: { budget: -500 }, next: "e1" },
        { id: "b", label: "Premium vendors", effects: { budget: -2000, morale: 10 }, next: "e1" },
      ],
    },
    { id: "e1", type: "event", turningPoint: true, text: "Something breaks." },
    {
      id: "c4", type: "choice", text: "What do you protect?", checkpointEligible: true,
      options: [
        { id: "a", label: "Cut scope", effects: { time: 2 }, next: "c5" },
        { id: "b", label: "Find a new partner", effects: { time: -3 }, next: "c5" },
        { id: "c", label: "Rally the team", effects: { morale: 15 }, next: "c5" },
      ],
    },
    {
      id: "c5", type: "choice", text: "Debrief?", checkpointEligible: true,
      options: [
        { id: "a", label: "Ask for critical feedback", effects: {}, next: "rl" },
        { id: "b", label: "Skip it", effects: { time: 1 }, next: "rl" },
      ],
    },
    { id: "rl", type: "checkpoint", kind: "real_life", text: "When have you faced something like this?", next: "end" },
    { id: "end", type: "end", text: "Market day is over." },
  ],
});
