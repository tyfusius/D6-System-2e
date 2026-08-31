import {
  acceptedWildDieChoice,
  D6_ROLL_CONTRACT_VERSION,
  type D6MvDegree,
  type D6RollMode,
  type D6RollResultV1,
  type D6WildDieChoice,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { foundryRandomId } from "../foundry-random-id";

const AUTHORITY_VERSION = 1 as const;
const AUTHORITY_LIFETIME_MS = 60_000;
const RESPONSE_TIMEOUT_MS = 65_000;

type WildChoiceAuthorityReason =
  | "blind-d6mv-advantage"
  | "blind-second-edition-advantage"
  | "d6mv-complication"
  | "first-edition-critical-one"
  | "second-edition-classic-mishap"
  | "second-edition-complication";

interface WildChoiceRequest {
  readonly actorId: string;
  readonly choices: readonly D6WildDieChoice[];
  readonly createdAt: number;
  readonly decision: D6WildDecisionViewModel;
  readonly expiresAt: number;
  readonly id: string;
  readonly reason: WildChoiceAuthorityReason;
  readonly requesterUserId: string;
  readonly rollMode: D6RollMode;
  readonly targetUserId: string;
  readonly type: "roll-authority-wild-request";
  readonly version: number;
}

export interface D6WildDecisionViewModel {
  readonly actorName?: string;
  readonly authority: "game-master" | "player";
  readonly degree?: D6MvDegree;
  readonly difficulty?: number;
  readonly kind: "advantage" | "complication" | "wild-choice";
  readonly margin?: number;
  readonly oppositionName?: string;
  readonly resourceLabel?: string;
  readonly targetKind?: "fixed" | "opposed";
  readonly total: number;
}

interface WildChoiceResponse {
  readonly choice: D6WildDieChoice | null;
  readonly id: string;
  readonly requesterUserId: string;
  readonly targetUserId: string;
  readonly type: "roll-authority-wild-response";
}

interface FollowUpClaimRequest {
  readonly actorId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly id: string;
  readonly messageId: string;
  readonly requesterUserId: string;
  readonly targetUserId: string;
  readonly type: "roll-authority-follow-up-claim";
  readonly version: number;
}

interface FollowUpClaimResponse {
  readonly granted: boolean;
  readonly id: string;
  readonly requesterUserId: string;
  readonly targetUserId: string;
  readonly type: "roll-authority-follow-up-response";
}

interface FollowUpReleaseRequest {
  readonly actorId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly id: string;
  readonly messageId: string;
  readonly requesterUserId: string;
  readonly targetUserId: string;
  readonly type: "roll-authority-follow-up-release";
  readonly version: number;
}

interface FollowUpReleaseResponse {
  readonly id: string;
  readonly released: boolean;
  readonly requesterUserId: string;
  readonly targetUserId: string;
  readonly type: "roll-authority-follow-up-release-response";
}

type RollAuthoritySocketMessage =
  | WildChoiceRequest
  | WildChoiceResponse
  | FollowUpClaimRequest
  | FollowUpClaimResponse
  | FollowUpReleaseRequest
  | FollowUpReleaseResponse;

interface FollowUpClaim {
  readonly requestId: string;
  readonly userId: string;
}

interface PendingResponse<T> {
  readonly resolve: (value: T) => void;
  readonly targetUserId: string;
}

interface IncomingWildDecision {
  readonly actorId: string;
  readonly expiresAt: number;
  readonly promise: Promise<D6WildDieChoice | null>;
  readonly requesterUserId: string;
}

interface IncomingFollowUpDecision {
  readonly actorId: string;
  readonly expiresAt: number;
  readonly messageId: string;
  readonly promise: Promise<boolean>;
  readonly requesterUserId: string;
}

const pendingWildChoices = new Map<
  string,
  PendingResponse<D6WildDieChoice | null>
>();
const pendingFollowUpClaims = new Map<string, PendingResponse<boolean>>();
const pendingFollowUpReleases = new Map<string, PendingResponse<boolean>>();
const followUpClaimLocks = new Set<string>();
const incomingWildDecisions = new Map<string, IncomingWildDecision>();
const incomingFollowUpDecisions = new Map<string, IncomingFollowUpDecision>();

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function d6MvChoiceKind(
  choices: readonly D6WildDieChoice[],
): D6WildDecisionViewModel["kind"] {
  if (choices.every((choice) => choice.startsWith("d6mv-advantage-"))) {
    return "advantage";
  }
  if (choices.every((choice) => choice.startsWith("d6mv-complication-"))) {
    return "complication";
  }
  return "wild-choice";
}

export function wildDecisionViewModel(
  choices: readonly D6WildDieChoice[],
  result: D6RollResultV1,
  options: {
    readonly actorName?: string | undefined;
    readonly resourceLabel?: string | undefined;
  } = {},
): D6WildDecisionViewModel {
  const kind = d6MvChoiceKind(choices);
  const authority = kind === "advantage" ? "player" : "game-master";
  const evidence = result.d6mv;
  return Object.freeze({
    ...(options.actorName === undefined
      ? {}
      : { actorName: options.actorName }),
    authority,
    ...(evidence === undefined
      ? {}
      : {
          degree: evidence.degree,
          difficulty: evidence.difficulty,
          margin: evidence.margin,
          targetKind: result.opposition === undefined ? "fixed" : "opposed",
        }),
    kind,
    ...(result.opposition === undefined ||
    result.request.opposition?.name === undefined
      ? {}
      : { oppositionName: result.request.opposition.name }),
    ...(options.resourceLabel === undefined
      ? {}
      : { resourceLabel: options.resourceLabel }),
    total: result.total,
  });
}

function validWildDecisionViewModel(
  value: unknown,
): value is D6WildDecisionViewModel {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<D6WildDecisionViewModel>;
  return (
    ["game-master", "player"].includes(candidate.authority ?? "") &&
    ["advantage", "complication", "wild-choice"].includes(
      candidate.kind ?? "",
    ) &&
    Number.isFinite(candidate.total) &&
    (candidate.difficulty === undefined ||
      Number.isFinite(candidate.difficulty)) &&
    (candidate.margin === undefined || Number.isFinite(candidate.margin))
  );
}

const labels: Readonly<Record<D6WildDieChoice, string>> = {
  "d6mv-advantage-failure-ally-hero-point":
    "D6E2.Roll.D6MV.Choice.AdvantageFailureAllyHeroPoint",
  "d6mv-advantage-failure-explode":
    "D6E2.Roll.D6MV.Choice.AdvantageFailureExplode",
  "d6mv-advantage-failure-partial-setback":
    "D6E2.Roll.D6MV.Choice.AdvantageFailurePartialSetback",
  "d6mv-advantage-success-ally-hero-point":
    "D6E2.Roll.D6MV.Choice.AdvantageSuccessAllyHeroPoint",
  "d6mv-advantage-success-exceptional":
    "D6E2.Roll.D6MV.Choice.AdvantageSuccessExceptional",
  "d6mv-advantage-success-two-hero-points":
    "D6E2.Roll.D6MV.Choice.AdvantageSuccessTwoHeroPoints",
  "d6mv-complication-failure-catastrophic":
    "D6E2.Roll.D6MV.Choice.ComplicationFailureCatastrophic",
  "d6mv-complication-failure-exceptional":
    "D6E2.Roll.D6MV.Choice.ComplicationFailureExceptional",
  "d6mv-complication-failure-setback":
    "D6E2.Roll.D6MV.Choice.ComplicationFailureSetback",
  "d6mv-complication-success-failure":
    "D6E2.Roll.D6MV.Choice.ComplicationSuccessFailure",
  "d6mv-complication-success-partial":
    "D6E2.Roll.D6MV.Choice.ComplicationSuccessPartial",
  "d6mv-complication-success-setback":
    "D6E2.Roll.D6MV.Choice.ComplicationSuccessSetback",
  "first-edition-complication": "D6E2.Roll.Choice.Complication",
  "first-edition-remove-highest": "D6E2.Roll.Choice.RemoveHighest",
  "second-edition-classic-complication": "D6E2.Roll.Choice.ClassicComplication",
  "second-edition-classic-penalty": "D6E2.Roll.Choice.ClassicPenalty",
  "second-edition-exceptional": "D6E2.Roll.Choice.Exceptional",
  "second-edition-failure": "D6E2.Roll.Choice.Failure",
  "second-edition-ordinary": "D6E2.Roll.Choice.Ordinary",
  "second-edition-partial": "D6E2.Roll.Choice.Partial",
};

const d6MvResourceAwards: Readonly<Partial<Record<D6WildDieChoice, number>>> =
  Object.freeze({
    "d6mv-advantage-failure-explode": 1,
    "d6mv-advantage-success-exceptional": 1,
    "d6mv-advantage-success-two-hero-points": 2,
    "d6mv-complication-failure-catastrophic": 2,
    "d6mv-complication-failure-exceptional": 1,
    "d6mv-complication-success-failure": 2,
    "d6mv-complication-success-partial": 1,
  });

const icons: Readonly<Record<D6WildDieChoice, string>> = {
  "d6mv-advantage-failure-ally-hero-point": "fa-solid fa-hand-holding-heart",
  "d6mv-advantage-failure-explode": "fa-solid fa-dice-six",
  "d6mv-advantage-failure-partial-setback": "fa-solid fa-code-branch",
  "d6mv-advantage-success-ally-hero-point": "fa-solid fa-hand-holding-heart",
  "d6mv-advantage-success-exceptional": "fa-solid fa-star",
  "d6mv-advantage-success-two-hero-points": "fa-solid fa-coins",
  "d6mv-complication-failure-catastrophic": "fa-solid fa-skull",
  "d6mv-complication-failure-exceptional": "fa-solid fa-triangle-exclamation",
  "d6mv-complication-failure-setback": "fa-solid fa-arrow-trend-down",
  "d6mv-complication-success-failure": "fa-solid fa-xmark",
  "d6mv-complication-success-partial": "fa-solid fa-code-branch",
  "d6mv-complication-success-setback": "fa-solid fa-arrow-trend-down",
  "first-edition-complication": "fa-solid fa-triangle-exclamation",
  "first-edition-remove-highest": "fa-solid fa-dice-one",
  "second-edition-classic-complication": "fa-solid fa-triangle-exclamation",
  "second-edition-classic-penalty": "fa-solid fa-dice-one",
  "second-edition-exceptional": "fa-solid fa-star",
  "second-edition-failure": "fa-solid fa-xmark",
  "second-edition-ordinary": "fa-solid fa-check",
  "second-edition-partial": "fa-solid fa-code-branch",
};

function authorityChannel(): string {
  return `system.${SYSTEM_ID}`;
}

function activeGm(): FoundryUser | undefined {
  return (game.users?.contents ?? [])
    .filter((user) => user.active && user.isGM)
    .sort((left, right) =>
      (left.name ?? left.id).localeCompare(right.name ?? right.id, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    )[0];
}

function isCurrentRequest(
  message: {
    readonly createdAt: number;
    readonly expiresAt: number;
    readonly version: number;
  },
  now = Date.now(),
): boolean {
  return (
    message.version === AUTHORITY_VERSION &&
    Number.isFinite(message.createdAt) &&
    Number.isFinite(message.expiresAt) &&
    message.createdAt <= now + 30_000 &&
    message.expiresAt > now &&
    message.expiresAt - message.createdAt <= AUTHORITY_LIFETIME_MS
  );
}

function pruneIncomingDecisions(now = Date.now()): void {
  for (const [id, decision] of incomingWildDecisions) {
    if (decision.expiresAt <= now) incomingWildDecisions.delete(id);
  }
  for (const [id, decision] of incomingFollowUpDecisions) {
    if (decision.expiresAt <= now) incomingFollowUpDecisions.delete(id);
  }
}

function isWildChoice(value: unknown): value is D6WildDieChoice {
  return typeof value === "string" && value in labels;
}

function isGmComplicationChoices(choices: readonly D6WildDieChoice[]): boolean {
  return (
    choices.length === 2 &&
    choices.includes("second-edition-partial") &&
    choices.includes("second-edition-failure")
  );
}

function isFirstEditionCriticalOneChoices(
  choices: readonly D6WildDieChoice[],
): boolean {
  return (
    choices.length === 2 &&
    choices.includes("first-edition-remove-highest") &&
    choices.includes("first-edition-complication")
  );
}

function isSecondEditionAdvantageChoices(
  choices: readonly D6WildDieChoice[],
): boolean {
  return (
    choices.length === 2 &&
    choices.includes("second-edition-exceptional") &&
    choices.includes("second-edition-ordinary")
  );
}

function isSecondEditionClassicMishapChoices(
  choices: readonly D6WildDieChoice[],
): boolean {
  return (
    choices.length === 2 &&
    choices.includes("second-edition-classic-penalty") &&
    choices.includes("second-edition-classic-complication")
  );
}

function wildChoiceAuthorityReason(
  choices: readonly D6WildDieChoice[],
  rollMode: D6RollMode,
): WildChoiceAuthorityReason | null {
  if (
    rollMode === "blindroll" &&
    choices.length > 0 &&
    choices.every((choice) => choice.startsWith("d6mv-advantage-"))
  ) {
    return "blind-d6mv-advantage";
  }
  if (
    choices.length > 0 &&
    choices.every((choice) => choice.startsWith("d6mv-complication-"))
  ) {
    return "d6mv-complication";
  }
  if (isFirstEditionCriticalOneChoices(choices)) {
    return "first-edition-critical-one";
  }
  if (isGmComplicationChoices(choices)) {
    return "second-edition-complication";
  }
  if (isSecondEditionClassicMishapChoices(choices)) {
    return "second-edition-classic-mishap";
  }
  if (rollMode === "blindroll" && isSecondEditionAdvantageChoices(choices)) {
    return "blind-second-edition-advantage";
  }
  return null;
}

function validWildChoiceAuthorityRequest(
  message: Pick<WildChoiceRequest, "choices" | "reason" | "rollMode">,
): boolean {
  return (
    wildChoiceAuthorityReason(message.choices, message.rollMode) ===
    message.reason
  );
}

export function requiresGmWildChoice(
  choices: readonly D6WildDieChoice[],
  result: D6RollResultV1,
): boolean {
  return wildChoiceAuthorityReason(choices, result.request.rollMode) !== null;
}

function requestingPlayer(
  requesterUserId: string,
  actorId: string,
): { readonly actor: FoundryActorDocument; readonly user: FoundryUser } | null {
  const user = game.users?.get(requesterUserId);
  const actor = game.actors?.get(actorId);
  if (!user?.active || user.isGM || !actor?.testUserPermission(user, "OWNER")) {
    return null;
  }
  return { actor, user };
}

function rollResult(value: unknown): D6RollResultV1 | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("contractVersion" in value) ||
    value.contractVersion !== D6_ROLL_CONTRACT_VERSION ||
    !("request" in value) ||
    typeof value.request !== "object" ||
    value.request === null
  ) {
    return null;
  }
  return value as D6RollResultV1;
}

