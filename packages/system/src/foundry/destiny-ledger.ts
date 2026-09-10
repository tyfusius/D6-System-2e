import {
  validateDestinyState,
  initialDestinyState,
  type D6DestinyStateV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import {
  sealDestiny,
  openDestinyEnvelope,
  destinyEnrolledGMIds,
  type DestinyEnvelopeV1,
} from "./destiny-crypto";
export const DESTINY_ROOT_SETTING = "destinyAuthorityRootV1";
/** The ciphertext and dice claims share one durable revision, independent of ChatMessage lifetime. */
export class DestinyLedger {
  #creation: Promise<DestinyEnvelopeV1> | undefined;
  constructor(
    private readonly requireAuthority: () => void,
    private readonly publicRevision: () => number,
  ) {}
  async envelope(): Promise<DestinyEnvelopeV1> {
    this.requireAuthority();
    const saved = game.settings.get(SYSTEM_ID, DESTINY_ROOT_SETTING);
    if (saved) {
      if (
        typeof saved !== "object" ||
        (saved as { version: unknown }).version !== 1
      )
        throw new Error("D6E2.Destiny.Error.Version");
      return saved as DestinyEnvelopeV1;
    }
    if (this.publicRevision() > 0)
      throw new Error("D6E2.Destiny.Error.AuthorityMissing");
    this.#creation ??= (async () => {
      const recipients = destinyEnrolledGMIds().sort();
      const envelope = await sealDestiny(
        "ledger",
        initialDestinyState(),
        recipients,
      );
      this.requireAuthority();
      if (
        JSON.stringify(recipients) !==
        JSON.stringify(destinyEnrolledGMIds().sort())
      )
        throw new Error("D6E2.Destiny.Error.KeyEnrollmentRequired");
      await game.settings.set(SYSTEM_ID, DESTINY_ROOT_SETTING, envelope);
      return envelope;
    })().finally(() => {
      this.#creation = undefined;
    });
    return this.#creation;
  }
  async read(): Promise<D6DestinyStateV1> {
    const state = await openDestinyEnvelope<D6DestinyStateV1>(
      "ledger",
      await this.envelope(),
    );
    validateDestinyState(state);
    return structuredClone(state);
  }
  async write(
    state: D6DestinyStateV1,
    expectedRevision: number,
  ): Promise<void> {
    this.requireAuthority();
    const previous = await this.envelope();
    const current = await openDestinyEnvelope<D6DestinyStateV1>(
      "ledger",
      previous,
    );
    this.requireAuthority();
    if (current.revision !== expectedRevision)
      throw new Error("D6E2.Destiny.Error.RevisionConflict");
    const recipients = destinyEnrolledGMIds().sort();
    const envelope = await sealDestiny("ledger", state, recipients, previous);
    this.requireAuthority();
    if (
      JSON.stringify(recipients) !==
      JSON.stringify(destinyEnrolledGMIds().sort())
    )
      throw new Error("D6E2.Destiny.Error.KeyEnrollmentRequired");
    await game.settings.set(SYSTEM_ID, DESTINY_ROOT_SETTING, envelope);
  }
}
