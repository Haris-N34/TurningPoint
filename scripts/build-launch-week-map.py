# Generates content/maps/launch-week.json (v2 map scenario). Edit here, then run:
#   python3 scripts/build-launch-week-map.py
# Wording, NPC voice and trade-offs are open for Haris's review (#44).
import json, pathlib

def opt(id, label, effects=None, reaction=("note", "neutral", None), explain=False, minutes=0, unlocks=None, requires=None, kpi=None):
    o = {"id": id, "label": label, "effects": effects or {}, "reaction": {"emote": reaction[0], "expression": reaction[1]}}
    if len(reaction) > 2 and reaction[2]: o["reaction"]["line"] = reaction[2]
    if explain: o["explainOnPick"] = True
    if minutes: o["minutes"] = minutes
    if unlocks: o["unlocks"] = unlocks
    if requires: o["requires"] = requires
    if kpi: o["kpi"] = kpi
    return o

def node(id, npc, lines, prompt, options):
    return {"id": id, "npc": npc, "lines": [{"who": w, "text": t, "expression": e} for (w, t, e) in lines], "prompt": prompt, "options": options}

def issue(id, title, npc, zone, node, severity, talk, skills, spawn=None, deadline=None, lifetime=None, eligible=False, expire=None, delegable=True, delegate=None, tags=None):
    i = {"id": id, "title": title, "npc": npc, "zone": zone, "node": node, "severity": severity, "talkCost": talk, "skillSignals": skills,
         "checkpointEligible": eligible, "delegable": delegable, "onExpire": expire or {"effects": {}}}
    if spawn: i["spawnAt"] = spawn
    if deadline: i["deadline"] = deadline
    if lifetime: i["lifetime"] = lifetime
    if delegate: i["delegateEffects"] = delegate
    if tags: i["tags"] = tags
    return i

look = lambda skin, hair, style, outfit, accent=None, extra="none": {k: v for k, v in dict(skin=skin, hair=hair, hairStyle=style, outfit=outfit, accent=accent, extra=extra).items() if v is not None}

zones = [
    {"id": "gate", "name": "Entrance Gate", "x": 17, "y": 1, "w": 6, "h": 3},
    {"id": "volunteers", "name": "Volunteer Station", "x": 3, "y": 4, "w": 9, "h": 6},
    {"id": "vendors", "name": "Vendor Row", "x": 26, "y": 4, "w": 12, "h": 6},
    {"id": "hq", "name": "HQ Tent", "x": 16, "y": 12, "w": 8, "h": 5},
    {"id": "storage", "name": "Storage Shed", "x": 3, "y": 19, "w": 8, "h": 6},
    {"id": "sponsor", "name": "Sponsor Office", "x": 28, "y": 19, "w": 9, "h": 6},
    {"id": "stage", "name": "Main Stage", "x": 14, "y": 23, "w": 12, "h": 6},
]

