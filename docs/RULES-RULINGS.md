# Authoritative Rules Rulings

This ledger records explicit table rulings for contradictory or ambiguous
language in _D6 System: Second Edition_ v1.1. These rulings are the authority for
system automation unless later official errata supersedes them.

## Ruling 1: Successful damage resistance causes Staggered

- **Source:** D62e p. 33.
- **Conflict:** The formal outcome list says a Brawn total greater than the
  Damage total causes Staggered. The example says the same result causes
  Stunned, while the following condition text says a character becomes Stunned
  when Staggered again while already Staggered.
- **Decision:** A Brawn total greater than the Damage total causes Staggered. A
  second Staggered result while the character is already Staggered causes
  Stunned.
- **Rationale:** Treat the example's direct Stunned result as a typo. The formal
  outcome list and the immediately following escalation rule form the coherent
  progression.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 2: A Brawn-roll Complication causes Mortally Wounded

- **Source:** D62e p. 33.
- **Conflict:** The formal outcome list requires a Complication on the Damage
  roll. The example instead refers to a `1` on the defender's Brawn Wild Die.
- **Decision:** When the Brawn total is equal to or less than the Damage total
  and the Brawn resistance roll invokes a Complication, the target becomes
  Mortally Wounded. A Complication on the Damage roll does not escalate the
  target's condition.
- **Rationale:** Treat `Damage Roll invoked a Complication` in the formal list
  as a typo for `Brawn Roll invoked a Complication`, consistent with the
  numerical example and the adverse meaning of a Complication for the
  character making the resistance roll.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 3: A declaration cannot reduce a required roll below 1D

- **Source:** D62e pp. 26, 29-30.
- **Ambiguity:** The rules require every roll to contain a Wild Die and warn that
  excessive actions will not work, but do not explicitly define a `0D` or
  negative-dice roll.
- **Decision:** A character cannot declare an action sequence if the resulting
  multiple-action penalty plus wounds, movement, conditions, or other
  applicable penalties would reduce any declared Skill or Attribute use to `0D`
  or less. The whole-die count must remain at least `1D`; positive pips do not
  rescue a zero-die pool, so `0D+1` and `0D+2` are also illegal. There is no 1D
  floor and no automatic-failure declaration.
- **Consequences:** Adding an action must revalidate every rolled action already
  in the sequence. Movement and other non-roll segments may remain legal
  themselves but can make a rolled action illegal by increasing the round
  penalty. If an applicable penalty changes after declaration, execution of a
  roll reduced below 1D is prohibited.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 4: Heroic Die Code doubling includes canonical pips

- **Source:** D62e pp. 28, 94-95; First Edition compatibility profile.
- **Ambiguity:** The core Hero Point rule doubles a Die Code, but the optional
  Pips module does not explicitly state how a `+1` or `+2` is doubled.
- **Decision:** In Second Edition without the Pips module, only whole dice
  exist, so `3D` becomes `6D`. With the Pips module active, double the complete
  canonical pip score and normalize it, so `3D+2` becomes `7D+1`. First Edition
  always uses the same pip-aware calculation.
- **Consequences:** Basic and Classic Hero Point variants retain their own
  printed strategies. This ruling governs the core/Heroic Die Code-doubling
  strategy and the First Edition Fate Point compatibility calculation.
- **Status:** Accepted by the project owner on 2026-07-30.

## Ruling 5: First Edition unconscious duration uses a positive difference

- **Source:** D6S pp. 75-76.
- **Conflict:** The stun-only and Wound Level paragraphs describe unconscious
  minutes as resistance minus Damage, even though those outcomes occur only
  when Damage exceeds resistance. A literal result would therefore be negative.
- **Decision:** Store the positive Damage-minus-resistance difference for
  stun-only unconscious duration. A failed Incapacitated Stamina/Willpower check
  retains the separate printed 10D-minute duration.
- **Rationale:** This is the only non-negative reading consistent with the
  surrounding damage comparison and an elapsed duration.
- **Status:** Provisional implementation clarification recorded on 2026-07-31;
  the project owner may replace it if official errata supplies another value.

## Ruling 6: Body Point rounding and zero-point rescue

