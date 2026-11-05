# Generates content/maps/client-pivot.json ("The Client Pivot", PRD v2 A12). Edit here, then run:
#   python3 scripts/build-client-pivot-map.py && python3 scripts/build-map.py client-pivot
# Wording, NPC voice and trade-offs are open for Haris's review.
import json, pathlib

def opt(id, label, effects=None, reaction=("note", "neutral"), explain=False, minutes=0, unlocks=None, requires=None, kpi=None):
    o = {"id": id, "label": label, "effects": effects or {}, "reaction": {"emote": reaction[0], "expression": reaction[1]}}
    if len(reaction) > 2 and reaction[2]:
        o["reaction"]["line"] = reaction[2]
    if explain: o["explainOnPick"] = True
    if minutes: o["minutes"] = minutes
    if unlocks: o["unlocks"] = unlocks
    if requires: o["requires"] = requires
    if kpi: o["kpi"] = kpi
    return o

def node(id, npc, lines, prompt, options, charts=None):
    n = {"id": id, "npc": npc, "lines": [{"who": w, "text": t, "expression": e} for (w, t, e) in lines], "prompt": prompt, "options": options}
    if charts: n["charts"] = charts
    return n

def issue(id, title, npc, zone, node, severity, talk, skills, spawn=None, deadline=None, lifetime=None, eligible=False, expire=None, delegable=True, delegate=None, tags=None, hidden=False):
    i = {"id": id, "title": title, "npc": npc, "zone": zone, "node": node, "severity": severity, "talkCost": talk, "skillSignals": skills,
         "checkpointEligible": eligible, "delegable": delegable, "onExpire": expire or {"effects": {}}}
    if spawn: i["spawnAt"] = spawn
    if deadline: i["deadline"] = deadline
    if lifetime: i["lifetime"] = lifetime
    if delegate: i["delegateEffects"] = delegate
    if tags: i["tags"] = tags
    if hidden: i["hidden"] = True
    return i

look = lambda skin, hair, style, outfit, accent=None, extra="none": {k: v for k, v in dict(skin=skin, hair=hair, hairStyle=style, outfit=outfit, accent=accent, extra=extra).items() if v is not None}
E = lambda **kw: {"effects": {k.replace("__", "."): v for k, v in kw.items()}}

zones = [
    {"id": "bus-stop", "name": "Bus Stop", "x": 17, "y": 1, "w": 6, "h": 3},
    {"id": "pod", "name": "Team Pod", "x": 3, "y": 4, "w": 9, "h": 6},
    {"id": "partner-office", "name": "Partner's Office", "x": 26, "y": 4, "w": 12, "h": 6},
    {"id": "desk", "name": "Your Desk", "x": 16, "y": 12, "w": 8, "h": 5},
    {"id": "whiteboard", "name": "Whiteboard Room", "x": 3, "y": 19, "w": 8, "h": 6},
    {"id": "cafe", "name": "Café", "x": 28, "y": 19, "w": 9, "h": 6},
    {"id": "client", "name": "Client Site (by bus)", "x": 14, "y": 23, "w": 12, "h": 6, "remote": True},
]

