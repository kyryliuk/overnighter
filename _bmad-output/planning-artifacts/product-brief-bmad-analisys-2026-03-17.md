---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
inputDocuments:
  - 'brainstorming-session-2026-03-15-0600.md'
  - 'market-rv-travel-companion-app-research-2026-03-17.md'
date: '2026-03-17'
author: 'Kyryl'
---

# Product Brief: Overnighter

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

**Overnighter** is a rig-aware RV travel utility for full-time and budget-focused travelers who need to find overnight parking, dump stations, water fills, and fuel — all in one place, filtered for their specific rig, with community-verified freshness signals. Where today's RVers juggle 4–5 apps and still arrive at closed or wrong spots, Overnighter gives them one map that knows their rig and shows only what actually applies to them. The app is built by a full-time RVer living this problem every day, and powered by a community of travelers who verify and update spots in real time.

---

## Core Vision

### Problem Statement

Full-time and budget-conscious RVers spend 30–60 minutes per travel day manually cross-referencing multiple apps (iOverlander, Campendium, The Dyrt, Sanidumps, Google Maps) to answer one question: *"Where am I stopping tonight, and can I dump and fill water there?"* No single US app aggregates all essential stop types — overnight parking, dump stations, water, fuel — on one map filtered for a specific rig's height and length. Travelers are forced to be their own integration layer, every single day.

### Problem Impact

- Wasted time: 30–60 minutes of daily research tax on every travel day
- Stale data: 42% of Walmarts have silently changed their overnight policy; dump stations close or break without notice; apps show data that's months or years old
- Rig blindness: every app shows spots for all rig types — a Class A driver sees spots they physically cannot reach, fit, or legally park
- High stress: arriving after dark at a spot that no longer exists or no longer allows RVs is a real safety risk
- No single source of truth: the market has accepted multi-app juggling as "normal" — but it isn't necessary

### Why Existing Solutions Fall Short

| App | What it does well | Critical gap |
|---|---|---|
| iOverlander | Massive community, off-grid spots | No rig filter; 97% of users contribute nothing; legacy app shut down 2025 |
| The Dyrt | Strong brand, campground database | Campground-focused, not utility stops; no rig profile; $11M VC pressure pushes away from free camping |
| Campendium | Reviews, cell signal data | Acknowledged stale data; no rig filter; no freshness signal |
| AllStays | Bridge clearances, dump data | Static data; no community layer; no rig profile; dated UX |
| park4night | Exact product vision — but EU only | No US market presence; French company; unserved geography |

**The gap:** No US app combines multi-source aggregation + rig-aware filtering + community-verified recency in one product.

### Proposed Solution

**Overnighter** is a responsive web app (mobile-first) that:
1. Takes a one-time rig profile (height, length, class) and remembers it
2. Shows a unified map pulling from BLM/USFS/NPS public APIs + OpenStreetMap + community-seeded spots
3. Pre-filters every pin for the saved rig — grey out spots the rig can't reach
4. Shows a recency badge (green < 7 days / yellow 8–30 days / red 30+ days) as the primary trust signal
5. Displays multi-amenity pins — one pin per location showing all services (dump + water + overnight + fuel)
6. Grows through community check-ins — departure-triggered 3-tap confirmations that keep data fresh

### Key Differentiators

1. **Rig-aware at the data layer** — not a filter bolt-on; every result pre-qualified for your specific vehicle before you see it. No competitor does this.
2. **Recency as the primary UI signal** — freshness is front and center, not buried in comments. Directly solves the #1 pain point (stale data).
3. **Multi-source aggregation** — not a new data source, a new lens over all existing sources simultaneously.
4. **Founder authenticity** — built by a full-timer living this problem in a 2001 Damon Challenger Class A. "Built by a full-timer, for full-timers" is uncopiable positioning.
5. **Community-first growth model** — park4night proved this reaches €2M bootstrapped in Europe; US market is unserved.

---

## Target Users

### Primary Users

#### "The Full-Timer" — Marcus (Based on Founder Reality)

**Who He Is:**
Marcus is a full-time Class A RVer in his late 30s–40s, living on the road full-time in a large rig (think: 2001 Damon Challenger, 35 feet). He's budget-conscious — not broke, but deliberate. He's trading rent for road. He covers 400–600 miles between destinations, moves every 2–5 days, and treats travel planning as a daily operational task, not a leisure activity.