- **Source:** D6S pp. 14, 75-78.
- **Conflict:** The optional wound-band table says to round so percentage bands
  do not overlap and labels zero Body Points Dead, while the adjacent rescue
  rule explicitly permits medical aid after reaching zero and says only another
  full maximum of damage after zero makes normal revival impossible.
- **Decision:** Round a positive remaining percentage upward to the next whole
  percent, then apply the printed 81+/60-80/40-59/20-39/10-19/1-9 bands. Treat
  zero through one point above negative maximum as Mortally Wounded and
  rescue-eligible. Treat negative maximum or lower as Dead. Body Points alone
  use those terminal thresholds for consciousness and mortality without
  applying intermediate wound penalties; the combined profile applies the
  derived bands and penalties.
- **Rationale:** Upward rounding gives every integer point one deterministic,
  non-overlapping band. Preserving the longer rescue paragraph avoids making
  its timing, survival checks, and permanent Skill-loss rules unreachable.
- **Status:** Provisional implementation clarification recorded on 2026-08-01;
  the project owner may replace it if official errata supplies another value.

## Accumulating-stuns compatibility boundary

OpenD6 Space pp. 75-76 define stun weapons by reducing the ordinary wound
result two levels and applying a positive Damage-minus-resistance duration.
They do not contain a persistent hit count, whole-Strength-dice threshold, or
the one-minute count reset. Those mechanics are therefore implemented only as
an explicitly labelled legacy D6 compatibility extension, disabled by default,
and are not cited as a D6 Space rule.

While enabled, every positive stun hit adds one to the persistent count. The
short action penalty is noncumulative: net differences 1-3 apply −1D and 4-8
apply −2D for the current and next round. A net difference of 9+ causes the
existing immediate unconsciousness; reaching the count threshold causes
unconsciousness for a separate 2D minutes. The primary active GM decays the
short penalty once per true Combat round, but only an owner-confirmed
uninterrupted one-minute rest clears the count. This is an implementation
boundary for an optional compatibility mode, not a new ruling about D6 Space.

## Equipment by Genre/Era classification note

D62e pp. 79-85 clearly present Medieval, Modern, and Science Fiction as
alternative equipment families and explicitly leave acquisition and cost to the
Gamemaster. No contradiction required a new rules ruling. The implementation
therefore treats era as classification and catalog-filter guidance only: it does
not hide mismatched Items, invent prices, infer bonuses from descriptions, or
ship the protected named tables. Licensed Foundry modules may contribute
validated catalog facts through the public registry while the base catalog
remains empty.

## Hero Point module implementation note

D62e pp. 75-76 define three mutually exclusive strategies. Heroic retains the
core p. 28 uses and its session reset/carry-over choice. Basic bonus dice are
ordinary dice. Classic uses the same persistent Experience Point balance as its
required advancement module, and every 6 on every independently resolving
Classic Wild Die—including an exploding continuation—earns one point. Its spend
limit uses the roll's baseline Attribute whole dice, not a Skill increase,
modifier, or already-added bonus die. Failed-roll rerolls and Stunned prevention
are Heroic-only. These are direct implementation boundaries from the printed
module rather than new contradictory-source rulings.

## Alternate Initiative implementation note

D62e pp. 69-70 define Standard, Simple, Basic, and Narrative as a mutually
exclusive campaign family but do not settle equal Perception totals. The
implementation preserves the Combat's existing stable order for ties; this is
a deterministic implementation decision, not an additional rules result.
Basic reverses the high-to-low resolution order only for declaration guidance
and clears initiative at each new round. Narrative stores each chosen successor
on the Combat and rotates the previous last declarer to the first position next
round. The Hero Point interrupt sidebar remains optional GM advice and is not
automatically awarded or invoked.

## No Dodge Defense interaction note

D62e p. 94 replaces a character's Dodge with fixed personal ranged-attack
difficulties; it does not remove Parry or machine Defense. The prone bonus on
p. 32 and the smaller-target scale bonus on pp. 196–197 explicitly modify
Dodge, so neither modifies this replacement difficulty. Cover remains an
independent GM-adjudicated addition. Because the system has no persistent
printed Dodge-reaction scheduler, the p. 94 Long-range dodging value is exposed
as a per-attack **Target is dodging** choice, only at Long range, and is fully
audited in chat.

## Hyper-lethal Combat boundaries

