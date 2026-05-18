# Role Onboarding UAT Pack

Use these scripts to run real-user onboarding UAT role by role. Run them in
order because later roles depend on earlier roles existing.

## Before You Start

- Use the agreed UAT environment and app build.
- Use real Singapore mobile numbers that can receive SMS OTP.
- Do not reuse phone numbers or emails from earlier tests.
- Prefix test names with `UAT` and the role, for example `UAT Director Tan`.
- Record each step as `PASS`, `FAIL`, `BLOCKED`, or `SKIP`.
- Capture a screenshot for every `FAIL` or `BLOCKED` result.
- Do not use MKTR for these tests.
- Use Supabase or database checks only when a step explicitly says
  "Verifier Checks". UAT testers can ask a technical verifier to do those.

## Run Order

1. [Admin](./01-admin.md) - confirm or provision the first administrator.
2. [Director](./02-director.md) - invite a director from admin.
3. [Manager](./03-manager.md) - invite a manager from admin or director.
4. [Agent](./04-agent.md) - invite an agent under a manager.
5. [PA](./05-pa.md) - invite a PA and assign them to a manager.
6. [RO](./06-ro.md) - invite a Recruitment Officer.
7. [Candidate](./07-candidate.md) - create or invite a candidate.

## Systems Under Test

- Lyfe mobile app: staff invitation, OTP login, role navigation, candidate creation.
- lyfe.sg / ATS: candidate-facing profile and onboarding flow only.
- Supabase: verifier-only checks for role, status, and assignment.

## How To Use The Tables

- Fill the `Result` column while testing.
- Mark `PASS` only when the expected result is visible to the tester.
- Mark `BLOCKED` when the next step cannot be attempted.
- Mark `FAIL` when the step can be attempted but the result is wrong.
- Add issue links in the result notes, not inside the script.

## Shared Expected Behavior

- The invited phone number and login phone number must match.
- Staff roles should not go through candidate onboarding screens.
- Candidates have the longest flow: invite link or OTP, consent, email
  verification when required, onboarding, then Home.
- Pending invitations should become accepted after the invited person logs in
  successfully.
- Real UAT users should not be marked as test data.
- Team > Invite Member is for staff invitations. Candidate onboarding is tested
  through Add Candidate, or through Invite Member opened from a candidate/Home
  flow when that path is explicitly in scope.

## Result Template

Copy this into your UAT notes for each role:

```text
Role:
Tester:
Environment:
App version/build:
Phone number used:
Date:
Overall result: PASS / FAIL / BLOCKED / SKIP
Issue links:
Notes:
```

## Stop Conditions

Stop the current role test and log a blocker if:

- OTP cannot be delivered to the invited phone.
- Login lands in the wrong role or wrong app area.
- A staff user is sent into candidate onboarding.
- A role can invite or access something explicitly listed as not allowed.
- Candidate records are assigned to the wrong manager.
