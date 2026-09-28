"""Local pre-release guard. Run before requesting any production approval."""
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
blocked = [name for name in ("menu.html", "bulk-order.html")
           if "yourbusiness@upi" in (root / name).read_text()]
if blocked:
    print("RELEASE BLOCKED: remind Ankit to replace the UPI placeholder with verified business details.")
    print("Affected pages: " + ", ".join(blocked))
    print("Verify the recipient, amount and pending-payment flow before requesting production approval.")
    sys.exit(1)
print("UPI placeholder check passed. Full release review and explicit production approval are still required.")
