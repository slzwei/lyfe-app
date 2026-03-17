/**
 * Leads service — barrel re-export from sub-modules.
 *
 * Sub-modules:
 *   crud.ts       — Lead CRUD, assign, team agents
 *   activities.ts — Activity logging, notes, reassignment
 *   stats.ts      — Pipeline stats, dashboard aggregations
 */
export {
    CreateLeadInput,
    fetchLeads,
    fetchLead,
    createLead,
    updateLeadStatus,
    fetchTeamAgents,
    assignLead,
} from './crud';
export { fetchLeadActivities, addLeadNote, addLeadActivity, reassignLead } from './activities';
export {
    LeadPipelineStats,
    ManagerDashboardStats,
    fetchLeadStats,
    fetchRecentActivities,
    getTeamLeadSummary,
    fetchManagerDashboardStats,
} from './stats';
