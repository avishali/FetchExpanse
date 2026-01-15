ROLE: VERIFIER
TASK: Verify internal navigation stack behaves like browser navigation

TESTS
1) Organize → ReviewDetail → Back
PASS if Organize restores same filters and scroll.

2) Back → Forward
PASS if ReviewDetail restores same message.

3) Click external link in email body
PASS if:
- System browser opens
- App view unchanged
- Back/Forward still work

4) Rapid navigation
PASS if no state corruption.

DELIVERABLE
VERIFIER_RESULT.md with PASS/FAIL.
STOP.