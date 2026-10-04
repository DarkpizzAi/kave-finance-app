# Stash - non-negotiables

Everything else, including the whole design system, lives in the `brand`
plugin of the private `kave-hub` repo. This repo is public: no household data,
names, figures or tokens, ever.

## Never rename
The repo slug (`kave-finance-app`), its GitHub Pages URL and the `CACHE` name
in `service-worker.js` are the deployment's identity.

## Bump `VERSION` on every deploy
In `service-worker.js`. A token change counts. Verify by reading a value only
the new code can produce, not by checking that it deployed.

## `tokens.css` is generated
By `brand/tools/sync-household-tokens.py` in kave-hub. Never hand-edit.
`styles.css` uses tokens and defines none.

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
