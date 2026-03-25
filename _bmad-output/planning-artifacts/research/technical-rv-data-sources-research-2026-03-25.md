---
stepsCompleted: [1, 2, 3]
inputDocuments: []
workflowType: 'research'
lastStep: 3
research_type: 'technical'
research_topic: 'Public Data Sources for RV Overnight Parking, Dump Stations & Water Taps'
research_goals: 'Identify all public data sources for overnight parking, dump stations, water taps, and RV amenities; evaluate APIs and data access; plan per-source sync APIs for Phase 4'
user_name: 'Kyryl'
date: '2026-03-25'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical

**Date:** 2026-03-25
**Author:** Kyryl
**Research Type:** Technical

---

## Research Overview

## Technical Research Scope Confirmation

**Research Topic:** Public Data Sources for RV Overnight Parking, Dump Stations & Water Taps
**Research Goals:** Identify all public data sources for overnight parking, dump stations, water taps, and RV amenities; evaluate APIs and data access; plan per-source sync APIs for Phase 4

**Technical Research Scope:**

- Architecture Analysis - design patterns, frameworks, system architecture
- Implementation Approaches - development methodologies, coding patterns
- Technology Stack - languages, frameworks, tools, platforms
- Integration Patterns - APIs, protocols, interoperability
- Performance Considerations - scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-03-25

---

## Technology Stack Analysis

### Programming Languages

The ecosystem around RV and camping data sources is polyglot. Each source has a distinct set of language-friendly access patterns:

**OpenStreetMap / Overpass API:**
Client libraries and tooling span all major languages. The official OSM sync toolchain (Osmosis) is Java-based; Osmupdate and Osmconvert are written in C. Python is the dominant language for client-side Overpass queries, with the `overpy` and `overpass-api-python-wrapper` libraries. JavaScript/Node.js is also common for web-based consumers via the raw Overpass HTTP endpoint. The server itself runs on C++ (osm3s).

_Popular Languages: Python (data processing), JavaScript/TypeScript (web clients), Java (Osmosis sync), C (Osmupdate/Osmconvert performance tools)_
_Emerging Languages: Rust-based OSM parsers (osm-pbf-parser, libosmium bindings) gaining traction for performance-critical pipeline work_
_Language Evolution: Shift from Java-heavy pipelines to Python data engineering stacks for OSM data processing_
_Source: [Overpass API - OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) | [Osmupdate - OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Osmupdate)_

**RIDB / Recreation.gov:**
REST API with JSON responses — consumable from any language. Official community clients exist in Python (`recdotgov-client` on GitHub, auto-generated from OpenAPI spec) and Node.js. Rate limit is 50 req/min so most sync implementations are single-threaded with backoff.

