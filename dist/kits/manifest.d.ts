import type { HarnessConfig } from '../config/schema.js';
import type { ConfigError } from '../contracts/header.js';
import type { Rule } from '../diffaudit/rules.js';
export interface KitDoc {
    path: string;
    tags: string[];
    capabilities: string[];
}
export interface Kit {
    name: string;
    dir: string;
    fragment: Partial<HarnessConfig>;
    docs: KitDoc[];
    rules: Rule[];
}
/** Read `<dir>/kit.yaml` (config fragment plus docs and rules) and `<dir>/rules.yaml`. */
export declare function loadKit(dir: string): Kit | {
    error: ConfigError;
};
