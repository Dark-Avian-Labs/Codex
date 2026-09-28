import { normalizeStartupPipelineSummary } from '../../../shared/warframeImport/pipelineSummary.js';
import type {
  StartupPipelineSummary,
  SummaryOutcome,
} from '../../../shared/warframeImport/pipelineSummaryTypes.js';

export type { StartupPipelineSummary, SummaryOutcome };

const DIV = '══════════════════════════════════════════════════════════════';

function clipList(items: string[], max = 12): string {
  if (items.length === 0) return '—';
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} ... (+${items.length - max} more)`;
}

function outcomeLabel(o: SummaryOutcome): string {
  switch (o) {
    case 'ok':
      return 'OK';
    case 'skipped':
      return 'skipped';
    case 'failed':
      return 'failed';
    case 'partial':
      return 'partial';
    default:
      return o;
  }
}

export function printStartupPipelineSummary(summary: StartupPipelineSummary): void {
  const s = normalizeStartupPipelineSummary(summary) ?? summary;
  console.log(`\n${DIV}`);
  console.log(' Run summary — what ran and what changed');
  console.log(`${DIV}`);
  console.log(` Duration: ${(s.durationMs / 1000).toFixed(1)}s\n`);

  if (s.blockingIssues.length > 0) {
    console.log(' Blocking issues:');
    for (const line of s.blockingIssues) console.log(`   • ${line}`);
    console.log('');
  }

  const row = (title: string, outcome: SummaryOutcome, lines: string[]) => {
    console.log(` ${title}  [${outcomeLabel(outcome)}]`);
    for (const l of lines) console.log(`   ${l}`);
    console.log('');
  };

  row('Schema', s.schema.outcome, [s.schema.detail]);

  const ex = s.officialExports;
  if (ex.outcome === 'failed' && ex.error) {
    row('Exports', 'failed', [ex.error]);
  } else if (ex.stats) {
    const st = ex.stats;
    const lines: string[] = [
      `Tracked ${st.requiredCount} required export categories.`,
      `Updated on disk: ${st.downloaded.length} — ${clipList(st.downloaded)}`,
      `Unchanged (hash match): ${st.skippedUnchanged.length}`,
    ];
    if (st.failed.length > 0) {
      lines.push(`Download failures: ${st.failed.length}`);
      for (const f of st.failed) {
        lines.push(`  • ${f.category}: ${f.error}`);
      }
    }
    row('Exports', st.failed.length > 0 ? 'partial' : 'ok', lines);
  } else {
    row('Exports', ex.outcome, [ex.detail]);
  }

  const db = s.sqliteFromExports;
  row('Database', db.outcome, [
    db.detail,
    ...(db.rows
      ? [
          `Loaded: ${db.rows.warframes} warframes, ${db.rows.weapons} weapons, ` +
            `${db.rows.companions} companions, ${db.rows.mods} mods, ${db.rows.modSets} mod sets, ` +
            `${db.rows.arcanes} arcanes, ${db.rows.abilities} abilities.`,
        ]
      : []),
    ...(db.modDescriptionsBackfilled !== undefined
      ? [`Mod descriptions backfilled: ${db.modDescriptionsBackfilled}.`]
      : []),
    ...(db.error ? [`Error: ${db.error}`] : []),
  ]);

  const re = s.warframeRankExceptions;
  row('Rank Exceptions', re.outcome, [
    re.detail,
    ...(re.entryCount !== undefined ? [`Entries written: ${re.entryCount}.`] : []),
    ...(re.error ? [`Error: ${re.error}`] : []),
  ]);

  const es = s.exaltedStanceMods;
  row('Exalted Stances', es.outcome, [
    es.detail,
    ...(es.found !== undefined
      ? [
          `Found: ${es.found}, updated: ${es.insertedOrUpdated ?? 0}` +
            (es.wikiImagesApplied !== undefined ? `, wiki images: ${es.wikiImagesApplied}` : '') +
            '.',
        ]
      : []),
    ...(es.error ? [`Error: ${es.error}`] : []),
  ]);

  const ag = s.atragraphMods;
  row('Atragraph Mods', ag.outcome, [
    ag.detail,
    ...(ag.setsFound !== undefined
      ? [
          `Sets: ${ag.setsFound}, mods updated: ${ag.modsUpdated ?? 0}, images downloaded: ${ag.imagesDownloaded ?? 0}.`,
        ]
      : []),
    ...(ag.error ? [`Error: ${ag.error}`] : []),
  ]);

  const im = s.images;
  const imLines: string[] = [im.detail];
  if (im.total !== undefined) {
    imLines.push(
      `Total: ${im.total}, downloaded: ${im.downloaded ?? 0}, ` +
        `skipped: ${im.skipped ?? 0}, failed: ${im.failed ?? 0}.`,
    );
  }
  if (im.sampleErrors && im.sampleErrors.length > 0) {
    imLines.push('Failures:');
    for (const e of im.sampleErrors) imLines.push(`  • ${e}`);
  }
  if (im.error) imLines.push(`Error: ${im.error}`);
  row('Images', im.outcome, imLines);

  const hi = s.hiddenCompanionWeapons;
  row('Companion Weapons', hi.outcome, [
    hi.detail,
    ...(hi.found !== undefined
      ? [`Found: ${hi.found}, updated: ${hi.insertedOrUpdated ?? 0}.`]
      : []),
    ...(hi.error ? [`Error: ${hi.error}`] : []),
  ]);

  const ov = s.overframe;
  const ovLines: string[] = [ov.detail];
  if (ov.totalIndexed !== undefined) {
    ovLines.push(`Indexed: ${ov.totalIndexed}, needing work: ${ov.matchedNeedingWork ?? 0}.`);
  }
  if (ov.pagesScraped !== undefined) ovLines.push(`Pages scraped: ${ov.pagesScraped}.`);
  if (ov.merge) {
    ovLines.push(
      `Merged: ${ov.merge.warframesUpdated} warframes, ${ov.merge.weaponsUpdated} weapons, ` +
        `${ov.merge.companionsUpdated} companions, ${ov.merge.helminthUpdated} helminth flags.`,
    );
  }
  if (ov.error) ovLines.push(`Error: ${ov.error}`);
  row('Overframe', ov.outcome, ovLines);

  const wk = s.wiki;
  const wkLines: string[] = [wk.detail];
  if (wk.merge) {
    wkLines.push(
      `Updated: ${wk.merge.abilitiesUpdated} abilities, ${wk.merge.passivesUpdated} passives, ` +
        `${wk.merge.augmentsUpdated} augments, ${wk.merge.shardTypes} shard types, ${wk.merge.shardBuffs} shard buffs, ` +
        `${wk.merge.rivenDispositionsSyncedFromOmega} riven dispositions (omega), ${wk.merge.rivenDispositionsWikiFallback} riven (wiki fallback), ` +
        `${wk.merge.weaponsProjectileSpeedsUpdated} projectile speeds.`,
    );
  }
  if (wk.error) wkLines.push(`Error: ${wk.error}`);
  row('Wiki', wk.outcome, wkLines);

  const hm = s.helminthWiki;
  const hmLines: string[] = [hm.detail];
  if (hm.wikiNamesFound !== undefined) {
    hmLines.push(
      `Wiki tokens: ${hm.wikiNamesFound}, abilities flagged: ${hm.abilitiesFlagged ?? 0}.`,
    );
  }
  if (hm.error) hmLines.push(`Error: ${hm.error}`);
  row('Helminth', hm.outcome, hmLines);

  const ic = s.incarnonWiki;
  const icLines: string[] = [ic.detail];
  if (ic.pagesScraped !== undefined) {
    icLines.push(
      `Pages: ${ic.pagesScraped} scraped, ${ic.pagesFailed ?? 0} failed; weapons tagged: ${ic.weaponsTagged ?? 0}.`,
    );
  }
  if (ic.imagesDownloaded !== undefined) {
    icLines.push(
      `Images: ${ic.imagesDownloaded} downloaded, ${ic.imagesSkipped ?? 0} reused from cache.`,
    );
  }
  if (ic.error) icLines.push(`Error: ${ic.error}`);
  row('Incarnon', ic.outcome, icLines);

  const wm = s.warframeMarketLinks;
  const wmLines: string[] = [wm.detail];
  if (wm.rowsUpserted !== undefined) {
    wmLines.push(`Rows upserted: ${wm.rowsUpserted}, catalog slugs: ${wm.slugCount ?? 0}.`);
  }
  if (wm.error) wmLines.push(`Error: ${wm.error}`);
  row('Warframe Market links', wm.outcome, wmLines);

  console.log(`${DIV}\n`);
}
