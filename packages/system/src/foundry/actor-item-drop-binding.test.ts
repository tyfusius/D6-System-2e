import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindActorItemDropTarget } from "./actor-item-drop-binding";

describe("Actor Item drop binding", () => {
  const bind = vi.fn();
  const construct = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    class PublicDragDrop {
      constructor(configuration: unknown) {
        construct(configuration);
      }

      bind(element: HTMLElement) {
        bind(element);
      }
    }
    vi.stubGlobal("foundry", {
      applications: { ux: { DragDrop: { implementation: PublicDragDrop } } },
    });
  });

  it("uses the public v14 controller and accepts drops for permission-aware rejection", async () => {
    const element = {} as HTMLElement;
    const callbacks = {
      canDrag: vi.fn(() => false),
      dragend: vi.fn(),
      dragleave: vi.fn(),
      dragover: vi.fn(),
      dragstart: vi.fn(),
      drop: vi.fn(() => Promise.resolve()),
    };
    bindActorItemDropTarget(element, callbacks);

    expect(bind).toHaveBeenCalledWith(element);
    const configuration = construct.mock.calls[0]?.[0] as {
      callbacks: Record<string, (event: DragEvent) => unknown>;
      dragSelector: string;
      permissions: Record<string, () => boolean>;
    };
    expect(configuration.dragSelector).toBe("[data-item-id]");
    expect(configuration.permissions.dragstart?.()).toBe(false);
    expect(configuration.permissions.drop?.()).toBe(true);
    const event = {} as DragEvent;
    await configuration.callbacks.drop?.(event);
    expect(callbacks.drop).toHaveBeenCalledWith(event);
  });
});
