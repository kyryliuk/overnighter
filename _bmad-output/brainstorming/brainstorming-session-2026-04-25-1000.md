---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Pivot Overnighter project to a publicly accessible water tap discovery and mapping system using a custom-trained ML model and automated image sourcing'
session_goals: 'Brainstorm architecture, image sourcing strategy, ML training/deployment pipeline, and project scope migration — starting with Florida/Florida Keys region'
selected_approach: 'ai-recommended'
techniques_used: ['Constraint Mapping', 'SCAMPER Method', 'Cross-Pollination']
ideas_generated: [48]
session_active: false
workflow_completed: true
---

# Brainstorming Session Results

**Facilitator:** Kyryl
**Date:** 2026-04-25

## Session Overview

**Topic:** Pivot Overnighter project to a publicly accessible water tap discovery and mapping system using a custom-trained ML model and automated image sourcing

**Goals:** Brainstorm architecture, image sourcing strategy, ML training/deployment pipeline, and project scope migration — starting with Florida/Florida Keys region

### Session Setup

- User has already collected a dataset of faucet/water tap photos
- ML faucet classifier module already exists in the project (needs training)
- Key challenge: train model locally → test → publish as accessible API endpoint
- Target geography: Florida, especially Homestead / Florida Keys corridor
- Sources to explore: gas stations, campgrounds, restaurants
- Image sourcing must stay within ToS (no scraping violations)
- Output: map pins of confirmed publicly accessible water taps integrated into existing Overnighter map

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** ML-powered water tap discovery + map integration pivot with focus on ToS-safe image sourcing, ML train/deploy pipeline, and project migration

**Recommended Techniques:**

- **Constraint Mapping:** Map real vs. imagined blockers — especially around ToS, API limits, and ML hosting costs
- **SCAMPER Method:** Systematically generate ideas across all system components through 7 lenses
- **Cross-Pollination:** Transfer battle-tested patterns from wildlife ID apps, infrastructure inspection, AED locators, and Yelp

**AI Rationale:** Complex multi-component technical problem requiring constraint clarity before ideation, systematic coverage of all system aspects, and validated patterns from adjacent domains.

---

## Technique Execution Results

### Technique 1: Constraint Mapping

**Key Discoveries:**

- **ToS (Mixed):** Google Street View/Maps scraping is a hard wall. Mapillary (free, CC-BY-SA API), official Google Places Photos API (~$34 for full Florida pilot), and OSM are all ToS-safe alternatives.
- **Location enumeration (Fog):** Overpass API returns all `amenity=fuel`, `amenity=campsite`, `tourism=camp_site` nodes in a bounding box — free, one query, no ToS issues.
- **Photo coverage (Fog):** User has 100+ varied photos with visible taps. Manual collection from local gas stations is a quality advantage, not a limitation. Albumentations augmentation turns 100 → 5,000 training samples.
- **ML hosting cost (Fog):** AWS Lambda handles real-time inference at near-zero idle cost. AWS Batch handles nightly scans at under $1/run for full Florida. Azure Container Apps is viable if existing infra preferred.
- **Architecture decision confirmed:** Hybrid inference — Lambda for real-time user submissions, Batch for nightly automated scans. Single model, two invocation paths.

**Constraint Resolution Summary:**

| Constraint | Type | Resolution |
|---|---|---|
| ToS / image scraping | Mixed | Mapillary + Places API + OSM = fully legal |
| Enumerating locations | Fog | Overpass API, free |
| Photo coverage | Fog | 100+ photos viable; augment to 5K+ |
| ML hosting cost | Fog | Lambda + Batch = near-zero idle |

---

### Technique 2: SCAMPER Method

**S — Substitute:**
- Photos → YouTube video frames (dashcam footage, 30 angles per location)
- Binary classifier → YOLOv8 object detector (bounding boxes = tap proof photo for users)
- Custom training → CLIP zero-shot + fine-tune on pseudo-labels (GPT-4o does labeling work)

**C — Combine:**
- OSM `drinking_water` nodes + ML results → private PostGIS DB (OSM as one-time read-only bootstrap)
- Batch scan + user correction loop → self-improving system (every user interaction = free training label)
- Water taps + existing corridor suggestions → water tap density as route quality signal
- Multi-source confidence scoring (ML + OSM + user = high; ML only = medium)
- OSM attribute inheritance (access, fee, seasonal, bottle) → free structured metadata on day one

**A — Adapt:**
- iOverlander data model → tap schema with `source_type`, `verified_date`, `access_notes`, `confidence`
- Verification event log (append-only, not overwrite) — full audit trail, history is preserved
- Place-anchored tap record → `place_id` foreign key inherits business hours automatically

