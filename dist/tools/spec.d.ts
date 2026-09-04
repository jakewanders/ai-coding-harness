import { type UnitKind } from '../store/state.js';
export declare const BUG_WORDS: RegExp;
export declare function inferKind(title: string, body: string): UnitKind;
export declare const specTool: import("../registry/tools.js").ToolDef;
