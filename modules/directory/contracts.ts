export interface DirectoryTopPortal {
  rank: number;
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
  stars: number;
  value: string;
  limitation: string;
  collected: boolean;
  enabled: boolean;
}

export interface DirectoryEntry {
  id: string;
  rank: number;
  name: string;
  url: string | null;
  domain: string | null;
  category: string;
  stars: number;
  advice: string;
  collected: boolean;
  enabled: boolean;
}

export interface DirectoryCategoryCount {
  name: string;
  count: number;
}

export interface DirectoryResponse {
  totalRecords: number;
  ratedCount: number;
  directUrlCount: number;
  collectedCount: number;
  enabledCount: number;
  starCounts: Record<string, number>;
  categories: DirectoryCategoryCount[];
  topPortals: DirectoryTopPortal[];
  entries: DirectoryEntry[];
}

export interface DirectoryUpdateStarRequest {
  id: string;
  stars: number;
}

export interface DirectoryUpdateStarResponse {
  ok: boolean;
  id: string;
  stars: number;
}
