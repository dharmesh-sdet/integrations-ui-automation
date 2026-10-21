# Salesforce Opportunities: what the tester sees

Notes from a hands-on exploration of the Salesforce test org, 2026-10-16.
All facts are `[staging, 2026-10-16]` unless tagged otherwise.

## What is an Opportunity?

An Opportunity in Salesforce is the equivalent of a Deal in HubSpot. It
represents a potential sale or revenue event tied to an Account.

## New Opportunity form

Required fields:
- **Opportunity Name** (free text)
- **Close Date** (date picker, typically a future date)
- **Stage** (dropdown picklist)

Stage values seen in the test org:
- Prospecting
- Qualification
- Needs Analysis
- Value Proposition
- Id. Decision Makers
- Perception Analysis
- Proposal/Price Quote
- Negotiation/Review
- Closed Won
- Closed Lost

(These are the standard Salesforce Stage values. The test org may have
additional custom values; confirm during test data setup.)

## After creation

A success message appears. It does not auto-close; the user must click the
cross (X) to dismiss it.

**Open question:** Does the success message auto-close after a timeout? Not
confirmed yet. Needs a timed check.

## What matters for the Saleshandy integration

- "Create an Opportunity" activities need Stage and Close Date in the extra
  settings. If these are missing, Save should be blocked.
- Stage values must match what exists in the org's picklist. A value not in
  the picklist will fail on API create.
- When building test data, use the Stage values listed above.
