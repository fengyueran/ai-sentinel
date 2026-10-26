CREATE INDEX CONCURRENTLY IF NOT EXISTS lb_aliases_lookup_idx ON lb_aliases (source_key, normalized_alias);