**How He Experiences the Problem:**
Every travel day starts the same way: he opens 4–5 apps and starts cross-referencing. Campendium for overnight reviews. Sanidumps for dump stations. iOverlander for free spots. Google Maps for fuel. AllStays maybe, for Walmart status. By the time he's done, 30–60 minutes are gone — and he's still not sure the dump station he found is actually open, or that the Walmart he picked still allows overnight parking. He's arrived at dead spots before. He's driven 20 miles to a dump station that was out of service. He knows the pain isn't a knowledge problem — it's a data freshness and rig-fit problem.

**What Makes Him Different from a Camper:**
Marcus doesn't "camp." He lives. His needs are operational and recurring, not recreational and occasional. Every stop has logistics: dump when needed, fill water, find cheap or free overnight. He doesn't need glamping features. He needs a utility that respects his time and his rig's constraints.

**Success Vision:**
One map. Open it, see what's near, see what's fresh, see what fits his Class A. Done in 5 minutes. Leave with confidence. That's it.

**Key Quote:** *"I don't need another app. I need the last app."*

---

### Secondary Users

#### "The Boondocker" — Sarah

**Who She Is:**
Sarah lives in a converted Sprinter van or Class B. She's 28–40, likely remote-working or freelancing. She prioritizes extended stays on BLM land, national forest dispersed camping, and off-the-beaten-path spots. She doesn't move as often as Marcus — she might stay somewhere 5–14 days — but when she moves, she needs to plan a water fill and a dump run as part of the transition.

**How She Experiences the Problem:**
Sarah doesn't need overnight parking in a Walmart lot. She needs to know: "When I leave this BLM spot after 10 days, where's the nearest dump and fresh water fill that my van can reach without a dirt road that will bottom me out?" She's currently using iOverlander + Google Maps + asking in Facebook groups. The group ask takes hours to get responses, and half the intel is outdated.

**Success Vision:**
A map that shows BLM boundaries, dispersed camp spots, AND the nearest dump/water within range — with recency signals so she's not driving to a busted pump.

---

#### "The New Full-Timer" — Jamie

**Who They Are:**
Jamie went full-time 4–6 months ago. They have a Class C or travel trailer. They're still figuring out the workflow everyone else has hacked together. They haven't memorized which apps to use. They haven't learned that 42% of Walmarts changed policy. They're drowning in app recommendations from Facebook groups, installing 5 things, and still not confident in their planning.

