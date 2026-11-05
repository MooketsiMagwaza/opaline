import { normalizeSettings, type Settings } from "./store";

/** Settings keys whose draft value differs from the baseline the draft was staged from. */
export function stagedChanges(baseline: Settings, draft: Settings): Partial<Settings> {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof Settings)[]) {
    if (draft[key] !== baseline[key]) changes[key] = draft[key];
  }
  return changes as Partial<Settings>;
}

/**
 * Carries settings changed elsewhere (for example Ctrl+B while Settings is open) into an open draft.
 * A key the user has staged keeps its staged value; every other key follows the live setting, so
 * applying the draft later can never silently revert a change made outside the panel.
 */
export function absorbLiveChanges(baseline: Settings, draft: Settings, live: Settings): { baseline: Settings; draft: Settings } {
  const nextBaseline: Record<string, unknown> = { ...baseline };
  const nextDraft: Record<string, unknown> = { ...draft };
  for (const key of Object.keys(live) as (keyof Settings)[]) {
    if (live[key] === baseline[key]) continue;
    nextBaseline[key] = live[key];
    if (draft[key] === baseline[key]) nextDraft[key] = live[key];
  }
  return { baseline: normalizeSettings(nextBaseline), draft: normalizeSettings(nextDraft) };
}