npcs = [
    {"id": "priya", "name": "Priya", "role": "Volunteer lead", "zone": "volunteers", "tile": {"x": 7, "y": 7}, "portrait": "priya",
     "look": look("#8d5a3b", "#1f1720", "bun", "#2f7f73", "#e9d8b8"), "volunteer": {"reliability": 0.8}},
    {"id": "theo", "name": "Theo", "role": "Logistics volunteer", "zone": "storage", "tile": {"x": 7, "y": 22}, "portrait": "logistics-volunteer",
     "look": look("#f1c9a5", "#c4462a", "spiky", "#2d3a5c", "#f08a24", "vest"), "volunteer": {"reliability": 0.65}},
    {"id": "sam", "name": "Sam", "role": "Volunteer", "zone": "volunteers", "tile": {"x": 5, "y": 8}, "portrait": "priya",
     "look": look("#c68a5e", "#3b2a20", "short", "#6b4fa0"), "volunteer": {"reliability": 0.45}, "ambient": True},
    {"id": "rosa", "name": "Rosa", "role": "Bakery stall", "zone": "vendors", "tile": {"x": 28, "y": 7}, "portrait": "vendor-1",
     "look": look("#f0c8a8", "#c9c4c0", "curly", "#7a2e3a", "#e0a43a", "apron")},
    {"id": "kenji", "name": "Kenji", "role": "Dumpling truck", "zone": "vendors", "tile": {"x": 32, "y": 7}, "portrait": "vendor-2",
     "look": look("#e8b98f", "#1c1a1d", "short", "#3f6b3a")},
    {"id": "amara", "name": "Amara", "role": "Produce stall", "zone": "vendors", "tile": {"x": 36, "y": 7}, "portrait": "vendor-3",
     "look": look("#6b4430", "#2a1d18", "long", "#c47a2c")},
    {"id": "okafor", "name": "Mr. Okafor", "role": "Sponsor rep", "zone": "sponsor", "tile": {"x": 32, "y": 22}, "portrait": "mr-okafor",
     "look": look("#5a3a28", "#8a8a8a", "short", "#283a5c", "#e39a2d", "glasses")},
    {"id": "dana", "name": "Dana", "role": "Non-profit lead", "zone": "stage", "tile": {"x": 20, "y": 25}, "portrait": "dana",
     "look": look("#7a4a32", "#3a2418", "curly", "#a6482a")},
    {"id": "laptop", "name": "HQ laptop", "role": "Your desk", "zone": "hq", "tile": {"x": 20, "y": 14}, "portrait": "laptop",
     "look": look("#000000", "#000000", "bald", "#000000")},
]

