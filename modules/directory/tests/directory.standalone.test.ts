import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDirectory } from "../backend/read.ts";

test("directory loads rated AI sources and Top 10 priority portals with direct URLs", async () => {
  const data = await loadDirectory();
  assert.equal(data.totalRecords, 812);
  assert.equal(data.entries.length, 812);
  assert.equal(data.ratedCount, 812);
  assert.equal(data.starCounts["0"] ?? 0, 0);
  assert.equal(data.starCounts["1"] ?? 0, 0);
  assert.equal(data.starCounts["2"] ?? 0, 0);
  for (const entry of data.entries) {
    assert.ok(entry.stars >= 3, `entry ${entry.id} has stars ${entry.stars} < 3`);
  }
  assert.ok(data.directUrlCount >= 650);
  assert.equal(data.topPortals.length, 10);
  for (const portal of data.topPortals) {
    assert.ok(portal.url.startsWith("http"), `portal #${portal.rank} has URL ${portal.url}`);
    assert.equal(portal.stars, 5);
  }
  assert.equal(data.starCounts["5"], 44);
  assert.equal(data.starCounts["4"], 337);
  assert.ok(data.categories.length >= 10);
});