**How They Experience the Problem:**
Jamie experiences the problem more acutely than Marcus — Marcus has the pain dialed in and a coping system. Jamie doesn't even have a system yet. They're losing time AND making mistakes (showing up at spots that don't work for them). They're the user most likely to pay for something that solves this immediately, because they haven't normalized the chaos yet.

**Success Vision:**
Replace all the confusing advice they're getting about which apps to use. One app recommended by the community that just works from day one.

**Strategic Note:** Jamie is the highest-converting new user — they haven't built app loyalty yet. Target through "New to full-time life?" onboarding angle.

---

### User Journey

#### Marcus — Primary Journey

| Stage | Touchpoint | Experience |
|---|---|---|
| **Discovery** | Sees Overnighter mentioned in Facebook group by founder | "Another app" skepticism → watches 60-sec demo showing his exact daily pain solved |
| **Onboarding** | Sets rig profile in 3 taps (Class A, 35ft, 12ft height) | Immediate: map greyed-out spots visibly filter to his rig. "Oh — it actually knows my rig." |
| **First Use** | Plans tomorrow's stop — searches overnight + dump near I-10 corridor | Sees 3 viable stops with green recency badges instead of 12 mixed results requiring cross-reference |
| **Aha Moment** | Taps a dump station pin — sees "Verified 3 days ago, $5 fee, Class A accessible" | Closes Sanidumps app for the first time in a year |
| **Check-in Loop** | Departure triggers "How was this spot?" — 3-tap confirmation | Feels like contributing back to the community that helped him |
| **Subscription** | After 30 days free, offered $19.99/year | Converts because the app has already replaced 4 others — it's already proven ROI |

#### Sarah — Secondary Journey

| Stage | Touchpoint | Experience |
|---|---|---|
| **Discovery** | Van life subreddit thread mentions Overnighter for dump planning | Checks it out specifically for the dump+water layer |
| **Onboarding** | Sets Sprinter profile (Class B, 22ft, 9ft height) | Notes it shows BLM land overlay and dispersed camps in addition to utility stops |
| **Core Use** | Plans transition from BLM stay to next area | Single map shows nearest dump + water fill along her route, filtered for her vehicle |
| **Aha Moment** | Recency badge saves her from driving to a broken pump | Becomes an active contributor — posts check-ins from every stop |

#### Jamie — New Full-Timer Journey

| Stage | Touchpoint | Experience |
|---|---|---|
| **Discovery** | Asked in Facebook group "what apps do I need for full-timing?" — gets reply "just use Overnighter" | Relief at a single answer instead of a 20-app list |
| **Onboarding** | Guided rig setup flow with plain-language labels | No prior knowledge required — first map view immediately useful |
| **Core Use** | Uses it as primary tool from day one, never builds multi-app dependency | Becomes the user who later recommends it in the same question thread they started in |

---

## Success Metrics

### What Success Looks Like for Users

**The core user success signal is behavioral replacement:**
A user has succeeded when they stop opening their old apps.

Specific observable success moments:
- Marcus opens Overnighter instead of 4 apps on a travel day → **planning time drops below 10 minutes**
- Sarah finds dump + water fill for her van with one search before leaving a BLM spot
- Jamie gets a working overnight stop recommendation on their very first travel day
- Any user taps a spot pin, sees a green recency badge, and drives there with confidence

**User Success Metrics:**

| Metric | What it measures | Target |
|---|---|---|
| Rig profile completion at signup | User committed enough to set up properly | >80% of new signups |
| Core journey completion (search → pin view → route) | Product works end-to-end for real use | >70% of active users within first week |
| Return usage within 7 days of first session | Product solves a recurring need | >60% Day-7 retention |
| Check-in submission rate (per departure) | Community flywheel activating | >15% of active users submit ≥1 check-in/month |
| App replacement signal (survey) | Did they actually close other apps? | >50% of 30-day users report replacing ≥1 prior app |

---

### Business Objectives

**3-Month Objectives (post-launch, Florida-first):**
- Establish real, regular usage in the target geography before expanding
- Validate that free users convert to paid when premium features unlock
- Prove the community data loop works: users contribute check-ins unprompted

**12-Month Objectives:**
- Reach sustainable revenue that covers infrastructure + founder time
- Build a contributor base large enough that data stays fresh without manual effort
- Establish Overnighter as the recommended answer in the "what apps do I need?" Facebook group threads

**Strategic Milestone (18–24 months):**
- Reach the park4night equivalent for the US market: ~$100K ARR bootstrapped, profitable at small scale, community-self-sustaining

---

### Key Performance Indicators

**Growth KPIs:**

| KPI | 3-Month Target | 12-Month Target |
|---|---|---|
| Registered users | 500 | 5,000 |
| Monthly Active Users (MAU) | 200 | 2,500 |
| Florida corridor active users | 100 | — |
| Organic signups from Facebook groups | >80% of new users | >60% of new users |

**Engagement KPIs:**

| KPI | Target | Why it matters |
|---|---|---|
| Weekly active rate (WAU/MAU) | >40% | RVers travel frequently — high if product is useful |
| Avg sessions per travel week | ≥3 | Morning plan + en-route check + arrival confirm |
| Check-ins submitted per 100 MAU/month | ≥20 | Community data freshness threshold |
| Rig profile completion rate | >80% | Proxy for real intent to use |

**Revenue KPIs:**

| KPI | Target | Notes |
|---|---|---|
| Free-to-paid conversion (30-day trial) | ≥8% | park4night baseline; achievable with clear value demo |
| Annual subscription price | $19.99–$24.99/year | Below The Dyrt Pro, above park4night EU |
| MRR at 12 months | ~$800–$1,000 | ~500 paid users × $19.99/yr ÷ 12 |
| Churn rate (annual) | <25% | High if product consistently useful |

**Data Quality KPIs (the unique Overnighter metric):**

| KPI | Target | Why it matters |
|---|---|---|
| % of pins with check-in within 30 days | >60% of active pins | This IS the product's core value prop |
| % of pins with green recency badge (< 7 days) | >30% of active pins | Real-time freshness that no competitor has |
| User-reported accuracy rate (survey) | >85% | Did the spot match reality? |

---

## MVP Scope

### Core Features (Phase 0 — Must Ship)

The MVP answers one question for Marcus on any given travel day:
**"Where am I stopping tonight, and where do I dump and fill water?"**

Everything in Phase 0 must serve that question directly.

#### 1. Rig Profile Setup
- One-time 3-step setup: rig class (A/B/C/TT/5th wheel), length, height
- Stored in localStorage (no account required)
- Profile persists across sessions on the same device
- **Why it's MVP:** Without rig filtering, Overnighter is just another map app

#### 2. Unified Map View
- Single map showing all stop types as layered pins:
  - Overnight parking (Walmart, BLM, Harvest Hosts, free camp)
  - Dump stations
  - Water fills
  - Fuel (diesel + propane)
- Pulls from: BLM/USFS/NPS public APIs + OpenStreetMap Overpass + static community seed data
- **Why it's MVP:** The unified map IS the core product promise

#### 3. Rig-Aware Filtering
- Every pin pre-filtered against saved rig profile before rendering
- Spots the rig can't access: greyed out (visible but not clickable) — not hidden
- Filter logic: height clearances, length restrictions, rig class restrictions
- **Why it's MVP:** This is the #1 differentiator — no competitor does this

#### 4. Recency Badges
- Three-state freshness indicator on every pin:
  - 🟢 Green: verified within 7 days
  - 🟡 Yellow: verified 8–30 days ago
  - 🔴 Red: 30+ days, or never verified
- Badge is the dominant visual element on each pin — not buried in detail view
- **Why it's MVP:** Solves the #1 pain point (stale data) with one visual signal

#### 5. Pin Detail View
- Tap any pin to see: name, type, amenities, fee, rig restrictions, last verified date, community notes
- Multi-amenity display: single location with dump + water + overnight shown as one pin
- One-tap "Get Directions" → opens native maps app
- **Why it's MVP:** Users need enough info to make a go/no-go decision before driving

#### 6. Community Check-In (Minimal)
- Departure-triggered prompt: "How was [spot name]?" — 3-tap confirmation
  - Still open / Closed / Changed (optional text note)
- Updates recency badge immediately
- No account required for first check-in (device-fingerprinted)
- **Why it's MVP:** The community loop is what keeps data fresh — start it on day one

#### 7. Basic Search
- Search by location name or address
- "Near me" button using device GPS
- Results list alongside map view
- **Why it's MVP:** Users need to search a destination corridor, not just current location

---

### Out of Scope for MVP

These are explicitly deferred — not forgotten, just not now.

| Feature | Why Deferred |
|---|---|
| Native iOS / Android apps | Web app first; validate demand before native investment |
| User accounts / login | localStorage is sufficient for Phase 0; auth adds build time and complexity |
| Trip route planning | Multi-stop route builder is Phase 2; single destination is enough to validate |
| Offline maps | High complexity (tile caching); Phase 2 premium feature |
| Social features (follow, friends) | Community is check-ins only for now — social layer is Phase 3 |
| Photo uploads on spots | Adds storage cost and moderation complexity; Phase 2 |
| Campground reservations / booking | Different product category; not the utility positioning |
| Cell signal data | Campendium's feature; not core to the stop-planning use case for MVP |
| Alerts / notifications | No push without native app; deferred to Phase 2 |
| Multi-device sync | Requires accounts; deferred until auth is built |

**The rule for MVP deferrals:** If Marcus can plan his next stop without it, it waits.

---

### MVP Success Criteria

The MVP is considered successful and ready to scale when:

1. **Validation gate:** 50+ active users using it on real travel days within 60 days of launch
2. **Data freshness gate:** >30% of active pins have a community check-in within the last 30 days (the flywheel is turning)
3. **Replacement signal:** In post-use survey, >40% of users report replacing at least one prior app
4. **Conversion signal:** At least 5% of 30-day users express willingness to pay $19.99/year (even before paywall exists)
5. **No critical data failures:** <5% of user-followed pins result in "spot was wrong" reports

If all 5 gates pass → build Phase 1 (accounts, offline maps, premium tier).
If gates 1-3 pass but 4-5 don't → re-examine data quality before monetization.

---

### Future Vision

**Phase 1 (Months 3–6): Accounts + Premium**
- User accounts with cloud sync (rig profile + saved spots + check-in history)
- Premium tier: offline map tiles, advanced rig filters, route corridor planning
- Subscription paywall: $19.99/year with 30-day free trial
- Push notifications for saved spot status changes

**Phase 2 (Months 6–12): Data Depth + Community**
- Photo uploads on spot check-ins
- Crowd-sourced spot additions (new pins submitted by community)
- Moderation layer for contributed data
- Cell signal data layer (partnership or community-sourced)
- US geographic expansion beyond Florida pilot

**Phase 3 (Year 2): Platform + Ecosystem**
- Native iOS + Android apps
- Multi-stop trip planning with overnight sequencing
- Partner integrations (Harvest Hosts API, Boondockers Welcome)
- Fleet/caravan mode for groups traveling together
- International expansion (Canada, Mexico snowbird corridors)

**If wildly successful:** Overnighter becomes the operating system for full-time RV life — the single app that handles all stop logistics, replacing the entire ecosystem of fragmented tools permanently.
