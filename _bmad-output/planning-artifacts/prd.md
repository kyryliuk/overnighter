---
stepsCompleted: ['step-01b-continue.md', 'step-02-discovery.md', 'step-02b-vision.md', 'step-02c-executive-summary.md', 'step-03-success.md', 'step-04-journeys.md', 'step-05-domain.md', 'step-06-innovation.md', 'step-07-project-type.md', 'step-08-scoping.md', 'step-09-functional.md', 'step-10-nonfunctional.md', 'step-11-polish.md', 'step-12-complete.md', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
workflow_completed: true
lastStep: 12
inputDocuments:
  - 'product-brief-bmad-analisys-2026-03-17.md'
  - 'market-rv-travel-companion-app-research-2026-03-17.md'
  - 'brainstorming-session-2026-03-15-0600.md'
  - 'brainstorming-session-2026-04-25-1000.md'
workflowType: 'prd'
classification:
  domain: general
  projectType: web_app
  complexity: medium
date: '2026-03-17'
lastEdited: '2026-04-26'
editHistory:
  - date: '2026-04-26'
    changes: 'Scope pivot — elevated water tap discovery to primary product focus; added ML-powered faucet detection pipeline, FL Keys corridor pilot, Journey 6; applied validation fixes (FR32, FR20, FR24, FR37, FR28, NFR-SC4)'
documentCounts:
  briefCount: 1
  researchCount: 1
  brainstormingCount: 2
  projectDocsCount: 0
---

# Product Requirements Document — Overnighter

**Author:** Kyryl
**Date:** 2026-03-17

## Executive Summary

**Overnighter** is a rig-aware RV travel utility — a mobile-first web app that answers the one question every full-time and budget-focused RVer asks every travel day: *"Where am I stopping tonight, and where do I dump and fill water?"* It replaces the 30–60-minute, 4–5-app daily planning ritual with a single map that already knows your rig's length, height, and class, shows only what actually fits you, and leads with a freshness signal — not buried reviews — as the primary trust mechanism.

The primary launch mission is solving the most dangerous gap in the existing data landscape: **publicly accessible water taps**. In remote corridors like the Florida Keys (Homestead → Key West), finding a working outdoor faucet at a gas station, campground, or rest stop can mean the difference between a safe travel day and an emergency. No existing app, database, or API has comprehensive ground-truth coverage of these taps. Overnighter builds it from scratch using a custom-trained ML faucet classifier that scans street-level imagery to discover taps that no one has ever recorded in any database.

The core users are full-time RVers (Marcus, Class A, 35ft — living this problem daily), boondockers (Sarah, Sprinter van — planning dump/water transitions from BLM stays), new full-timers (Jamie — drowning in fragmented app recommendations), and Keys corridor travelers (Alex — solo overlander who has run dry on US-1 with no reliable source). The product serves a US market of ~1 million full-time RVers within an 8.1M household RV owner base, piloting in the Florida Keys corridor before expanding to other high-need desert and remote corridors nationally.

The product is greenfield, bootstrapped, and founder-authentic — built by a full-timer who has personally experienced the water scarcity problem in the Florida Keys.

### What Makes This Special

Four capabilities no single US competitor has simultaneously:

1. **Rig-aware at the data layer** — every pin pre-filtered against the saved rig profile (height, length, class) before it renders. Not a UI filter bolt-on. Spots that don't fit are greyed out, not hidden. No US competitor does this.

2. **Recency as the primary UI signal** — a three-state freshness badge (🟢 <7 days / 🟡 8–30 days / 🔴 30+ days) is the dominant visual on every pin, not buried in comments. Directly solves the #1 pain point (stale data). The community data freshness loop (departure-triggered 3-tap check-ins) keeps it self-sustaining.

3. **Multi-source aggregation on one map** — BLM/USFS/NPS public APIs + OpenStreetMap Overpass + community-seeded spots, showing overnight parking, dump stations, water fills, fuel, and propane in a single unified view. The user is no longer the integration layer.

4. **ML-powered water tap discovery** — a custom-trained faucet classifier (trained on field-collected photos from the Florida Keys corridor) automatically scans street-level imagery from Mapillary and Google Places Photos to detect publicly accessible outdoor water taps at gas stations, campgrounds, and restaurants. Pins are created from ML ground truth, not from crowd-sourced reports. No US competitor applies machine learning to discover amenities rather than display them.

The market proof: park4night executed this model in Europe, reaching €2M revenue bootstrapped without US presence. The US market is unserved. iOverlander shut down in 2025, creating an active gap. The founder is the only person who can build this with authentic authority and personal Keys corridor ground truth.

**Classification:** Web App (mobile-first PWA/SPA) · Consumer Travel & Outdoor Utilities · Medium complexity · Greenfield · ML-assisted data pipeline

## Success Criteria

### User Success

Success is behavioral replacement — a user has succeeded when they stop opening their old apps.

| Metric | Target | What It Measures |
|---|---|---|
| Rig profile completion at signup | >80% | User committed enough to set up properly |
| Core journey completion (search → pin view → route) | >70% of active users within first week | Product works end-to-end for real use |
| Day-7 retention | >60% | Product solves a recurring need |
| Planning time per travel day | <10 minutes | Down from 30–60 minutes across 4–5 apps |
| App replacement signal (30-day survey) | >40% report replacing ≥1 prior app | Behavioral replacement confirmed |
| Check-in submission rate | >15% of active users submit ≥1/month | Community flywheel activating |

**User success moments:**
- Marcus opens Overnighter instead of 4 apps on a travel day
- Sarah finds dump + water fill filtered for her Sprinter with one search
- Jamie gets a working overnight stop on their very first travel day
- Any user taps a pin, sees a green recency badge, and drives there with confidence

### Business Success

**3-Month Targets (Florida corridor pilot):**

| KPI | Target |
|---|---|
| Registered users | 500 |
| Monthly Active Users | 200 |
| Florida corridor active users | 100 |
| Organic signups from Facebook groups | >80% of new users |
| Weekly active rate (WAU/MAU) | >40% |
| Avg sessions per travel week | ≥3 |

**12-Month Targets:**

| KPI | Target |
|---|---|
| Registered users | 5,000 |
| Monthly Active Users | 2,500 |
| Free-to-paid conversion (30-day trial) | ≥8% |
| Annual subscription price | $19.99–$24.99/year |
| MRR | ~$800–$1,000 |
| Annual churn | <25% |

**Strategic milestone (18–24 months):** ~$100K ARR bootstrapped, profitable at small scale, community data self-sustaining without manual effort.

### Technical Success

| Metric | Target | Rationale |
|---|---|---|
| Map initial load time | <3 seconds on 4G | Core interaction — delay = abandonment |
| Pin render for viewport | <1 second after map load | Rig filter must feel instant |
| API data freshness pipeline | Updates within 24 hours of source change | Recency badges must reflect reality |
| Uptime (MVP) | >99% during active hours (6am–10pm) | RVers plan in the morning before driving |
| Check-in write success rate | >99.5% | Lost check-ins directly degrade the data flywheel |

### Water Tap Discovery Success

| Metric | Target | What It Measures |
|---|---|---|
| Confirmed water tap pins in Homestead→Marathon corridor | ≥30 pins within 60 days of launch | Sufficient coverage for Keys corridor travelers |
| ML faucet detection precision on FL Keys ground truth | ≥80% | Model quality before auto-pinning |
| Water tap filter usage rate | ≥40% of active users use water tap filter at least once per trip | Feature adoption and utility |
| User tap photo submission rate | ≥10% of active users submit ≥1 tap photo per month | Community validation loop activating |
| Stale tap pin rate | <10% of water tap pins unverified for >90 days | Data freshness maintained via community decay prompts |

### MVP Validation Gates

The MVP is validated when ALL five gates pass:

1. **Usage gate:** 50+ active users on real travel days within 60 days of launch
2. **Data flywheel gate:** >30% of active pins have a community check-in within the last 30 days
3. **Replacement gate:** >40% of 30-day users report replacing ≥1 prior app (survey)
4. **Monetization signal gate:** ≥5% of 30-day users express willingness to pay $19.99/year
5. **Data accuracy gate:** <5% of user-followed pins result in "spot was wrong" reports

Gates 1–3 failing → fix product before marketing. Gates 4–5 failing → fix data quality before monetization.

## Product Scope

**MVP philosophy:** Problem-solving MVP — the minimum that eliminates the 30–60-minute daily research pain for Marcus AND solves the water tap desert problem in the Florida Keys corridor. Pure utility. No platform features, no paywall, no social layer at launch.

**MVP rule:** If Marcus can plan his next stop without it, it waits. If a Keys traveler could run dry without it, it ships.

**Resource constraint:** Solo founder (Kyryl). No admin UI at MVP — founder uses direct database access for data quality operations.

**Geographic focus:** Homestead → Marathon corridor (US-1, Mile Markers 0–50) as primary pilot. Highest personal pain point, highest validation value, personally verifiable ground truth.

### MVP — Must-Have Capabilities

**Core journeys supported:** Marcus J1 (daily planning), Marcus J2 (spot failure recovery), Sarah J3 (BLM transition planning), Jamie J4 (first travel day), Alex J6 (Keys corridor water tap planning).

| # | Capability | MVP Rationale |
|---|---|---|
| 1 | Rig profile setup (localStorage, no auth) | Without this, it's just another map app |
| 2 | Unified map (Leaflet + CartoDB Dark Matter tiles) | The core product — the map IS Overnighter |
| 3 | Rig-aware pin filtering (grey-out, not hide) | #1 differentiator — non-negotiable |
| 4 | Recency badges (3-state: green/yellow/red) | Solves #1 pain point — non-negotiable |
| 5 | Amenity filter chips (💧🚽🏕⛽🔵⚡🚿) | Enables Sarah/Marcus multi-need planning |
| 6 | Pin detail view (amenities, fee, restrictions, badge) | Go/no-go decision without leaving app |
| 7 | One-tap directions (native maps handoff) | Last mile — closes the planning loop |
| 8 | Departure check-in (3-tap: open/closed/changed) | Community flywheel starts day one |
| 9 | In-spot issue reporting + immediate badge degradation | Edge case recovery (Marcus J2) |
| 10 | Basic search (address + "Near me" GPS) | Can't use the map without finding locations |
| 11 | Water tap ML batch discovery pipeline (Overpass enumeration → image sourcing → faucet classifier → PostGIS pins) | Primary water tap data source; no existing database covers Keys corridor |
| 12 | User water tap photo submission + ML re-validation | Community-sourced tap discovery supplements ML batch scans |
| 13 | Water tap pin detail (confidence score, source, access type, seasonal notes, Mile Marker) | Keys-specific metadata enables informed go/no-go decisions |

### Explicitly Deferred

| Feature | Reason |
|---|---|
| Admin UI / dashboard | Founder uses direct DB access; saves significant build time |
| User accounts / auth | localStorage sufficient; auth adds complexity |
| Offline map tiles | Service worker complexity; Phase 2 premium feature |
| Trip route planning | Multi-stop builder is Phase 2 |
| Photo uploads (general) | Storage cost + moderation; Phase 2 (water tap photo submission is MVP exception) |
| Social features | Community is check-ins only; social is Phase 3 |
| Native iOS/Android apps | Validate demand on web first |
| Push notifications | No push without native app |
| Cell signal data | Not core to stop-planning use case for MVP |
| Real-time ML inference API | Batch-only in v1; real-time endpoint is Phase 2 after batch proven |
| Multi-state tap discovery expansion | Florida Keys pilot must validate model accuracy first; Phase 2 |
| Multi-amenity ML detection (air pumps, showers, dump) | Same pipeline, different model; Phase 3 after water tap pipeline matures |

### Phase 2 — Growth (Months 3–6, after MVP gates pass)

- User accounts + cloud sync (rig profile, saved spots, check-in history)
- Premium subscription tier ($19.99/year, 30-day free trial)
- Offline map tile caching (PWA service worker)
- Route corridor planning (multi-stop) with water tap density overlay
- Push notifications for saved spot status changes
- Photo uploads on check-ins
- Crowd-sourced new spot submissions + moderation
- Basic admin UI (pin flag queue, badge override, archive)
- Real-time ML inference API endpoint for user photo submissions
- Water tap discovery expansion to full Florida state + high-need desert corridors (Arizona, Nevada, West Texas) — prioritized by water stress ranking
- Automated confidence decay: tap pins older than 6 months trigger nearby-user re-verification prompts

### Phase 3 — Vision (Year 2+)

- Native iOS + Android apps
- Multi-stop trip planning with overnight sequencing
- Partner integrations (Harvest Hosts API, Boondockers Welcome)
- Fleet/caravan mode
- International expansion (Canada, Mexico snowbird corridors)
- Cell signal data layer

### Risk Mitigation

**Technical:**

| Risk | Mitigation |
|---|---|
| Overpass API rate limit (10k req/day public) | Client-side response caching from day one; evaluate self-hosted Overpass at 200+ MAU |
| Rig filter inaccuracy on API-sourced pins | Flag API-sourced pins as "restrictions unverified" until community confirms |
| iOS Safari Leaflet tap issues | Apply `tap: false` Leaflet option; test on physical device pre-launch |
| GPS permission denied | Graceful fallback to manual search; no core feature blocked |

**Market:**

| Risk | Mitigation |
|---|---|
| Cold-start data problem at launch | Founder manually seeds 50–100 Florida corridor pins; admin-verified badge applied |
| Low check-in rate | Departure trigger timing tuned; 3-tap friction minimized; "you just helped the next traveler" prompt |
| Facebook group referral channel dries up | Founder posts authentic use stories; builds audience before launch |

**Resource:**

| Risk | Mitigation |
|---|---|
| Solo founder bandwidth | Admin UI deferred; no auth system at MVP; scope to 10 must-haves only |
| Feature creep during build | Every addition tested against "can Marcus plan his next stop without this?" |
| Infrastructure cost | Static SPA hosting (Vercel/Netlify free tier); serverless functions for check-in writes |

## User Journeys

### Journey 1: Marcus — The Full-Timer, Daily Planning (Primary Success Path)

*Where we meet him:* It's 7am in a Walmart parking lot outside Tallahassee. Marcus has his coffee. He has 380 miles to cover today and needs to land somewhere by 5pm that his 35-foot Class A can fit, preferably with a dump station since he's two days out from needing one.

*The old reality:* He opens Campendium — lots of campgrounds, nothing free. Opens Sanidumps — finds a station but it's 40 miles off his route. Opens iOverlander — spots listed but who knows when they were last verified. 45 minutes later he has a plan he's maybe 60% confident in.

*With Overnighter:*
1. Opens the app. His Class A profile (35ft, 12ft height) is already saved.
2. Map loads centered on his current location. Pins pre-filtered — grey spots already removed. He can see 6 viable overnight stops with dump access along I-75 corridor.
3. He taps the most promising pin: "Flying J, Ocala" — green badge (verified 2 days ago), dump + fuel + propane, Class A accessible, $0 overnight with purchase. Directions in one tap.
4. He closes the app in 8 minutes. His backup is the next pin on the list.

*Resolution:* He drives with confidence. He checks in at departure the next morning — 3 taps. The badge stays green for the next traveler.

**Capabilities revealed:** Rig profile persistence, pre-filtered map render, multi-amenity pin display, recency badge as dominant visual, one-tap directions, departure check-in trigger.

---

### Journey 2: Marcus — Edge Case, Spot Failure Recovery

*The scenario:* Marcus arrives at the Flying J at 6pm. The dump station is coned off — out of service. No advance warning in the app.

*Recovery path:*
1. He pulls up Overnighter. Taps the Flying J pin. Sees "Report an issue" option.
2. Selects "Dump station closed" — 2 taps. Badge updates to red immediately on his device.
3. He filters for 💧 Dump + 🏕 Overnight, zooms out slightly. Sees a KOA 4 miles away with a yellow badge (14 days old — acceptable).
4. He reroutes. 12 minutes total downtime.

*Resolution:* His report saves the next driver from the same detour. The community loop works even in failure scenarios.

**Capabilities revealed:** In-spot issue reporting, immediate badge degradation on report, fallback search within current viewport, filter chips active during recovery flow.

---

### Journey 3: Sarah — The Boondocker, BLM Transition Planning

*Where we meet her:* Sarah has been on a BLM dispersed site outside Quartzsite for 9 days. She's leaving tomorrow. Her van's water tank is at 20%, waste tank at 75%. She needs a dump + fresh water fill before settling into her next spot in the Sonoran Desert.

*The old reality:* She asks in a Facebook van life group: "Dump and water near Quartzsite?" Gets 6 replies over 4 hours — some outdated, one saying the Pilot closed, one recommending a rest stop that might not allow RVs.

*With Overnighter:*
1. Opens app. Sets filter chips: 💧 Water + 🚽 Dump active.
2. Map shows 4 nearby spots filtered for her Sprinter (Class B, 22ft, 9ft). Two green badges, one yellow, one red.
3. She taps the nearest green: Love's Travel Stop, 8 miles, dump + water confirmed 3 days ago, $10 fee, Class B accessible.
4. Plans her route: dump + water stop → 2 hours west to next BLM area. Done before she finishes breakfast.

*Resolution:* No Facebook group needed. She submits a check-in at departure: "Still open, fee now $12." Saves the next person the guesswork.

**Capabilities revealed:** Multi-amenity filter chip combinations, BLM overlay layer, Class B rig filtering, fee display in pin detail, check-in note field for price changes.

---

### Journey 4: Jamie — The New Full-Timer, First Travel Day

*Where we meet them:* Jamie went full-time 3 months ago in a Class C. They've been parked at a campground for 2 weeks — safe, but expensive. They want to try their first free overnight stop. They asked in a Facebook group and got told "just use Overnighter."

*The experience:*
1. Opens Overnighter for the first time. Onboarding: "What's your rig?" — Class C, 28ft, 11ft height. Done in 90 seconds.
2. Map loads. They're in north Florida. They tap the 🏕 Overnight filter chip. Six green and yellow pins appear within 20 miles — Walmarts, a rest area, one BLM spot.
3. They tap a nearby Walmart with a green badge: "Verified 1 day ago. Overnight parking allowed. Class C accessible. No fee."
4. They save it. Navigate there. It works exactly as described.

*Resolution:* Jamie texts back to the Facebook group: "Overnighter worked perfectly." The referral loop closes.

**Capabilities revealed:** First-time onboarding flow (rig class + dimensions), post-onboarding immediate map context, save/bookmark pin, single-filter overnight view, social proof via recency badge.

---

### Journey 5: Admin/Founder — Data Quality Operations

*Who:* Kyryl, operating as founder/admin. Monitors data freshness, manages flagged pins, seeds new community spots.

*Recurring scenarios:*
1. **Stale data sweep:** Filters map to 🔴 Red badge pins in the Florida corridor. Reviews pins not verified in 60+ days. Marks outdated pins or removes if source API confirms closure.
2. **Flagged pin review:** A pin has received 3 "Closed" reports in 48 hours. System flags it. Admin confirms closure, archives pin. Badge degradation already happened automatically — archive removes from public view.
3. **Community seed:** Adds a new rest area spotted on a recent drive — fills in amenities, rig clearance, GPS coordinates. Publishes as admin-verified (green badge, admin source tag).

**Capabilities revealed:** Admin pin flag queue, manual badge override, pin archive/publish controls, admin-sourced pin type, bulk data quality view.

---

### Journey 6: Alex — The Keys Corridor Traveler, Water Planning

*Where we meet them:* Alex is driving a camper van southbound on US-1, leaving Homestead for the first time. They have a 5-gallon water jug, currently at half-full. The Florida Keys stretch ahead — 113 miles of two-lane highway with no towns, no grocery stores, and no reliable information about where outdoor faucets exist. A Facebook group post from 3 weeks ago says "the Marathon rest stop has a tap" but Alex doesn't know if it's still working.

*The old reality:* No app has this data. iOverlander is gone. Google Maps shows "water" at some marinas but they're locked. The only option is stopping at every gas station and walking around the building hoping to find a spigot. Alex budgets an extra hour and just hopes.

*With Overnighter:*
1. Opens the app. Taps the 💧 Water filter. The map shows 8 confirmed water tap pins between Homestead and Marathon — gas stations at MM 6 and MM 18, a campground at MM 31, and five others, each with a green or yellow badge.
2. Taps the MM 18 pin: Shell station, outdoor spigot on the south wall, confirmed 4 days ago, free, year-round access, Mile Marker 18.2. Photo of the actual faucet visible in the pin detail.
3. Plans a fill-up stop at MM 18 and a backup at MM 31. Closes the app in 4 minutes.
4. Arrives at MM 18. Tap is exactly where the photo shows. Fills up. Submits a check-in: "Still open, works great." Badge stays green for the next traveler.

*Resolution:* Alex drives the rest of the Keys with confidence. No emergency, no wasted stops, no anxiety. They tell their van life group: "Overnighter has actual faucet locations in the Keys."

**Capabilities revealed:** Water tap filter chip, ML-sourced tap pins with confidence badge, tap photo in pin detail, Mile Marker field, seasonal access notes, user tap photo submission, departure check-in.

---

### Journey Requirements Summary

| Capability Area | Driven By |
|---|---|
| Rig profile setup + localStorage persistence | Marcus J1, Jamie J4 |
| Pre-filtered map render (rig-aware) | Marcus J1, J2 |
| Recency badge as dominant visual + three states | Marcus J1, J2, Sarah J3 |
| Multi-amenity filter chips (scrollable, multi-select) | Sarah J3, Marcus J2, Alex J6 |
| Pin detail view (amenities, fee, restrictions, badge) | Marcus J1, Sarah J3 |
| One-tap directions | Marcus J1 |
| Departure-triggered check-in (3-tap) | Marcus J1, Sarah J3 |
| In-spot issue reporting + immediate badge degradation | Marcus J2 |
| Onboarding flow (first-time rig setup) | Jamie J4 |
| Pin save/bookmark | Jamie J4 |
| Admin: pin flag queue + badge override + archive | Admin J5 |
| Water tap ML-sourced pins (confidence badge, photo, Mile Marker, seasonal notes) | Alex J6 |
| User water tap photo submission + check-in | Alex J6 |

## Domain-Specific Requirements

### Compliance & Regulatory

- **Map tile licensing** — OpenStreetMap tiles are CC BY-SA; CartoDB Dark Matter tiles are free for public use with attribution. Attribution must appear on map per tile provider terms.
- **Public land API terms** — BLM/USFS/NPS data is US federal public data; no licensing fee but terms prohibit commercial resale of raw data. Aggregation + UX layer is permissible.
- **Overpass API rate limits** — Public endpoint allows ~10k requests/day. MVP must implement server-side caching or use a self-hosted instance for production scale.
- **No PII at MVP** — localStorage-only storage; no user accounts; no personal data transmitted to server. GDPR/CCPA exposure is minimal. Future account feature requires privacy policy + data processing agreement.

### Technical Constraints

- **Geolocation permissions** — "Near me" requires explicit browser permission (`navigator.geolocation`). Must degrade gracefully to manual search if denied. iOS Safari requires HTTPS.
- **HTTPS required** — Geolocation API and secure localStorage access both require HTTPS in production.
- **Community content moderation** — Check-in notes are free-text. MVP requires basic content filtering and a report mechanism; founder reviews flagged content manually at launch.
- **Data accuracy liability** — Terms of service must disclaim that stop information may be outdated or incorrect. Critical for overnight safety use case.

### Integration Stack

| Integration | Purpose | Notes |
|---|---|---|
| Leaflet.js + CartoDB Dark Matter tiles | Map rendering | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`; `tap: false` on iOS |
| OpenStreetMap Overpass API | Fuel, dump, water point queries + location enumeration for ML pipeline | Server-side proxy + caching required in production |
| BLM/USFS/NPS APIs | Public land boundaries, dispersed camping | 24-hour refresh cycle |
| Browser Geolocation API | "Near me" GPS | Requires HTTPS + user permission |
| Native maps handoff | One-tap directions | `maps://` (iOS), `geo://` (Android), web URL (desktop) |
| Mapillary API | Street-level imagery for ML faucet detection pipeline | CC-BY-SA license; attribution required per Mapillary ToS; no bulk download — API calls per location only |
| Google Places Photos API | Business photos for ML faucet detection when Mapillary coverage insufficient | Official commercial API; rate limits per Google Maps Platform terms; $0.007/photo at standard pricing; API key server-side only |
| Faucet Classifier ML Model | Binary classification of outdoor water tap presence in photos | Custom-trained on field-collected Florida Keys photos; hosted on AWS Lambda (real-time) or AWS Batch (nightly scan); model weights are proprietary |

### ML Pipeline Compliance

- **Training data privacy** — photos used for model training must not contain identifiable faces or license plates; field-collected photos must be reviewed before inclusion in training set
- **Mapillary attribution** — all map views using Mapillary-sourced tap discoveries must display Mapillary attribution per CC-BY-SA terms
- **Google Places API commercial use** — photo fetching for ML inference is permitted under Google Maps Platform ToS; batch automated requests must respect per-second rate limits via server-side throttling
- **Model ownership** — custom-trained faucet classifier weights are proprietary; model is not open-sourced at MVP

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Rig-Aware Data Layer (not a UI filter)**
Every competing product applies rig filtering post-query — show all results, then filter. Overnighter pre-filters at the data layer: the query is parameterized by the rig profile before rendering. Inaccessible spots are greyed (visible, not hidden) to preserve spatial context. No US competitor has implemented rig-awareness at this level.

**2. Recency-First Information Architecture**
The dominant visual signal on every pin is a freshness badge — not a star rating, not a category icon. This inverts the standard map app information hierarchy: the user's primary question ("can I trust this data?") is answered before they tap the pin.

**3. Departure-Triggered Contribution Loop**
Community apps ask for reviews voluntarily. Overnighter ties the contribution prompt to a natural behavioral trigger — departure from a location — at the exact moment the user has the most current knowledge of the spot. This maximizes data accuracy and contribution rate without requiring voluntary motivation.

**4. Multi-Source Aggregation as the Product**
The product's value is not a new data source — it's a new lens over existing sources simultaneously (BLM/USFS/NPS + OpenStreetMap Overpass + community). The user was previously the integration layer. Overnighter makes the integration invisible.

**5. ML-Powered Water Tap Discovery (Ground-Truth from Imagery)**
The existing RV ecosystem relies entirely on crowd-sourced or manually entered amenity data. No competitor trains a machine learning model to proactively scan imagery and discover amenities that no one has reported. Overnighter's faucet classifier ingests street-level photos of gas stations, campgrounds, and restaurants, runs them through a custom-trained binary classifier, and auto-creates tap pins at confidence ≥0.75 — without any human having to first find and report the tap. The model was trained on field-collected photos from the Florida Keys corridor, giving it ground-truth accuracy for the exact pilot region. This is a data moat: the dataset grows with every scan and every user submission, making it progressively harder to replicate.

### Market Context

- **park4night** (EU) executed the closest comparable model — community-verified spots, multi-amenity, recency signals — and reached €2M bootstrapped. US market is unserved.
- **iOverlander** attempted the community data model with no rig awareness and a 97% lurker rate; shut down in 2025 — validating the gap and the need for a better contribution loop.
- **The Dyrt** raised $11M VC and moved away from free camping — creating a premium-tier gap in the free/utility segment Overnighter addresses directly.
- **No competitor** — including iOverlander, Campendium, AllStays, or park4night — has applied ML to discover amenities from imagery. The water tap discovery pipeline is uncontested.

### Innovation Validation

| Innovation | Validation Signal | Timeline |
|---|---|---|
| Rig-aware data layer | >70% of rig-complete users never manually filter results | 30 days post-launch |
| Recency-first UX | <10% of users tap a red-badge pin | 30 days post-launch |
| Departure check-in loop | >15% monthly active check-in submission rate | 60 days post-launch |
| Multi-source aggregation | >40% of users report replacing ≥1 prior app | 60 days post-launch |

## Web App Technical Requirements

### Architecture Overview

Overnighter is a **mobile-first SPA** built for on-the-road use on iOS Safari and Chrome Android. The core interaction — map browsing, pin filtering, check-in submission — is continuous and stateful, requiring SPA architecture. Phase 2 adds PWA offline capability via service worker. No SSR required for MVP; the app is referral/link distributed, not search-discovered.

### Browser Matrix

| Browser | Priority | Notes |
|---|---|---|
| iOS Safari (16+) | P0 | Most RVers on iPhone; `tap: false` Leaflet fix required; HTTPS for geolocation |
| Chrome Android (100+) | P0 | Android RV users |
| Chrome Desktop (100+) | P1 | Trip planning on laptop |
| Firefox Desktop (100+) | P1 | Secondary desktop |
| Safari Desktop (16+) | P2 | Mac users |
| IE / Edge Legacy | Out of scope | Explicitly excluded |

### Responsive Design

- Mobile-first breakpoints — base styles target 375px (iPhone SE minimum)
- `100dvh` viewport — dynamic viewport height for iOS Safari address bar behavior
- Desktop split view at `lg` (1024px+) — map panel left, detail/search panel right
- Tailwind CSS + shadcn/ui component library
- Touch targets minimum 44×44px per WCAG 2.1
- Horizontal scrollable filter chip bar above map — no modal sheet for filters

### SEO Strategy

- MVP: minimal — app is referral/link distributed via Facebook groups, not search-discovered
- Open Graph meta tags for link previews in social channels
- `<title>` and `<meta description>` set per view for basic indexability
- No SSR at MVP; CSR with static HTML shell
- Phase 2: consider SSR for spot detail pages if pin direct-linking becomes a sharing pattern

## Functional Requirements

### Rig Profile Management

- **FR1:** A user can set their rig class (Class A / B / C / Travel Trailer / 5th Wheel) during onboarding
- **FR2:** A user can set their rig length (in feet) during onboarding
- **FR3:** A user can set their rig height (in feet and inches) during onboarding
- **FR4:** The system persists the rig profile across sessions without requiring account creation
- **FR5:** A user can edit their saved rig profile at any time
- **FR6:** The system uses the saved rig profile to pre-filter all map pins before display

### Map & Location Discovery

- **FR7:** A user can view a map showing all available stop pins for their current viewport
- **FR8:** A user can search for a location by name or address to center the map
- **FR9:** A user can use their device's GPS location to center the map on their current position
- **FR10:** A user can pan and zoom the map to explore different areas
- **FR11:** The system displays stop pins for all categories simultaneously on a single map layer
- **FR12:** The system displays stop pins the user's rig cannot access in a visually distinct (greyed-out) state without hiding them

### Amenity Filtering

- **FR13:** A user can activate one or more amenity filter chips (Water, Dump, Overnight, Fuel, Propane, Electric, Shower) to narrow displayed pins
- **FR14:** The system applies active filter chips using AND logic — only pins matching all active filters are shown in full color
- **FR15:** A user can deactivate individual filter chips to broaden results
- **FR16:** The system preserves active filters when the user pans or zooms the map

### Spot Data & Recency

- **FR17:** The system displays a freshness badge on every pin indicating how recently it was verified (green: <7 days, yellow: 8–30 days, red: 30+ days or never)
- **FR18:** The system aggregates spot data from BLM/USFS/NPS public APIs, OpenStreetMap Overpass, and community-submitted check-ins
- **FR19:** The system displays multi-amenity information on a single pin when a location offers multiple services (e.g., dump + water + overnight)
- **FR20:** The system updates a pin's recency badge within 500ms of a community check-in submission (per NFR-P4)

### Pin Detail & Navigation

- **FR21:** A user can tap a pin to view its detail: name, stop type, amenities, fee, rig restrictions, last verified date, and community notes
- **FR22:** A user can initiate navigation to a spot with a single tap, handing off to the device's native maps application
- **FR23:** A user can report an issue on a spot directly from the pin detail view
- **FR24:** The system degrades the recency badge to red within 500ms of an issue report submission (per NFR-P4)

### Community Check-In

- **FR25:** The system prompts a user to submit a check-in when they depart a location they previously viewed or saved
- **FR26:** A user can submit a check-in confirming a spot's status (Still open / Closed / Changed)
- **FR27:** A user can add an optional text note to a check-in (e.g., updated fee, hours change)
- **FR28:** The system records check-ins without requiring user account creation
- **FR29:** The system uses check-in data to update the pin's recency badge and last-verified date

### Spot Saving

- **FR30:** A user can save a spot pin for later reference
- **FR31:** A user can view their saved spots in a list

### Data Quality & Moderation

- **FR32:** The system flags a pin for admin review when it receives ≥3 "Closed" or issue reports within a 48-hour period
- **FR33:** An admin can view and manage flagged pins (review, archive, or override badge status)
- **FR34:** An admin can manually create and publish new spot pins with admin-verified status
- **FR35:** An admin can edit existing pin data (amenities, restrictions, coordinates, fee)

### Onboarding

- **FR36:** A first-time user is guided through rig profile setup before accessing the full map
- **FR37:** The system re-renders the map with the rig filter applied within 500ms of onboarding completion (per NFR-P4)
- **FR38:** A user can skip rig profile setup and access the map without a rig profile (with reduced filter capability)

### Water Tap Discovery Pipeline

- **FR39:** The system enumerates all `amenity=fuel`, `amenity=campsite`, and `tourism=camp_site` nodes within a configured geographic bounding box using the OpenStreetMap Overpass API
- **FR40:** For each enumerated location, the system fetches up to 5 street-level photos per location from Mapillary API and Google Places Photos API (Mapillary queried first; Google Places used as fallback when Mapillary coverage is insufficient)
- **FR41:** The system runs each fetched photo through the faucet classifier ML model and records a confidence score (0.0–1.0) per photo per location
- **FR42:** The system creates a water tap map pin for any location where at least one photo returns a classifier confidence score ≥0.75, recording the highest-confidence photo, score, source API, and scan timestamp
- **FR43:** The system stores each water tap pin with location coordinates, place name, place type, access classification (unverified at ML-creation time), confidence score, data source, photos, seasonal availability notes, geographic reference (Mile Marker for Florida Keys), active status, and last verified date
- **FR44:** The system links each water tap pin to a business location record to inherit business name, address, and operating hours
- **FR45:** A user can submit a photo of an outdoor water tap at any location via the app; the system runs the photo through the faucet classifier and, if confidence ≥0.75, creates or confirms a tap pin at that location
- **FR46:** A user can confirm or deny an existing water tap pin ("Still here" / "No longer here") from the pin detail view; each response is recorded as a verification event in an append-only log
- **FR47:** The system displays a water tap pin's confidence source visually: ML-discovered pins show a model confidence indicator; user-confirmed pins show a community verification count; pins confirmed by ≥2 independent users are promoted to "verified" status

## Non-Functional Requirements

### Performance

- **NFR-P1:** The map and initial pin set must render within 3 seconds on a 4G cellular connection (measured from first navigation to interactive map)
- **NFR-P2:** Pin filtering (rig-aware + amenity chips) must respond within 200ms of user input
- **NFR-P3:** Pin detail sheet must open within 300ms of tap
- **NFR-P4:** Check-in submission must complete (write + badge update) within 500ms
- **NFR-P5:** JavaScript bundle size must not exceed 250KB gzipped (initial load); Leaflet + app combined
- **NFR-P6:** Lighthouse Performance score must be ≥80 on mobile (tested on Moto G4 equivalent)
- **NFR-P7:** Map tile requests must be client-cached; repeat viewport visits must not re-fetch tiles from CDN

### Security

- **NFR-S1:** All client-server communication must use HTTPS
- **NFR-S2:** No personally identifiable information is collected or stored server-side at MVP; rig profile and saved pins are localStorage-only
- **NFR-S3:** Device fingerprinting for anonymous check-ins must use anonymous session tokens — no canvas fingerprinting
- **NFR-S4:** Community check-in text notes must be sanitized server-side before storage to prevent XSS injection
- **NFR-S5:** Admin operations must require authentication — admin endpoints must not be publicly accessible
- **NFR-S6:** API keys for any paid services must be server-side only; no secrets exposed in client bundle

### Scalability

- **NFR-SC1:** The system must support 200 MAU at MVP launch without infrastructure changes
- **NFR-SC2:** The system must be architectable to support 5,000 MAU (12-month target) with horizontal scaling only
- **NFR-SC3:** Overpass API requests must be cached server-side with a minimum 24-hour TTL to stay within public API rate limits at scale
- **NFR-SC4:** Check-in writes must handle burst traffic of ≥10× baseline write rate without degrading map read latency beyond NFR-P1 thresholds

### Accessibility

- **NFR-A1:** The product must meet WCAG 2.1 Level AA compliance
- **NFR-A2:** All map pins must have `aria-label` attributes readable by screen readers: `"[SpotName]: [category], verified [recency]"`
- **NFR-A3:** Recency status must be conveyed by both color AND icon/text — never color alone
- **NFR-A4:** All interactive elements must meet minimum 44×44px touch target size
- **NFR-A5:** Users with `prefers-reduced-motion` enabled must not experience map pan/zoom animations
- **NFR-A6:** Minimum color contrast ratio of 4.5:1 for all text against background (WCAG AA)

### Integration

- **NFR-I1:** BLM/USFS/NPS API data must be refreshed at minimum every 24 hours; data older than 48 hours must be flagged as potentially stale
- **NFR-I2:** OpenStreetMap Overpass API queries must use a server-side proxy with response caching — direct client-to-Overpass calls are prohibited in production
- **NFR-I3:** CartoDB tile layer must fall back to standard OSM tiles if CartoDB CDN is unavailable (no blank map)
- **NFR-I4:** Native maps handoff must support both `maps://` (iOS) and `geo://` (Android) URI schemes; desktop falls back to a web maps URL
- **NFR-I5:** Geolocation API usage must degrade gracefully when permission is denied — search functionality must remain fully usable

### Reliability

- **NFR-R1:** System uptime must be ≥99% during peak usage hours (6am–10pm local time), measured monthly
- **NFR-R2:** Check-in write failures must be retried automatically up to 3 times before surfacing an error to the user
- **NFR-R3:** Map must remain functional (browsable with cached data) even if data API calls fail
- **NFR-R4:** No user-submitted check-in data may be silently lost; failed writes must be queued for retry or logged for admin recovery

### ML Pipeline

- **NFR-ML1:** The water tap ML batch scan pipeline must complete a full bounding box scan of ≤500 locations within 2 hours of scheduled trigger
- **NFR-ML2:** The faucet classifier must achieve ≥80% precision on the Florida Keys ground truth validation set before any auto-created pins are published to the map
- **NFR-ML3:** The batch scan pipeline must re-scan the Florida Keys corridor (Homestead → Marathon bounding box) at minimum every 30 days to detect newly installed or removed taps
- **NFR-ML4:** The ML batch pipeline image sourcing must remain within each API provider's published rate limits at all times; rate limit violations must not cause pipeline scan failures or data loss
- **NFR-ML5:** ML model weights and training data must not be accessible to end users or exposed via any client-facing interface