function followUpClaim(value: unknown): FollowUpClaim | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("requestId" in value) ||
    typeof value.requestId !== "string" ||
    !("userId" in value) ||
    typeof value.userId !== "string"
  ) {
    return null;
  }
  return value as FollowUpClaim;
}

export async function promptWildChoiceDialog(
  choices: readonly D6WildDieChoice[],
  decision: D6WildDecisionViewModel,
): Promise<D6WildDieChoice | null> {
  const choiceLabel = (choice: D6WildDieChoice): string => {
    if (choice.endsWith("ally-hero-point") && decision.resourceLabel) {
      return game.i18n.format("D6E2.Roll.D6MV.Choice.AllyAwardPending", {
        resource: decision.resourceLabel,
      });
    }
    const resourceQuantity = d6MvResourceAwards[choice];
    if (resourceQuantity !== undefined && decision.resourceLabel) {
      return game.i18n.format("D6E2.Roll.D6MV.Choice.ResourceAward", {
        action: game.i18n.localize(labels[choice]),
        quantity: resourceQuantity,
        resource: decision.resourceLabel,
      });
    }
    return game.i18n.localize(labels[choice]);
  };
  const decisionKind = game.i18n.localize(
    decision.kind === "advantage"
      ? "D6E2.Roll.Outcome.d6mv-advantage"
      : decision.kind === "complication"
        ? "D6E2.Roll.Outcome.d6mv-complication"
        : "D6E2.Roll.WildChoice",
  );
  const authority = game.i18n.localize(
    decision.authority === "player"
      ? "D6E2.Roll.D6MV.Authority.Player"
      : "D6E2.Roll.D6MV.Authority.GameMaster",
  );
  const d6MvEvidence =
    decision.degree === undefined
      ? `<div class="od6roll-preview"><span>${game.i18n.localize("D6E2.Roll.Total")}</span><strong>${decision.total}</strong></div>`
      : `<dl class="d6e2-wild-decision-evidence">
          <div><dt>${game.i18n.localize("D6E2.Roll.D6MV.Decision")}</dt><dd>${escapeHtml(decisionKind)} · ${escapeHtml(authority)}</dd></div>
          <div><dt>${game.i18n.localize("D6E2.Roll.D6MV.DegreeHeading")}</dt><dd>${escapeHtml(game.i18n.localize(`D6E2.Roll.D6MV.Degree.${decision.degree}`))}</dd></div>
          <div><dt>${game.i18n.localize("D6E2.Roll.Total")}</dt><dd>${decision.total}</dd></div>
          <div><dt>${game.i18n.localize(decision.targetKind === "opposed" ? "D6E2.Roll.D6MV.Opposition" : "D6E2.Roll.Difficulty")}</dt><dd>${decision.oppositionName ? `${escapeHtml(decision.oppositionName)} · ` : ""}${decision.difficulty ?? "—"}</dd></div>
          <div><dt>${game.i18n.localize("D6E2.Roll.D6MV.Margin")}</dt><dd>${decision.margin ?? "—"}</dd></div>
        </dl>`;
  const selected: unknown =
    await foundry.applications.api.DialogV2.wait<D6WildDieChoice | null>({
      buttons: [
        ...choices.map((choice) => ({
          action: choice,
          callback: () => choice,
          icon: icons[choice],
          label: choiceLabel(choice),
        })),
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
      ],
      classes: [
        "d6e2",
        "d6e2-wild-dialog",
        "od6roll-dialog",
        "od6roll-wild-one-dialog",
      ],
      content: `<div class="od6-dialog-shell">
        ${
          decision.actorName
            ? `<p class="od6roll-request-banner"><i class="fa-solid fa-user-shield" aria-hidden="true"></i> ${game.i18n.format("D6E2.Roll.GmComplicationFor", { actor: escapeHtml(decision.actorName) })}</p>`
            : ""
        }
        <p>${game.i18n.localize("D6E2.Roll.WildChoiceHelp")}</p>
        ${d6MvEvidence}
      </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-dice-one",
        title: game.i18n.localize("D6E2.Roll.WildChoice"),
      },
    });
  return acceptedWildDieChoice(choices, selected);
}

function waitForResponse<T>(
  id: string,
  targetUserId: string,
  pending: Map<string, PendingResponse<T>>,
  fallback: T,
  emit: () => void,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => {
      pending.delete(id);
      resolve(fallback);
    }, RESPONSE_TIMEOUT_MS);
    pending.set(id, {
      resolve: (value) => {
        globalThis.clearTimeout(timer);
        pending.delete(id);
        resolve(value);
      },
      targetUserId,
    });
    emit();
  });
}

export async function requestGmWildChoice(
  choices: readonly D6WildDieChoice[],
  result: D6RollResultV1,
  resourceLabel?: string,
): Promise<D6WildDieChoice | null> {
  const reason = wildChoiceAuthorityReason(choices, result.request.rollMode);
  if (reason === null) return null;
  if (game.user?.isGM) {
    return promptWildChoiceDialog(
      choices,
      wildDecisionViewModel(choices, result, {
        actorName: result.request.source.actorName,
        resourceLabel,
      }),
    );
  }
  const requester = game.user;
  const gm = activeGm();
  if (!requester || !gm) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Roll.GmWildChoiceUnavailable"),
    );
    return null;
  }
  const id = foundryRandomId();
  const createdAt = Date.now();
  const request: WildChoiceRequest = {
    actorId: result.request.source.actorId,
    choices,
    createdAt,
    decision: wildDecisionViewModel(choices, result, { resourceLabel }),
    expiresAt: createdAt + AUTHORITY_LIFETIME_MS,
    id,
    reason,
    requesterUserId: requester.id,
    rollMode: result.request.rollMode,
    targetUserId: gm.id,
    type: "roll-authority-wild-request",
    version: AUTHORITY_VERSION,
  };
  ui.notifications.info(
    game.i18n.format("D6E2.Roll.GmWildChoiceWaiting", {
      gm: gm.name ?? gm.id,
    }),
  );
  return waitForResponse(id, gm.id, pendingWildChoices, null, () => {
    game.socket?.emit(authorityChannel(), request);
  });
}

async function claimFollowUpLocally(
  message: FoundryChatMessageDocument,
  userId: string,
  requestId: string,
): Promise<boolean> {
  if (
    followUpClaimLocks.has(message.id) ||
    message.getFlag(SYSTEM_ID, "rollFollowUpUsed") === true
  ) {
    return false;
  }
  followUpClaimLocks.add(message.id);
  try {
    await message.update({
      [`flags.${SYSTEM_ID}.rollFollowUpClaim`]: {
        requestId,
        userId,
      } satisfies FollowUpClaim,
      [`flags.${SYSTEM_ID}.rollFollowUpUsed`]: true,
    });
    return true;
  } finally {
    followUpClaimLocks.delete(message.id);
  }
}

async function releaseFollowUpLocally(
  message: FoundryChatMessageDocument,
  userId: string,
): Promise<void> {
  const claim = followUpClaim(message.getFlag(SYSTEM_ID, "rollFollowUpClaim"));
  if (claim?.userId !== userId) return;
  await message.update({
    [`flags.${SYSTEM_ID}.rollFollowUpClaim`]: null,
    [`flags.${SYSTEM_ID}.rollFollowUpUsed`]: false,
  });
}

export async function claimRollFollowUp(
  message: FoundryChatMessageDocument,
  actor: FoundryActorDocument,
): Promise<boolean> {
  const requester = game.user;
  if (!requester) return false;
  const id = foundryRandomId();
  if (requester.isGM) {
    return claimFollowUpLocally(message, requester.id, id);
  }
  const gm = activeGm();
  if (!gm) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Roll.FollowUp.GmUnavailable"),
    );
    return false;
  }
  const createdAt = Date.now();
  const request: FollowUpClaimRequest = {
    actorId: actor.id,
    createdAt,
    expiresAt: createdAt + AUTHORITY_LIFETIME_MS,
    id,
    messageId: message.id,
    requesterUserId: requester.id,
    targetUserId: gm.id,
    type: "roll-authority-follow-up-claim",
    version: AUTHORITY_VERSION,
  };
  return waitForResponse(id, gm.id, pendingFollowUpClaims, false, () => {
    game.socket?.emit(authorityChannel(), request);
  });
}

export async function releaseRollFollowUp(
  message: FoundryChatMessageDocument,
  actor: FoundryActorDocument,
): Promise<void> {
  const requester = game.user;
  if (!requester) return;
  if (requester.isGM) {
    await releaseFollowUpLocally(message, requester.id);
    return;
  }
  const gm = activeGm();
  if (!gm) return;
  const createdAt = Date.now();
  const id = foundryRandomId();
  const request = {
    actorId: actor.id,
    createdAt,
    expiresAt: createdAt + AUTHORITY_LIFETIME_MS,
    id,
    messageId: message.id,
    requesterUserId: requester.id,
    targetUserId: gm.id,
    type: "roll-authority-follow-up-release",
    version: AUTHORITY_VERSION,
  } satisfies FollowUpReleaseRequest;
  await waitForResponse(id, gm.id, pendingFollowUpReleases, false, () => {
    game.socket?.emit(authorityChannel(), request);
  });
}

async function receiveWildRequest(message: WildChoiceRequest): Promise<void> {
  const currentUser = game.user;
  if (
    !currentUser?.isGM ||
    message.targetUserId !== currentUser.id ||
    !isCurrentRequest(message) ||
    !validWildDecisionViewModel(message.decision) ||
    !Array.isArray(message.choices) ||
    !message.choices.every(isWildChoice) ||
    !validWildChoiceAuthorityRequest(message)
  ) {
    return;
  }
  const requester = requestingPlayer(message.requesterUserId, message.actorId);
  if (!requester) return;
  pruneIncomingDecisions();
  const existing = incomingWildDecisions.get(message.id);
  if (
    existing &&
    (existing.actorId !== message.actorId ||
      existing.requesterUserId !== message.requesterUserId)
  ) {
    return;
  }
  const promise =
    existing?.promise ??
    promptWildChoiceDialog(
      message.choices,
      Object.freeze({
        ...message.decision,
        actorName: requester.actor.name,
        total: Math.trunc(message.decision.total),
      }),
    );
  if (!existing) {
    incomingWildDecisions.set(message.id, {
      actorId: message.actorId,
      expiresAt: message.expiresAt,
      promise,
      requesterUserId: message.requesterUserId,
    });
  }
  const choice = await promise;
  game.socket?.emit(authorityChannel(), {
    choice,
    id: message.id,
    requesterUserId: message.requesterUserId,
    targetUserId: currentUser.id,
    type: "roll-authority-wild-response",
  } satisfies WildChoiceResponse);
}

async function receiveFollowUpClaim(
  message: FollowUpClaimRequest,
): Promise<void> {
  const currentUser = game.user;
  if (
    !currentUser?.isGM ||
    message.targetUserId !== currentUser.id ||
    !isCurrentRequest(message)
  ) {
    return;
  }
  const requester = requestingPlayer(message.requesterUserId, message.actorId);
  const chatMessage = game.messages?.get(message.messageId);
  const result = chatMessage
    ? rollResult(chatMessage.getFlag(SYSTEM_ID, "roll"))
    : null;
  pruneIncomingDecisions();
  const existing = incomingFollowUpDecisions.get(message.id);
  if (
    existing &&
    (existing.actorId !== message.actorId ||
      existing.messageId !== message.messageId ||
      existing.requesterUserId !== message.requesterUserId)
  ) {
    return;
  }
  const promise =
    existing?.promise ??
    (requester !== null &&
    chatMessage !== undefined &&
    result?.request.source.actorId === message.actorId
      ? claimFollowUpLocally(chatMessage, message.requesterUserId, message.id)
      : Promise.resolve(false));
  if (!existing) {
    incomingFollowUpDecisions.set(message.id, {
      actorId: message.actorId,
      expiresAt: message.expiresAt,
      messageId: message.messageId,
      promise,
      requesterUserId: message.requesterUserId,
    });
  }
  const granted = await promise;
  game.socket?.emit(authorityChannel(), {
    granted,
    id: message.id,
    requesterUserId: message.requesterUserId,
    targetUserId: currentUser.id,
    type: "roll-authority-follow-up-response",
  } satisfies FollowUpClaimResponse);
}

async function receiveFollowUpRelease(
  message: FollowUpReleaseRequest,
): Promise<void> {
  const currentUser = game.user;
  if (
    !currentUser?.isGM ||
    message.targetUserId !== currentUser.id ||
    !isCurrentRequest(message)
  ) {
    return;
  }
  const requester = requestingPlayer(message.requesterUserId, message.actorId);
  const chatMessage = requester
    ? game.messages?.get(message.messageId)
    : undefined;
  let released = false;
  if (chatMessage) {
    await releaseFollowUpLocally(chatMessage, message.requesterUserId);
    released = true;
  }
  game.socket?.emit(authorityChannel(), {
    id: message.id,
    released,
    requesterUserId: message.requesterUserId,
    targetUserId: currentUser.id,
    type: "roll-authority-follow-up-release-response",
  } satisfies FollowUpReleaseResponse);
}

async function receiveSocket(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("type" in value)) return;
  const message = value as RollAuthoritySocketMessage;
  const currentUser = game.user;
  if (!currentUser) return;
  if (
    message.type === "roll-authority-wild-response" &&
    message.requesterUserId === currentUser.id &&
    (message.choice === null || isWildChoice(message.choice))
  ) {
    const pending = pendingWildChoices.get(message.id);
    if (pending?.targetUserId === message.targetUserId) {
      pending.resolve(message.choice);
    }
    return;
  }
  if (
    message.type === "roll-authority-follow-up-response" &&
    message.requesterUserId === currentUser.id &&
    typeof message.granted === "boolean"
  ) {
    const pending = pendingFollowUpClaims.get(message.id);
    if (pending?.targetUserId === message.targetUserId) {
      pending.resolve(message.granted);
    }
    return;
  }
  if (
    message.type === "roll-authority-follow-up-release-response" &&
    message.requesterUserId === currentUser.id &&
    typeof message.released === "boolean"
  ) {
    const pending = pendingFollowUpReleases.get(message.id);
    if (pending?.targetUserId === message.targetUserId) {
      pending.resolve(message.released);
    }
    return;
  }
  if (message.type === "roll-authority-wild-request") {
    await receiveWildRequest(message);
  } else if (message.type === "roll-authority-follow-up-claim") {
    await receiveFollowUpClaim(message);
  } else if (message.type === "roll-authority-follow-up-release") {
    await receiveFollowUpRelease(message);
  }
}

export function registerRollAuthoritySocket(): void {
  game.socket?.on(authorityChannel(), (value: unknown) => {
    void receiveSocket(value);
  });
}

export function resetRollAuthorityForTests(): void {
  pendingWildChoices.clear();
  pendingFollowUpClaims.clear();
  pendingFollowUpReleases.clear();
  followUpClaimLocks.clear();
  incomingWildDecisions.clear();
  incomingFollowUpDecisions.clear();
}
