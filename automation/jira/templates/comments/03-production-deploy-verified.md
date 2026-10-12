# Production deploy verified

Post this on each fixed bug after it is retested on Production following a
deploy. Use the exact same text on every ticket in the batch. Afterwards, if
the user asks, move the ticket to Done (see "Release transitions" in
[../../docs/jira-reference.md](../../docs/jira-reference.md)).

```
Verified on production after deploy. Retested the scenario from this ticket and it works as expected.
```

Real uses: AL-4025 (78614), AL-4062 (78638), AL-4064 (78640), AL-4108
(78643), AL-4113 (78648), and the rest of the 14 bugs linked to AL-4012 on
2026-10-07.

If only part of the ticket was retested, or something still differs, don't
use this one-liner. Use a Verification comment that says exactly what was
covered.
