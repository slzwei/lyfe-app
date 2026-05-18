# 3. Manager Onboarding UAT

## Goal

Confirm an admin or director can invite a manager, and the manager can log in
with the correct role and invite permissions.

## Tester Setup

- Inviter account: Admin or Director.
- New user account: Manager.
- App needed: Lyfe mobile app.
- Do not use: ATS or MKTR.

## Preconditions

- Admin onboarding UAT has passed.
- Director onboarding UAT has passed if the director invite path is being tested.
- Manager phone number can receive SMS OTP.
- Manager phone number is not already used by another Lyfe user.

## Test Data

```text
Inviter role: Admin / Director
Inviter name:
Manager full name:
Manager phone:
Environment:
App build:
```

## Steps

| Step | Tester Action | Expected Result | Result |
|---|---|---|---|
| 1 | Log in as Admin or Director. | Inviter lands on Home. |  |
| 2 | Go to Team. | Team screen opens. |  |
| 3 | Tap Invite Member. | Invite form opens. |  |
| 4 | Enter manager full name and 8-digit Singapore phone number. | Fields accept the data. |  |
| 5 | Select role `Manager`. | Manager is selected. |  |
| 6 | Leave manager assignment empty. | No manager assignment is required in the invite form. |  |
| 7 | Tap Create Invitation. | Success message appears. |  |
| 8 | Check Team pending invitations. | Manager invitation appears as pending. |  |
| 9 | Sign out of inviter, or switch to the manager device. | Login screen is ready for manager. |  |
| 10 | Manager enters the same invited phone number. | OTP request is accepted. |  |
| 11 | Manager enters SMS OTP. | Login succeeds. |  |
| 12 | Complete consent screens if shown. | Manager continues into the app. |  |
| 13 | Confirm landing page after login. | Manager lands on Home, not candidate onboarding. |  |
| 14 | Open Team. | Team is available. |  |
| 15 | Open Invite Member and role selector. | Agent and PA are available. Director, RO, Admin, and Candidate are not available in the Team invite flow. |  |
| 16 | Open Profile. | Manager role badge is shown and the view mode control is available. |  |

## Verifier Checks

Ask a technical verifier to confirm:

- Invitation status changed from pending to accepted.
- Manager role is `manager`.
- Manager is active and not marked as test data.
- Any expected reporting relationship is correct for the UAT scenario.

## Pass Criteria

- Admin or Director can create the manager invitation.
- Manager logs in successfully by phone OTP.
- Manager skips candidate onboarding.
- Manager can access Team and Invite Member.
- Manager can invite Agent and PA from Team.
- Candidate creation or invitation is covered in the candidate script.

## Fail Or Blocked Examples

- Manager cannot receive OTP.
- Manager lands in candidate onboarding.
- Manager can invite Director, RO, or Admin.
- Manager cannot access Team.
- Role badge or permissions show the wrong role.

## Next Script

After this passes, run [4. Agent Onboarding UAT](./04-agent.md).
