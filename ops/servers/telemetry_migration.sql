-- mirror_event: add monotonic seq for polling
ALTER TABLE mirror_event
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;

CREATE INDEX IF NOT EXISTS mirror_event_tenant_seq
  ON mirror_event (tenant_id, seq DESC);

CREATE INDEX IF NOT EXISTS mirror_event_topic_seq
  ON mirror_event (topic, seq DESC);

CREATE INDEX IF NOT EXISTS mirror_event_diamond_seq
  ON mirror_event (seq DESC)
  WHERE topic LIKE 'diamond.%';

CREATE INDEX IF NOT EXISTS mirror_event_diamond_dimension
  ON mirror_event ((payload->>'dimension'))
  WHERE topic = 'diamond.finding';

CREATE INDEX IF NOT EXISTS mirror_event_diamond_severity
  ON mirror_event ((payload->>'severity'))
  WHERE topic = 'diamond.finding';
