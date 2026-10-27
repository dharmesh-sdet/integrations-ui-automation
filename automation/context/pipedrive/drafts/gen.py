import sys
OUT=sys.argv[1]
common_not_covered = ("Not covered, still open: B1 (Update a Person with no person errors) and B2 (Update a Deal or Delete Deal with no person errors) are already reported. The rows that hit them expect Error. Do not file them again. The `\\\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped and not tested (QA 2026-10-23, date conversion issue seen on HubSpot).")
W = {
 'reply-received': dict(name='Reply is Received in Saleshandy', do='Mark the prospect as replied', subj='Reply is Received in Saleshandy', typ='Email',
   title='First Last', multi=False,
   setup=["Each row uses a new prospect with its own email, for example `yourname+pipedrive-r1@company.com`, added to an active sequence. Step 1 shows Sent before the reply.",
          "\"Mark the prospect as replied\" means Emails tab > the prospect's row > Actions > Mark as Replied (same method as HubSpot and Salesforce).",
          "After the reply: the Prospects tab shows Replied. Wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.",
          "If Saleshandy does not set the prospect to Replied, no event goes to Pipedrive. That is not a workflow failure.",
          "Triggers: every other trigger off, only \"Reply is Received in Saleshandy\" on. For each section, select only the actions named in its heading, then Save."],
   extra_intro="Lead and deal titles are the prospect's First Last name here. The other workflows use the email. Update a Deal sets the title to the email, so it renames a deal made with the name (decided).",
   baseline=[("Reply trigger off, every other trigger off, Create a Person selected","Mark the prospect as replied","Prospects tab shows Replied. No person and no activity from this trigger. No new Logs entry for the prospect")],
   lead_extra=[("Prospect has no first or last name","Person named (No Name). Lead created on it. Lead title not documented, record it (proposed, unconfirmed)")],
   deal_extra=[], upd_deal_extra=[("Person has 1 deal titled with the person's name","Deal title changes to the prospect email. Configured pipeline and stage applied. Still 1 deal")]),
 'link-clicked': dict(name='Link is Clicked in Saleshandy', do='Click the first link in the step 1 email', subj='Link is clicked in Saleshandy', typ='email',
   title='with the prospect email', multi=True,
   setup=["Each row uses a new prospect with its own email, for example `yourname+pipedrive-c1@company.com`, added to an active sequence. Sequence Settings > Safety Settings > Track Link Clicks on. Each email body has 2 links.",
          "\"Click the first link\" means: step 1 shows Sent in the Emails tab, open the prospect's inbox on mailinator.com, open the sequence email and click its first link right away (same method as HubSpot).",
          "After the click: it takes up to 1.5 minutes to register. Refresh Sequences > Emails until the clicked count goes up, then wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.",
          "One real click can give 2 or 3 runs (link scanners and previews click too). That is Saleshandy event behavior, not a workflow bug. Count the runs in Logs first. Creating actions then make one record per run.",
          "Triggers: every other trigger off, only \"Link is Clicked in Saleshandy\" on. For each section, select only the actions named in its heading, then Save."],
   extra_intro="",
   baseline=[("Track Link Clicks off in the sequence, Create a Person selected","Click the first link in the step 1 email","No clicked count, no run in Logs, no person and no activity"),
             ("Create a Person selected, prospect already clicked the first link","Click the second link in the same email","A further run in Logs and one more activity on the same person. Still 1 person (proposed, unconfirmed)")],
   lead_extra=[], deal_extra=[], upd_deal_extra=[]),
 'email-opened': dict(name='Email is Opened in Saleshandy', do='Open the step 1 email', subj='Email Open Recorded in Saleshandy', typ='email',
   title='with the prospect email', multi=True,
   setup=["Each row uses a new prospect with its own email, for example `yourname+pipedrive-o1@company.com`, added to an active sequence. Sequence Settings > Safety Settings > Track email opens on.",
          "\"Open the step 1 email\" means: step 1 shows Sent in the Emails tab, open the prospect's inbox on mailinator.com and open the sequence email with images loaded (same method as HubSpot).",
          "After the open: refresh Sequences > Emails until the Opened count goes up, then wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.",
          "Mail clients that prefetch images can add runs. Count the runs in Logs first. Creating actions then make one record per run (proposed, unconfirmed).",
          "Triggers: every other trigger off, only \"Email is Opened in Saleshandy\" on. For each section, select only the actions named in its heading, then Save."],
   extra_intro="",
   baseline=[("Track email opens off in the sequence, Create a Person selected","Open the step 1 email","No Opened count, no run in Logs, no person and no activity"),
             ("Create a Person selected, prospect already opened the step 1 email once","Open the same email again","Whether a second open registers is not documented. Record the Opened count and Logs, and the activities on the person (proposed, unconfirmed)")],
   lead_extra=[], deal_extra=[], upd_deal_extra=[]),
 'email-bounced': dict(name='Email is Bounced in Saleshandy', do='Mark the step 1 email as bounced', subj='Email is bounced in Saleshandy', typ='email',
   title='with the prospect email', multi=False,
   setup=["Each row uses a new prospect with its own email, for example `yourname+pipedrive-b1@mailinator.com`, added to an active sequence with Add Prospects.",
          "\"Mark the step 1 email as bounced\" means Emails tab > the prospect's row > Actions > Mark as bounced. Send now is not needed (same method as HubSpot). A prospect can be marked as bounced only once.",
          "Real bounce: one row only, to protect the sender account (cap 1, proposed). The prospect email is `name@<company>.mailinator.com`.",
          "After the bounce: wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.",
          "Triggers: every other trigger off, only \"Email is Bounced in Saleshandy\" on. For each section, select only the actions named in its heading, then Save."],
   extra_intro="No bounce-specific rule is documented for Pipedrive: nothing is tagged or flagged on the person besides the activity.",
   baseline=[("Real bounce: new prospect at a `<company>.mailinator.com` address, Create a Person selected","Send the step 1 email and wait for Saleshandy to set Bounced","Person created and one activity, same as a manual bounce (proposed, unconfirmed)")],
   lead_extra=[], deal_extra=[], upd_deal_extra=[]),
 'prospect-unsubscribed': dict(name='Prospect is Unsubscribed in Saleshandy', do='Unsubscribe the prospect (UI)', subj='Prospect is Unsubscribed in Saleshandy', typ='email',
   title='with the prospect email', multi=False,
   setup=["Each row uses a new prospect with its own email, for example `yourname+pipedrive-u1@mailinator.com`, added to an active sequence. Step 1 shows Sent before the unsubscribe.",
          "Before the first row, read the node names in the run log of one run. v2 shows \"Find person's latest deal\" and \"Person - Find a person\". v1 shows \"Find a deal\" and \"Create a person\". A v1 result is a setup gap, not a v2 bug.",
          "\"Unsubscribe the prospect (UI)\" means Prospects tab > tick the prospect > toolbar icon Mark as Unsubscribe (no confirm dialog). \"Unsubscribe by link\" means open the unsubscribe link from the prospect's Mailinator inbox, LINKS tab (same methods as HubSpot).",
          "After the unsubscribe: the Prospects tab shows Unsubscribed. Wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.",
          "Triggers: every other trigger off, only \"Prospect is Unsubscribed in Saleshandy\" on. For each section, select only the actions named in its heading, then Save."],
   extra_intro="No unsubscribe-specific rule is documented for Pipedrive: nothing is tagged or flagged on the person besides the activity.",
   baseline=[("Create a Person selected, new prospect","Unsubscribe the prospect by link","Page says \"You will no longer receive emails from us\". Prospects tab shows Unsubscribed. Person created and one activity (proposed, unconfirmed)"),
             ("Prospect unsubscribed by link","Click \"Subscribe here\" on the unsubscribe page","Prospects tab shows the previous status. No new run and no new activity (proposed, unconfirmed)")],
   lead_extra=[], deal_extra=[], upd_deal_extra=[]),
 'prospect-outcome-updated': dict(name='Prospect Outcome is updated in Saleshandy', do='Change the outcome to Interested', subj='Prospect Outcome is updated in Saleshandy', typ='email',
   title='with the prospect email', multi=False, cat=True,
   setup=["Each row uses a new prospect with its own email, for example `yourname+pipedrive-p1@company.com`, added to an active sequence. Step 1 shows Sent before the outcome changes.",
          "The outcome is changed in Sequence > the sequence > Prospects, with the outcome dropdown on the prospect's row (same method as Salesforce). The outcome list on the Pipedrive category dropdown is read on staging first. Interested, Not Interested and Closed are assumed to exist (as on HubSpot and Salesforce).",
          "After the change: wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.",
          "A category gate runs first. Category equal to the new outcome: the actions run. Category empty: the actions run for every outcome. Any other case: nothing runs, which is expected.",
          "Triggers: every other trigger off, only \"Prospect Outcome is updated in Saleshandy\" on. For each section, select only the actions named in its heading, and set Select Saleshandy Conversation Category = Interested unless the row says otherwise, then Save."],
   extra_intro="\"Meeting Booked\" never matches the category (known Z-7, webui bug). It is not used in any row. Do not file it. Update a Deal in slot 5 does not run today (found offline, unconfirmed). Row 4 expects it to run and is reported as an unconfirmed expectation, not a product bug, until QA confirms it is a bug.",
   baseline=[("Category = Interested, Create a Person selected, new prospect","Change the outcome to Not Interested","Nothing runs: no person and no activity. Record the Logs entry, if any"),
             ("Category left empty, Create a Person selected, new prospect","Change the outcome to Closed","Actions run: person created and one activity, even though the outcome is not Interested"),
             ("Category left empty, prospect already changed to Interested","Change the outcome to Not Interested","A second activity on the same person. Still 1 person"),
             ("Category = Interested, Update a Deal only in slot 5 (slots 1 to 4 empty), person has 1 deal","Change the outcome to Interested","The deal is updated like in any other slot (proposed, unconfirmed)")],
   lead_extra=[], deal_extra=[], upd_deal_extra=[]),
}
def table(rows):
    s="| # | Scenario | Do | Expected | Ticket |\n|---|---|---|---|---|\n"
    for i,(a,b,c) in enumerate(rows,1):
        s+=f"| {i} | {a} | {b} | {c} | None |\n"
    return s