The phrases “first level” and “next level” on D62e p. 89 describe the complete
normal damage track that replaces the p. 33 Staggered/Stunned/Wounded track.
Accordingly, removing Stunned makes Wounded the first result whether Brawn is
above or at/below Damage; removing Wounded makes Stunned first and Mortally
Wounded next; enabling both removals makes Mortally Wounded the sole normal
damage result. A resistance Complication remains Mortally Wounded.

The p. 90 Killing Blow comparison is strict: `Brawn × 2 < Damage`. Equality is
not a Killing Blow. Spending the printed Hero Point prevents only immediate
death, then applies the ordinary result from the active damage track; any
separate Hero Point option produced by that result remains a distinct choice.

The Maximum Armor Rule names a “Brawn+Armor” roll. The 6D cap therefore applies
to that personal base pool. The relative-Scale resistance modifier on pp.
196-197 remains a separate, visible modifier. Hull plus Shields/Armor is not a
Brawn roll, so Vehicle and Starship damage is unchanged. The module changes
normal damage resolution, not environmental direct Conditions or manual
Condition edits.

## Freeform Skill-Based Magic implementation note

D62e pp. 145–159 define a base Difficulty 5 plus Power, target, resistance,
duration, casting-time, and range modifiers, with a final minimum of 5. Power
adds +5 for every point above 1, including values beyond the printed table's
Power 10 row. A Spell School specialization removes the untrained penalty;
Magic or Spell School dice without the matching specialization add +5, and no
Magic/Spell School dice add +10.

The shared roll pipeline requires a legal minimum pool, so the printed no-dice
attempt is represented as 1D plus the +10 Difficulty penalty rather than being
blocked. This is an explicit implementation boundary, not an extra Magic die
stored on the Actor. Manifestations calculate and audit the attempt but never
infer or apply an arbitrary fictional effect. The resistance selector records
the spell designer's chosen printed category; whether a target is willing or
capable of resistance remains a table ruling.

## Ruling 7: Active-combat Skill values use whole-die ratings

For D62e pp. 162–163 Feint and Full Defense, the printed instruction adds or
subtracts the character's Skill value from an already numeric static Defense.
The implementation therefore uses the Skill's whole-die rating: 4D contributes 4. It does not add the internal pip score (12) or convert the rating to a ×5
difficulty. Magic Point maximum follows the same convention: Magic whole dice
plus three times the caster's own Mystical Alignment whole dice.

## Ruling 8: Bestiary category ratings are broad Attribute baselines

- **Source:** D62e pp. 165–167.
- **Ambiguity:** The creature blocks label two rows “Agility Skills” and “Brawn
  Skills” while listing Knowledge and Perception without “Skills.” The adjacent
  construction guidance separately says individual Skills are generally rated
  above a base Attribute when the creature needs them.
- **Decision:** Store all four category values as the Creature's base Attribute
  scores. Explicit individual Skill increases, attacks, and special facts are
  embedded Items supplied by the registered profile. A conditional defense such
  as a flying value remains an explicit contributed fact unless a separately
  sourced movement state can determine when it applies; the system does not
  infer flight from an image, biography, or creature name.
- **Status:** Implementation clarification recorded on 2026-08-01; it preserves
  every printed numeric fact without inventing a universal creature Skill.

## Ruling 9: Flying uses its complete Die Code as an alternate Dodge basis

- **Source:** D62e pp. 21 and 175.
- **Ambiguity:** Core Dodge is five times full Perception dice, while the
  Science Fiction Skills text says Flying can replace “Agility” when
  calculating Dodge and separately forbids counting Agility twice.
- **Decision:** Core Perception remains the default. When Flying applies, an
  owner may select the complete Flying Die Code—Agility plus the Flying Skill
  increase—as the alternate value passed to the same ×5 static-defense
  calculation. Agility is therefore present once, never added again. The
  persisted selection is explicit because the system cannot infer whether a
  character is currently flying.
- **Status:** Implementation clarification recorded on 2026-08-02.

## Ruling 10: D6 Space Group Attack is not a D62e Combined Action rule

- **Sources:** D62e p. 63 and p. 185; D6S pp. 82 and 88.
- **Ambiguity:** OpenD6 Next has a Combined Actions workflow, but it is not a
  rules authority. D62e Command describes leadership without providing
  arithmetic or a consent procedure for combining ordinary actions.
