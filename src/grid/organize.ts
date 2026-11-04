import type { Item } from "../core/api";
import { ORGANIZE_RULES, type OrganizeRuleDefinition } from "./organize-rules";
import { ensureGroup, groupOf, groups } from "./groups";

type OrganizeRule = OrganizeRuleDefinition & { match: RegExp };
const rules: readonly OrganizeRule[] = ORGANIZE_RULES.map(rule => ({ ...rule, match: new RegExp(rule.pattern, "i") }));

/**
 * Sorts loose items into panes from the ordered definitions in data/organize-rules.ts.
 * It never touches an existing pane member, and a new pane needs at least two matches.
 */
export function organize(items: Item[]): number {
  const buckets = new Map<OrganizeRule, string[]>();

  for (const item of items) {
    if (groupOf(item.path)) continue;
    const rule = rules.find(candidate => !!candidate.folders === item.isFolder && candidate.match.test(item.name));
    if (!rule) continue;
    const bucket = buckets.get(rule) ?? [];
    bucket.push(item.path);
    buckets.set(rule, bucket);
  }

  let moved = 0;
  for (const [rule, paths] of buckets) {
    const exists = groups().some(group => group.id === rule.id);
    if (!exists && paths.length < 2) continue;
    ensureGroup(rule.id, rule.name, paths);
    moved += paths.length;
  }
  return moved;
}