for key,w in W.items():
    do=w['do']; subj=w['subj']; typ=w['typ']; T=w['title']; m=w['multi']
    per = " per run" if m else ""
    each = "One lead on it per run in Logs, titled" if m else "One lead on it, titled"
    L = [("Prospect not in Pipedrive",do,f"Person created, named First Last. {each} {T}. No activity" if m or True else ""),
         ("Prospect already a person in Pipedrive",do,"Person updated, still 1 person. New lead on it")]
    L += [(a,do,b) for a,b in w['lead_extra']]
    D = [("Prospect not in Pipedrive",do,f"Person created. Deal on it titled {T}, in the configured pipeline and stage. No activity. No organization link"),
         ("Person has 1 deal",do,"New deal added. Existing deal unchanged")]
    P = [("Prospect not in Pipedrive",do,f"Person created, 1 person only{' even if the action gives several runs' if m else ''}. Activity{' per run' if m else ''}: type {typ}, done, subject \"{subj}\""),
         ("Person exists",do,"Person updated, still 1 person. A further activity is added")]
    UD = [("Person has 2 deals",do,"Only the newest deal changes: title is the prospect email, configured pipeline and stage, mapped Value. The older deal is unchanged")]
    UD += [(a,do,b) for a,b in w['upd_deal_extra']]
    UD += [("Prospect not in Pipedrive",do,"Run ends in Error (known B2). No person is created")]
    UP = [("Person exists with an old value in a mapped field",do,"Mapped fields updated. 1 activity added"),
          ("Prospect not in Pipedrive",do,"Run ends in Error (known B1). No person is created")]
    DD = [("Person has 2 deals",do,"Only the newest deal is deleted. The older deal stays")]
    DP = [("Person exists",do,"Person is deleted")]
    CO = [("Prospect has a company, no organization with that name",do,"Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal")]
    UO = [("An organization with the exact company name exists with an old mapped value",do,"First exact match updated with the name and mapped fields")]
    DO = [("An organization with the exact company name exists",do,"Organization is deleted. A Pipedrive deprecation warning is information only")]
    CB = [("Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive",do,f"Exactly 1 person with 1 lead, 1 deal and 1 activity" + (" per run" if m else ""))]
    if m:
        CB[0]=(CB[0][0],do,"Exactly 1 person. 1 lead, 1 deal and 1 activity for each run in Logs")
    cfg_pd="Pipeline and Stage as read on staging."
    cat = "Select Saleshandy Conversation Category = Interested" if w.get('cat') else None
    def ec(base):
        parts=[]
        if base and base!="None": parts.append(base)
        if cat: parts.append(cat)
        return ", ".join(parts) if parts else "None"
    def ecs(base):
        e=ec(base)
        return e+"." if not e.endswith(".") else e
    s=f"# {w['name']} (Pipedrive): Regression scenarios\n\n"
    s+=f"Environment: Staging. Version v2. No Jira ticket is given for this workflow, so every Ticket cell is None. Expected results come from the rules document of 2026-10-23 and are not yet confirmed in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. A different result there is not automatically a failure.\n\n"
    s+="Scope: the action rules are the same in all 7 Pipedrive workflows and were covered row by row in Email Sent (letter case, 1 or 2 deals, wrong mapped types). Here each action runs on its main path, plus what is specific to this trigger.\n\n"
    if w['extra_intro']: s+=w['extra_intro']+"\n\n"
    s+=common_not_covered+"\n\n## Test data setup\n\n"
    for x in w['setup']: s+="- "+x+"\n"
    s+="- Records a row needs first (person, deals, organization) are created by hand in Pipedrive.\n- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only, no Expected Close Date. Pipeline and Stage are read on staging before any row asserts them.\n\n"
    s+=f"## Trigger behavior (baseline)\n\n"+table(w['baseline'])+"\n"
    for head,base,rows in [("Create a Lead","None",L),("Create a Deal",cfg_pd,D),("Create a Person","None",P),("Update a Deal",cfg_pd,UD),("Update a Person","None",UP),("Delete Deal","None",DD),("Delete Person","None",DP),("Create Organization","None",CO),("Update Organization","None",UO),("Delete Organization","None",DO),("Combined actions",cfg_pd,CB)]:
        s+=f"## {head}\n\nExtra Configuration: {ecs(base)}\n\n"+table(rows)+"\n"
    open(f"{OUT}/{key}.md","w").write(s.rstrip()+"\n")
    n=s.count("\n| ")-s.count("| # |")
    print(key, "rows:", sum(1 for l in s.splitlines() if l.startswith("| ") and not l.startswith("| #")))
