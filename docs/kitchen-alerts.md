# Kitchen order alerts

Development only; no deployment or migration required. Extends existing Order Console alerts, not a new notification service.

- Authorized server response counts all new, unacknowledged normal/bulk orders independently of the recent-order display limit.
- Banner shows channel counts and oldest elapsed waiting time; highlights waiting five minutes or longer. This is an attention threshold, not a promised acceptance SLA.
- Show New Orders clears search and loads the oldest unacknowledged orders first (up to 150). Process them to reveal later waiting orders. Other list statistics reflect the loaded orders, not global lifetime counts.
- Visible banner/tab-title works without sound. Sound requires Enable Sound each session; successful Web Audio activation is required before displaying Sound On. Repeats every 12 seconds while attention is needed and the last server check is successful.
- Five-second polling, a 15-second request timeout, reconnect/focus refresh, offline/error message and timer cleanup. Alerts stop repeating on failed checks; failure must never be interpreted as zero waiting orders.
- Sign-out clears orders, title and timers; in-flight responses cannot restore them. Accept/reject remains the existing authoritative workflow. Alerts never confirm payment or accept orders automatically.
- These are browser-page alerts: not push, SMS, email or WhatsApp. They require an open, connected console and awake device. Background browser throttling can delay checks/sound. Multiple open consoles may each sound. Keep one designated kitchen console active.
- Counts and order retrieval use separate queries; simultaneous changes can briefly differ until the next successful poll. Server rejects the full request if alert-count queries fail.

Verification: 10 API/DOM tests passed, using mocked database query results/audio. They cover auth denial, exact-count behavior beyond recent limits, oldest-attention filtering, failed count queries, timing, explicit sound, connection failure and stale responses after logout. They do not prove actual sound audibility, browser permissions or PostgREST integration.

## Local acceptance

Extract the update into the existing QA project. Stop the Edge Functions terminal using Ctrl+C and restart it:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/start_local_delivery_qa.sh
```

Leave that terminal running. In another Git Bash terminal:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_local_delivery_acceptance.sh
echo "Exit code: $?"
```

Expected: 38 checkout and 85 operations/admin checks, exit 0. Four added browser tests verify the two-channel alert response and explicit sound controls for normal/bulk at 390/1280 widths. Also listen on the actual kitchen device with its volume enabled; automated checks cannot establish speaker audibility.

Next: after this acceptance, agree the customer-notification channel and event scope under P15. Menu, images, prices and payments remain on hold.
