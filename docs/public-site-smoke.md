# Public-site HTTP smoke check

Development branch: `tcb-navigation-smoke` (extends `tcb-public-site-smoke`). No merge or deployment authorized.

Run `python3 scripts/public_site_smoke.py` from the repository root in a
network-enabled environment. The fixed target is
`https://ankitkashikar.github.io/MyWebsite/`, including the repository path.
It checks thirteen public URLs (including explicit `index.html` and five policy pages), their same-site CSS/JavaScript dependencies, and
`images/tcb_logo.svg`. It rejects redirects, missing pages, unexpected titles,
HTML fallback responses for assets, wrong content types, and network errors.
Third-party assets are excluded. It uses GET requests only and never signs in,
submits orders, changes payments, or calls Supabase. It follows same-site HTML
navigation links within the repository path, bounded to 40 pages, strips
fragments, and rejects links outside the project path or containing queries
that need manual review. External, telephone and email links are not fetched.
Fragment existence and JavaScript-driven navigation are not verified.

`python3 scripts/public_site_smoke_test.py` runs eight offline failure-detection
tests in the initial version; the expanded suite has twelve tests. All twelve passed; `python3 scripts/qa_check.py` also passed with zero
errors and warnings. These results do not establish public-site availability. The first live attempt
from this environment timed out on the homepage and received HTTP 404 for the
six HTML page URLs. This is a failed probe, not proof of a global outage;
verify the Pages URL/deployment and rerun from an independent network.

The workflow `Public Site HTTP Smoke` has read-only repository permissions.
Pull requests run offline tests only. Manual workflow dispatch additionally
checks the currently deployed site; it never deploys the selected branch.
A new workflow may need to exist on the default branch before GitHub exposes
its manual dispatch UI. The script can be run directly without merging it.

A successful HTTP check is availability evidence only. It does not establish
that the development branch is deployed, or replace browser, API, payment,
database migration, or business acceptance.

## 23 September 2026 visibility follow-up

Owner reports changing the repository from private back to public on GitHub
Free. A fresh run of the original seven-page live probe returned HTTP 404 for
all seven pages and the logo (eight failures, exit 1). Availability remains
unverified; inspect Pages publishing source and latest deployment status.
Do not infer a successful restoration from repository visibility alone.
The thirteen-page extension passed offline tests but has not passed live.
