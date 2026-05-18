# 2. Director Onboarding UAT

## Goal

Confirm an admin can invite a director, and the director can log in with the
correct role and permissions.

## Tester Setup

- Inviter account: Admin from script 1.
- New user account: Director.
- App needed: Lyfe mobile app on both inviter and director devices, or one
  test device that can switch accounts.
- Do not use: ATS or MKTR.

## Preconditions

- Admin onboarding UAT has passed.
- The director phone number can receive SMS OTP.
- The director phone number is not already used by another Lyfe user.

## Test Data

```text
Admin tester:
Director full name:
Director phone:
Environment:
App build:
```

## Steps

| Step | Tester Action | Expected Result | Result |
|---|---|---|---|
| 1 | Log in to Lyfe mobile app as Admin. | Admin lands on Home. |  |
| 2 | Go to Team. | Team screen opens. |  |
| 3 | Tap Invite Member. | Invite form opens. |  |
| 4 | Enter the director full name and 8-digit Singapore phone number. | Fields accept the data. |  |
| 5 | Select role `Director`. | Director is selected. |  |
| 6 | Leave manager assignment empty. | No manager is required for director. |  |
| 7 | Tap Create Invitation. | Success message appears. |  |
| 8 | Check Team pending invitations. | Director invitation appears as pending. |  |
| 9 | Sign out of admin, or switch to the director device. | Login screen is ready for director. |  |
| 10 | Director enters the same phone number used in the invitation. | OTP request is accepted. |  |
| 11 | Director enters SMS OTP. | Login succeeds. |  |
| 12 | Complete consent screens if shown. | Director continues into the app. |  |
| 13 | Confirm landing page after login. | Director lands on Home, not candidate onboarding. |  |
| 14 | Open Team. | Team is available to director. |  |
| 15 | Open Invite Member and role selector. | Manager, Agent, PA, and RO are available. Admin is not available. Candidate is not required in the Team invite flow. |  |

## Verifier Checks

Ask a technical verifier to confirm:

- The invitation status changed from pending to accepted.
- Director role is `director`.
- Director is active and not marked as test data.

## Pass Criteria

- Admin can create the director invitation.
- Director logs in successfully by phone OTP.
- Director skips candidate onboarding.
- Director can access Team and Invite Member.
- Director can invite Manager, Agent, PA, and RO from Team.
- Candidate creation or invitation is covered in the candidate script.

## Fail Or Blocked Examples

- Invite submission fails for an admin.
- Director cannot receive OTP.
- Director lands in candidate onboarding.
- Director can invite Admin.
- RO is missing from the director role selector.

## Next Script

After this passes, run [3. Manager Onboarding UAT](./03-manager.md).
