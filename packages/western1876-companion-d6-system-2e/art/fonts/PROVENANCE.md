# 1876 website typography and palette

## Bleeding Cowboys

The heading font is an unchanged copy of the current 1876 website asset,
`website/src/assets/fonts/Bleeding_Cowboys.ttf`, confirmed by the established
website owner on 7 September 2026. It is **Bleeding Cowboys**, normal weight 400,
by **Segments Design**, also known as **Last Soundtrack (Gyom.Typo)**.

- Original source: <https://www.dafont.com/bleeding-cowboys.font>
- Embedded copyright: Bleeding Cowboys © Last Soundtrack (Gyom.Typo) 2007.
  All Rights Reserved.
- Embedded version: Version 1.00, June 28, 2007. PostScript name: BleedingCowboys.
- Commercial-use contact recorded by the website: gyom.typo@gmail.com.
- Unmodified file size: 148,896 bytes.
- SHA-256: `5c827d55569edcb75bdd162479905f8290455388f3b51a2acc49a5f83a60b9fc`.

The website README records the personal/noncommercial project basis confirmed by
Geir on 5 September 2026. The website owner confirmed that basis for this requested
local companion copy. The inspected source describes the font as free for personal
use and requests contact for commercial use. No separate font license or general
redistribution grant was present. This notice records provenance; it does not grant
public or commercial redistribution rights. This font is not covered by the OFL
licenses of other website fonts. No public release of this companion is part of
this implementation.

The website's `src/styles/heading-font.css` registers the font at normal 400 with
`font-display: swap`. It uses zero letter spacing and generous 1.6–1.65 heading
line height. The companion contributes this face for the display role only through
the public font registry. D6 Humanist remains the body role. The system and the
separate scoped Design amendment own rendering and font fallback; this package
adds no global CSS or font engine.

## Website palette

Design mapped the existing website colors to the five supported profile tokens:

| Profile token | Color     | Website role    |
| ------------- | --------- | --------------- |
| background    | `#0b0b0a` | Dark background |
| text          | `#e8dcc6` | Bone text       |
| accent        | `#c7a264` | Gold accent     |
| accentBright  | `#e8dcc6` | Bone highlight  |
| muted         | `#c0aa85` | Footer text     |

The footer color was selected for muted text because it passes the system's
raised-panel contrast threshold; the darker general website muted color does not.
The existing profile renderer derives panel and border colors. Website reds remain
reserved for semantic danger styling rather than being used as the bright accent.
No global palette overrides are installed by the companion.
