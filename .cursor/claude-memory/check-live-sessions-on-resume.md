---
name: check-live-sessions-on-resume
description: "On \"resume\", check live peer sessions and running processes before proposing which workflow to pick up"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 04dfe407-406f-4c09-80db-7cdebee2acda
  modified: 2026-10-13T09:51:10.551Z
---

When QA says "resume", do not trust RESUME.md's "RUNNING" labels. First run `ListAgents` (peer sessions: name, busy/shell, started) and `ps -eo pid,etime,args | grep -E "playwright test"` (which specs are running), plus `ls -l` of the `*-progress.md` and `reports/*/results.json` timestamps. Then propose a workflow nobody owns, with the evidence, and ask before starting.

**Why:** On 2026-10-13 I read only RESUME.md (saved 15:00) and asked QA which workflow to take. QA asked whether I even check the other active sessions; I had not. Two workflows were live (Link Clicked, Email Opened Phase 2) and a third "resume" session had just started.

**How to apply:** Do the check as the first step of any resume. Show a table: workflow, live or not, evidence. Recommend one unowned workflow. If another session may be picking the same one, message it via SendMessage before starting. See [[resume-pointers]] and [[no-unnecessary-stops]].
