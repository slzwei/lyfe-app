/**
 * Re-export all mock data from a single entry point.
 */
export { daysAgo, futureDateStr, hoursAgo, nowIso } from './helpers';

export {
    MOCK_EVENTS,
    MOCK_RS_ACTIVITIES,
    MOCK_RS_ATTENDANCE,
    MOCK_RS_CONFIG,
    MOCK_RS_PAST_ACTIVITIES,
    MOCK_RS_PAST_ATTENDANCE,
    MOCK_USERS,
    PA_MOCK_EVENTS,
} from './events';

export { MOCK_CANDIDATES } from './candidates';

export { MOCK_AGENT_NAME_MAP, MOCK_LEAD_ACTIVITIES, MOCK_LEADS } from './leads';

export { type AssignedManager, MOCK_AGENTS, MOCK_ASSIGNED_MANAGERS, MOCK_MANAGERS } from './team';

export {
    MOCK_ACTIVITIES,
    MOCK_AGENT_STATS,
    MOCK_LEAD_PIPELINE,
    MOCK_MANAGER_ACTIVITIES,
    MOCK_MANAGER_STATS,
    PA_MOCK_CANDIDATE_COUNT,
    PA_MOCK_INTERVIEW_COUNT,
} from './home';
