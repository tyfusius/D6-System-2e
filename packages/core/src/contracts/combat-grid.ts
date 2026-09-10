import type { D6CombatantRoundStateV1 } from "./combat";

export interface D6CombatGridParticipantV1 {
  readonly id: string;
  readonly label: string;
  readonly img?: string;
  readonly initiative: number | null;
  readonly visible: boolean;
  readonly canRead: boolean;
  readonly canManage: boolean;
  readonly defeated: boolean;
  readonly state: D6CombatantRoundStateV1;
}
export type D6CombatGridCellStatus =
  | "pending"
  | "completed"
  | "held"
  | "canceled"
  | "prevented"
  | "empty"
  | "redacted";
export interface D6CombatGridCellV1 {
  readonly id?: string;
  readonly segment: number;
  readonly label?: string;
  readonly kind?: string;
  readonly status: D6CombatGridCellStatus;
  readonly active: boolean;
  readonly earlyReaction: boolean;
  readonly canComplete: boolean;
  readonly canAnnotateHold: boolean;
  readonly canClearHold: boolean;
  readonly canCancel: boolean;
}
export interface D6CombatGridRowV1 {
  readonly id: string;
  readonly label: string;
  readonly img?: string;
  readonly initiative?: number | null;
  readonly actionCount?: number;
  readonly penaltyScore?: number;
  readonly declared?: boolean;
  readonly revision?: number;
  readonly canManage: boolean;
  readonly cells: readonly D6CombatGridCellV1[];
}
export interface D6CombatGridProjectionV1 {
  readonly version: 1;
  readonly round: number;
  readonly currentSegment: number;
  readonly complete: boolean;
  readonly waiting: boolean;
  readonly columns: readonly number[];
  readonly rows: readonly D6CombatGridRowV1[];
  readonly declarationOrder: readonly string[];
}