npcs = [
    {"id": "dev", "name": "Tomi", "role": "Developer", "zone": "pod", "tile": {"x": 6, "y": 7}, "portrait": "developer",
     "look": look("#6b4430", "#2a1d18", "curly", "#6e2a3a"), "volunteer": {"reliability": 0.7}},
    {"id": "analyst", "name": "Mei", "role": "Data analyst", "zone": "pod", "tile": {"x": 9, "y": 7}, "portrait": "analyst",
     "look": look("#f0c8a8", "#1f1a20", "long", "#2f6f68", None, "glasses"), "volunteer": {"reliability": 0.75}},
    {"id": "partner", "name": "Mr. Adeyemi", "role": "Consulting partner", "zone": "partner-office", "tile": {"x": 32, "y": 7}, "portrait": "partner",
     "look": look("#8d5a3b", "#8a8a8a", "short", "#3a3d45", "#efe4cf")},
    {"id": "manager", "name": "Rachel", "role": "Store manager", "zone": "client", "tile": {"x": 17, "y": 25}, "portrait": "store-manager",
     "look": look("#f1c9a5", "#b24a28", "bun", "#4f6b32", "#efe4cf", "vest")},
    {"id": "cfo", "name": "Mr. Lindqvist", "role": "Client CFO", "zone": "client", "tile": {"x": 23, "y": 25}, "portrait": "cfo",
     "look": look("#e8c0a0", "#9a9a9a", "short", "#283a5c", "#a3242c", "glasses")},
    {"id": "former", "name": "Gloria", "role": "Former client employee", "zone": "cafe", "tile": {"x": 32, "y": 22}, "portrait": "former-employee",
     "look": look("#7a4a32", "#c9c4c0", "curly", "#c4892c")},
    {"id": "kai", "name": "Kai", "role": "Store employee on break", "zone": "client", "tile": {"x": 20, "y": 27}, "portrait": "store-employee",
     "look": look("#d9a17a", "#3a2418", "short", "#3f6b3a", "#efe4cf", "apron")},
    {"id": "old-report", "name": "A dusty binder", "role": "2019 rollout report", "zone": "whiteboard", "tile": {"x": 9, "y": 23}, "portrait": "prop:report",
     "look": look("#000000", "#000000", "bald", "#000000")},
    {"id": "laptop", "name": "Your laptop", "role": "Data dashboards", "zone": "desk", "tile": {"x": 20, "y": 15}, "portrait": "laptop",
     "look": look("#000000", "#000000", "bald", "#000000")},
]

CHARTS = [
    {"title": "Stockouts per week", "unit": "", "points": [["Big stores", 3], ["Mid stores", 5], ["Small stores", 19]]},
    {"title": "Food waste (% of stock)", "unit": "%", "points": [["2023", 4], ["2024", 4], ["2025", 5]]},
    {"title": "Weekly orders placed by hand", "unit": "", "points": [["Big stores", 2], ["Mid stores", 6], ["Small stores", 14]]},
]

