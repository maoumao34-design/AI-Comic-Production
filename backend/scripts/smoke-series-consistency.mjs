// smoke-series-consistency.mjs — 不启 Comfy：用 EP-01 已有 03 图晋升系列包并校验解析顺序
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import * as series from "../platforms/series-consistency.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../..");

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT " + msg);
}

async function main() {
  const seriesId = "heiress-smoke";
  const episodeId = "EP-01";

  // 找任意已有 char/*/output.png
  const root = path.join(REPO, "assets", episodeId, "03-assets");
  const versions = (await fs.readdir(root)).filter((v) => v.startsWith("v")).sort().reverse();
  let foundVer = null;
  let foundSubject = null;
  for (const ver of versions) {
    const outs = path.join(root, ver, "outputs");
    let walk = [];
    try {
      walk = await fs.readdir(outs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of walk) {
      if (!d.isDirectory()) continue;
      // char/serena 两层
      if (d.name === "char") {
        const chars = await fs.readdir(path.join(outs, "char"));
        for (const c of chars) {
          const png = path.join(outs, "char", c, "output.png");
          try {
            await fs.access(png);
            foundVer = ver;
            foundSubject = `char/${c}`;
            break;
          } catch {
            /* */
          }
        }
      }
      if (foundSubject) break;
    }
    if (foundSubject) break;
  }
  assert(foundSubject, "need at least one EP-01 03 character output.png");

  const versionObj = {
    version: foundVer,
    archive_path: `assets/${episodeId}/03-assets/${foundVer}/`,
    model: "smoke",
    seed: 0,
    content: { assets: [{ asset_id: foundSubject, kind: "consistency_asset", label: foundSubject }] },
    refs: [],
  };

  const promo = await series.promoteApprovedAssets(episodeId, versionObj, { seriesId });
  assert(!promo.skipped, "promote should not skip: " + promo.reason);
  assert(promo.promoted.length >= 1, "promoted >= 1");
  assert(versionObj.content.subjects?.some((s) => s.consistency_ref?.startsWith(`series:${seriesId}/`)), "content stamped");

  const pack = await series.listSeriesPack(seriesId);
  assert(pack.subject_count >= 1, "pack has subjects");
  assert(pack.subjects.some((s) => s.subject_id === foundSubject), "pack contains " + foundSubject);

  const hit = await series.resolveAssetPng("EP-99", foundSubject, seriesId);
  assert(hit?.source === "series", "EP-99 resolves from series");
  assert(hit.path.includes("_series"), "path under _series");

  const reused = await series.reuseSeriesSubjectIntoEpisode("EP-99", foundSubject, "v1", seriesId);
  assert(reused?.reused === true, "reuse into EP-99");
  await fs.access(path.join(REPO, "assets", "EP-99", "03-assets", "v1", "outputs", foundSubject, "output.png"));

  const seeded = await series.seedEpisodeSeriesRefs("EP-99", seriesId);
  assert(seeded.seeded.length >= 1, "seeded refs");

  // 本集不得复用自己贡献的锁定图（保证可改）
  assert(
    (await series.canReuseSeriesSubject(episodeId, foundSubject, seriesId)) === false,
    "source episode must not auto-reuse own lock",
  );
  assert(
    (await series.canReuseSeriesSubject("EP-99", foundSubject, seriesId)) === true,
    "other episode may reuse",
  );

  // ↩️ 联动：撤出 source 集贡献后，跨集也拿不到
  const dem = await series.demoteEpisodeContributions(episodeId, { seriesId });
  assert(dem.removed.length >= 1, "demote removes source episode entries");
  const pack2 = await series.listSeriesPack(seriesId);
  assert(pack2.subject_count === 0, "pack empty after demote");
  assert(
    (await series.canReuseSeriesSubject("EP-99", foundSubject, seriesId)) === false,
    "no reuse after demote",
  );

  console.log("SMOKE series-consistency PASSED", {
    seriesId,
    subject: foundSubject,
    promoted: promo.promoted.length,
    demoted: dem.removed.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