- **Decision:** D62e does not receive generic Combined Action automation. Its
  standard requested-roll workflow remains available without altering the
  requester's roll. D6 Space's Group Attack is a coordinated attack resolved
  through that book's Command procedure and belongs only in a separately
  sourced First Edition Space package. Psionic combined Skills remain bounded
  to their own later D62e module.
- **Status:** Profile boundary accepted by the core closure audit on 2026-08-02.

## Ruling 11: Core static defense remains ×5 for beta

- **Source:** D62e p. 21.
- **Ambiguity:** The printed core calculation uses five times the full Attribute
  dice, while a sidebar allows a GM to lower the multiplier to four or three.
- **Decision:** The supported native profile retains ×5. The lower values are
  optional table tuning, not a named rules component, and do not add another
  persistent world setting before beta. A GM using that advice adjudicates the
  alternate difficulty at the table.
- **Status:** Release-scope decision accepted on 2026-08-02.

## Ruling 12: Automatic Token movement requires an explicit spatial destination

- **Sources:** D62e p. 32 and pp. 73–74; D6S pp. 63–64.
- **Ambiguity:** Personal movement supplies maximum distances, while the chase
  rules use an abstract Distance track and neither source supplies a destination
  that Foundry may infer.
- **Decision:** Automatic personal Token movement begins only after the owner or
  GM points to an explicit destination on the active Scene. Foundry measures the
  snapped route, enforces the applicable movement maximum and movement-wall
  collision, and never chooses a direction. A failed First Edition movement
  check does not move the Token because D6 Space permits either reduced movement
  or a fall, which requires GM adjudication. Chase Distance never translates a
  Token because its 0–8 track is not a map distance.
- **Status:** Implementation boundary recorded on 2026-08-02.

## Ruling 13: First Edition grenade ranges use Strength and target a place

- **Sources:** D6 Space p. 111; Tyfusius house-rule specification recorded
  2026-08-02.
- **Ambiguity:** The printed explosive profile has a Short minimum but the
  targeting table also names Point Blank; weak Strength can shift the Short
  minimum to zero. Ordinary First Edition attacks use active defenses, while a
  grenade is aimed at a place.
- **Decision:** The optional First Edition rule uses effective Strength, with 2D
  as its six-pip baseline, and shifts every range boundary one meter per pip.
  Boundaries clamp at zero. If Short begins at zero, Point Blank is empty and a
  zero-meter throw is Short. A selected Token supplies only the aimed position;
  the roll uses fixed Point Blank/Short/Medium/Long difficulties 0/10/15/20 and
  does not trigger that Actor's active defense. Blast, scatter, and affected
  targets stay with the GM until a separately bounded explosive-resolution
  pass.
- **Status:** House-rule and targeting boundary accepted on 2026-08-02.

## Ruling 14: Segmented actions use independent queues and MAP

- **Sources:** D6 Space pp. 58 and 73; Tyfusius house-rule specification
  recorded 2026-08-02.
- **Ambiguity:** The source establishes Perception initiative, declaration, and
  Multiple Action Penalties but does not interleave every character's first,
  second, and later actions. A character may also need to defend before their
  normal place in initiative.
- **Decision:** When the independent house rule is enabled, each participating
  Combatant declares one complete ordered queue. Segment 1 resolves in
  initiative order, followed by Segment 2 in the same order, continuing until
  all queues are spent. An early defense forces that defender's complete
  declaration and immediately spends only its first queued action. The
  defender's later segments always use the defender's own declared action count
  and MAP, never those of the attacker. Full Defense remains exclusive.
  Movement uses only linked queued pools: the whole dice in the lowest
  post-MAP pool, capped by Move divided by that Actor's declared actions.
  Running is an explicit queued movement action with Difficulty equal to five
  times the Actor's declared actions. Success doubles the normal segment
  allowance; failure spends Running and its MAP but retains only normal
  movement. A Running Wild Die 1 resolved as a Complication forfeits all other
  actions and permits only one normal segment movement total. Reactive movement
  spends the reactor's own next action and uses only the reactor's queue, MAP,
  and Move cap; it does not generate a further movement reaction.
- **Status:** House-rule scheduling and movement boundary accepted and
  implemented on 2026-08-02.