nodes = [
    node("n-kickoff", "partner", [("partner", "The client says 'modernise inventory'. That's not a brief. What do they actually need from us by Friday?", "neutral")],
         "How do you frame the problem?", [
        opt("a", "Pin down one measurable goal with the client first", {"trust.firm": 8}, ("heart", "happy", "Good. A goal we can be held to.")),
        opt("b", "Start building a full system comparison right away", {"morale": -4}, ("sweat", "worried", "That's a lot of work toward an unclear goal.")),
        opt("c", "Ask the team what they think the brief is", {"morale": 4, "trust.firm": 2}, ("note", "neutral")),
    ]),
    node("n-data", "laptop", [("you", "Three dashboards from the client. Mei pulled them last night.", "neutral")],
         "What's the finding that matters?", [
        opt("a", "Stockouts are concentrated in the small stores, where orders are placed by hand", {"trust.firm": 6}, ("note", "happy"), kpi={"insight": "correct"}),
        opt("b", "Stockouts are rising everywhere, so every store needs the new system", {}, ("question", "neutral"), kpi={"insight": "partial"}),
        opt("c", "Food waste is the real problem, so lead with waste", {}, ("note", "neutral"), unlocks=["credibility-hit"], kpi={"insight": "wrong"}),
    ], charts=CHARTS),
    node("n-dev-estimate", "dev", [("dev", "Honest answer? Integrating with their old till system is six weeks, not two.", "worried")],
         "What do you do with Tomi's estimate?", [
        opt("a", "Put the real estimate in the plan and flag the risk", {"trust.firm": 4, "morale": 4}, ("heart", "happy", "Thanks for not shaving it down.")),
        opt("b", "Ask him to find a two-week version", {"morale": -8}, ("anger", "angry", "That's how projects fail.")),
        opt("c", "Leave integration out of the recommendation", {"trust.cfo": -4}, ("sweat", "worried"), explain=True),
    ]),
    node("n-manager-visit", "manager", [("manager", "Last time head office 'modernised', my staff spent a month typing everything twice.", "angry")],
         "What do you ask her?", [
        opt("a", "Ask her to walk you through how orders work today", {"trust.manager": 10}, ("heart", "happy", "Nobody from head office has asked me that.")),
        opt("b", "Reassure her the new system is much better", {"trust.manager": -4}, ("question", "neutral", "They all say that.")),
        opt("c", "Promise nothing changes for her team", {"trust.manager": 4, "trust.cfo": -4}, ("note", "neutral"), explain=True),
    ]),
    node("n-analyst-model", "analyst", [("analyst", "I can forecast demand per store or per region. Per store is more accurate but takes two extra days.", "neutral")],
         "Which forecast model?", [
        opt("a", "Per store for the small stores only", {"morale": 3}, ("note", "happy", "Smart. That's where the problem is.")),
        opt("b", "Per store everywhere", {"morale": -4}, ("sweat", "worried"), minutes=60),
        opt("c", "Per region, it's good enough", {}, ("note", "neutral")),
    ]),
    node("n-pitch-manager", "manager", [("manager", "So what are you actually recommending? In plain words, please.", "neutral")],
         "How do you explain it to the store manager?", [
        opt("a", "'Your small stores stop running out of milk, and you stop typing orders by hand.'", {"trust.manager": 12}, ("heart", "happy", "Now that I understand."), kpi={"fit": "good"}),
        opt("b", "'We'll deploy a cloud ERP with ML-driven demand forecasting and API integration.'", {"trust.manager": -8}, ("question", "worried", "...What?"), kpi={"fit": "poor"}),
        opt("c", "'Kai told me the night shift reorders from memory. This fixes that first.'", {"trust.manager": 16}, ("heart", "happy", "That's exactly it."), requires=["store-employee"], kpi={"fit": "good"}, explain=True),
    ]),
    node("n-phased-plan", "laptop", [("you", "The CFO cut the budget in half and wants a phased plan by Friday. The original plan doesn't fit any more.", "worried")],
         "What goes in phase 1?", [
        opt("a", "Phase 1: the small stores only, where stockouts are worst", {"morale": 4}, ("note", "neutral"), kpi={"coreBudgetShare": 0.85}),
        opt("b", "Phase 1: every store, but without the forecasting", {"morale": -2}, ("sweat", "worried"), kpi={"coreBudgetShare": 0.55}, explain=True),
        opt("c", "Push back and ask for the full budget", {"trust.cfo": -10}, ("anger", "worried"), kpi={"coreBudgetShare": 0.3}, explain=True),
        opt("d", "Phase 1: a cheap pilot in two stores, then decide", {"morale": 2}, ("note", "neutral"), kpi={"coreBudgetShare": 0.7}),
    ]),
    node("n-team-worried", "dev", [("dev", "Half the budget means half the work, right? Are we still doing this properly?", "worried")],
         "What do you tell the team?", [
        opt("a", "Explain the phases and what each person owns now", {"morale": 12}, ("heart", "happy")),
        opt("b", "Tell them to keep going while you figure it out", {"morale": -6}, ("sweat", "worried")),
        opt("c", "Say the scope is the same, just faster", {"morale": -10}, ("anger", "angry"), explain=True),
    ]),
    node("n-cfo-call", "cfo", [("cfo", "I need to know by tonight what you're cutting. Not the theory. What changes.", "angry")],
         "What do you send the CFO?", [
        opt("a", "One page: what's in phase 1, what waits, and the cost of each", {"trust.cfo": 10}, ("note", "happy", "Finally, something I can sign.")),
        opt("b", "The full technical deck with a cover note", {"trust.cfo": -6}, ("question", "angry")),
        opt("c", "Ask for a week to rework everything", {"trust.cfo": -12}, ("anger", "angry"), explain=True),
    ]),
    node("n-pitch-cfo", "cfo", [("cfo", "Convince me phase 1 is worth the money.", "neutral")],
         "How do you make the case to the CFO?", [
        opt("a", "Show phase-1 cost per small store and how fewer stockouts could repay it", {"trust.cfo": 12}, ("heart", "happy", "Show me the costs and assumptions behind that."), kpi={"fit": "good"}),
        opt("b", "Walk him through the architecture diagram", {"trust.cfo": -8}, ("sweat", "worried", "I'm not the IT department."), kpi={"fit": "poor"}),
        opt("c", "Show why the 2019 rollout failed and how phase 1 avoids it", {"trust.cfo": 16}, ("heart", "happy", "You did your homework."), requires=["cafe-chat"], kpi={"fit": "good"}, explain=True),
    ]),
    node("n-feedback", "partner", [("partner", "I read your deck. Honestly, it's unreadable. Twenty slides of features and no answer on slide one.", "angry")],
         "How do you take it?", [
        opt("a", "Ask what he'd put on slide one, and rebuild it around that", {"trust.firm": 10}, ("heart", "happy", "Answer first. Then evidence."), kpi={"feedback": "open"}),
        opt("b", "Explain that the client asked for detail", {"trust.firm": -4}, ("note", "neutral", "Then put the detail at the back."), kpi={"feedback": "defensive"}),
        opt("c", "Say there's no time to change it now", {"trust.firm": -10}, ("anger", "angry"), kpi={"feedback": "dismissive"}, explain=True),
    ]),
    node("n-final-deck", "laptop", [("you", "Friday morning. The deck needs to land in four hours.", "neutral")],
         "What do you change last?", [
        opt("a", "Put the answer on slide one and cut the feature list", {"trust.firm": 6}, ("note", "happy")),
        opt("b", "Add more appendix slides to be safe", {}, ("sweat", "neutral")),
        opt("c", "Add the 2019 lessons-learned slide from the old report", {"trust.cfo": 6, "trust.firm": 4}, ("heart", "happy"), requires=["dusty-report"]),
    ]),
    node("n-dev-blocker", "dev", [("dev", "The client still hasn't sent test data. I can't show the demo without it.", "angry")],
         "What do you do?", [
        opt("a", "Call Rachel and ask for one store's data today", {"trust.manager": 4}, ("note", "happy"), minutes=30),
        opt("b", "Build the demo on made-up numbers", {"trust.cfo": -6}, ("sweat", "worried"), explain=True),
        opt("c", "Drop the demo from the pitch", {"morale": -4}, ("note", "neutral")),
    ]),
    node("n-credibility", "partner", [("partner", "The client's ops lead says your waste number doesn't hold up. Waste moved from 4% to 5%, while small stores have 19 stockouts a week.", "angry")],
         "How do you respond?", [
        opt("a", "Own the misread and re-run the analysis", {"trust.firm": 4}, ("note", "neutral", "Good. Fix it fast.")),
        opt("b", "Defend the waste angle", {"trust.firm": -8, "trust.cfo": -6}, ("anger", "angry")),
    ]),
    node("n-kickoff-miss", "partner", [("partner", "We're two days in and still don't have an agreed goal with the client.", "angry")],
         "What now?", [
        opt("a", "Book 20 minutes with the client today to agree one goal", {"trust.firm": 2}, ("note", "neutral")),
        opt("b", "Keep going and agree it at the end", {"trust.firm": -6}, ("sweat", "worried")),
    ]),
    node("n-manager-escalates", "manager", [("manager", "I heard nothing from you, so I told the CFO I'm against this.", "angry")],
         "Can you win her back?", [
        opt("a", "Apologise and go through the plan with her now", {"trust.manager": 6}, ("note", "neutral")),
        opt("b", "Go over her head to the CFO", {"trust.manager": -10}, ("anger", "angry")),
    ]),
    # Hidden discoveries: optional, never signposted (A12).
    node("n-cafe-chat", "former", [("former", "You're the consultants? I ran stock at the small stores until 2020. The last system failed because nobody asked the night shift.", "neutral")],
         "What do you ask Gloria?", [
        opt("a", "Ask what the night shift actually does", {}, ("heart", "happy", "They reorder from memory. Always have.")),
        opt("b", "Thank her and head back", {}, ("note", "neutral")),
    ]),
    node("n-store-employee", "kai", [("kai", "Honestly? When the system's down at night, we just reorder from memory. Half the stockouts are that.", "neutral")],
         "What do you do with that?", [
        opt("a", "Ask if you can mention it to Rachel", {}, ("note", "happy", "Sure, she knows.")),
        opt("b", "Note it down", {}, ("note", "neutral")),
    ]),
    node("n-dusty-report", "old-report", [("you", "A binder labelled '2019 Inventory Rollout: Lessons Learned'. Nobody has opened it in years.", "neutral")],
         "Do you read it?", [
        opt("a", "Read it properly and take notes", {}, ("exclaim", "happy"), minutes=30),
        opt("b", "Skim the summary", {}, ("note", "neutral")),
    ]),
]