_Source: [Recreation.gov API Docs](https://ridb.recreation.gov/docs) | [recdotgov-client GitHub](https://github.com/juftin/recdotgov-client)_

**iOverlander:**
No programmatic language bindings. Data access is manual web export (GPX / CSV / JSON / XLS) per country. Files are emailed as a download link expiring in 24 hours. No API client libraries exist because no public API is offered.

_Source: [iOverlander Countries](https://app.ioverlander.com/countries/places_by_country)_

### Development Frameworks and Libraries

**OSM Ecosystem:**

| Library / Tool | Language | Purpose |
|---|---|---|
| Osmosis | Java | Incremental replication, filtering, PBF→PostgreSQL |
| Osmupdate | C | Download and assemble OSM change files |
| Osmconvert | C | Format conversion (PBF ↔ OSM XML ↔ OsmChange) |
| Osmdbt | C++ | Produces minutely diffs directly from PostgreSQL WAL |
| overpy | Python | Overpass API client |
| overpass-api-python-wrapper | Python | Simplified Overpass queries |
| Nominatim | PHP+PostgreSQL | Geocoding and reverse geocoding on OSM data |
| imposm3 | Go | Fast OSM→PostgreSQL importer |

_Major Frameworks: Osmosis (replication), imposm3 (fast import), overpy (Python queries)_
_Micro-frameworks: overpass-api-python-wrapper for simple POI queries without full planet ingestion_
_Source: [Planet.osm/diffs Wiki](https://wiki.openstreetmap.org/wiki/Planet.osm/diffs) | [Osmosis/Replication Wiki](https://wiki.openstreetmap.org/wiki/Osmosis/Replication)_

**RIDB:**
Airbyte provides a pre-built connector (`source-recreation`) for ingesting RIDB data into data warehouses. Manual integration via HTTP client (Axios, Fetch, Python requests) is straightforward given the clean REST + JSON surface.

_Source: [Recreation.gov API Airbyte Docs](https://docs.airbyte.com/integrations/sources/recreation)_

**Campflare:**
Web-based API for campground data. Free for individuals and nonprofits (invite-only via contact@campflare.com). Provides map layers and campground data. No SDK found — raw HTTP REST.

_Source: [Campflare API & Data](https://campflare.com/api)_

### Database and Storage Technologies

**For OSM data at scale:**
- **PostgreSQL + PostGIS**: The canonical storage backend for imported OSM data. Osmosis and imposm3 both target PostGIS. Spatial indexes (GiST on geometry columns) are essential for bounding-box and radius queries.
- **PBF (Protocol Buffer Format)**: The binary OSM dump format used for Planet.osm full downloads and Geofabrik regional extracts. Significantly smaller than XML equivalents.
- **OsmChange (.osc) / .o5c**: Binary/XML diff format produced by osmdbt and used by Osmosis for incremental replication.
- **SQLite + SpatiaLite**: Lightweight alternative for smaller regional datasets or mobile offline use.

**For Overnighter's sync pipeline:**
The pattern established with `sync-gov` uses Supabase (PostgreSQL + PostGIS) as the destination store. Each source sync API would transform external data into Overnighter's normalized `spots` table schema.

_Relational Databases: PostgreSQL + PostGIS (primary), SQLite/SpatiaLite (regional/mobile)_
_Binary Formats: PBF for bulk, OsmChange (.osc) for incremental_
_Source: [Using planet.osm Wiki](https://wiki.openstreetmap.org/wiki/Using_planet.osm) | [Geofabrik Technical Details](https://download.geofabrik.de/technical.html)_

### Development Tools and Platforms

**Data Acquisition:**
- **Overpass Turbo** (`overpass-turbo.eu`): Interactive web IDE for Overpass QL — used to develop and test queries before putting them into production sync scripts
- **Geofabrik Downloads** (`download.geofabrik.de`): Regional PBF extracts (US, North America) updated daily — significantly reduces initial import time vs full Planet
- **osmupdate CLI**: Downloads and chains minutely/hourly/daily diffs into a single .osc file covering any time window

**Data Validation:**
- **JOSM**: Java OSM editor — useful for inspecting and validating extracted POIs
- **osmium-tool**: C++ CLI for inspecting and converting OSM files

**Build and Automation:**
- Serverless functions (Vercel) for per-source sync endpoints — matches existing `sync-gov` architecture
- GitHub Actions or Vercel Cron for scheduled sync triggers
- Node.js + TypeScript for sync API implementations (consistent with Overnighter's existing API stack)

_Source: [Overpass API by Example](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example) | [Geofabrik Technical Details](https://download.geofabrik.de/technical.html)_

### Cloud Infrastructure and Deployment

All sync endpoints follow the same Vercel serverless function pattern as the existing `sync-gov` API:

```
/api/sync-osm       → OSM Overpass pull (filterable by bbox/tag)
/api/sync-ridb      → RIDB REST pull (national parks / campgrounds)
/api/sync-campflare → Campflare API pull (campground map layer data)
```

Invocation via HTTP GET with `Authorization: Bearer <SYNC_SECRET>` header — same pattern as `sync-gov`. Scheduled via Vercel Cron or external cron (e.g., GitHub Actions scheduled workflow calling the endpoint).

Supabase (PostgreSQL + PostGIS) is the destination for all sources, writing to the normalized `spots` table with `source` column discriminating origin.

_Major Cloud Providers: Vercel (functions), Supabase (database + PostGIS)_
_Serverless Platforms: Vercel Serverless Functions (existing pattern, proven)_
_Source: [RIDB at data.gov](https://catalog.data.gov/dataset/recreation-information-database-ridb-58364) | [Recreation.gov Use Our Data](https://www.recreation.gov/use-our-data)_

### Technology Adoption Trends

**OSM is the dominant open standard:** Overpass API has become the de-facto access layer for geospatial POI data in open-source applications. The tag vocabulary for camping (`tourism=camp_site`, `tourism=caravan_site`, `amenity=sanitary_dump_station`, `amenity=drinking_water`, `man_made=water_tap`) is well established and actively maintained.

**Proprietary sources are closing off:** iOverlander shifted from free data exports to a $99/yr subscription for bulk access. AllStays, Campendium, and Hipcamp offer no public APIs — developer access requires negotiating a data licensing deal. This trend reinforces OSM + government APIs (RIDB) as the most reliable long-term foundations.

**RIDB is the authoritative US government source:** Backed by 12 federal agencies (USDA Forest Service, National Park Service, Army Corps of Engineers, Bureau of Land Management, etc.). Free, stable, versioned REST API. The most authoritative source for developed campgrounds with site-level detail (electric hookups, pull-through sites, max RV length).

**Campflare is a niche but relevant option:** Free for nonprofits/individuals, provides campground map data and availability. Invite-only model limits reliability as a long-term dependency.

**SaniDumps / rvdumps**: Community-driven, no APIs. OSM covers significant overlap for dump stations via `amenity=sanitary_dump_station` — tagging is sparse in OSM today but improving. Best strategy is to combine OSM POIs with manual admin curation.

_Migration Patterns: Industry moving away from scraped/exported data toward Overpass API + RIDB as the two stable open pillars_
_Emerging Technologies: Overpass API incremental diff (minutely replication via Osmosis) becoming viable for real-time freshness without full re-imports_
_Legacy Technology: GPX/CSV file-based batch imports from iOverlander becoming unsustainable at scale_
_Source: [FreeCampsites.net Bulk Data](https://freecampsites.net/bulk-data-submissions/) | [Campflare API](https://campflare.com/api)_

---

### Data Source Summary Matrix

| Source | Access Method | Auth | Cost | Sync Feasibility | Best For |
|---|---|---|---|---|---|
| **OpenStreetMap (Overpass)** | REST / Overpass QL | None | Free | ✅ High — minutely diffs | Dump stations, water taps, campsites globally |
| **RIDB / Recreation.gov** | REST + JSON | API Key | Free | ✅ High — stable REST | US national/state parks, developed campgrounds |
| **Campflare** | REST API | Invite-only | Free (nonprofits) | ⚠️ Medium — invite gated | Campground data + availability |
| **iOverlander** | Manual export | Account + $99/yr | Paid | ❌ Low — no API, manual | Overlanding spots globally (backup only) |
| **FreeCampsites.net** | No read API | N/A | N/A | ❌ Not feasible | Boondocking spots (data not accessible) |
| **SaniDumps.com** | No API | N/A | N/A | ❌ Not feasible | Dump stations (covered by OSM) |
| **rvdumps.com** | No API | N/A | N/A | ❌ Not feasible | Dump stations (covered by OSM) |
| **AllStays** | Licensing only | Contact required | Paid license | ⚠️ Low — licensing cost | Comprehensive RV database (fallback) |
| **Campendium** | No API | N/A | N/A | ❌ Not feasible | User-reviewed boondocking spots |

---

## Integration Patterns Analysis

### API Design Patterns

Each data source exposes a different access surface. Overnighter's per-source sync functions must adapt to each pattern independently while writing to a unified internal schema.

**OpenStreetMap — Overpass API (query language, not REST)**

Overpass uses its own declarative query language (Overpass QL), not a standard REST interface. A sync function issues an HTTP POST to `https://overpass-api.de/api/interpreter` with a QL body:

```
[out:json][timeout:60][bbox:{{south}},{{west}},{{north}},{{east}}];
(
  node["amenity"="sanitary_dump_station"];
  node["amenity"="drinking_water"];
  node["man_made"="water_tap"];
  node["tourism"="camp_site"];
  node["tourism"="caravan_site"];
);
out body;
```

Response is JSON with `elements[]` array. Each element has `id`, `lat`, `lon`, and `tags` object. No pagination — the bbox constrains result size. For full US coverage, tile the country into a grid of bboxes and call each sequentially.

_Pattern: Pull-on-demand, bbox-tiled, no auth, idempotent via OSM node `id` as external key_
_Source: [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) | [Overpass Turbo](https://overpass-turbo.eu/)_

**RIDB / Recreation.gov — Standard REST + JSON**

Clean REST API with offset-based pagination. Max 50 results per page, 50 req/min rate limit. Two relevant endpoints:

```
GET https://ridb.recreation.gov/api/v1/facilities?activity=CAMPING&limit=50&offset=0
GET https://ridb.recreation.gov/api/v1/campsites?facilityid={id}&limit=50&offset=0
```

Headers: `apikey: {RIDB_API_KEY}`. Paginate by incrementing `offset` until `METADATA.Results.CURRENT_COUNT < limit`. Full US campground dataset is ~5,000 facilities — achievable in a single sync run within rate limits (~100 pages × 50 = 5,000 records at 50 req/min = ~2 minutes).

_Pattern: REST + JSON, offset pagination, API key auth, idempotent via `FacilityID` as external key_
_Source: [RIDB API Docs](https://ridb.recreation.gov/docs) | [Airbyte RIDB Connector](https://docs.airbyte.com/integrations/sources/recreation)_

**Google Places API — Review Text Mining**

Two-step process per geographic search area:

1. **Nearby Search** — returns up to 60 places (paginated via `next_page_token`):
   ```
   GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
     ?location={lat},{lng}&radius=50000&type=gas_station&key={KEY}
   ```
2. **Place Details** — returns up to 5 reviews per place:
   ```
   GET https://maps.googleapis.com/maps/api/place/details/json
     ?place_id={id}&fields=name,geometry,reviews,types&key={KEY}
   ```

Keyword scan on `reviews[].text` for amenity signals. Store only the derived flags (`has_dump`, `has_water`, `has_propane`) + the `place_id` — **never persist raw review text** (ToS §3.2.3).

_Pattern: REST + JSON, token-based pagination, API key auth, on-demand corridor-scoped (not full US sweep)_
_Source: [Google Places API Overview](https://developers.google.com/maps/documentation/places/web-service/overview) | [Place Reviews API](https://developers.google.com/maps/documentation/javascript/place-reviews)_

---

### Communication Protocols and Data Formats

| Source | Protocol | Auth | Format | Pagination |
|---|---|---|---|---|
| Overpass API | HTTP POST | None | JSON / XML | bbox tiling |
| RIDB | HTTP GET | API Key header | JSON | offset/limit |
| Google Places | HTTP GET | API Key query param | JSON | next_page_token |
| iOverlander (manual) | HTTPS download | Session cookie | JSON / CSV / GPX | per-country export |

**OSM-specific formats for bulk ingestion (non-Overpass path):**
- `.osm.pbf` — Protocol Buffer binary, used for Geofabrik regional extracts
- `.osc.gz` — OsmChange XML diff format for incremental updates
- Both are handled by Osmosis (Java) or osmium-tool (C++) before loading into PostGIS

_Source: [OsmChange Format](https://wiki.openstreetmap.org/wiki/OsmChange) | [Planet.osm/diffs](https://wiki.openstreetmap.org/wiki/Planet.osm/diffs)_

---

### System Interoperability — Unified Sync Architecture

All three sync APIs write to a single normalized destination: Overnighter's `spots` table in Supabase (PostgreSQL + PostGIS). The interoperability contract is the shared schema:

```typescript
// Shared output type for all sync functions
interface SpotUpsert {
  external_id: string       // e.g. "osm:node:123456", "ridb:facility:789", "places:ChIJ..."
  source: 'osm' | 'ridb' | 'places' | 'ioverlander' | 'admin'
  lat: number
  lng: number
  name: string
  amenities: {
    dump_station: boolean
    water: boolean
    propane: boolean
    camping: boolean
    electric: boolean
  }
  last_synced_at: string    // ISO 8601
  verified: boolean         // false for auto-synced, true for admin-confirmed
}
```

Upsert via `ON CONFLICT (external_id) DO UPDATE` — fully idempotent. Re-running any sync is safe.

```sql
INSERT INTO spots (external_id, source, location, name, amenities, last_synced_at)
VALUES (...)
ON CONFLICT (external_id) DO UPDATE SET
  amenities = EXCLUDED.amenities,
  last_synced_at = EXCLUDED.last_synced_at;
```

_Pattern: ETL with idempotent upsert, PostGIS geometry column, source discriminator_
_Source: [PostGIS Data Management](https://postgis.net/docs/using_postgis_dbmanagement.html) | [Geospatial ETL Patterns](https://medium.com/analytics-vidhya/i-built-a-geospatial-etl-from-scratch-with-python-and-this-is-what-i-learned-b45b37d15f94)_

---

### Microservices Integration — Per-Source Sync Functions

Each sync source gets its own Vercel serverless function, following the existing `sync-gov` pattern:

```
/api/sync-osm        → OSM Overpass pull (bbox param, tag filter)
/api/sync-ridb       → RIDB REST sweep (US campgrounds + campsites)
/api/sync-places     → Google Places review miner (corridor bbox param)
```

**Common function interface:**

```typescript
// All sync functions share the same HTTP contract
GET /api/sync-{source}?bbox=south,west,north,east
Authorization: Bearer {SYNC_SECRET}

// Response
{ inserted: number, updated: number, skipped: number, errors: number, duration_ms: number }
```

**Invocation methods:**
- **Manual trigger** — admin calls the endpoint directly from the admin UI
- **Scheduled** — Vercel Cron job (`vercel.json` `crons` block) on a per-source schedule:
  - OSM: weekly (data changes slowly; dump stations don't move often)
  - RIDB: monthly (federal data is very stable)
  - Places: on-demand per corridor (user routes drive the scan area)

_Pattern: Isolated serverless functions, shared auth (SYNC_SECRET), shared output schema, independent schedules_
_Source: [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)_

---

### Event-Driven Integration

**Cron-triggered sync (primary pattern):**

```json
// vercel.json additions for Phase 4
{
  "crons": [
    { "path": "/api/sync-osm",  "schedule": "0 3 * * 0" },
    { "path": "/api/sync-ridb", "schedule": "0 4 1 * *" }
  ]
}
```

OSM runs every Sunday at 3am UTC. RIDB runs on the 1st of every month at 4am UTC. Places sync is on-demand only (triggered by user route creation, not scheduled).

**Places corridor scan — event-driven trigger:**

When a user creates or updates a trip plan route, a background job fires `sync-places` scoped to the corridor bbox. This keeps the Places data fresh for active route areas without sweeping the entire US.

```
User creates trip route → extract corridor bbox → POST /api/sync-places?bbox=...
```

_Pattern: Cron for OSM/RIDB, event-driven for Places; all async, no blocking of user requests_

---

### Integration Security Patterns

All sync endpoints are protected by the existing `requireSyncAuth` middleware pattern (same as `sync-gov`):

```typescript
// Shared auth check for all sync functions
const token = req.headers.authorization?.replace('Bearer ', '')
if (token !== process.env.SYNC_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

**API key storage (Vercel environment variables):**

| Variable | Source | Scope |
|---|---|---|
| `SYNC_SECRET` | Self-generated (existing) | All sync endpoints |
| `RIDB_API_KEY` | ridb.recreation.gov registration | sync-ridb only |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console | sync-places only |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase (existing) | All functions |

No new auth patterns needed — extend the existing middleware.

_Source: [Google Places API Keys](https://developers.google.com/maps/documentation/places/web-service/get-api-key)_

<!-- Content will be appended sequentially through research workflow steps -->
