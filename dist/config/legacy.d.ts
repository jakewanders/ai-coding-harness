/**
 * Deprecated config spellings, upgraded in memory before validation so that
 * older files keep loading. Each upgrade yields a note that `system doctor`
 * prints; the file on disk is never rewritten.
 */
type Raw = Record<string, unknown>;
/** Stage ids renamed in the stage-vocabulary change. */
export declare const LEGACY_STAGE_IDS: Record<string, string>;
/** Return the config with deprecated keys and stage ids rewritten, plus a note per rewrite. */
export declare function upgradeLegacyConfig(raw: Raw): {
    raw: Raw;
    notes: string[];
};
export {};