nodes = [
    node("n-roles", "priya", [("priya", "Two volunteers want social media. Nobody's on deliveries or set-up, and both need cover by Saturday.", "worried")],
         "How do you split the roles?", [
        opt("a", "Assign roles myself and post a checklist", {"morale": -8}, ("sweat", "neutral", "Clear, but a couple of them look flat.")),
        opt("b", "Ask who's free when, then pair people on logistics", {"morale": 6}, ("heart", "happy", "I'll pair someone experienced with someone new. That's cover."), minutes=15),
        opt("c", "Take logistics myself so the team stays happy", {"morale": 10, "budget": 0}, ("note", "worried", "You sure you have time for that?"), explain=True, minutes=30),
    ]),
    node("n-vendor-mix", "rosa", [("rosa", "I need the fee by tomorrow. Trucks pay more, but small stalls bring the neighbours.", "neutral")],
         "What vendor mix and fee do you set?", [
        opt("a", "Mostly local stalls at a low fee", {"budget": -300, "trust.vendors": 10, "trust.community": 5}, ("heart", "happy", "The neighbours will love that.")),
        opt("b", "Mix: two trucks pay more, the rest stay cheap", {"budget": 200, "trust.vendors": 4}, ("note", "neutral", "Balanced. I can work with it.")),
        opt("c", "Big-name trucks only, highest fees", {"budget": 900, "trust.vendors": -12, "trust.community": -8}, ("anger", "angry", "So we're out, then."), explain=True),
    ]),
    node("n-permit", "theo", [("theo", "The food permit form isn't filed. The city office closes early tomorrow.", "worried")],
         "How do you handle the permit?", [
        opt("a", "Drop everything and file it in person now", {"trust.partner": 6}, ("heart", "happy", "Legend. Filed."), minutes=60),
        opt("b", "Theo files it; I check the form first", {"trust.partner": 3, "morale": 4}, ("note", "happy", "On it.")),
        opt("c", "Pay a runner $150 to file it", {"budget": -150}, ("note", "neutral", "Done, but that's budget gone.")),
    ]),
    node("n-logo", "okafor", [("okafor", "Our board wants the logo on every table, banner and bag. That was the deal.", "neutral")],
         "What do you say?", [
        opt("a", "Yes to everything, keep the sponsor happy", {"budget": -200, "trust.community": -4}, ("heart", "happy", "Wonderful.")),
        opt("b", "Banner and stage only, and say why", {"trust.community": 3}, ("note", "neutral", "Reasonable. I'll take it back.")),
        opt("c", "Push back: the market isn't an ad", {"trust.community": 5, "budget": 0}, ("anger", "angry", "That's not how partnerships work."), explain=True),
    ]),
    node("n-schedule", "priya", [("priya", "Ari and Jess are both on Saturday set-up. Clean-up has nobody, and Jess leaves at noon.", "worried")],
         "How do you fix the schedule?", [
        opt("a", "Rebuild the rota myself tonight", {"morale": -3}, ("sweat", "neutral"), minutes=45),
        opt("b", "Ask who can swap to clean-up, then confirm the new shifts", {"morale": 6}, ("heart", "happy", "They both said yes.")),
        opt("c", "Leave it, sort it on the day", {"morale": -6}, ("sweat", "worried", "That makes me nervous.")),
    ]),
    node("n-vendor-cut", "kenji", [("kenji", "Another festival offered me more for the same weekend. I need $400 extra to stay.", "angry")],
         "What do you offer Kenji?", [
        opt("a", "No more money, but the best spot by the gate", {"trust.vendors": 4}, ("note", "neutral", "Hm. Foot traffic is money. Deal.")),
        opt("b", "Pay the extra $400 to keep Kenji", {"budget": -400, "trust.vendors": -3}, ("heart", "happy", "Now we're talking."), explain=True),
        opt("c", "Offer $200 more and a smaller stall", {"budget": -200, "trust.vendors": 2}, ("note", "neutral", "Fine.")),
        opt("d", "Let him walk and replace him", {"trust.vendors": -8, "trust.community": -2}, ("anger", "angry", "Your loss."), explain=True),
    ]),
    node("n-signups", "dana", [("dana", "Only twelve families have signed up. Last year's market had sixty by now.", "worried")],
         "How do you get the word out?", [
        opt("a", "Flyers through the school newsletters", {"budget": -120, "trust.community": 8}, ("heart", "happy", "The schools will share it.")),
        opt("b", "Paid social ads", {"budget": -500, "trust.community": 3}, ("note", "neutral")),
        opt("c", "Ask vendors to promote it to their customers", {"trust.vendors": 2, "trust.community": 5}, ("note", "happy", "I'll ask what they can share. They need the details today.")),
    ]),
    node("n-fridge", "theo", [("theo", "The fridge rental fell through. Without cold storage, half the food can't be sold.", "worried")],
         "What do you do about cold storage?", [
        opt("a", "Rent a pricier fridge today", {"budget": -600}, ("note", "neutral")),
        opt("b", "Borrow the church's walk-in fridge", {"trust.partner": 4}, ("heart", "happy", "They said yes!"), minutes=30),
        opt("c", "Cut the dairy and meat vendors", {"trust.vendors": -10, "budget": 100}, ("anger", "worried", "Two vendors are furious."), explain=True),
    ]),
    # One recovery node per disruption. Option ids and KPIs on n-recovery stay fixed so old sponsor logs replay.
    node("n-recovery", "laptop", [("you", "The sponsor's gone, and most of the budget with it. I need a plan that fits what's left.", "worried")],
         "What is your recovery plan?", [
        opt("a", "Run Saturday only; protect vendor access and food safety", {"morale": 4}, ("note", "neutral"), kpi={"coreBudgetShare": 0.8}),
        opt("b", "Keep Saturday and Sunday; cut promotion, decorations and the stage", {"morale": -4, "trust.community": -4}, ("sweat", "worried"), kpi={"coreBudgetShare": 0.6}, explain=True),
        opt("c", "Move the market back two days and rebuild with partners", {"morale": -6, "trust.vendors": -6}, ("question", "worried"), kpi={"coreBudgetShare": 0.7}, explain=True),
        opt("d", "Keep the full programme and chase replacement funding", {"morale": 2}, ("sweat", "worried"), kpi={"coreBudgetShare": 0.3}),
    ]),
    node("n-recovery-venue", "laptop", [("you", "We lost the site and the backup costs more. Everyone needs to know where to go.", "worried")],
         "Where does the market happen now?", [
        opt("a", "Book the school field nearby and keep the full vendor list", {"trust.vendors": 4, "morale": -2}, ("note", "neutral"), kpi={"coreBudgetShare": 0.7}),
        opt("b", "Shrink into the church car park: fewer stalls, food and families first", {"trust.vendors": -6, "trust.community": 2}, ("sweat", "worried"), kpi={"coreBudgetShare": 0.8}, explain=True),
        opt("c", "Move the market back a week and keep the original layout", {"morale": -6, "trust.vendors": -8, "trust.community": -4}, ("question", "worried"), kpi={"coreBudgetShare": 0.5}, explain=True),
    ]),
    node("n-recovery-cover", "laptop", [("you", "Priya leaves Thursday. Her set-up and gate shifts on Saturday have nobody on them yet.", "worried")],
         "How do you cover Priya's shifts?", [
        opt("a", "Cover the gate myself and move Theo to lead set-up", {"morale": 2}, ("note", "neutral"), kpi={"coreBudgetShare": 0.8}),
        opt("b", "Share her shifts across the team; drop the late clean-up", {"morale": -4}, ("sweat", "worried"), kpi={"coreBudgetShare": 0.75}, explain=True),
        opt("c", "Pay a college student to take her shifts", {"budget": -400, "morale": 4}, ("note", "happy"), kpi={"coreBudgetShare": 0.5}, explain=True),
    ]),
    node("n-shaken", "priya", [("priya", "The group chat went quiet after the news. Two people asked if it's even happening.", "worried")],
         "How do you reassure the team?", [
        opt("a", "Call everyone in today: the new plan and what stays", {"morale": 12}, ("heart", "happy", "That helped. People feel included.")),
        opt("b", "Post a short update in the chat", {"morale": 4}, ("note", "neutral")),
        opt("c", "Say nothing until the plan is final", {"morale": -10}, ("sweat", "worried", "People are guessing the worst."), explain=True),
    ]),
    node("n-vendors-moved", "rosa", [("rosa", "So where do we set up now? I need power for my oven and a time to unload.", "worried")],
         "What do you tell the vendors?", [
        opt("a", "Send every vendor a site map and load-in times today", {"trust.vendors": 10}, ("heart", "happy", "That's all I needed.")),
        opt("b", "Walk the new site with vendors before handing out spots", {"trust.vendors": 6, "trust.community": 2}, ("note", "happy"), minutes=45),
        opt("c", "Tell them to come early and sort spots on the day", {"trust.vendors": -8}, ("anger", "angry", "With an oven? That won't work."), explain=True),
    ]),
    node("n-handover", "priya", [("priya", "Before I go, I want to hand over properly: the rota, the vendor contacts, the gate float.", "neutral")],
         "How do you take over Priya's work?", [
        opt("a", "Sit down with Priya and Theo and write it all down", {"morale": 4}, ("heart", "happy", "Good. Nothing gets lost."), minutes=30),
        opt("b", "Ask Priya to send her notes tonight", {"morale": -2}, ("note", "neutral", "I'll try, but some of it is in my head.")),
        opt("c", "Split it: the rota to Theo, the vendor contacts to me", {"morale": 2}, ("note", "neutral"), explain=True),
    ]),
    node("n-lost-lead", "theo", [("theo", "Everyone liked working with Priya. The new ones are asking who they report to now.", "worried")],
         "How do you steady the team?", [
        opt("a", "Tell the team today who leads what from Thursday", {"morale": 10}, ("heart", "happy", "Clear. That helps.")),
        opt("b", "Ask Theo to step up as lead and tell the team", {"morale": 6}, ("exclaim", "happy", "Me? Okay. I'll do it.")),
        opt("c", "Let things settle and see who steps up", {"morale": -8}, ("sweat", "worried", "People are just waiting around."), explain=True),
    ]),
    node("n-vendors-worried", "rosa", [("rosa", "Is the market still on? I've ordered flour for two days. What do I tell my supplier?", "worried")],
         "What do you tell the vendors?", [
        opt("a", "Tell them the truth today: what changes and what doesn't", {"trust.vendors": 10}, ("heart", "happy", "Thank you for being straight with us.")),
        opt("b", "Say everything is fine for now", {"trust.vendors": -6}, ("question", "worried", "I still need dates and stall details to plan."), explain=True),
        opt("c", "Offer refunds on fees to anyone who wants out", {"budget": -300, "trust.vendors": 6}, ("note", "happy")),
    ]),
    node("n-new-partner", "dana", [("dana", "The credit union offers $800 if you pitch this afternoon, or $500 for a written plan. They want an answer today.", "happy")],
         "Do you go after the new partner?", [
        opt("a", "Pitch it myself this afternoon", {"budget": 800, "trust.partner": 4}, ("heart", "happy", "They're in!"), minutes=60),
        opt("b", "Send Dana with my one-page plan", {"budget": 500, "trust.partner": 2}, ("note", "happy")),
        opt("c", "Skip it, we have enough to do", {}, ("sweat", "worried")),
    ]),
    node("n-feedback", "dana", [("dana", "Families want an activity they can join without buying anything. I still don't see one. Can we make room?", "angry")],
         "How do you respond to Dana's feedback?", [
        opt("a", "Ask what matters most, then add a free kids' activity", {"trust.partner": 10, "trust.community": 6}, ("heart", "happy", "Thank you. Let's add a kids' corner."), kpi={"feedback": "open"}),
        opt("b", "Defend the plan and keep the programme as it is", {"trust.partner": -4}, ("note", "neutral", "I hear you. I still think it's off."), kpi={"feedback": "defensive"}),
        opt("c", "Say there's no time for changes now", {"trust.partner": -10}, ("anger", "angry"), kpi={"feedback": "dismissive"}, explain=True),
    ]),
    node("n-supplies", "theo", [("theo", "After the cuts we're short eight tables and two tents.", "worried")],
         "How do you cover the shortfall?", [
        opt("a", "Borrow from the school and the library", {"trust.community": 4}, ("heart", "happy"), minutes=30),
        opt("b", "Rent what's missing", {"budget": -350}, ("note", "neutral")),
        opt("c", "Vendors bring their own tables", {"trust.vendors": -5}, ("sweat", "worried")),
    ]),
    node("n-weather", "theo", [("theo", "40% chance of rain Saturday morning. The gym is free, but it has less stall space.", "worried")],
         "What's the call?", [
        opt("a", "Book the gym as a backup, decide Friday night", {"budget": -150}, ("note", "happy", "Good, a plan B.")),
        opt("b", "Keep the outdoor layout and accept the rain risk", {}, ("sweat", "worried")),
        opt("c", "Move indoors now to be safe", {"trust.vendors": -4, "budget": -250}, ("note", "neutral")),
    ]),
    node("n-dropout", "amara", [("amara", "I'm sorry. My supplier fell through and I can't come tomorrow.", "worried")],
         "What do you do about the gap?", [
        opt("a", "Give her spot to a community group for free", {"trust.community": 6}, ("heart", "happy")),
        opt("b", "Spread the other stalls out", {}, ("note", "neutral")),
        opt("c", "Find a last-minute vendor at a discount", {"budget": -100, "trust.vendors": 3}, ("note", "happy"), minutes=30),
    ]),
    node("n-permit-fine", "theo", [("theo", "The city called. Without the permit we get fined, or shut down Saturday.", "angry")],
         "How do you fix it now?", [
        opt("a", "Pay the late fee and file today", {"budget": -250}, ("note", "neutral")),
        opt("b", "Ask Dana to rush the filing through the non-profit", {"trust.partner": -4}, ("sweat", "worried")),
    ]),
    node("n-kenji-leaves", "kenji", [("kenji", "I'm packing up. I'll do the food festival instead.", "angry")],
         "Last chance. What do you say?", [
        opt("a", "Offer the extra $200 as a final compromise", {"budget": -200, "trust.vendors": 2}, ("note", "neutral")),
        opt("b", "Wish him well and fill the spot", {"trust.vendors": -4}, ("note", "neutral")),
    ]),
]

