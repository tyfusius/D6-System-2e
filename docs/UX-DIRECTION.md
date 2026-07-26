# UX direction

## Product goals

The interface is organized around player and GM decisions, not stored-object shape.
The first visual language should feel cinematic and modern without copying OpenD6
Next or the rulebook trade dress.

## Character sheet

- A clear identity/portrait area and compact Hero Point/condition summary.
- Core attributes and their primary roll controls remain visible.
- Skills are grouped under their governing attribute but remain embedded Items.
- Optional attributes appear only when active, while preserved inactive data is
  recoverable through GM configuration.
- Advanced creation and module controls use progressive disclosure.
- Every drag-and-drop action also has an Add or Manage control.

## Roll builder

The default view shows:

- source pool;
- difficulty or opposition;
- major modifiers;
- Hero Point choice;
- roll action.

An audit expansion lists every pool contributor and action consequence. The UI
prevents duplicate submission and shows pending asynchronous state. Wild Die
choices state their mechanical and resource consequences before confirmation.

## Chat

Cards render typed results and include:

- actor and action identity;
- dice faces with a distinct accessible Wild Die indicator;
- provisional and final score/evaluation;
- chosen Advantage/Complication resolution;
- Hero Point transaction;
- authorized follow-ups such as Doubling Down.

Color is never the only status indicator. Buttons use semantic labels and permissions
are checked again by the application service.

## Accessibility

- semantic headings, labels, buttons, and form associations;
- full keyboard operation and visible focus;
- predictable focus restoration after dialogs and updates;
- WCAG-aware contrast through semantic CSS tokens;
- error messages adjacent to the relevant control;
- `aria-live` for pending/result state where appropriate;
- reduced-motion support;
- usable reflow at narrow widths and common browser zoom levels.

## Responsive targets

The character sheet must remain functional at 520 CSS pixels wide. Dense tables
become labelled stacked rows rather than horizontal scroll where practical. Primary
roll and save actions remain reachable without opening multiple windows.

## Validation

Each workflow records decisions, clicks, windows, keyboard behavior, resize behavior,
permission differences, and console observations. Visual similarity to OpenD6 Next
is secondary to task parity and rules clarity.