issues = [
    issue("kickoff", "What does the client actually need?", "partner", "partner-office", "n-kickoff", "medium", 30, ["communication", "adaptability"],
          spawn="Mon 09:00", deadline="Mon 12:00", eligible=True, delegable=False, expire={"effects": {"trust.firm": -4}, "spawn": "kickoff-miss"}),
    issue("data-read", "Read the inventory data", "laptop", "desk", "n-data", "high", 45, ["analytical"],
          spawn="Mon 10:00", deadline="Tue 10:00", eligible=True, delegable=False, tags=["data"], expire=E(trust__firm=-8)),
    issue("dev-estimate", "Tomi's integration estimate", "dev", "pod", "n-dev-estimate", "medium", 30, ["communication", "analytical"],
          spawn="Mon 13:00", deadline="Mon 17:30", delegable=False, expire=E(morale=-4)),
    issue("manager-visit", "Rachel is wary of head office", "manager", "client", "n-manager-visit", "medium", 45, ["empathy", "communication", "curiosity"],
          spawn="Tue 09:30", deadline="Tue 13:00", eligible=True, delegable=False, expire=E(trust__manager=-8)),
    issue("analyst-model", "Mei needs a forecast model", "analyst", "pod", "n-analyst-model", "medium", 30, ["analytical", "prioritization"],
          spawn="Tue 11:00", deadline="Tue 16:00", expire=E(morale=-4), delegate={"morale": 1}),
    issue("pitch-manager", "Explain it to the store manager", "manager", "client", "n-pitch-manager", "high", 45, ["communication", "empathy"],
          spawn="Tue 14:00", deadline="Wed 11:00", eligible=True, delegable=False, tags=["pitch"], expire={"effects": {"trust.manager": -6}, "spawn": "manager-escalates"}),
    issue("phased-plan", "Phased plan by Friday", "laptop", "desk", "n-phased-plan", "high", 60, ["adaptability", "prioritization", "creativity"],
          lifetime=480, eligible=True, delegable=False, tags=["recovery"], expire=E(morale=-10)),
    issue("team-worried", "The team is worried", "dev", "pod", "n-team-worried", "medium", 30, ["collaboration", "communication"],
          lifetime=360, eligible=True, delegable=False, expire=E(morale=-10)),
    issue("cfo-call", "The CFO wants to know what changes", "cfo", "client", "n-cfo-call", "high", 30, ["communication", "adaptability"],
          lifetime=420, delegable=False, expire=E(trust__cfo=-10)),
    issue("pitch-cfo", "Make the case to the CFO", "cfo", "client", "n-pitch-cfo", "high", 45, ["communication", "analytical"],
          spawn="Thu 09:30", deadline="Thu 15:00", eligible=True, delegable=False, tags=["pitch"], expire=E(trust__cfo=-10)),
    issue("feedback", "The partner hates your deck", "partner", "partner-office", "n-feedback", "medium", 30, ["feedback"],
          spawn="Thu 11:00", deadline="Thu 17:00", eligible=True, delegable=False, tags=["feedback"], expire=E(trust__firm=-8)),
    issue("final-deck", "Finish the deck", "laptop", "desk", "n-final-deck", "medium", 45, ["communication"],
          spawn="Fri 09:30", deadline="Fri 14:00", delegable=False, expire=E(trust__firm=-6)),
    issue("dev-blocker", "No test data for the demo", "dev", "pod", "n-dev-blocker", "high", 30, ["problem-solving", "adaptability"],
          spawn="Fri 11:00", deadline="Fri 16:00", expire=E(trust__cfo=-4), delegate={"trust.manager": 2}),
    issue("credibility-hit", "Your waste number doesn't hold up", "partner", "partner-office", "n-credibility", "high", 30, ["analytical", "feedback"],
          lifetime=240, delegable=False, expire=E(trust__firm=-10)),
    issue("kickoff-miss", "Still no agreed goal", "partner", "partner-office", "n-kickoff-miss", "medium", 30, ["communication"],
          lifetime=180, delegable=False, expire=E(trust__firm=-6)),
    issue("manager-escalates", "Rachel went to the CFO", "manager", "client", "n-manager-escalates", "high", 30, ["empathy"],
          lifetime=120, delegable=False, expire=E(trust__manager=-8)),
    issue("cafe-chat", "Coffee with a former employee", "former", "cafe", "n-cafe-chat", "low", 30, ["curiosity"],
          spawn="Mon 09:00", hidden=True, delegable=False, tags=["discovery"]),
    issue("store-employee", "A store employee on break", "kai", "client", "n-store-employee", "low", 15, ["curiosity"],
          spawn="Mon 09:00", hidden=True, delegable=False, tags=["discovery"]),
    issue("dusty-report", "A dusty report", "old-report", "whiteboard", "n-dusty-report", "low", 15, ["curiosity", "analytical"],
          spawn="Mon 09:00", hidden=True, delegable=False, tags=["discovery"]),
]