E = lambda **kw: {"effects": {k.replace("__", "."): v for k, v in kw.items()}}
issues = [
    issue("roles", "Nobody wants logistics", "priya", "volunteers", "n-roles", "medium", 45, ["collaboration", "prioritization"], spawn="Mon 09:00", deadline="Mon 15:00", eligible=True, expire=E(morale=-8), delegate={"morale": 2}),
    issue("vendor-mix", "Vendor mix and fees", "rosa", "vendors", "n-vendor-mix", "medium", 45, ["prioritization", "communication"], spawn="Mon 10:00", deadline="Tue 10:00", eligible=True, expire=E(trust__vendors=-10), delegable=False),
    issue("permit", "Food permit not filed", "theo", "storage", "n-permit", "high", 30, ["prioritization", "problem-solving"], spawn="Mon 13:00", deadline="Tue 10:00", expire={"effects": {"trust.partner": -8}, "spawn": "permit-fine"}, delegate={}),
    issue("logo", "Sponsor wants logos everywhere", "okafor", "sponsor", "n-logo", "low", 30, ["communication", "empathy"], spawn="Mon 14:30", deadline="Mon 17:30", expire=E(trust__community=-3), delegable=False),
    issue("schedule", "Saturday rota clash", "priya", "volunteers", "n-schedule", "medium", 30, ["collaboration"], spawn="Tue 09:30", deadline="Tue 13:00", eligible=True, expire=E(morale=-6), delegate={"morale": 1}),
    issue("vendor-cut", "Kenji wants a bigger cut", "kenji", "vendors", "n-vendor-cut", "medium", 45, ["communication", "prioritization"], spawn="Tue 11:00", deadline="Tue 17:00", eligible=True, expire={"effects": {"trust.vendors": -5}, "spawn": "kenji-leaves"}, delegable=False),
    issue("signups", "Low sign-ups", "dana", "stage", "n-signups", "medium", 30, ["communication", "creativity"], spawn="Tue 13:30", deadline="Tue 17:30", expire=E(trust__community=-8), delegate={"trust.community": 3}),
    issue("fridge", "Fridge rental fell through", "theo", "storage", "n-fridge", "high", 45, ["problem-solving", "creativity"], spawn="Tue 15:00", deadline="Wed 10:00", eligible=True, expire=E(trust__vendors=-8, budget=-200), delegate={}),
    issue("recovery-plan", "Recovery plan", "laptop", "hq", "n-recovery", "high", 60, ["adaptability", "resilience", "prioritization"], lifetime=480, eligible=True, delegable=False, tags=["recovery"], expire=E(morale=-10)),
    issue("team-shaken", "The team is shaken", "priya", "volunteers", "n-shaken", "medium", 30, ["empathy", "communication", "resilience"], lifetime=360, eligible=True, expire=E(morale=-12), delegable=False),
    issue("vendors-worried", "Vendors ask if it's still on", "rosa", "vendors", "n-vendors-worried", "high", 30, ["communication", "empathy"], lifetime=420, expire=E(trust__vendors=-12), delegate={"trust.vendors": 2}),
    issue("recovery-venue", "Find a new site", "laptop", "hq", "n-recovery-venue", "high", 60, ["adaptability", "resilience", "prioritization"], lifetime=480, eligible=True, delegable=False, tags=["recovery"], expire=E(morale=-10)),
    issue("vendors-moved", "Vendors need the new layout", "rosa", "vendors", "n-vendors-moved", "high", 30, ["communication", "problem-solving"], lifetime=420, expire=E(trust__vendors=-12), delegate={"trust.vendors": 2}),
    issue("recovery-cover", "Cover Priya's shifts", "laptop", "hq", "n-recovery-cover", "high", 60, ["adaptability", "resilience", "prioritization"], lifetime=480, eligible=True, delegable=False, tags=["recovery"], expire=E(morale=-10)),
    issue("handover", "Priya's handover", "priya", "volunteers", "n-handover", "high", 30, ["collaboration", "communication"], lifetime=420, expire=E(morale=-6, trust__vendors=-6), delegable=False),
    issue("lost-lead", "The team lost its lead", "theo", "storage", "n-lost-lead", "medium", 30, ["empathy", "collaboration", "resilience"], lifetime=360, eligible=True, expire=E(morale=-12), delegable=False),
    issue("new-partner", "A possible new sponsor", "dana", "stage", "n-new-partner", "medium", 30, ["creativity", "adaptability"], spawn="Thu 09:30", deadline="Thu 15:00", delegable=False),
    issue("feedback", "Dana's critical feedback", "dana", "stage", "n-feedback", "medium", 45, ["feedback", "empathy"], spawn="Thu 11:00", deadline="Thu 17:00", eligible=True, delegable=False, tags=["feedback"], expire=E(trust__partner=-10)),
    issue("supplies", "Short of tables and tents", "theo", "storage", "n-supplies", "medium", 30, ["creativity", "problem-solving"], spawn="Thu 13:00", deadline="Fri 11:00", expire=E(trust__vendors=-6), delegate={"trust.community": 2}),
    issue("weather", "Rain forecast for Saturday", "theo", "storage", "n-weather", "medium", 30, ["ambiguity", "adaptability"], spawn="Fri 09:30", deadline="Fri 14:00", eligible=True, expire=E(trust__community=-5), delegate={}),
    issue("dropout", "A vendor drops out", "amara", "vendors", "n-dropout", "high", 30, ["adaptability", "problem-solving"], spawn="Fri 11:00", deadline="Fri 16:00", expire=E(trust__community=-6), delegable=False),
    issue("permit-fine", "City fine threatened", "theo", "storage", "n-permit-fine", "high", 30, ["problem-solving"], lifetime=120, expire=E(trust__partner=-12, budget=-300), delegable=False),
    issue("kenji-leaves", "Kenji is packing up", "kenji", "vendors", "n-kenji-leaves", "medium", 30, ["communication"], lifetime=120, expire=E(trust__vendors=-6), delegable=False),
]

