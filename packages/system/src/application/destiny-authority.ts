import {
  transitionDestiny,
  type D6DestinyCommandV1,
  type D6DestinyPrincipal,
  type D6DestinyStateV1,
} from "@d6-system-2e/core";

export interface DestinyAuthorityStore {
  isAuthority(): boolean;
  read(): Promise<D6DestinyStateV1>;
  write(state: D6DestinyStateV1, expectedRevision: number): Promise<void>;
  validate(
    command: D6DestinyCommandV1,
    principal: D6DestinyPrincipal,
    state: D6DestinyStateV1,
  ): Promise<void>;
  /** Must use an atomic same-document delivery receipt; replay is recovery. */
  deliver(state: D6DestinyStateV1): Promise<void>;
  reconcile?(state: D6DestinyStateV1): Promise<void>;
}

/** One durable command at a time on the elected active GM, including recovery. */
export class DestinyAuthority {
  #tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly store: DestinyAuthorityStore) {}
  execute(
    command: D6DestinyCommandV1,
    principal: D6DestinyPrincipal,
  ): Promise<D6DestinyStateV1> {
    const run = async () => {
      this.#requireAuthority();
      const current = await this.store.read();
      this.#requireAuthority();
      const next = transitionDestiny(current, command, principal);
      if (next !== current)
        await this.store.validate(command, principal, current);
      this.#requireAuthority();
      if (next !== current) await this.store.write(next, current.revision);
      this.#requireAuthority();
      await this.store.deliver(next);
      this.#requireAuthority();
      return this.store.read();
    };
    const result = this.#tail.then(run, run);
    this.#tail = result.catch(() => undefined);
    return result;
  }
  recover(): Promise<D6DestinyStateV1> {
    const run = async () => {
      this.#requireAuthority();
      const state = await this.store.read();
      this.#requireAuthority();
      await this.store.deliver(state);
      this.#requireAuthority();
      const current = await this.store.read();
      await this.store.reconcile?.(current);
      return current;
    };
    const result = this.#tail.then(run, run);
    this.#tail = result.catch(() => undefined);
    return result;
  }
  #requireAuthority(): void {
    if (!this.store.isAuthority())
      throw new Error("D6E2.Destiny.Error.GMUnavailable");
  }
}