**M — Modify:**
- State-by-state rollout: Florida pilot → Arizona, Nevada, New Mexico, West Texas (water stress ranking)
- Florida as model validation lab — personal ground truth advantage in Keys corridor
- On-device ONNX model (~10MB) — runs offline, critical for Keys dead zones
- Per-category confidence thresholds — campgrounds 0.6, gas stations 0.8
- Social proof "last seen" — "3 overlanders confirmed this in 30 days"
- Community-driven expansion — 50 user requests triggers a state scan automatically

**E — Eliminate:**
- Eliminate real-time API in v1 — batch-only cuts scope 40%, ships faster
- Eliminate custom scraping — official SDKs only, no brittle maintenance, no legal risk
- Eliminate manual location curation — Overpass handles it automatically

**R — Reverse:**
- Users find taps → model validates (easier model job, faster accurate coverage)
- Start with Homestead → Marathon corridor specifically, not all Florida

---

### Technique 3: Cross-Pollination

**From iNaturalist / Merlin Bird ID:**
- "Research Grade" model: 2 independent user confirmations promotes pin from unverified → confirmed
- Offline-first on-device inference: Merlin proved lightweight models work on old phones in remote areas — same architecture for Keys dead zones

**From Infrastructure Inspection (RoadBotics):**
- "Drive-once, classify-everything" pipeline: Label Studio + FastAPI, already open-source and productionized
- Coverage heatmap (green/yellow/red zones) — communicates *absence* of water, the actual danger, better than pins

**From AED Locator Networks (PulsePoint):**
- Confidence decay: pins fade after 6 months, nearby users get "can you confirm?" push automatically
- Proactive contextual notification: "Next confirmed water tap: 8 miles ahead at MM 47 Shell"

**From Yelp / Google Maps:**
- Photo tag → place attribute: tap detection sets `has_water_tap=true` on place record → searchable
- Photo freshness weighting: recency × confidence = trust score; stale high-confidence loses to fresh low-confidence

---

### Extended Exploration

**ML Training specifics:**
- CLIP zero-shot as v1 (~$14 for 6,000 Florida images) — ship in a week, train properly in month 2
- Transfer learning from MobileNetV3/EfficientNet-B0 — 50–100 labeled photos sufficient for fine-tuning
- Ship at 80% accuracy — better than 95% accuracy you never ship; user corrections fix the rest
- Negative examples are the bottleneck — need gas station facades *without* taps, as important as positives

**Project migration delta:**
- Faucet classifier module already exists (`bb80f53`) — train it, wire batch output to PostGIS
- Corridor suggestions already done (p3-2-2, p3-2-3) — add water tap density to scoring function
- Trip archive pattern already built (`a2c3ee6`) — reuse soft-delete + archive for tap lifecycle

**Florida Keys specifics:**
- Mile Marker system as primary location index — query "taps MM 40–60", speaks local language
- Seasonal closure data — `closed_months[]` field, hurricane season June–November flags unreliable taps

---

## Idea Organization and Prioritization

### Complete Idea Inventory by Theme

**THEME 1: Data & Image Sourcing (ToS-Safe)**
1. Mapillary API — CC-BY-SA, free, no scraping
2. Google Places Photos API — official, ~$34 for Florida pilot
3. Overpass API for location enumeration — bounding box query, free
4. YouTube video frames — dashcam footage, 30 angles per location
5. Synthetic augmentation — 100 photos → 5,000 training samples
6. Eliminate custom scraping — official SDKs only

**THEME 2: ML Model & Training**
7. CLIP zero-shot as v1 — $14 for Florida pilot, no training needed
8. YOLOv8 object detector — bounding boxes, tap proof photos
9. Transfer learning (MobileNetV3/EfficientNet-B0) — fine-tune on 100 photos
10. Ship at 80% accuracy — don't wait for perfect data
11. Negative examples are the bottleneck — need no-tap gas station photos
12. On-device ONNX model — ~10MB, offline in Keys dead zones
13. Per-category confidence thresholds — context-aware scoring
14. Recency × confidence trust score — freshness matters more than raw confidence

**THEME 3: System Architecture**
15. Hybrid inference pattern — Lambda (real-time) + Batch (nightly scans)
16. Batch-only v1 — eliminate real-time, ship faster
17. Azure Container Apps — scale-to-zero, uses existing infra
18. Label Studio + FastAPI pipeline — open-source, already productionized
19. OSM read-only bootstrap → private PostGIS DB
20. Place-anchored tap record — `place_id` FK, business hours join

**THEME 4: Data Model & Trust**
21. Core tap schema — `location`, `place_id`, `place_type`, `access`, `confidence`, `source`, `photos[]`, `is_active`
22. Verification event log — append-only, full audit trail
23. Multi-source confidence scoring — ML + OSM + user = high confidence
24. iNaturalist Research Grade — 2-user confirmation promotes pin
25. AED confidence decay — pins fade after 6 months, auto-prompt nearby users
26. Yelp photo → place attribute — `has_water_tap=true` on place record

