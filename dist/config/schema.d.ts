import { z } from 'zod';
/**
 * Configuration schema, mirroring spec section 5. Every section is optional so
 * a single layer (user file, repo file, kit fragment) may carry only what it
 * overrides; DEFAULTS fills the rest. Objects are strict so unknown keys are
 * reported with their valid siblings.
 */
export { SEAT_NAMES } from '../contracts/header.js';
export type { SeatName } from '../contracts/header.js';
export declare const SeverityValue: z.ZodEnum<{
    block: "block";
    off: "off";
    warn: "warn";
}>;
export declare const StoreSchema: z.ZodObject<{
    path: z.ZodOptional<z.ZodString>;
    remote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const SeatsSchema: z.ZodObject<{
    tracker: z.ZodOptional<z.ZodObject<{
        fetch: z.ZodOptional<z.ZodArray<z.ZodString>>;
        comment: z.ZodOptional<z.ZodArray<z.ZodString>>;
        transition_hint: z.ZodOptional<z.ZodArray<z.ZodString>>;
        create: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    codehost: z.ZodOptional<z.ZodObject<{
        open_pr: z.ZodOptional<z.ZodArray<z.ZodString>>;
        read_threads: z.ZodOptional<z.ZodArray<z.ZodString>>;
        comment: z.ZodOptional<z.ZodArray<z.ZodString>>;
        resolve_thread: z.ZodOptional<z.ZodArray<z.ZodString>>;
        attach: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    docs: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    design: z.ZodOptional<z.ZodObject<{
        fetch: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    chat: z.ZodOptional<z.ZodObject<{
        post: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    reviewbot: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodArray<z.ZodString>>;
        threads: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    counterweight: z.ZodOptional<z.ZodObject<{
        cli: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        http: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const CommandsSchema: z.ZodObject<{
    check: z.ZodOptional<z.ZodString>;
    test: z.ZodOptional<z.ZodString>;
    lint: z.ZodOptional<z.ZodString>;
    typecheck: z.ZodOptional<z.ZodString>;
    e2e: z.ZodOptional<z.ZodString>;
    boot: z.ZodOptional<z.ZodString>;
    install: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const CapabilitiesSchema: z.ZodObject<{
    isolation: z.ZodOptional<z.ZodEnum<{
        branch: "branch";
        worktree: "worktree";
    }>>;
    browser_ui: z.ZodOptional<z.ZodBoolean>;
    contracts: z.ZodOptional<z.ZodBoolean>;
    component_library: z.ZodOptional<z.ZodBoolean>;
    daemon_warmup: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const SubprojectSchema: z.ZodObject<{
    path: z.ZodOptional<z.ZodString>;
    commands: z.ZodOptional<z.ZodObject<{
        check: z.ZodOptional<z.ZodString>;
        test: z.ZodOptional<z.ZodString>;
        lint: z.ZodOptional<z.ZodString>;
        typecheck: z.ZodOptional<z.ZodString>;
        e2e: z.ZodOptional<z.ZodString>;
        boot: z.ZodOptional<z.ZodString>;
        install: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const RepoSchema: z.ZodObject<{
    base_branch: z.ZodOptional<z.ZodString>;
    commands: z.ZodOptional<z.ZodObject<{
        check: z.ZodOptional<z.ZodString>;
        test: z.ZodOptional<z.ZodString>;
        lint: z.ZodOptional<z.ZodString>;
        typecheck: z.ZodOptional<z.ZodString>;
        e2e: z.ZodOptional<z.ZodString>;
        boot: z.ZodOptional<z.ZodString>;
        install: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    constraints: z.ZodOptional<z.ZodObject<{
        package_manager: z.ZodOptional<z.ZodString>;
        test_flags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    subprojects: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        commands: z.ZodOptional<z.ZodObject<{
            check: z.ZodOptional<z.ZodString>;
            test: z.ZodOptional<z.ZodString>;
            lint: z.ZodOptional<z.ZodString>;
            typecheck: z.ZodOptional<z.ZodString>;
            e2e: z.ZodOptional<z.ZodString>;
            boot: z.ZodOptional<z.ZodString>;
            install: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    capabilities: z.ZodOptional<z.ZodObject<{
        isolation: z.ZodOptional<z.ZodEnum<{
            branch: "branch";
            worktree: "worktree";
        }>>;
        browser_ui: z.ZodOptional<z.ZodBoolean>;
        contracts: z.ZodOptional<z.ZodBoolean>;
        component_library: z.ZodOptional<z.ZodBoolean>;
        daemon_warmup: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const EnvironmentSchema: z.ZodObject<{
    name: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<{
        production: "production";
        reference: "reference";
        sut: "sut";
    }>>;
    env_prefix: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const TicketSchema: z.ZodObject<{
    pattern: z.ZodString;
    repo: z.ZodOptional<z.ZodString>;
    subproject: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodString>;
    status_hints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strict>;
export declare const GateOverrideSchema: z.ZodObject<{
    severity: z.ZodOptional<z.ZodEnum<{
        block: "block";
        off: "off";
        warn: "warn";
    }>>;
    requires: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const CustomGateSchema: z.ZodObject<{
    id: z.ZodString;
    stage: z.ZodString;
    command: z.ZodString;
    severity: z.ZodOptional<z.ZodEnum<{
        block: "block";
        off: "off";
        warn: "warn";
    }>>;
}, z.core.$strict>;
export declare const ModeSchema: z.ZodObject<{
    extends: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    demote: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<{
        block: "block";
        off: "off";
        warn: "warn";
    }>>>;
    merge_dispatches: z.ZodOptional<z.ZodBoolean>;
    walkthrough_after_pr: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const DiffauditRuleSchema: z.ZodObject<{
    id: z.ZodString;
    pattern: z.ZodString;
    files: z.ZodString;
    severity: z.ZodOptional<z.ZodEnum<{
        blocker: "blocker";
        major: "major";
        minor: "minor";
        note: "note";
    }>>;
    message: z.ZodString;
}, z.core.$strict>;
export declare const HarnessConfigSchema: z.ZodObject<{
    schema: z.ZodOptional<z.ZodLiteral<1>>;
    store: z.ZodOptional<z.ZodObject<{
        path: z.ZodOptional<z.ZodString>;
        remote: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>>;
    seats: z.ZodOptional<z.ZodObject<{
        tracker: z.ZodOptional<z.ZodObject<{
            fetch: z.ZodOptional<z.ZodArray<z.ZodString>>;
            comment: z.ZodOptional<z.ZodArray<z.ZodString>>;
            transition_hint: z.ZodOptional<z.ZodArray<z.ZodString>>;
            create: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        codehost: z.ZodOptional<z.ZodObject<{
            open_pr: z.ZodOptional<z.ZodArray<z.ZodString>>;
            read_threads: z.ZodOptional<z.ZodArray<z.ZodString>>;
            comment: z.ZodOptional<z.ZodArray<z.ZodString>>;
            resolve_thread: z.ZodOptional<z.ZodArray<z.ZodString>>;
            attach: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        docs: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        design: z.ZodOptional<z.ZodObject<{
            fetch: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        chat: z.ZodOptional<z.ZodObject<{
            post: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        reviewbot: z.ZodOptional<z.ZodObject<{
            status: z.ZodOptional<z.ZodArray<z.ZodString>>;
            threads: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        counterweight: z.ZodOptional<z.ZodObject<{
            cli: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            http: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    repos: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        base_branch: z.ZodOptional<z.ZodString>;
        commands: z.ZodOptional<z.ZodObject<{
            check: z.ZodOptional<z.ZodString>;
            test: z.ZodOptional<z.ZodString>;
            lint: z.ZodOptional<z.ZodString>;
            typecheck: z.ZodOptional<z.ZodString>;
            e2e: z.ZodOptional<z.ZodString>;
            boot: z.ZodOptional<z.ZodString>;
            install: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        constraints: z.ZodOptional<z.ZodObject<{
            package_manager: z.ZodOptional<z.ZodString>;
            test_flags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        subprojects: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            path: z.ZodOptional<z.ZodString>;
            commands: z.ZodOptional<z.ZodObject<{
                check: z.ZodOptional<z.ZodString>;
                test: z.ZodOptional<z.ZodString>;
                lint: z.ZodOptional<z.ZodString>;
                typecheck: z.ZodOptional<z.ZodString>;
                e2e: z.ZodOptional<z.ZodString>;
                boot: z.ZodOptional<z.ZodString>;
                install: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        capabilities: z.ZodOptional<z.ZodObject<{
            isolation: z.ZodOptional<z.ZodEnum<{
                branch: "branch";
                worktree: "worktree";
            }>>;
            browser_ui: z.ZodOptional<z.ZodBoolean>;
            contracts: z.ZodOptional<z.ZodBoolean>;
            component_library: z.ZodOptional<z.ZodBoolean>;
            daemon_warmup: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>>>;
    environments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodEnum<{
            production: "production";
            reference: "reference";
            sut: "sut";
        }>>;
        env_prefix: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    tickets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        pattern: z.ZodString;
        repo: z.ZodOptional<z.ZodString>;
        subproject: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        url: z.ZodOptional<z.ZodString>;
        status_hints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strict>>>;
    gates: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        severity: z.ZodOptional<z.ZodEnum<{
            block: "block";
            off: "off";
            warn: "warn";
        }>>;
        requires: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>>>;
    custom_gates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        stage: z.ZodString;
        command: z.ZodString;
        severity: z.ZodOptional<z.ZodEnum<{
            block: "block";
            off: "off";
            warn: "warn";
        }>>;
    }, z.core.$strict>>>;
    modes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        extends: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        demote: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodEnum<{
            block: "block";
            off: "off";
            warn: "warn";
        }>>>;
        merge_dispatches: z.ZodOptional<z.ZodBoolean>;
        walkthrough_after_pr: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
    kits: z.ZodOptional<z.ZodArray<z.ZodString>>;
    protected_branches: z.ZodOptional<z.ZodArray<z.ZodString>>;
    diffaudit: z.ZodOptional<z.ZodObject<{
        rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            pattern: z.ZodString;
            files: z.ZodString;
            severity: z.ZodOptional<z.ZodEnum<{
                blocker: "blocker";
                major: "major";
                minor: "minor";
                note: "note";
            }>>;
            message: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;
export type RepoConfig = z.infer<typeof RepoSchema>;
export type CommandsConfig = z.infer<typeof CommandsSchema>;
export type CapabilitiesConfig = z.infer<typeof CapabilitiesSchema>;
export type TicketConfig = z.infer<typeof TicketSchema>;
export type ModeConfig = z.infer<typeof ModeSchema>;
export type GateOverride = z.infer<typeof GateOverrideSchema>;
export type CustomGateConfig = z.infer<typeof CustomGateSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;
export type DiffauditRuleConfig = z.infer<typeof DiffauditRuleSchema>;
export { DEFAULTS } from './defaults.js';
