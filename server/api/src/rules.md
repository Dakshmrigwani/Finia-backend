#	Rule
1	One source of truth: every number on screen comes from the Transaction table. No hardcoded values in the UI.
2	Amounts are stored positive. direction (IN/OUT) says income or expense.
3	importFingerprint = hash of userId + date + amount + raw description. Same hash means skip the row.
4	title = cleaned merchant name. description = raw bank text.
5	Transfers between own accounts are excluded from spend. Refunds reduce expense.
6	Date ranges anchor to the user's latest transaction date, not today.
7	Currency comes from the user profile or the statement. Never hardcode ₹ or $.
8	Every insight has a minimum-data check. Fail means hide the card.
9	Math is deterministic code. AI only rewords the result, if used at all.
10	The demo user goes through the same import pipeline as real users.

server\api\src\src

add in user when user save data like motive , income , goal then its already onboarded true defined in this for now