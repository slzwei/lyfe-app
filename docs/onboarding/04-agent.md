# 4. Agent Onboarding UAT

## Goal

Confirm a staff inviter can invite an agent, assign the agent to the correct
manager, and verify the agent lands with agent-level access only.

## Tester Setup

- Inviter account: Admin, Director, or Manager.
- Required existing account: active Manager who will own the agent.
- New user account: Agent.
- App needed: Lyfe mobile app.
- Do not use: ATS or MKTR.

## Preconditions

- Manager onboarding UAT has passed.
- Target manager exists and is active.
- Agent phone number can receive SMS OTP.
- Agent phone number is not already used by another Lyfe user.

## Test Data

```text
Inviter role: Admin / Director / Manager
Target manager:
Agent full name:
Agent phone:
Environment:
App build:
```

## Steps

| Step | Tester Action | Expected Result | Result |
|---|---|---|---|
| 1 | Log in as Admin, Director, or Manager. | Inviter lands on Home. |  |
| 2 | Go to Team. | Team screen opens. |  |
| 3 | Tap Invite Member. | Invite form opens. |  |
| 4 | Enter agent full name and 8-digit Singapore phone number. | Fields accept the data. |  |
| 5 | Select role `Agent`. | Agent is selected. |  |
| 6 | Select the target manager, or choose self when the inviter is the intended manager and the app supports that. | Target manager is selected or correctly defaulted. |  |
| 7 | Tap Create Invitation. | Success message appears. |  |
| 8 | Check Team pending invitations. | Agent invitation appears as pending. |  |
| 9 | Sign out of inviter, or switch to the agent device. | Login screen is ready for agent. |  |
| 10 | Agent enters the same invited phone number. | OTP request is accepted. |  |
| 11 | Agent enters SMS OTP. | Login succeeds. |  |
| 12 | Complete consent screens if shown. | Agent continues into the app. |  |
| 13 | Confirm landing page after login. | Agent lands on Home, not candidate onboarding. |  |
| 14 | Check visible tabs. | Home, Leads, Events, and Profile are visible. Team, Candidates, PA, Admin, and Roadmap are not visible. |  |
| 15 | Open Leads. | Agent can see their lead workspace. |  |
| 16 | Confirm restricted actions. | Agent cannot invite members, create candidates, schedule interviews, or access Team. |  |
| 17 | Log back in as the target manager and open Team. | New agent appears under the target manager. |  |

## Verifier Checks

Ask a technical verifier to confirm:

- Invitation status changed from pending to accepted.
- Agent role is `agent`.
- Agent is active and not marked as test data.
- Agent reports to the intended manager.

## Pass Criteria

- Agent logs in successfully by phone OTP.
- Agent skips candidate onboarding.
- Agent has only agent-level navigation and actions.
- Agent appears under the intended manager.

## Fail Or Blocked Examples

- Manager assignment is missing or wrong.
- Agent lands in candidate onboarding.
- Agent can access Team or candidate-management screens.
- Agent appears as a user but not under the intended manager.

## Next Script

After this passes, run [5. PA Onboarding UAT](./05-pa.md).
