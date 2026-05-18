# 7. Candidate Onboarding UAT

## Goal

Confirm a staff user can create or invite a candidate, the candidate can
complete the web onboarding path, and the candidate can enter the mobile app
with the correct role and manager assignment.

## Tester Setup

- Staff creator account: Admin, Director, Manager, PA, or RO.
- Candidate account: new candidate with real Singapore mobile number.
- Systems needed: Lyfe mobile app and lyfe.sg / ATS candidate portal.
- Do not use: MKTR.

## Preconditions

- At least one active manager exists.
- If testing as PA, the PA has an assigned manager.
- Candidate phone number can receive SMS OTP.
- Candidate phone and email are not already used by another candidate.
- Candidate has time to complete the web profile/onboarding flow.
- If DISC completion is part of the release gate, the candidate has enough
  time to complete the assessment in the same session.

## Test Data

```text
Staff creator role:
Assigned manager:
Candidate full name:
Candidate phone:
Candidate email:
Position or notes, if used:
Environment:
App build:
```

## Steps

Run Method A unless the UAT scope specifically asks for the Invite Member path.

## Method A: Add Candidate

Use this as the primary candidate UAT path because it exercises the recruitment
candidate creation flow.

| Step | Tester Action | Expected Result | Result |
|---|---|---|---|
| 1 | Log in to Lyfe mobile app as Admin, Director, Manager, PA, or RO. | Staff user lands on Home. |  |
| 2 | Open Add Candidate from the relevant candidate area. | Add Candidate form opens. |  |
| 3 | Enter candidate full name. | Name is accepted. |  |
| 4 | Enter candidate phone number. | Phone is accepted. |  |
| 5 | Enter candidate email if available. | Email is accepted. |  |
| 6 | Add notes or resume PDF if the test scenario requires it. | Optional data is accepted. |  |
| 7 | Choose assigned manager. | Manager can default to self for manager, PA can choose assigned manager only, Admin/Director/RO can choose intended manager. |  |
| 8 | Tap Create Candidate. | Success message appears with invite link. |  |
| 9 | Copy or share the invite link. | Invite link is available to send to candidate. |  |
| 10 | Confirm the candidate appears in the staff candidate list. | Candidate appears with invited/applied status. |  |
| 11 | Send the invite link to the candidate. | Candidate receives the link. |  |
| 12 | Candidate opens the invite link on lyfe.sg / ATS. | Candidate login/onboarding page opens. |  |
| 13 | Candidate completes the web profile/onboarding form. | Submission succeeds and the candidate is moved to the next required page. |  |
| 14 | Candidate completes DISC or other required assessment if prompted. | Assessment completes and results page appears, or the step is marked `SKIP` when assessment is outside this UAT run. |  |
| 15 | Candidate opens Lyfe mobile app. | Mobile login screen appears. |  |
| 16 | Candidate enters the same phone number used in the invite. | OTP request is accepted. |  |
| 17 | Candidate enters SMS OTP. | Login succeeds. |  |
| 18 | Candidate completes consent and email verification if shown. | Candidate continues. |  |
| 19 | Candidate completes mobile onboarding screens if shown. | Candidate reaches Onboarding Complete. |  |
| 20 | Candidate lands on Home. | Candidate Home appears. |  |
| 21 | Check candidate tabs. | Home, Roadmap, Events, and Profile are visible. Leads, Team, PA, and Admin are not visible. |  |
| 22 | Staff opens candidate detail again. | Candidate profile/progress is visible to the correct staff users. |  |

## Candidate Web Flow Minimum Checks

When completing Method A step 13, record these minimum checks:

| Check | Expected Result | Result |
|---|---|---|
| Invite link opens without a token error. | Candidate can proceed. |  |
| Required profile fields validate. | Empty required fields show clear errors. |  |
| Completed profile submits. | Candidate reaches assessment, results, or completion page. |  |
| Returning to the link after submission. | Candidate is not asked to redo completed work. |  |

## Method B: Invite Member As Candidate

Use this only if the test scope specifically needs candidate creation through
Invite Member instead of Add Candidate. Open Invite Member from a Home,
Candidates, or PA/RO candidate flow. Do not use Team > Invite Member for this
method because Team invitation is scoped to staff roles.

| Step | Tester Action | Expected Result | Result |
|---|---|---|---|
| 1 | Log in as Admin, Director, Manager, PA, or RO. | Staff user lands on Home. |  |
| 2 | Open Invite Member. | Invite form opens. |  |
| 3 | Enter candidate full name and phone. | Fields accept the data. |  |
| 4 | Select role `Candidate`. | Candidate is selected. |  |
| 5 | Select assigned manager when the app asks for one. | Correct manager is selected. |  |
| 6 | Tap Create Invitation. | Success message appears. |  |
| 7 | Copy/share the invite URL if shown. | Invite URL is available. |  |
| 8 | Continue Method A from step 12. | Candidate completes web and mobile onboarding. |  |

## Verifier Checks

Ask a technical verifier to confirm:

- Candidate record exists.
- Invitation exists and has a token.
- Member invitation mirror exists for valid Singapore phone numbers.
- Candidate user role is `candidate` after login.
- Candidate is active and not marked as test data.
- Candidate is assigned to the intended manager.
- Candidate mobile onboarding is complete after finishing the flow.

## Pass Criteria

- Staff can create or invite the candidate through the selected method.
- Candidate can open the invite link and complete web onboarding.
- Candidate can log in to the mobile app by phone OTP.
- Candidate has candidate-only navigation.
- Candidate is assigned to the correct manager.
- Correct staff users can see candidate progress.

## Fail Or Blocked Examples

- Candidate phone or email already exists.
- Invite link is missing or invalid.
- Candidate uses a different phone number than the invite.
- Candidate cannot complete web onboarding.
- Candidate logs in with a staff role or wrong role.
- Candidate appears under the wrong manager.
- Staff cannot see candidate progress after completion.

## Completion

After this passes, the full role onboarding UAT run is complete.
