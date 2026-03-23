-- Seed data for local development
-- 5 sample pins across the US for testing rig-aware filtering

INSERT INTO pins (name, description, latitude, longitude, pin_type, max_length_ft, max_height_ft, amenities, badge_state)
VALUES
  (
    'Dispersed Site — Coconino NF',
    'Open dispersed camping area in Coconino National Forest. Flat terrain, good cell signal.',
    35.1983, -111.6513,
    'usfs',
    45, 13.5,
    '{"water":false,"dump":false,"electric":false,"shower":false,"fuel":false,"propane":false,"overnight":true}',
    'green'
  ),
  (
    'BLM Camping — Desert Southwest',
    'Unrestricted BLM land. Suitable for all rig sizes. No services.',
    33.4151, -112.0665,
    'blm',
    NULL, NULL,
    '{"water":false,"dump":false,"electric":false,"shower":false,"fuel":false,"propane":false,"overnight":true}',
    'yellow'
  ),
  (
    'Rest Stop — I-40 NM',
    'Standard interstate rest stop with RV dump and water.',
    35.0844, -106.6504,
    'community',
    65, 14.0,
    '{"water":true,"dump":true,"electric":false,"shower":false,"fuel":false,"propane":false,"overnight":true}',
    'grey'
  ),
  (
    'KOA-style Camp — Colorado',
    'Full hookup campground. Max length 40ft due to tight turns.',
    39.7392, -104.9903,
    'community',
    40, 13.0,
    '{"water":true,"dump":true,"electric":true,"shower":true,"fuel":false,"propane":true,"overnight":true}',
    'green'
  ),
  (
    'Walmart Overnight — Flagstaff',
    'Confirmed overnight parking permission. Large lot, level.',
    35.1983, -111.6215,
    'community',
    NULL, NULL,
    '{"water":false,"dump":false,"electric":false,"shower":false,"fuel":false,"propane":false,"overnight":true}',
    'red'
  );
