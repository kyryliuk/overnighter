---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'RV travel companion app — unified overnight parking, dump stations, water, trip planning, and community intelligence for full-time RVers'
session_goals: 'Validate and expand the core product idea; identify the MVP scope, differentiation from existing tools, monetization angles, and potential feature rabbit holes to avoid'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'SCAMPER Method', 'Reverse Brainstorming']
ideas_generated: [9 features, 4 risk mitigations, 14 validation questions]
workflow_completed: true
session_active: false
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Kyryl
**Date:** 2026-03-15

## Session Overview

**Topic:** RV travel companion app — unified overnight parking, dump stations, water, trip planning, and community intelligence for full-time RVers

**Goals:** Validate and expand the core product idea; identify the MVP scope, differentiation from existing tools, monetization angles, and potential feature rabbit holes to avoid

### Context Guidance

_User is a senior .NET engineer, full-time RVing with wife, cat, and dog in a 2001 Damon Challenger 335 Class A motorhome. Domain expertise: e-commerce, RV travel, electricity. Tech stack preference: Azure, .NET or Python backend, LangChain, LLM APIs (OpenAI/Anthropic), Streamlit/Gradio or simple web app with DB. Living the problem every day — highly authentic founder._

### Session Setup

User has provided a rich, detailed product idea with real lived pain points. Core pain: fragmented information across iOverlander, Campendium, dump station directories, government forest service sites, etc. Forces constant context-switching and manual validation. Key constraints: RV height/clearance routing, free vs. paid sites, community verification of legality and safety, and AI-powered trip planning layer.

---

## Phase 1: Question Storming — Key Discoveries

**Q1 — User Identity**
Two distinct user types: (A) Planner/Retirees — paid campgrounds, trip itineraries; (B) Road Warrior/Boondocker — free spots, real-time ground truth. Kyryl confirmed Road Warrior is the primary user. Potential third: transitioning weekender terrified of full-time life.

**Q2 — Moment of Pain**
Current workflow: manually cross-referencing iOverlander, dump station directories, rest area guides, Walmart lists simultaneously. Pain is not missing data — it's being the integration layer yourself, every single time.

**Q3 — Location Dependency (Critical Insight)**
Rules, infrastructure, and availability vary dramatically by state. Illinois: easy water (truck stops), hard overnight. Florida: fewer Walmarts allow overnight, truck stop water scarce. Arizona/Utah/West: best access via public lands. Static national data is unreliable — recency of community verification is the real value.

**Q4 — Cold Start & Differentiation**
"Better design" is not a moat. Real differentiators: (1) rig-profile-aware filtering — every result pre-filtered for specific vehicle height/length; (2) height-aware routing (bridge clearance) — free, currently only in paid apps; (3) unified aggregation with automated validity checking.

**Q5 — Retention Driver**
The one thing that prevents deletion: app knows YOUR specific rig. Not generic spots — spots your Damon Challenger 335 (Class A) can actually reach, fit, and legally stay at.

**Q6 — Data Strategy**
Coordinates-only scraping: facts, not copyrightable in US (Feist v. Rural Telephone). Safer foundation: BLM/USFS/NPS public APIs + OpenStreetMap (zero legal risk) + manually seeded personal spots. Community re-verification converts seeded coordinates into owned, fresh data. Waze model: seed with existing data, make valuable through verification layer.

**Critical Unknowns Remaining:** Legal/liability if wrong spot info causes harm. Monetization. Why hasn't The Dyrt already built this exact thing?

---

## Phase 2: SCAMPER — Ideas Generated

### MVP Definition (Confirmed)
**Core:** Unified near-me map aggregator. One map, all sources, color-coded by type, filtered for your specific rig. Route planner is v2.
**Design principle:** "If Google Maps already does it well, don't build it. Only build what Google Maps can't do because it doesn't know you have a 40-foot RV."

### Feature Ideas

