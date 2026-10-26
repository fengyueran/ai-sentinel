CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS lb_aliases_source_alias_key ON lb_aliases (source_key, alias);
