# UX direction

## Product goals

The interface is organized around player and GM decisions, not stored-object shape.
The first visual language uses the same interaction family as OpenD6 Next so an
existing user can transfer habits directly. Implementation, semantic tokens, data
models, and rules services remain native to this project; protected trade dress and
setting artwork are not reused.

The built-in theme is the neutral OpenD6 Classic charcoal-and-gold palette. Blue
Rebel styling and other setting identities belong to independently registered
companion themes and are never the generic system default.

## Character sheet

- A clear identity/portrait area and compact Hero Point/condition summary.
- Core attributes and their primary roll controls remain visible.
- Skills are grouped under their governing attribute but remain embedded Items.
- Optional attributes appear only when active, while preserved inactive data is
  recoverable through GM configuration.
- Advanced creation and module controls use progressive disclosure.
- Every drag-and-drop action also has an Add or Manage control.

### Sheet modes

- **Normal** is the compact play view. Attributes and skills show canonical
  die-code labels such as `2D`, `2D+1`, and `3D+2`. Mechanical scores and
  embedded-skill structure are read-only for both players and GMs; play controls
  must call rules services rather than mutate scores.
- **Advance** preserves the OpenD6 Next workflow location and visual treatment.
  It is the only player-facing route for spending advancement resources and
  increasing skills. Purchases remain disabled until the campaign chooses one of
  the rulebook's mutually exclusive advancement modules.
- **Free Edit** exposes the canonical integer pip score and is available only to
  a GM. Its adjacent `xD+y` label is derived from that score; dice and remainder
  pips are never independent stored values. The UI omits Free Edit for players,
  and the handler independently rejects it for a non-GM. A character stored in
  Free Edit opens in effective Normal mode for a player.

These restrictions are enforced in document pre-update/pre-create guards as well
as in templates and handlers. Hiding a control is not the permission boundary.

The mode is persistent Actor presentation/workflow state at
`system.sheetMode.value`; it is not a rules result.

## Settings

Edition-specific configuration uses the same OpenD6 Next visual language as the
sheets and roll surfaces. The root settings list stays concise: shared
preferences remain visible directly, while the two rules editions open
dedicated, scrollable, keyboard-accessible ApplicationV2 forms with local help
text and one explicit save action.

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

OpenD6 Next is the canonical UI implementation, not merely a visual reference.
The corresponding component structure and styling are ported directly. A visible
difference is treated as a defect unless Second Edition rules, generic
terminology, or a documented platform constraint requires it. See ADR 0008.

The implementation uses the neutral OpenD6 Classic theme and Second Edition
result contracts. It does not import setting branding or make presentation
responsible for rules.

Wild Die choices use the same visual family in a dedicated decision surface. It
shows the triggering Wild Die face and current total before presenting explicit
rules-authorized actions, including their Hero Point consequences in the button
labels.

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
