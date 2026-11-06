# Stash - non-negotiables

> **Hugo, read this first:** on 06/11/2026 Isa updated the branding skill and
> consequently Stash (now on Material 3, v0.4). What changed and what is left:
> `kave-hub/finance/data/stash-handoff-2026-11-06.md`.

## The household look is enforced

Before any interface change, load `brand:apply-household-look` (or read
`kave-hub/brand/skills/apply-household-look/SKILL.md` if the loaded copy is
out of date). Every commit runs `kave-hub/brand/tools/brand_check.py --strict`
(git hook and Claude hook), and pushing `main` needs a passed brand review in
`kave-hub/brand/reviews/<this repo>-<VERSION>.md`. A deviation from Material 3
needs Isa's dated decision in `kave-hub/brand/data/look-recap.md`.

Everything else, including the whole design system, lives in the `brand`
plugin of the private `kave-hub` repo. This repo is public: no household data,
names, figures or tokens, ever.

## Never rename
The repo slug (`kave-finance-app`), its GitHub Pages URL and the `CACHE` name
in `service-worker.js` are the deployment's identity.

## Bump `VERSION` on every deploy
In `service-worker.js`. A token change counts. Verify by reading a value only
the new code can produce, not by checking that it deployed.

## `m3/` is generated
The Material 3 kit and tokens, by `brand/tools/sync-household-tokens.py` in
kave-hub (with the icons). Never hand-edit. `styles.css` is layout only and
defines no tokens. The pre-Material `tokens.css` was retired on 06/11/2026.

## Security
XSS is the threat model: the GitHub token sits in localStorage. Every synced
string goes through `escapeHtml`, every URL through `safeUrl`. No `eval`,
`new Function`, `document.write`, `insertAdjacentHTML`. Recompute the CSP hash
after touching `#theme-preload` (command in README).

## Every module goes in `SHELL`
In `service-worker.js`, in the same change.

## `eol=lf`
Pinned in `.gitattributes`; the CSP hash depends on it.

## The bank extracts are the truth
Stash reads and never sets an amount. It writes only what it owns (targets,
from step 4). Nothing is added to the data automatically.

## Check the no-token state
It is a real screen. Test it deliberately.
