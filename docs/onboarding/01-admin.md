# 1. Admin Onboarding UAT

## Goal

Confirm the first admin account can log in and can invite the next roles.
Admin must be tested first because every other role depends on it.

## Tester Setup

- Tester role: UAT tester with help from a technical verifier if admin needs
  manual provisioning.
- App/account needed: Lyfe mobile app installed on the admin phone.
- Test phone: real Singapore mobile number for the admin.
- Do not use: ATS, MKTR, or candidate invite links to create the admin.

## Preconditions

- The admin account already exists, or a technical verifier is available to
  provision it.
- The admin phone number can receive SMS OTP.
- The tester knows which environment and app build are under test.

## Test Data

Record before starting:

```text
Admin full name:
Admin phone:
Environment:
App build:
Technical verifier, if used:
```

## Steps

| Step | Tester Action | Expected Result | Result |
|---|---|---|---|
| 1 | Ask the technical verifier to confirm or create the admin account. | Verifier confirms the account exists, is active, has role `admin`, and is not test data. |  |
| 2 | Open Lyfe mobile app on the admin phone. | Login screen appears. |  |
| 3 | Enter the admin phone number and request OTP. | OTP request is accepted. |  |
| 4 | Enter the OTP received by SMS. | Login succeeds. |  |
| 5 | Complete consent screens if shown. | Admin continues into the app. |  |
| 6 | Confirm landing page after login. | Admin lands on Home, not candidate onboarding. |  |
| 7 | Open the main navigation/tabs. | Home, Leads, Team, Events, and Profile are available. |  |
| 8 | Go to Team and open Invite Member. | Invite Member is available. |  |
| 9 | Open the role selector. | Director, Manager, Agent, PA, and RO are available. Candidate is not required in the Team invite flow. |  |
| 10 | Do not submit any invitation in this guide. Return to Home or Team. | No accidental invitation is created. |  |

## Verifier Checks

Ask a technical verifier to confirm:

- Admin role is `admin`.
- Admin is active.
- Admin is not marked as test data.
- Auth metadata contains role `admin` so permissions match after login.

## Pass Criteria

- Admin logs in successfully by phone OTP.
- Admin skips candidate onboarding.
- Admin can access Team and Invite Member.
- Admin can invite Director, Manager, Agent, PA, and RO from Team.
- Candidate creation or invitation is covered in the candidate script.

## Fail Or Blocked Examples

- OTP is not received.
- Admin lands in candidate onboarding.
- Team or Invite Member is missing.
- RO is missing from the admin role selector.
- Technical verifier finds the role is not `admin`.

## Next Script

After this passes, run [2. Director Onboarding UAT](./02-director.md).