**[Feature #1]: Planning Handoff**
_Concept:_ App is the planning layer, not the navigation layer. Calculates optimal stop sequence → one-tap opens in Google Maps with waypoints via deep link URL. Zero navigation to build.
_Novelty:_ Doesn't compete with Google Maps. Handles RV-specific logic Google can't.

**[Feature #2]: Dual-Mode MVP**
_Concept:_ Two query modes on same backend: "Plan a trip" (origin → destination → stop sequence → Google Maps handoff) and "Near me now" (GPS → radius → filtered list). Same engine, two entry points.
_Novelty:_ Covers calm planning AND urgent reactive use case. Most apps only do one.

**[Feature #3]: Tiered Stop Checklist**
_Concept:_ Three tiers by frequency. Core (every travel day — always visible): overnight parking, dump station, water fill, fuel. Secondary (every few days): grocery, propane. Occasional (collapsed by default): laundry, pet supplies.
_Novelty:_ UI reflects actual usage patterns, not a feature list. Core needs front and center.

**[Feature #4]: Universal Stop Categories**
_Concept:_ Full household-on-wheels checklist covering all full-timer life logistics: dump, water, propane, laundry, fuel (rig-safe stations), grocery. Groceries excluded from MVP — Google Maps handles that.
_Novelty:_ First app to treat the RV as a full household, not just a vehicle.

**[Feature #5]: Travel Stop Intelligence**
_Concept:_ Recognizes Love's, Pilot, Flying J, TA as multi-need mega stops. Surfaces them when they satisfy 3+ checked needs simultaneously. APIs from these chains are partially queryable — less scraping needed.
_Novelty:_ Reduces total stops needed per trip. Optimization Google Maps can't do.

**[Feature #6]: Unified Near-Me Map (MVP Core)**
_Concept:_ One map (Google Maps/Mapbox base). All sources aggregated — iOverlander coordinates, dump stations, water, Walmart/Cracker Barrel/rest areas, BLM/USFS public lands — as color-coded pins. Filter by type. Tap for details + last verified date + community check-ins.
_Novelty:_ Not a new data source — a new lens over all existing sources simultaneously.

**[Feature #7]: Rig-Aware Filter Badge**
_Concept:_ Every pin pre-filtered for saved rig profile. Greyed-out pins = reported clearance issues for Class A. User never sees a spot they can't physically reach. "Filtered for your rig" badge always visible.
_Novelty:_ Personalization at the data layer. The map IS your rig's map, not a generic map.

**[Feature #8]: Recency Signal as Primary Trust Indicator**
_Concept:_ "Last verified X days ago" shown prominently on every pin. Color coding: green (<7 days), yellow (8–30 days), red (30+ days). Data freshness is the #1 UI element, not buried in comments.
_Novelty:_ Directly addresses the core pain of arriving somewhere and finding stale info.

**[Feature #9]: Multi-Amenity Pin**
_Concept:_ Single pin per physical location. Icons show every confirmed amenity at that spot. Example: [Love's] ⛽ Fuel 🚽 Dump 💧 Water 🧺 Laundry — Last verified: 2 days ago ✅. No duplicate pins, no clutter.
_Novelty:_ Mirrors how traveler thinks — "I'm going to THIS place" not three separate services.

---

## Validation Toolkit

### Facebook / Reddit Hook Post
> "Fellow full-timers — quick question. When you're on the road and need a dump station or overnight spot, what's your actual process? Do you use one app or juggle multiple? What's the most frustrating part of finding this info? Asking because I'm genuinely tired of switching between 5 apps every time."

### Pain Validation Questions (1-on-1 DMs)

**Core pain:**
1. How many apps/websites do you use to find overnight parking, dump stations, and water?
2. How much time do you spend finding these things per travel day?
3. Have you arrived at a spot and found the info was wrong? What happened?
4. What's your biggest frustration with iOverlander / The Dyrt / Campendium?

**Rig-specific:**
5. Do you worry about bridge clearance when planning routes? How do you handle it?
6. Have you had a dangerous moment with a bridge not on your nav app?
7. Do you filter spots by rig size or just read comments to figure it out?

**Community trust:**
8. How much do you trust iOverlander vs. Facebook group vs. calling ahead?
9. How old can a check-in be before you stop trusting it?
10. Do you leave check-ins after visiting a spot? Why or why not?

**Willingness to pay:**
11. Do you pay for any RV-specific apps currently? Which and why?
12. What would make a unified RV app worth $5/month? $10/month?
13. What would make you never delete an RV travel app?

**Killer question (ask last):**
14. "If I built an app that shows overnight parking, dump stations, water, and propane all on one map — filtered for your specific rig — would you use it over what you currently use? What would have to be true for you to switch?"

### Key Hypotheses to Validate
| Hypothesis | Question # |
|---|---|
| People use 3+ apps per trip | #1 |
| Stale data causes real problems | #3 |
| Rig-height filtering is a real need | #5, #6 |
| Community won't contribute check-ins | #10 |
| Someone will pay for this | #11, #12 |

### Target Channels
- Reddit: r/fulltimeRV, r/RVLiving, r/boondocking
- Facebook: "Full Time RV Living", "Boondockers Welcome Community", "RVillage"
- iOverlander's own Facebook group

**Success threshold:** 20 conversations in 2 weeks. If 15/20 say "yes I use multiple apps and hate it" — build. If "iOverlander is fine" — pivot.

---

## Phase 3: Reverse Brainstorming — Risk Analysis

### Failure #1: The Ghost Town Problem
**Risk:** App launches nationally with thin pin density vs. iOverlander's thousands of spots. First-time users see an empty map and uninstall within 60 seconds. No second chance.

**Mitigation — Regional Launch Strategy:**
Launch Florida-only first. 500 Florida-specific spots with dense coverage beats a thin national map. "The best RV app for Florida" is a real value prop. Expand state-by-state after proving density per region. Florida chosen because: year-round snowbird traffic, concentrated travel corridors (I-75, I-95, US-1), high full-timer population.

---

### Failure #2: The Contribution Problem
**Risk:** 90% of users are lurkers. Without community check-ins, data goes stale. After 6 months, every pin shows "Last verified: 180 days ago" — red everywhere. Trust collapses.

**Mitigation A — Geofence Nudge Check-In:**
When user departs a saved spot (geofence exit detected), push notification fires: "How was [Location Name]? 3 taps to confirm." Options: Still Good / Issues / Closed. No typing required. Contribution rate on departure-triggered prompts is 3-5x higher than voluntary check-ins.

**Mitigation B — Confidence Score Over Binary Truth:**
Replace "Verified / Not Verified" with a confidence score: "12 confirmed, 2 reported issues." Shifts liability to community consensus, not the app. More honest. More trusted. Wikipedia model applied to physical locations.

---

### Failure #3: The Solo Dev Death March
**Risk:** Full scope (scraping pipeline + map + community + routing + mobile) is a 24-month project for one engineer working nights and weekends while employed full-time and living in an RV. Scope kills the project before any competitor does.

**Kyryl's honest assessment:** "It's a very big scope to build all of that. Scraping, integrations, services — all require a lot of time. And I don't have a lot of time. I'm a full-time worker."

**Mitigation — The API-Only 8-Week Version:**

| Build | Skip |
|---|---|
| Mapbox/Google Maps base layer | Native mobile app |
| BLM + USFS + NPS official APIs (free, no scraping) | Community check-ins |
| OpenStreetMap Overpass API for dump/water (free, legal) | Trip planner |
| Static Walmart overnight JSON (~300 locations, seeded once) | Bridge clearance routing |
| Rig profile saved to localStorage (no accounts) | Backend auth system |
| Responsive web app only | Scraping anything |

Honest build estimate for a senior .NET dev: **6-8 weeks of evenings.**

---

### Failure #4: The "Still Need iOverlander" Problem
**Risk:** The API-only version has zero community discovery. Users will use it for known-category searches (dump near me, water near me) but return to iOverlander to discover new spots. The app becomes App #1 instead of App #5 — better, but not a destination.

**Kyryl's honest assessment:** "I will be using that app just for simple planning and checking because everything is together — but I will definitely be coming back to iOverlander to check for places, because I will not have the ability to get new fresh places from community."

**Mitigation — Accept v1 as Planning Utility, Not Discovery Platform:**
The product is a complement to iOverlander in Phase 0, not a replacement. It solves: "I know what I need, where is it near me right now, can my rig reach it?" iOverlander stays for discovery. The two-phase product plan:

| Phase | What it is | Scope |
|---|---|---|
| Phase 0 | Personal tool — public APIs only, solves YOUR planning pain | 6-8 weeks |
| Phase 1 | Public beta — add simple spot submission (3-tap, no typing) | +4 weeks |
| Phase 2 | Community platform — geofence check-ins, confidence scores, discovery | +2 months |

---

## Idea Organization and Prioritization

### Thematic Organization

**Theme 1: Core Map Experience (Ship First)**
The non-negotiable foundation. Every other feature depends on this.
- Feature #6: Unified Near-Me Map — one map, all sources, color-coded pins
- Feature #7: Rig-Aware Filter Badge — every pin pre-filtered for saved rig profile
- Feature #8: Recency Signal — "Last verified X days ago" as #1 UI element
- Feature #9: Multi-Amenity Pin — single pin per location showing all services

**Theme 2: Stop Intelligence (Ship First)**
Makes the map useful, not just pretty.
- Feature #3: Tiered Stop Checklist — core/secondary/occasional frequency tiers
- Feature #5: Travel Stop Intelligence — Love's/Pilot/Flying J as multi-need mega-stops

**Theme 3: Planning Layer (v1.1)**
Adds destination-based use case on top of the near-me engine.
- Feature #1: Planning Handoff — Google Maps deep link route export
- Feature #2: Dual-Mode MVP — "near me now" + "plan a trip" on same backend

**Theme 4: Data & Infrastructure (Foundation Decisions)**
Legal and technical strategy underpinning everything.
- Legal foundation: BLM/USFS/NPS public APIs + OpenStreetMap (zero legal risk)
- Seed layer: Static Walmart overnight JSON + Cracker Barrel + rest areas
- Coordinates-only rule: facts not copyrightable (Feist v. Rural Telephone, 1991)
- Regional launch: Florida-first for density before national expansion

**Theme 5: Community & Trust (Phase 1-2)**
What converts the app from utility to platform.
- Geofence Nudge Check-In — departure-triggered 3-tap confirmation
- Confidence Score — "12 confirmed, 2 reported issues" over binary verified/not
- Community re-verification — Waze model: seed data → community makes it fresh

---

### Prioritization Results

**Must Have — Phase 0 MVP (6-8 weeks):**
1. Rig profile input (height, length, class — saved to localStorage, no account required)
2. Map base (Mapbox free tier or Google Maps)
3. Data from: BLM/USFS/NPS APIs, OpenStreetMap Overpass, static Walmart JSON
4. Color-coded pins by category: overnight / dump / water / fuel
5. Rig-height filter — grey out pins with known clearance issues for Class A
6. Recency badge — green/yellow/red based on last-updated date
7. Multi-amenity single pin per location
8. Tiered filter UI — core categories always visible, secondary collapsed
9. Responsive web app (mobile-friendly, no native app)
10. Florida-first data coverage (500+ spots before national expansion)

**Should Have — v1.1 (+4 weeks after validation):**
- Simple spot submission (3-tap, no typing, photos optional)
- Google Maps handoff for route planning (deep link URL generation)
- Travel Stop Intelligence (truck stop multi-need detection)
- Basic "plan a trip" mode (origin → destination → stop sequence)

**Nice to Have — Phase 2 (+2 months after user growth):**
- Geofence Nudge Check-In (departure-triggered contribution)
- Confidence score system (replaces binary verified/not)
- Community discovery feed (new spots from community)
- Bridge clearance routing (height-aware route filter)

**Rabbit Holes to Avoid (explicitly out of scope):**
- Native iOS/Android app (responsive web first)
- User accounts and authentication (localStorage is sufficient for rig profile)
- Scraping from paid/protected sources in v1 (legal complexity, time cost)
- Grocery store integration (Google Maps already does this well)
- In-app navigation (Google Maps handoff is the right answer)
- National launch at day one (ghost town problem)

---

### Action Plans

**Action #1 — Validate Before Building (Week 1-2)**
_Why:_ Spending 8 weeks building before validating is the biggest risk of all.

Next Steps:
1. Post Facebook/Reddit hook post in r/fulltimeRV, r/boondocking, "Full Time RV Living" group
2. Conduct 20 1-on-1 conversations using the Pain Validation Questions from the Validation Toolkit
3. Focus on Questions #1 (apps used), #3 (stale data problems), #5-6 (bridge clearance), #10 (contribution habits)
4. Decision gate: If 15/20 say "yes I juggle multiple apps and hate it" → proceed to build. If "iOverlander is fine" → pivot.

**Action #2 — Define Data Pipeline (Week 2-3, parallel to validation)**
_Why:_ The biggest unknown is how hard the data pipeline actually is to build.

Next Steps:
1. Test BLM API (`api.blm.gov`) — evaluate coverage and data quality for overnight camping
2. Test USFS Recreation API (`apps.fs.usda.gov/Recreation`) — same evaluation
3. Test OpenStreetMap Overpass API — query for `amenity=sanitary_dump_station` and `amenity=water_point`
4. Manually build Walmart overnight JSON (publicly available lists exist on Github/Reddit)
5. Estimate: how many Florida spots does this give you before writing any scraping code?

**Action #3 — Build Phase 0 (Weeks 3-10, conditional on validation)**
_Why:_ Only start building after validation gate is passed.

Stack recommendation (based on Kyryl's preferences):
- Backend: .NET minimal API or Python FastAPI on Azure App Service
- Database: Azure Cosmos DB (geospatial queries, schemaless for varied spot data)
- Map: Mapbox GL JS (free tier generous, better for custom pins)
- Frontend: Streamlit (fastest to ship) OR simple React SPA (better mobile UX)
- Deployment: Azure Static Web Apps (frontend) + Azure App Service (backend)

Build sequence:
1. Data ingestion service (pull APIs, normalize to internal schema)
2. Map + pins (Mapbox, color by category)
3. Rig profile input (localStorage, no auth)
4. Filter logic (category filter + rig-height filter)
5. Recency badge (color coding on pin)
6. Mobile-responsive polish
7. Florida-only seed + soft launch to 5 RVer friends

---

## Session Summary and Insights

**Key Achievements:**
- Defined a concrete, shippable 6-8 week MVP scope using only public APIs
- Identified the #1 differentiation that competitors can't easily copy: rig-profile-aware filtering at the data layer
- Discovered that v1 is a planning utility, not an iOverlander replacement — that's fine and honest
- Created a 14-question validation toolkit ready to deploy to Reddit and Facebook groups
- Identified 4 major failure modes and specific mitigations for each
- Established clear rabbit holes to avoid (native app, auth, scraping, grocery, navigation)

**Breakthrough Moments:**
1. "Pain is not missing data — it's being the integration layer yourself, every single time." — The product's core value proposition in one sentence.
2. "If Google Maps already does it well, don't build it. Only build what Google Maps can't do because it doesn't know you have a 40-foot RV." — The product's design principle.
3. Kyryl's honest admission that he'd still use iOverlander for discovery unlocked the Two-Phase Product model — a planning utility first, community platform second.

**Session Reflections:**
The founder is living the problem every day with exceptional domain depth. The risk is not product-market fit — full-timers clearly suffer from fragmented data. The risk is scope creep and build time vs. available capacity. The single most important decision from this session: validate with 20 conversations BEFORE writing one line of production code.
