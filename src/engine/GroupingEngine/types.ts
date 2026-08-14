import type {
    GroupDefinition,
    AggregateDefinition,
} from "../../types/grouping";

export interface GroupingState {
    groups: GroupDefinition[];
    aggregates: AggregateDefinition[];
}