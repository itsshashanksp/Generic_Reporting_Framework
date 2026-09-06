import { isValidSqlResourceReference } from "./sqlContract";

const sqlModules = import.meta.glob(
    "../../config/reports/*.sql",
    { eager: true, query: "?raw", import: "default" }
) as Record<string, unknown>;

export class InvalidSqlResourceReferenceError extends Error {
    constructor(resource: string) {
        super(`Invalid SQL resource reference: ${resource}`);
        this.name = "InvalidSqlResourceReferenceError";
    }
}

export function buildSqlDefinitionRegistry(
    modules: Record<string, unknown>
): Record<string, string> {
    const registry: Record<string, string> = {};

    Object.entries(modules).forEach(([source, value]) => {
        if (typeof value !== "string" || value.trim().length === 0) {
            throw new Error(`Invalid SQL definition: ${source}`);
        }

        const resource = source.split("/").at(-1) ?? source;
        if (Object.prototype.hasOwnProperty.call(registry, resource)) {
            throw new Error(`Duplicate SQL definition resource: ${resource}`);
        }
        registry[resource] = value;
    });

    return registry;
}

const sqlDefinitions = buildSqlDefinitionRegistry(sqlModules);

/** Loads authoring text only; it does not execute or send SQL anywhere. */
export function getSqlDefinition(resource: string): string | undefined {
    if (!isValidSqlResourceReference(resource)) {
        throw new InvalidSqlResourceReferenceError(resource);
    }

    return sqlDefinitions[resource];
}