scenario = {
    "id": "client-pivot", "version": 1, "title": "The Client Pivot",
    "summary": "You're a junior analyst at a small tech consultancy. Five days to recommend an inventory system to a regional grocery chain. Midweek, the client's CFO cuts the budget in half.",
    "role": "Junior analyst", "industryFlavour": "tech",
    "targetSkills": ["communication", "analytical", "curiosity", "adaptability"],
    "estimatedMinutes": 14,
    "map": {"tiled": "/maps/client-pivot.json", "width": 40, "height": 30, "start": "desk"},
    "resources": {"budget": {"label": "Project budget", "start": 40000, "unit": "$"}, "morale": {"label": "Team morale", "start": 70}},
    "stakeholders": [{"id": "cfo", "label": "Client CFO", "start": 50}, {"id": "manager", "label": "Store manager", "start": 50}, {"id": "firm", "label": "Your partner", "start": 60}],
    "zones": zones, "npcs": npcs, "nodes": nodes, "issues": issues,
    "turningPoint": {
        "at": "Wed 09:00",
        "pool": ["budget-halved"],
        "disruptions": [
            {"id": "budget-halved", "title": "The CFO halves the budget", "caller": "cfo",
             "text": "Our board has cut this project's budget in half. I need a phased plan from you by Friday. Phase 1 has to pay for itself.",
             "budgetCut": 0.5, "effects": {"morale": -10}, "spawn": ["phased-plan", "team-worried", "cfo-call"]},
        ],
    },
    "deferReasons": ["Something more urgent first", "Waiting for client input", "Someone else is better placed", "Low impact, can wait"],
    "variation": {},
}
out = pathlib.Path(__file__).resolve().parent.parent / "content/maps/client-pivot.json"
out.write_text(json.dumps(scenario, indent=2) + "\n")
print("wrote", out, len(issues), "issues")
