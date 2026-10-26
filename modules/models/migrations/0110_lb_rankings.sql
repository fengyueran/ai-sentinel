CREATE TABLE IF NOT EXISTS lb_rankings (
  id                bigserial PRIMARY KEY,
  run_id            text NOT NULL REFERENCES lb_runs (id) ON DELETE CASCADE,
  board             text NOT NULL,
  model_id          text NOT NULL REFERENCES lb_models (id),
  rank              integer NOT NULL,
  score             double precision,
  uncertainty       double precision,
  coverage          double precision,
  confidence        text,
  metric_count      integer,
  summary           text,
  component_scores  jsonb,
  detail            jsonb,
  UNIQUE (run_id, board, model_id)
);
