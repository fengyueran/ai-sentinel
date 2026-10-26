CREATE TABLE IF NOT EXISTS lb_models (
  id                   text PRIMARY KEY,
  slug                 text NOT NULL UNIQUE,
  name                 text NOT NULL,
  provider             text,
  provider_slug        text,
  released_at          timestamptz,
  release_date_source  text,
  context_window_tokens integer,
  metadata_source      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