scenario = {
    "id": "launch-week", "version": 2, "title": "Launch Week",
    "summary": "Spend five weekdays preparing a weekend community market with a local non-profit. Problems appear across the site and the clock is running. Midweek, the plan breaks.",
    "role": "Student lead", "industryFlavour": "non-profit",
    "targetSkills": ["prioritization", "adaptability", "resilience", "collaboration"],
    "estimatedMinutes": 14,
    "map": {"tiled": "/maps/launch-week.json", "width": 40, "height": 30, "start": "hq"},
    "resources": {"budget": {"label": "Budget", "start": 5000, "unit": "$"}, "morale": {"label": "Team morale", "start": 70}},
    "stakeholders": [{"id": "vendors", "label": "Vendors", "start": 60}, {"id": "partner", "label": "Non-profit partner", "start": 65}, {"id": "community", "label": "Community", "start": 55}],
    "zones": zones, "npcs": npcs, "nodes": nodes, "issues": issues,
    "turningPoint": {
        "at": "Wed 09:00",
        "pool": ["sponsor-pulls-out", "venue-cancels", "lead-volunteer-quits"],
        "disruptions": [
            {"id": "sponsor-pulls-out", "title": "The main sponsor pulls out", "caller": "okafor",
             "text": "I'm sorry. Our board has withdrawn the sponsorship, effective today. We can't fund the market.",
             "budgetCut": 0.6, "effects": {"morale": -10}, "darkZone": "sponsor", "spawn": ["recovery-plan", "team-shaken", "vendors-worried"]},
            {"id": "venue-cancels", "title": "The venue cancels", "caller": "dana",
             "text": "The site owner cancelled our booking. The replacement costs more, so there's less for the programme. We need to rework the weekend.",
             "budgetCut": 0.3, "effects": {"morale": -12, "trust.vendors": -8}, "spawn": ["recovery-venue", "team-shaken", "vendors-moved"]},
            {"id": "lead-volunteer-quits", "title": "Your lead volunteer leaves", "caller": "priya",
             "text": "I got the paid internship. I start Thursday. Paid cover will cost us, but I can brief someone today.",
             "budgetCut": 0.2, "effects": {"morale": -25}, "spawn": ["recovery-cover", "handover", "lost-lead"]},
        ],
    },
    "deferReasons": ["Something more urgent first", "Waiting for information", "Someone else is better placed", "Low impact, can wait"],
    "variation": {"budget.start": [4500, 5500]},
}
out = pathlib.Path(__file__).resolve().parent.parent / "content/maps/launch-week.json"
out.write_text(json.dumps(scenario, indent=2) + "\n")
print("wrote", out, len(issues), "issues")
