import type { D6OpposedTieBreak, D6ParticipantKind } from "../domain/opposed";

export const D6_CHASE_CONTRACT_VERSION = 1 as const;

export type D6ChaseSide = "pursuer" | "fleeing";
export type D6ChaseStatus = "active" | "caught" | "escaped";

export interface D6ChaseParticipantV1 {
  readonly actorId: string;
  readonly actorName: string;
  readonly itemId: string;
  readonly skillName: string;
  readonly kind?: D6ParticipantKind;
}

export interface D6ChaseRollV1 {
  readonly requestId: string;
  readonly side: D6ChaseSide;
  readonly total: number;
  readonly userId: string;
  readonly wildDieFace?: number;
  readonly wildOutcome?: string;
}

export interface D6ChaseExchangeV1 {
  readonly exchange: number;
  readonly exceptional: boolean;
  readonly fromDistance: number;
  readonly pursuerTotal: number;
  readonly fleeingTotal: number;
  readonly shift: number;
  readonly toDistance: number;
  readonly winner: D6ChaseSide;
  readonly tieBreak: D6OpposedTieBreak;
  readonly pursuerWildOutcome?: string;
  readonly fleeingWildOutcome?: string;
}

export interface D6ChaseStateV1 {
  readonly contractVersion: typeof D6_CHASE_CONTRACT_VERSION;
  readonly distance: number;
  readonly exchange: number;
  readonly fleeing: D6ChaseParticipantV1;
  readonly history: readonly D6ChaseExchangeV1[];
  readonly id: string;
  readonly label: string;
  readonly pursuer: D6ChaseParticipantV1;
  readonly revision: number;
  readonly rolls: Readonly<Partial<Record<D6ChaseSide, D6ChaseRollV1>>>;
  readonly status: D6ChaseStatus;
}

export interface D6ChaseStartV1 {
  readonly distance?: number;
  readonly fleeing: D6ChaseParticipantV1;
  readonly id: string;
  readonly label: string;
  readonly pursuer: D6ChaseParticipantV1;
}

export interface D6ChaseResolveV1 {
  readonly exceptional?: boolean;
  readonly expectedRevision: number;
  readonly winner?: D6ChaseSide;
}

export interface D6System2eChaseApi {
  end(expectedRevision: number): Promise<void>;
  read(): D6ChaseStateV1 | null;
  resolve(input: D6ChaseResolveV1): Promise<D6ChaseStateV1>;
  roll(side: D6ChaseSide): Promise<D6ChaseStateV1 | null>;
  start(input: D6ChaseStartV1): Promise<D6ChaseStateV1>;
}
