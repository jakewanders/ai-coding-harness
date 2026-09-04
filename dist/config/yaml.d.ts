import { LineCounter, type Document } from 'yaml';
import type { ConfigError } from '../contracts/header.js';
export interface LocatedDocument {
    doc: Document;
    lineCounter: LineCounter;
}
/** Parse YAML keeping the document so paths can be mapped back to lines. */
export declare function parseYamlDocument(text: string): LocatedDocument;
/** First syntax error of a parsed document as a ConfigError, or null. */
export declare function documentError(located: LocatedDocument, file: string): ConfigError | null;
/**
 * Parse YAML text. On success returns the plain value; on a syntax error
 * returns a ConfigError with the line filled from the parser's line counter.
 */
export declare function parseYamlLocated(text: string, file: string): {
    value: unknown;
} | {
    error: ConfigError;
};
/**
 * 1-based line of the value at `path`, or of the key `path[last]` inside the
 * map at `path[0..-1]` when that key exists. Null when unresolvable.
 */
export declare function lineOfPath(located: LocatedDocument, path: Array<string | number>): number | null;
