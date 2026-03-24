-- Index for push notification recipient lookup by pin_id
CREATE INDEX IF NOT EXISTS idx_saved_spots_pin_id ON saved_spots (pin_id);
