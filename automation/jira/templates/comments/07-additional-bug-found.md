# Additional bug found

Use this only when the user wants a new, smaller bug found during a retest
kept on the current ticket instead of filed separately. By default, file a
new bug. It is a mini bug report inside a comment. If it reopens the ticket,
add a line tagging the developer, but only if the user asks.

```
**Additional bug found:** <one-line symptom>.

**Steps to Reproduce:**
1. <step>

**Actual Result:**
<what happens>

**Expected Result:**
<what should happen>

Reopening the ticket - @<developer>
CC: @<lead>
```

## Real example (AL-4048, comment 77206)

```
**Additional bug found:** Extra Configuration does not persist a Pause Delay in Days value of 0.

**Steps to Reproduce:**

1. Set the Pause Delay in Days to 1 and save.
2. Reopen the Extra Configuration and confirm it shows 1.
3. Change the Pause Delay in Days to 0 and save.
4. Reopen the Extra Configuration again.

**Actual Result:**
Instead of showing 0, the Pause Delay in Days field shows the last saved value (1), the 0 value was not persisted.

**Expected Result:**
The Pause Delay in Days field should save and display 0 when explicitly set to 0.


Reopening the ticket - @Rudra Chauhan
CC: @Darshan
```

This went right after a retest table comment on the same ticket (77205), and
that comment's Note pointed forward to it: "A separate issue was found with a
Pause Delay in Days value of 0, see the next comment."
