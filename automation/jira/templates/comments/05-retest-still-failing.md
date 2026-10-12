# Retest still failing

Post this on the bug when a retest (usually on Production) still fails. State
what you saw plainly. If the symptom differs from the ticket's Actual Result,
ask the user whether to point that out or just state the new finding.

```
**Retested on <Production | Staging> (<YYYY-MM-DD>):**

Retested this on <environment>. <What was done>, <what happens now>.
```

## Real example (AL-4025, comment 77542)

```
**Retested on Production (2026-09-22):**

Retested this on Production. When the prospect outcome is changed from the sequence in Saleshandy, the workflow does not get triggered, and no logs are being created in Integrations > HubSpot > Logs.
```
