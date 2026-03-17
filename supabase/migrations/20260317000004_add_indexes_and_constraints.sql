-- Phase 2: Add missing indexes and CHECK constraints for data integrity

-- ── Indexes ─────────────────────────────────────────────────────

-- candidate_activities: speed up activity timeline queries
CREATE INDEX IF NOT EXISTS idx_candidate_activities_candidate_created
    ON candidate_activities(candidate_id, created_at DESC);

-- notifications: speed up unread notifications badge and list
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
    ON notifications(user_id, is_read, created_at DESC);

-- roadshow_attendance: speed up check-in lookups
CREATE INDEX IF NOT EXISTS idx_roadshow_attendance_event_user
    ON roadshow_attendance(event_id, user_id, checked_in_at);

-- lead_activities: speed up activity timeline queries
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_created
    ON lead_activities(lead_id, created_at DESC);

-- ── CHECK constraints ───────────────────────────────────────────

-- Ensure pass_percentage is between 0 and 100
ALTER TABLE exam_papers
    ADD CONSTRAINT chk_pass_percentage
    CHECK (pass_percentage BETWEEN 0 AND 100);

-- Ensure duration is non-negative
ALTER TABLE exam_attempts
    ADD CONSTRAINT chk_duration_positive
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
