# Stash

The household money app: each person's targets, goal and where it went, from
aggregate summaries published by the extract pipeline. Phone first, comfortable
on a PC (side nav and two columns from 900px).

**This repo is the static shell only.** No data, no secrets. Summaries live in
the private `DarkpizzAi/kave-hub` repo under `finance/data/summary/`, targets in
`hugo/data/targets.md` and `isa/data/targets.md` (the household's will be
`finance/data/household-targets.md`, not created yet), read with a token pasted
in Settings. Design: `docs/superpowers/specs/2026-10-04-stash-finance-app-design.md`
in kave-hub.

Step 1 (this version): Overview for Hugo. Isa's view and Household show an
honest "no summary yet" until steps 2 and 3. The icons are Compass's for now.

Run locally: `python dev_server.py` then http://localhost:8779/ . Tests:
http://localhost:8779/tests/ and read the `DONE` line.

### Recomputing the script hash

`script-src` carries a sha256 of `#theme-preload`. Edit that script and the
hash stops matching. Recompute with:

    python -c "import re,hashlib,base64;b=re.search(rb'<script id=\"theme-preload\">(.*?)</script>',open('index.html','rb').read(),re.S).group(1);print('sha256-'+base64.b64encode(hashlib.sha256(b).digest()).decode())"