**THEME 5: User Experience**
27. Coverage heatmap — green/yellow/red zones signal absence of water
28. Proactive "tap ahead" notification — MM-based, contextual, anticipatory
29. Social proof display — "3 overlanders confirmed in last 30 days"
30. Mile Marker query index — Keys-native language
31. Corridor water density overlay — taps as route quality signal
32. User correction → training label feedback loop

**THEME 6: Florida Keys Launch Strategy**
33. Homestead → Marathon corridor first — personal ground truth, 50-mile strip
34. Florida as model validation lab — drive-it-yourself verification advantage
35. Mile Marker structured data — no other water app speaks this
36. Seasonal closure data — `closed_months[]`, hurricane season flagging

**THEME 7: Growth & Expansion**
37. State-by-state rollout — Florida → desert states by water stress ranking
38. Water stress ranking for expansion priority — Arizona, Nevada, New Mexico, West Texas
39. Community-driven expansion — 50 user requests triggers state scan
40. Multi-amenity pipeline — same infra, different model (future backlog)

**THEME 8: Project Migration (Overnighter Delta)**
41. Faucet classifier already exists — train it, wire to PostGIS
42. Corridor scoring extension — add water tap density field
43. Trip archive pattern reuse — stale tap lifecycle management

---

### Prioritization Results

**Top 3 High-Impact Ideas:**
1. **CLIP zero-shot as v1** — working Florida map in days, not months, $14 cost
2. **Homestead → Marathon corridor first** — personal validation, highest personal pain point
3. **Coverage heatmap** — communicates absence of water (the actual danger) better than any pin map

**Top 3 Quick Wins (this week):**
1. **Batch-only v1 scope** — cuts real-time API work entirely, ships faster
2. **Synthetic augmentation** — turn 100 photos into 5,000 training samples before writing pipeline code
3. **Overpass API query** — enumerate all Florida Keys gas stations + campgrounds in one query

**Biggest Breakthrough Concept:**
**Batch-only v1 + CLIP zero-shot + Homestead corridor** — three decisions together mean a working map of the Keys corridor with no custom model training, no scraping infrastructure, and no real-time API in approximately one week. Then iterate from there.

---

### Action Plans

**Priority 1: Ship a Working Keys Corridor Map (Week 1)**
1. Run Overpass API query: `amenity=fuel` + `amenity=campsite` bounding box Homestead → Marathon
2. For each location, fetch photos via Mapillary API or Google Places Photos API
3. Run photos through CLIP zero-shot ("does this show a publicly accessible outdoor water faucet?")
4. Write confident results (>0.7) to PostGIS with `source=clip_zero_shot`, `confidence=score`
5. Render pins on existing Overnighter map
6. Drive the corridor personally and flag wrong pins → immediate ground truth

**Priority 2: Train & Replace CLIP with Custom Model (Week 2–3)**
1. Augment 100 existing photos to 5,000 with Albumentations
2. Collect negative examples (gas station facades without taps) from Mapillary
3. Fine-tune EfficientNet-B0 or MobileNetV3 on augmented dataset
4. Evaluate against CLIP on Keys ground truth pins
5. Replace CLIP with custom model when custom model beats CLIP F1

**Priority 3: Productionize Batch Pipeline (Week 3–4)**
1. Wire trained model into AWS Batch or Azure Container Apps job
2. Schedule nightly scan of Florida Keys bounding box
3. Implement confidence decay — pins older than 6 months get flagged
4. Add user confirm/deny on map pins → append to verification event log

---

## Session Summary and Insights

**Key Achievements:**
- 48 ideas generated across Constraint Mapping, SCAMPER, and Cross-Pollination
- 4 of 4 initial constraints resolved as fog or manageable (no hard blockers found)
- Clear 3-week implementation roadmap identified
- Discovered the project is closer to done than it appears — faucet classifier, corridor logic, and archive pattern already exist

**Creative Breakthroughs:**
- CLIP zero-shot eliminates the "need more training data before I can ship" trap entirely
- The Homestead → Marathon corridor is both the highest-value launch target AND the cheapest to validate (personal ground truth)
- Coverage heatmap reframes the product: it's not just "where are taps" but "where did we look and find nothing" — the absence is the safety signal

**Session Reflections:**
- The user's personal experience in Florida Keys is a genuine competitive moat — no team or company can validate that corridor as quickly or cheaply
- The existing codebase is more ready than expected; the pivot is an extension, not a rewrite
- Water tap focus is the right constraint for v1 — multi-amenity expansion is a natural next chapter once the pipeline is proven
