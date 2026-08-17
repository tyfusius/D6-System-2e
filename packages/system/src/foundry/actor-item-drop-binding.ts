export type ActorItemDropCallbacks = Readonly<{
  canDrag(): boolean;
  dragend(): void;
  dragleave(): void;
  dragover(event: DragEvent): void;
  dragstart(event: DragEvent): void;
  drop(event: DragEvent): Promise<void>;
}>;

export function bindActorItemDropTarget(
  element: HTMLElement,
  callbacks: ActorItemDropCallbacks,
): void {
  const DragDrop = foundry.applications.ux.DragDrop.implementation;
  new DragDrop({
    callbacks: {
      dragend: callbacks.dragend,
      dragleave: callbacks.dragleave,
      dragover: callbacks.dragover,
      dragstart: callbacks.dragstart,
      drop: callbacks.drop,
    },
    dragSelector: "[data-item-id]",
    permissions: {
      dragstart: callbacks.canDrag,
      drop: () => true,
    },
  }).bind(element);
}
