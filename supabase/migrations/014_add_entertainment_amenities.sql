-- Migration: Add entertainment/outdoor activity keys to amenities default

ALTER TABLE pins
  ALTER COLUMN amenities SET DEFAULT
    '{"water":false,"dump":false,"electric":false,"shower":false,"fuel":false,"propane":false,
      "overnight":false,"toilets":false,"pets":false,"wifi":false,"kitchen":false,"restaurant":false,
      "big_rig":false,"tent":false,
      "hiking":false,"fishing":false,"swimming":false,"boating":false,"biking":false,"ohv":false,
      "climbing":false,"winter_sports":false,"hunting":false,"wildlife":false,"horseback":false,
      "hot_springs":false}';
