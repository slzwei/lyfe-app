export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: '14.4';
    };
    public: {
        Tables: {
            audit_log: {
                Row: {
                    actor_id: string | null;
                    actor_role: string | null;
                    created_at: string;
                    id: number;
                    new_data: Json | null;
                    old_data: Json | null;
                    operation: string;
                    source: string;
                    table_name: string;
                    tx_id: number;
                };
                Insert: {
                    actor_id?: string | null;
                    actor_role?: string | null;
                    created_at?: string;
                    id?: never;
                    new_data?: Json | null;
                    old_data?: Json | null;
                    operation: string;
                    source?: string;
                    table_name: string;
                    tx_id: number;
                };
                Update: {
                    actor_id?: string | null;
                    actor_role?: string | null;
                    created_at?: string;
                    id?: never;
                    new_data?: Json | null;
                    old_data?: Json | null;
                    operation?: string;
                    source?: string;
                    table_name?: string;
                    tx_id?: number;
                };
                Relationships: [];
            };
            candidate_activities: {
                Row: {
                    candidate_id: string;
                    created_at: string | null;
                    id: string;
                    note: string | null;
                    outcome: string | null;
                    type: string;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    candidate_id: string;
                    created_at?: string | null;
                    id?: string;
                    note?: string | null;
                    outcome?: string | null;
                    type: string;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    candidate_id?: string;
                    created_at?: string | null;
                    id?: string;
                    note?: string | null;
                    outcome?: string | null;
                    type?: string;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'candidate_activities_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'candidates';
                        referencedColumns: ['id'];
                    },
                ];
            };
            candidate_documents: {
                Row: {
                    candidate_id: string;
                    created_at: string | null;
                    file_name: string;
                    file_url: string;
                    id: string;
                    label: string;
                    updated_at: string | null;
                };
                Insert: {
                    candidate_id: string;
                    created_at?: string | null;
                    file_name: string;
                    file_url: string;
                    id?: string;
                    label: string;
                    updated_at?: string | null;
                };
                Update: {
                    candidate_id?: string;
                    created_at?: string | null;
                    file_name?: string;
                    file_url?: string;
                    id?: string;
                    label?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'candidate_documents_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'candidates';
                        referencedColumns: ['id'];
                    },
                ];
            };
            candidate_module_item_progress: {
                Row: {
                    attempt_count: number;
                    candidate_id: string;
                    completed_at: string | null;
                    completed_by: string | null;
                    created_at: string;
                    id: string;
                    module_item_id: string;
                    notes: string | null;
                    score: number | null;
                    status: Database['public']['Enums']['item_progress_status'];
                    updated_at: string;
                };
                Insert: {
                    attempt_count?: number;
                    candidate_id: string;
                    completed_at?: string | null;
                    completed_by?: string | null;
                    created_at?: string;
                    id?: string;
                    module_item_id: string;
                    notes?: string | null;
                    score?: number | null;
                    status?: Database['public']['Enums']['item_progress_status'];
                    updated_at?: string;
                };
                Update: {
                    attempt_count?: number;
                    candidate_id?: string;
                    completed_at?: string | null;
                    completed_by?: string | null;
                    created_at?: string;
                    id?: string;
                    module_item_id?: string;
                    notes?: string | null;
                    score?: number | null;
                    status?: Database['public']['Enums']['item_progress_status'];
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'candidate_module_item_progress_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidate_module_item_progress_completed_by_fkey';
                        columns: ['completed_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidate_module_item_progress_module_item_id_fkey';
                        columns: ['module_item_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_module_items';
                        referencedColumns: ['id'];
                    },
                ];
            };
            candidate_module_progress: {
                Row: {
                    candidate_id: string;
                    completed_at: string | null;
                    completed_by: string | null;
                    created_at: string;
                    id: string;
                    module_id: string;
                    notes: string | null;
                    score: number | null;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    candidate_id: string;
                    completed_at?: string | null;
                    completed_by?: string | null;
                    created_at?: string;
                    id?: string;
                    module_id: string;
                    notes?: string | null;
                    score?: number | null;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    candidate_id?: string;
                    completed_at?: string | null;
                    completed_by?: string | null;
                    created_at?: string;
                    id?: string;
                    module_id?: string;
                    notes?: string | null;
                    score?: number | null;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'candidate_module_progress_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidate_module_progress_completed_by_fkey';
                        columns: ['completed_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidate_module_progress_module_id_fkey';
                        columns: ['module_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_modules';
                        referencedColumns: ['id'];
                    },
                ];
            };
            candidate_profiles: {
                Row: {
                    additional_bankrupt: boolean | null;
                    additional_bankrupt_detail: string | null;
                    additional_convicted: boolean | null;
                    additional_convicted_detail: string | null;
                    additional_dismissed: boolean | null;
                    additional_dismissed_detail: string | null;
                    additional_health: boolean | null;
                    additional_health_detail: string | null;
                    additional_prev_applied: boolean | null;
                    additional_prev_applied_detail: string | null;
                    additional_relatives: boolean | null;
                    additional_relatives_detail: string | null;
                    address_block: string | null;
                    address_postal: string | null;
                    address_street: string | null;
                    address_unit: string | null;
                    alias: string | null;
                    candidate_id: string;
                    chinese_name: string | null;
                    completed: boolean;
                    contact_number: string | null;
                    created_at: string;
                    date_available: string | null;
                    date_of_birth: string | null;
                    declaration_agreed: boolean;
                    declaration_date: string | null;
                    education: Json;
                    email: string | null;
                    emergency_contact: string | null;
                    emergency_name: string | null;
                    emergency_relationship: string | null;
                    employment_history: Json;
                    expected_salary: string | null;
                    full_name: string;
                    gender: string | null;
                    id: string;
                    invitation_id: string | null;
                    languages: Json;
                    marital_status: string | null;
                    nationality: string | null;
                    ns_enlistment_date: string | null;
                    ns_exemption_reason: string | null;
                    ns_ord_date: string | null;
                    ns_service_status: string | null;
                    ns_status: string | null;
                    onboarding_step: number;
                    place_of_birth: string | null;
                    position_applied: string | null;
                    race: string | null;
                    salary_period: string | null;
                    shorthand_wpm: number | null;
                    software_competencies: string | null;
                    typing_wpm: number | null;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    additional_bankrupt?: boolean | null;
                    additional_bankrupt_detail?: string | null;
                    additional_convicted?: boolean | null;
                    additional_convicted_detail?: string | null;
                    additional_dismissed?: boolean | null;
                    additional_dismissed_detail?: string | null;
                    additional_health?: boolean | null;
                    additional_health_detail?: string | null;
                    additional_prev_applied?: boolean | null;
                    additional_prev_applied_detail?: string | null;
                    additional_relatives?: boolean | null;
                    additional_relatives_detail?: string | null;
                    address_block?: string | null;
                    address_postal?: string | null;
                    address_street?: string | null;
                    address_unit?: string | null;
                    alias?: string | null;
                    candidate_id: string;
                    chinese_name?: string | null;
                    completed?: boolean;
                    contact_number?: string | null;
                    created_at?: string;
                    date_available?: string | null;
                    date_of_birth?: string | null;
                    declaration_agreed?: boolean;
                    declaration_date?: string | null;
                    education?: Json;
                    email?: string | null;
                    emergency_contact?: string | null;
                    emergency_name?: string | null;
                    emergency_relationship?: string | null;
                    employment_history?: Json;
                    expected_salary?: string | null;
                    full_name?: string;
                    gender?: string | null;
                    id?: string;
                    invitation_id?: string | null;
                    languages?: Json;
                    marital_status?: string | null;
                    nationality?: string | null;
                    ns_enlistment_date?: string | null;
                    ns_exemption_reason?: string | null;
                    ns_ord_date?: string | null;
                    ns_service_status?: string | null;
                    ns_status?: string | null;
                    onboarding_step?: number;
                    place_of_birth?: string | null;
                    position_applied?: string | null;
                    race?: string | null;
                    salary_period?: string | null;
                    shorthand_wpm?: number | null;
                    software_competencies?: string | null;
                    typing_wpm?: number | null;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    additional_bankrupt?: boolean | null;
                    additional_bankrupt_detail?: string | null;
                    additional_convicted?: boolean | null;
                    additional_convicted_detail?: string | null;
                    additional_dismissed?: boolean | null;
                    additional_dismissed_detail?: string | null;
                    additional_health?: boolean | null;
                    additional_health_detail?: string | null;
                    additional_prev_applied?: boolean | null;
                    additional_prev_applied_detail?: string | null;
                    additional_relatives?: boolean | null;
                    additional_relatives_detail?: string | null;
                    address_block?: string | null;
                    address_postal?: string | null;
                    address_street?: string | null;
                    address_unit?: string | null;
                    alias?: string | null;
                    candidate_id?: string;
                    chinese_name?: string | null;
                    completed?: boolean;
                    contact_number?: string | null;
                    created_at?: string;
                    date_available?: string | null;
                    date_of_birth?: string | null;
                    declaration_agreed?: boolean;
                    declaration_date?: string | null;
                    education?: Json;
                    email?: string | null;
                    emergency_contact?: string | null;
                    emergency_name?: string | null;
                    emergency_relationship?: string | null;
                    employment_history?: Json;
                    expected_salary?: string | null;
                    full_name?: string;
                    gender?: string | null;
                    id?: string;
                    invitation_id?: string | null;
                    languages?: Json;
                    marital_status?: string | null;
                    nationality?: string | null;
                    ns_enlistment_date?: string | null;
                    ns_exemption_reason?: string | null;
                    ns_ord_date?: string | null;
                    ns_service_status?: string | null;
                    ns_status?: string | null;
                    onboarding_step?: number;
                    place_of_birth?: string | null;
                    position_applied?: string | null;
                    race?: string | null;
                    salary_period?: string | null;
                    shorthand_wpm?: number | null;
                    software_competencies?: string | null;
                    typing_wpm?: number | null;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'candidate_profiles_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'candidates';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidate_profiles_invitation_id_fkey';
                        columns: ['invitation_id'];
                        isOneToOne: false;
                        referencedRelation: 'invitations';
                        referencedColumns: ['id'];
                    },
                ];
            };
            candidate_programme_enrollment: {
                Row: {
                    candidate_id: string;
                    completed_at: string | null;
                    created_at: string;
                    id: string;
                    manually_unlocked: boolean;
                    programme_id: string;
                    started_at: string;
                    status: string;
                    unlocked_at: string | null;
                    unlocked_by: string | null;
                };
                Insert: {
                    candidate_id: string;
                    completed_at?: string | null;
                    created_at?: string;
                    id?: string;
                    manually_unlocked?: boolean;
                    programme_id: string;
                    started_at?: string;
                    status?: string;
                    unlocked_at?: string | null;
                    unlocked_by?: string | null;
                };
                Update: {
                    candidate_id?: string;
                    completed_at?: string | null;
                    created_at?: string;
                    id?: string;
                    manually_unlocked?: boolean;
                    programme_id?: string;
                    started_at?: string;
                    status?: string;
                    unlocked_at?: string | null;
                    unlocked_by?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'candidate_programme_enrollment_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'candidates';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidate_programme_enrollment_programme_id_fkey';
                        columns: ['programme_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_programmes';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidate_programme_enrollment_unlocked_by_fkey';
                        columns: ['unlocked_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            candidates: {
                Row: {
                    assigned_manager_id: string;
                    created_at: string | null;
                    created_by_id: string;
                    current_stage_id: string | null;
                    email: string | null;
                    id: string;
                    invite_token: string | null;
                    job_id: string | null;
                    name: string;
                    notes: string | null;
                    phone: string | null;
                    resume_url: string | null;
                    stage_entered_at: string | null;
                    status: Database['public']['Enums']['candidate_status'];
                    updated_at: string | null;
                };
                Insert: {
                    assigned_manager_id: string;
                    created_at?: string | null;
                    created_by_id: string;
                    current_stage_id?: string | null;
                    email?: string | null;
                    id?: string;
                    invite_token?: string | null;
                    job_id?: string | null;
                    name: string;
                    notes?: string | null;
                    phone?: string | null;
                    resume_url?: string | null;
                    stage_entered_at?: string | null;
                    status?: Database['public']['Enums']['candidate_status'];
                    updated_at?: string | null;
                };
                Update: {
                    assigned_manager_id?: string;
                    created_at?: string | null;
                    created_by_id?: string;
                    current_stage_id?: string | null;
                    email?: string | null;
                    id?: string;
                    invite_token?: string | null;
                    job_id?: string | null;
                    name?: string;
                    notes?: string | null;
                    phone?: string | null;
                    resume_url?: string | null;
                    stage_entered_at?: string | null;
                    status?: Database['public']['Enums']['candidate_status'];
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'candidates_assigned_manager_id_fkey';
                        columns: ['assigned_manager_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidates_created_by_id_fkey';
                        columns: ['created_by_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidates_current_stage_id_fkey';
                        columns: ['current_stage_id'];
                        isOneToOne: false;
                        referencedRelation: 'pipeline_stages';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'candidates_job_id_fkey';
                        columns: ['job_id'];
                        isOneToOne: false;
                        referencedRelation: 'jobs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            disc_responses: {
                Row: {
                    created_at: string;
                    id: string;
                    responses: Json;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    responses?: Json;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    responses?: Json;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            disc_results: {
                Row: {
                    angle: number;
                    c_pct: number;
                    c_raw: number;
                    created_at: string;
                    d_pct: number;
                    d_raw: number;
                    disc_type: string;
                    duration_seconds: number | null;
                    i_pct: number;
                    i_raw: number;
                    id: string;
                    results_email: string | null;
                    s_pct: number;
                    s_raw: number;
                    user_id: string;
                };
                Insert: {
                    angle: number;
                    c_pct: number;
                    c_raw: number;
                    created_at?: string;
                    d_pct: number;
                    d_raw: number;
                    disc_type: string;
                    duration_seconds?: number | null;
                    i_pct: number;
                    i_raw: number;
                    id?: string;
                    results_email?: string | null;
                    s_pct: number;
                    s_raw: number;
                    user_id: string;
                };
                Update: {
                    angle?: number;
                    c_pct?: number;
                    c_raw?: number;
                    created_at?: string;
                    d_pct?: number;
                    d_raw?: number;
                    disc_type?: string;
                    duration_seconds?: number | null;
                    i_pct?: number;
                    i_raw?: number;
                    id?: string;
                    results_email?: string | null;
                    s_pct?: number;
                    s_raw?: number;
                    user_id?: string;
                };
                Relationships: [];
            };
            email_otp_codes: {
                Row: {
                    code_hash: string;
                    created_at: string;
                    email: string;
                    expires_at: string;
                    id: string;
                    user_id: string;
                };
                Insert: {
                    code_hash: string;
                    created_at?: string;
                    email: string;
                    expires_at?: string;
                    id?: string;
                    user_id: string;
                };
                Update: {
                    code_hash?: string;
                    created_at?: string;
                    email?: string;
                    expires_at?: string;
                    id?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            event_attendees: {
                Row: {
                    attendee_role: string;
                    created_at: string | null;
                    event_id: string;
                    id: string;
                    user_id: string;
                };
                Insert: {
                    attendee_role?: string;
                    created_at?: string | null;
                    event_id: string;
                    id?: string;
                    user_id: string;
                };
                Update: {
                    attendee_role?: string;
                    created_at?: string | null;
                    event_id?: string;
                    id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'event_attendees_event_id_fkey';
                        columns: ['event_id'];
                        isOneToOne: false;
                        referencedRelation: 'events';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'event_attendees_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            events: {
                Row: {
                    created_at: string | null;
                    created_by: string;
                    description: string | null;
                    end_time: string | null;
                    event_date: string;
                    event_type: Database['public']['Enums']['event_type'];
                    external_attendees: Json;
                    id: string;
                    location: string | null;
                    start_time: string;
                    title: string;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    created_by: string;
                    description?: string | null;
                    end_time?: string | null;
                    event_date: string;
                    event_type?: Database['public']['Enums']['event_type'];
                    external_attendees?: Json;
                    id?: string;
                    location?: string | null;
                    start_time: string;
                    title: string;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    created_by?: string;
                    description?: string | null;
                    end_time?: string | null;
                    event_date?: string;
                    event_type?: Database['public']['Enums']['event_type'];
                    external_attendees?: Json;
                    id?: string;
                    location?: string | null;
                    start_time?: string;
                    title?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'events_created_by_fkey';
                        columns: ['created_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            exam_answers: {
                Row: {
                    answered_at: string | null;
                    attempt_id: string;
                    id: string;
                    is_correct: boolean | null;
                    question_id: string;
                    selected_answer: string | null;
                };
                Insert: {
                    answered_at?: string | null;
                    attempt_id: string;
                    id?: string;
                    is_correct?: boolean | null;
                    question_id: string;
                    selected_answer?: string | null;
                };
                Update: {
                    answered_at?: string | null;
                    attempt_id?: string;
                    id?: string;
                    is_correct?: boolean | null;
                    question_id?: string;
                    selected_answer?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'exam_answers_attempt_id_fkey';
                        columns: ['attempt_id'];
                        isOneToOne: false;
                        referencedRelation: 'exam_attempts';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'exam_answers_question_id_fkey';
                        columns: ['question_id'];
                        isOneToOne: false;
                        referencedRelation: 'exam_questions';
                        referencedColumns: ['id'];
                    },
                ];
            };
            exam_attempts: {
                Row: {
                    created_at: string | null;
                    duration_seconds: number | null;
                    id: string;
                    paper_id: string;
                    passed: boolean | null;
                    percentage: number | null;
                    personality_results: Json | null;
                    score: number | null;
                    started_at: string | null;
                    status: string;
                    submitted_at: string | null;
                    total_questions: number;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    duration_seconds?: number | null;
                    id?: string;
                    paper_id: string;
                    passed?: boolean | null;
                    percentage?: number | null;
                    personality_results?: Json | null;
                    score?: number | null;
                    started_at?: string | null;
                    status?: string;
                    submitted_at?: string | null;
                    total_questions: number;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    duration_seconds?: number | null;
                    id?: string;
                    paper_id?: string;
                    passed?: boolean | null;
                    percentage?: number | null;
                    personality_results?: Json | null;
                    score?: number | null;
                    started_at?: string | null;
                    status?: string;
                    submitted_at?: string | null;
                    total_questions?: number;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'exam_attempts_paper_id_fkey';
                        columns: ['paper_id'];
                        isOneToOne: false;
                        referencedRelation: 'exam_papers';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'exam_attempts_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            exam_papers: {
                Row: {
                    allow_multiple_answers: boolean;
                    code: string;
                    created_at: string | null;
                    description: string | null;
                    display_order: number | null;
                    duration_minutes: number;
                    id: string;
                    is_active: boolean | null;
                    is_mandatory: boolean | null;
                    pass_percentage: number;
                    question_count: number;
                    title: string;
                    updated_at: string | null;
                };
                Insert: {
                    allow_multiple_answers?: boolean;
                    code: string;
                    created_at?: string | null;
                    description?: string | null;
                    display_order?: number | null;
                    duration_minutes?: number;
                    id?: string;
                    is_active?: boolean | null;
                    is_mandatory?: boolean | null;
                    pass_percentage?: number;
                    question_count?: number;
                    title: string;
                    updated_at?: string | null;
                };
                Update: {
                    allow_multiple_answers?: boolean;
                    code?: string;
                    created_at?: string | null;
                    description?: string | null;
                    display_order?: number | null;
                    duration_minutes?: number;
                    id?: string;
                    is_active?: boolean | null;
                    is_mandatory?: boolean | null;
                    pass_percentage?: number;
                    question_count?: number;
                    title?: string;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
            exam_questions: {
                Row: {
                    correct_answer: string;
                    created_at: string | null;
                    explanation: string | null;
                    explanation_has_latex: boolean | null;
                    has_latex: boolean | null;
                    id: string;
                    options: Json;
                    paper_id: string;
                    question_number: number;
                    question_text: string;
                };
                Insert: {
                    correct_answer: string;
                    created_at?: string | null;
                    explanation?: string | null;
                    explanation_has_latex?: boolean | null;
                    has_latex?: boolean | null;
                    id?: string;
                    options: Json;
                    paper_id: string;
                    question_number: number;
                    question_text: string;
                };
                Update: {
                    correct_answer?: string;
                    created_at?: string | null;
                    explanation?: string | null;
                    explanation_has_latex?: boolean | null;
                    has_latex?: boolean | null;
                    id?: string;
                    options?: Json;
                    paper_id?: string;
                    question_number?: number;
                    question_text?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'exam_questions_paper_id_fkey';
                        columns: ['paper_id'];
                        isOneToOne: false;
                        referencedRelation: 'exam_papers';
                        referencedColumns: ['id'];
                    },
                ];
            };
            interviews: {
                Row: {
                    candidate_id: string;
                    confirmed_at: string | null;
                    created_at: string | null;
                    datetime: string;
                    google_calendar_event_id: string | null;
                    id: string;
                    location: string | null;
                    manager_id: string;
                    notes: string | null;
                    recommendation: string | null;
                    round_number: number;
                    scheduled_by_id: string;
                    status: Database['public']['Enums']['interview_status'];
                    type: Database['public']['Enums']['interview_type'];
                    updated_at: string | null;
                    zoom_link: string | null;
                };
                Insert: {
                    candidate_id: string;
                    confirmed_at?: string | null;
                    created_at?: string | null;
                    datetime: string;
                    google_calendar_event_id?: string | null;
                    id?: string;
                    location?: string | null;
                    manager_id: string;
                    notes?: string | null;
                    recommendation?: string | null;
                    round_number?: number;
                    scheduled_by_id: string;
                    status?: Database['public']['Enums']['interview_status'];
                    type?: Database['public']['Enums']['interview_type'];
                    updated_at?: string | null;
                    zoom_link?: string | null;
                };
                Update: {
                    candidate_id?: string;
                    confirmed_at?: string | null;
                    created_at?: string | null;
                    datetime?: string;
                    google_calendar_event_id?: string | null;
                    id?: string;
                    location?: string | null;
                    manager_id?: string;
                    notes?: string | null;
                    recommendation?: string | null;
                    round_number?: number;
                    scheduled_by_id?: string;
                    status?: Database['public']['Enums']['interview_status'];
                    type?: Database['public']['Enums']['interview_type'];
                    updated_at?: string | null;
                    zoom_link?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'interviews_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'candidates';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'interviews_manager_id_fkey';
                        columns: ['manager_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'interviews_scheduled_by_id_fkey';
                        columns: ['scheduled_by_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            invitations: {
                Row: {
                    accepted_at: string | null;
                    archived_at: string | null;
                    assigned_manager_id: string | null;
                    attached_files: Json | null;
                    candidate_name: string | null;
                    candidate_record_id: string | null;
                    created_at: string;
                    disc_pdf_path: string | null;
                    email: string;
                    expires_at: string;
                    id: string;
                    invited_by: string;
                    invited_by_user_id: string | null;
                    job_id: string | null;
                    position_applied: string | null;
                    profile_pdf_path: string | null;
                    status: string;
                    token: string;
                    user_id: string | null;
                };
                Insert: {
                    accepted_at?: string | null;
                    archived_at?: string | null;
                    assigned_manager_id?: string | null;
                    attached_files?: Json | null;
                    candidate_name?: string | null;
                    candidate_record_id?: string | null;
                    created_at?: string;
                    disc_pdf_path?: string | null;
                    email: string;
                    expires_at?: string;
                    id?: string;
                    invited_by: string;
                    invited_by_user_id?: string | null;
                    job_id?: string | null;
                    position_applied?: string | null;
                    profile_pdf_path?: string | null;
                    status?: string;
                    token: string;
                    user_id?: string | null;
                };
                Update: {
                    accepted_at?: string | null;
                    archived_at?: string | null;
                    assigned_manager_id?: string | null;
                    attached_files?: Json | null;
                    candidate_name?: string | null;
                    candidate_record_id?: string | null;
                    created_at?: string;
                    disc_pdf_path?: string | null;
                    email?: string;
                    expires_at?: string;
                    id?: string;
                    invited_by?: string;
                    invited_by_user_id?: string | null;
                    job_id?: string | null;
                    position_applied?: string | null;
                    profile_pdf_path?: string | null;
                    status?: string;
                    token?: string;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'invitations_assigned_manager_id_fkey';
                        columns: ['assigned_manager_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'invitations_candidate_record_id_fkey';
                        columns: ['candidate_record_id'];
                        isOneToOne: false;
                        referencedRelation: 'candidates';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'invitations_invited_by_user_id_fkey';
                        columns: ['invited_by_user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'invitations_job_id_fkey';
                        columns: ['job_id'];
                        isOneToOne: false;
                        referencedRelation: 'jobs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            jobs: {
                Row: {
                    archived_at: string | null;
                    closed_at: string | null;
                    created_at: string | null;
                    created_by: string;
                    department: string | null;
                    description: string | null;
                    id: string;
                    location: string | null;
                    portal: string | null;
                    portal_url: string | null;
                    status: Database['public']['Enums']['job_status'];
                    title: string;
                    updated_at: string | null;
                };
                Insert: {
                    archived_at?: string | null;
                    closed_at?: string | null;
                    created_at?: string | null;
                    created_by: string;
                    department?: string | null;
                    description?: string | null;
                    id?: string;
                    location?: string | null;
                    portal?: string | null;
                    portal_url?: string | null;
                    status?: Database['public']['Enums']['job_status'];
                    title: string;
                    updated_at?: string | null;
                };
                Update: {
                    archived_at?: string | null;
                    closed_at?: string | null;
                    created_at?: string | null;
                    created_by?: string;
                    department?: string | null;
                    description?: string | null;
                    id?: string;
                    location?: string | null;
                    portal?: string | null;
                    portal_url?: string | null;
                    status?: Database['public']['Enums']['job_status'];
                    title?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'jobs_created_by_fkey';
                        columns: ['created_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            lead_activities: {
                Row: {
                    created_at: string | null;
                    description: string | null;
                    id: string;
                    lead_id: string;
                    metadata: Json | null;
                    type: Database['public']['Enums']['lead_activity_type'];
                    user_id: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    description?: string | null;
                    id?: string;
                    lead_id: string;
                    metadata?: Json | null;
                    type: Database['public']['Enums']['lead_activity_type'];
                    user_id?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    description?: string | null;
                    id?: string;
                    lead_id?: string;
                    metadata?: Json | null;
                    type?: Database['public']['Enums']['lead_activity_type'];
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'lead_activities_lead_id_fkey';
                        columns: ['lead_id'];
                        isOneToOne: false;
                        referencedRelation: 'leads';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'lead_activities_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            leads: {
                Row: {
                    assigned_to: string;
                    created_at: string | null;
                    created_by: string;
                    email: string | null;
                    external_id: string | null;
                    full_name: string;
                    id: string;
                    notes: string | null;
                    phone: string | null;
                    product_interest: Database['public']['Enums']['product_interest'] | null;
                    recording_url: string | null;
                    source: Database['public']['Enums']['lead_source'] | null;
                    source_name: string | null;
                    status: Database['public']['Enums']['lead_status'];
                    transcript: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    assigned_to: string;
                    created_at?: string | null;
                    created_by: string;
                    email?: string | null;
                    external_id?: string | null;
                    full_name: string;
                    id?: string;
                    notes?: string | null;
                    phone?: string | null;
                    product_interest?: Database['public']['Enums']['product_interest'] | null;
                    recording_url?: string | null;
                    source?: Database['public']['Enums']['lead_source'] | null;
                    source_name?: string | null;
                    status?: Database['public']['Enums']['lead_status'];
                    transcript?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    assigned_to?: string;
                    created_at?: string | null;
                    created_by?: string;
                    email?: string | null;
                    external_id?: string | null;
                    full_name?: string;
                    id?: string;
                    notes?: string | null;
                    phone?: string | null;
                    product_interest?: Database['public']['Enums']['product_interest'] | null;
                    recording_url?: string | null;
                    source?: Database['public']['Enums']['lead_source'] | null;
                    source_name?: string | null;
                    status?: Database['public']['Enums']['lead_status'];
                    transcript?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'leads_assigned_to_fkey';
                        columns: ['assigned_to'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'leads_created_by_fkey';
                        columns: ['created_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            member_invitations: {
                Row: {
                    accepted_at: string | null;
                    accepted_by_id: string | null;
                    assigned_manager_id: string | null;
                    created_at: string;
                    expires_at: string;
                    full_name: string;
                    id: string;
                    intended_role: Database['public']['Enums']['user_role'];
                    invited_by_id: string;
                    notes: string | null;
                    phone: string;
                    status: string;
                };
                Insert: {
                    accepted_at?: string | null;
                    accepted_by_id?: string | null;
                    assigned_manager_id?: string | null;
                    created_at?: string;
                    expires_at?: string;
                    full_name: string;
                    id?: string;
                    intended_role: Database['public']['Enums']['user_role'];
                    invited_by_id: string;
                    notes?: string | null;
                    phone: string;
                    status?: string;
                };
                Update: {
                    accepted_at?: string | null;
                    accepted_by_id?: string | null;
                    assigned_manager_id?: string | null;
                    created_at?: string;
                    expires_at?: string;
                    full_name?: string;
                    id?: string;
                    intended_role?: Database['public']['Enums']['user_role'];
                    invited_by_id?: string;
                    notes?: string | null;
                    phone?: string;
                    status?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'member_invitations_accepted_by_id_fkey';
                        columns: ['accepted_by_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'member_invitations_assigned_manager_id_fkey';
                        columns: ['assigned_manager_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'member_invitations_invited_by_id_fkey';
                        columns: ['invited_by_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            notifications: {
                Row: {
                    body: string | null;
                    created_at: string | null;
                    data: Json | null;
                    id: string;
                    is_read: boolean;
                    title: string;
                    type: string;
                    user_id: string;
                };
                Insert: {
                    body?: string | null;
                    created_at?: string | null;
                    data?: Json | null;
                    id?: string;
                    is_read?: boolean;
                    title: string;
                    type: string;
                    user_id: string;
                };
                Update: {
                    body?: string | null;
                    created_at?: string | null;
                    data?: Json | null;
                    id?: string;
                    is_read?: boolean;
                    title?: string;
                    type?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'notifications_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            pa_manager_assignments: {
                Row: {
                    assigned_at: string | null;
                    id: string;
                    manager_id: string;
                    pa_id: string;
                };
                Insert: {
                    assigned_at?: string | null;
                    id?: string;
                    manager_id: string;
                    pa_id: string;
                };
                Update: {
                    assigned_at?: string | null;
                    id?: string;
                    manager_id?: string;
                    pa_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'pa_manager_assignments_manager_id_fkey';
                        columns: ['manager_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'pa_manager_assignments_pa_id_fkey';
                        columns: ['pa_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            pipeline_stages: {
                Row: {
                    created_at: string | null;
                    display_order: number;
                    id: string;
                    job_id: string;
                    name: string;
                    stage_type: Database['public']['Enums']['stage_type'];
                };
                Insert: {
                    created_at?: string | null;
                    display_order?: number;
                    id?: string;
                    job_id: string;
                    name: string;
                    stage_type?: Database['public']['Enums']['stage_type'];
                };
                Update: {
                    created_at?: string | null;
                    display_order?: number;
                    id?: string;
                    job_id?: string;
                    name?: string;
                    stage_type?: Database['public']['Enums']['stage_type'];
                };
                Relationships: [
                    {
                        foreignKeyName: 'pipeline_stages_job_id_fkey';
                        columns: ['job_id'];
                        isOneToOne: false;
                        referencedRelation: 'jobs';
                        referencedColumns: ['id'];
                    },
                ];
            };
            progress_signals: {
                Row: {
                    id: number;
                    updated_at: string | null;
                };
                Insert: {
                    id?: number;
                    updated_at?: string | null;
                };
                Update: {
                    id?: number;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
            roadmap_module_items: {
                Row: {
                    archived_at: string | null;
                    created_at: string;
                    description: string | null;
                    display_order: number;
                    exam_paper_id: string | null;
                    icon_name: string | null;
                    id: string;
                    is_active: boolean;
                    is_required: boolean;
                    item_type: Database['public']['Enums']['module_item_type'];
                    module_id: string;
                    pass_percentage: number | null;
                    resource_type: string | null;
                    resource_url: string | null;
                    time_limit_minutes: number | null;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    archived_at?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    exam_paper_id?: string | null;
                    icon_name?: string | null;
                    id?: string;
                    is_active?: boolean;
                    is_required?: boolean;
                    item_type: Database['public']['Enums']['module_item_type'];
                    module_id: string;
                    pass_percentage?: number | null;
                    resource_type?: string | null;
                    resource_url?: string | null;
                    time_limit_minutes?: number | null;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    archived_at?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    exam_paper_id?: string | null;
                    icon_name?: string | null;
                    id?: string;
                    is_active?: boolean;
                    is_required?: boolean;
                    item_type?: Database['public']['Enums']['module_item_type'];
                    module_id?: string;
                    pass_percentage?: number | null;
                    resource_type?: string | null;
                    resource_url?: string | null;
                    time_limit_minutes?: number | null;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadmap_module_items_exam_paper_id_fkey';
                        columns: ['exam_paper_id'];
                        isOneToOne: false;
                        referencedRelation: 'exam_papers';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'roadmap_module_items_module_id_fkey';
                        columns: ['module_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_modules';
                        referencedColumns: ['id'];
                    },
                ];
            };
            roadmap_modules: {
                Row: {
                    archived_at: string | null;
                    archived_by: string | null;
                    created_at: string;
                    description: string | null;
                    display_order: number;
                    estimated_minutes: number | null;
                    exam_paper_id: string | null;
                    icon_color: string | null;
                    icon_name: string | null;
                    id: string;
                    is_active: boolean;
                    is_required: boolean;
                    learning_objectives: string | null;
                    module_type: string;
                    programme_id: string;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    archived_at?: string | null;
                    archived_by?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    estimated_minutes?: number | null;
                    exam_paper_id?: string | null;
                    icon_color?: string | null;
                    icon_name?: string | null;
                    id?: string;
                    is_active?: boolean;
                    is_required?: boolean;
                    learning_objectives?: string | null;
                    module_type?: string;
                    programme_id: string;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    archived_at?: string | null;
                    archived_by?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    estimated_minutes?: number | null;
                    exam_paper_id?: string | null;
                    icon_color?: string | null;
                    icon_name?: string | null;
                    id?: string;
                    is_active?: boolean;
                    is_required?: boolean;
                    learning_objectives?: string | null;
                    module_type?: string;
                    programme_id?: string;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadmap_modules_archived_by_fkey';
                        columns: ['archived_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'roadmap_modules_exam_paper_id_fkey';
                        columns: ['exam_paper_id'];
                        isOneToOne: false;
                        referencedRelation: 'exam_papers';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'roadmap_modules_programme_id_fkey';
                        columns: ['programme_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_programmes';
                        referencedColumns: ['id'];
                    },
                ];
            };
            roadmap_prerequisites: {
                Row: {
                    created_at: string;
                    id: string;
                    module_id: string;
                    required_module_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    module_id: string;
                    required_module_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    module_id?: string;
                    required_module_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadmap_prerequisites_module_id_fkey';
                        columns: ['module_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_modules';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'roadmap_prerequisites_required_module_id_fkey';
                        columns: ['required_module_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_modules';
                        referencedColumns: ['id'];
                    },
                ];
            };
            roadmap_programmes: {
                Row: {
                    archived_at: string | null;
                    archived_by: string | null;
                    created_at: string;
                    description: string | null;
                    display_order: number;
                    icon_type: string;
                    id: string;
                    is_active: boolean;
                    slug: string;
                    title: string;
                    updated_at: string;
                };
                Insert: {
                    archived_at?: string | null;
                    archived_by?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    icon_type?: string;
                    id?: string;
                    is_active?: boolean;
                    slug: string;
                    title: string;
                    updated_at?: string;
                };
                Update: {
                    archived_at?: string | null;
                    archived_by?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    icon_type?: string;
                    id?: string;
                    is_active?: boolean;
                    slug?: string;
                    title?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadmap_programmes_archived_by_fkey';
                        columns: ['archived_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            roadmap_resources: {
                Row: {
                    content_text: string | null;
                    content_url: string | null;
                    created_at: string;
                    description: string | null;
                    display_order: number;
                    id: string;
                    is_active: boolean;
                    module_id: string;
                    resource_type: string;
                    title: string;
                };
                Insert: {
                    content_text?: string | null;
                    content_url?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    id?: string;
                    is_active?: boolean;
                    module_id: string;
                    resource_type: string;
                    title: string;
                };
                Update: {
                    content_text?: string | null;
                    content_url?: string | null;
                    created_at?: string;
                    description?: string | null;
                    display_order?: number;
                    id?: string;
                    is_active?: boolean;
                    module_id?: string;
                    resource_type?: string;
                    title?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadmap_resources_module_id_fkey';
                        columns: ['module_id'];
                        isOneToOne: false;
                        referencedRelation: 'roadmap_modules';
                        referencedColumns: ['id'];
                    },
                ];
            };
            roadshow_activities: {
                Row: {
                    afyc_amount: number | null;
                    created_at: string | null;
                    event_id: string;
                    id: string;
                    logged_at: string;
                    type: Database['public']['Enums']['roadshow_activity_type'];
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    afyc_amount?: number | null;
                    created_at?: string | null;
                    event_id: string;
                    id?: string;
                    logged_at?: string;
                    type: Database['public']['Enums']['roadshow_activity_type'];
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    afyc_amount?: number | null;
                    created_at?: string | null;
                    event_id?: string;
                    id?: string;
                    logged_at?: string;
                    type?: Database['public']['Enums']['roadshow_activity_type'];
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadshow_activities_event_id_fkey';
                        columns: ['event_id'];
                        isOneToOne: false;
                        referencedRelation: 'events';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'roadshow_activities_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            roadshow_attendance: {
                Row: {
                    checked_in_at: string;
                    checked_in_by: string | null;
                    created_at: string | null;
                    event_id: string;
                    id: string;
                    late_reason: string | null;
                    pledged_afyc: number;
                    pledged_closed: number;
                    pledged_pitches: number;
                    pledged_sitdowns: number;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    checked_in_at?: string;
                    checked_in_by?: string | null;
                    created_at?: string | null;
                    event_id: string;
                    id?: string;
                    late_reason?: string | null;
                    pledged_afyc?: number;
                    pledged_closed?: number;
                    pledged_pitches?: number;
                    pledged_sitdowns?: number;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    checked_in_at?: string;
                    checked_in_by?: string | null;
                    created_at?: string | null;
                    event_id?: string;
                    id?: string;
                    late_reason?: string | null;
                    pledged_afyc?: number;
                    pledged_closed?: number;
                    pledged_pitches?: number;
                    pledged_sitdowns?: number;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadshow_attendance_checked_in_by_fkey';
                        columns: ['checked_in_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'roadshow_attendance_event_id_fkey';
                        columns: ['event_id'];
                        isOneToOne: false;
                        referencedRelation: 'events';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'roadshow_attendance_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
            roadshow_configs: {
                Row: {
                    created_at: string | null;
                    event_id: string;
                    expected_start_time: string;
                    id: string;
                    late_grace_minutes: number;
                    slots_per_day: number;
                    suggested_closed: number;
                    suggested_pitches: number;
                    suggested_sitdowns: number;
                    updated_at: string | null;
                    weekly_cost: number;
                };
                Insert: {
                    created_at?: string | null;
                    event_id: string;
                    expected_start_time: string;
                    id?: string;
                    late_grace_minutes?: number;
                    slots_per_day?: number;
                    suggested_closed?: number;
                    suggested_pitches?: number;
                    suggested_sitdowns?: number;
                    updated_at?: string | null;
                    weekly_cost: number;
                };
                Update: {
                    created_at?: string | null;
                    event_id?: string;
                    expected_start_time?: string;
                    id?: string;
                    late_grace_minutes?: number;
                    slots_per_day?: number;
                    suggested_closed?: number;
                    suggested_pitches?: number;
                    suggested_sitdowns?: number;
                    updated_at?: string | null;
                    weekly_cost?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'roadshow_configs_event_id_fkey';
                        columns: ['event_id'];
                        isOneToOne: true;
                        referencedRelation: 'events';
                        referencedColumns: ['id'];
                    },
                ];
            };
            stage_transitions: {
                Row: {
                    candidate_id: string;
                    created_at: string | null;
                    from_stage_id: string | null;
                    id: string;
                    job_id: string;
                    moved_by: string;
                    note: string | null;
                    to_stage_id: string;
                };
                Insert: {
                    candidate_id: string;
                    created_at?: string | null;
                    from_stage_id?: string | null;
                    id?: string;
                    job_id: string;
                    moved_by: string;
                    note?: string | null;
                    to_stage_id: string;
                };
                Update: {
                    candidate_id?: string;
                    created_at?: string | null;
                    from_stage_id?: string | null;
                    id?: string;
                    job_id?: string;
                    moved_by?: string;
                    note?: string | null;
                    to_stage_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'stage_transitions_candidate_id_fkey';
                        columns: ['candidate_id'];
                        isOneToOne: false;
                        referencedRelation: 'candidates';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'stage_transitions_from_stage_id_fkey';
                        columns: ['from_stage_id'];
                        isOneToOne: false;
                        referencedRelation: 'pipeline_stages';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'stage_transitions_job_id_fkey';
                        columns: ['job_id'];
                        isOneToOne: false;
                        referencedRelation: 'jobs';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'stage_transitions_moved_by_fkey';
                        columns: ['moved_by'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'stage_transitions_to_stage_id_fkey';
                        columns: ['to_stage_id'];
                        isOneToOne: false;
                        referencedRelation: 'pipeline_stages';
                        referencedColumns: ['id'];
                    },
                ];
            };
            users: {
                Row: {
                    avatar_url: string | null;
                    created_at: string | null;
                    date_of_birth: string | null;
                    email: string | null;
                    email_verified: boolean | null;
                    external_id: string | null;
                    full_name: string;
                    id: string;
                    is_active: boolean | null;
                    last_login_at: string | null;
                    lifecycle_stage: Database['public']['Enums']['lifecycle_stage'] | null;
                    notification_preferences: Json | null;
                    onboarding_complete: boolean | null;
                    phone: string | null;
                    push_token: string | null;
                    reports_to: string | null;
                    role: Database['public']['Enums']['user_role'];
                    updated_at: string | null;
                };
                Insert: {
                    avatar_url?: string | null;
                    created_at?: string | null;
                    date_of_birth?: string | null;
                    email?: string | null;
                    email_verified?: boolean | null;
                    external_id?: string | null;
                    full_name: string;
                    id: string;
                    is_active?: boolean | null;
                    last_login_at?: string | null;
                    lifecycle_stage?: Database['public']['Enums']['lifecycle_stage'] | null;
                    notification_preferences?: Json | null;
                    onboarding_complete?: boolean | null;
                    phone?: string | null;
                    push_token?: string | null;
                    reports_to?: string | null;
                    role?: Database['public']['Enums']['user_role'];
                    updated_at?: string | null;
                };
                Update: {
                    avatar_url?: string | null;
                    created_at?: string | null;
                    date_of_birth?: string | null;
                    email?: string | null;
                    email_verified?: boolean | null;
                    external_id?: string | null;
                    full_name?: string;
                    id?: string;
                    is_active?: boolean | null;
                    last_login_at?: string | null;
                    lifecycle_stage?: Database['public']['Enums']['lifecycle_stage'] | null;
                    notification_preferences?: Json | null;
                    onboarding_complete?: boolean | null;
                    phone?: string | null;
                    push_token?: string | null;
                    reports_to?: string | null;
                    role?: Database['public']['Enums']['user_role'];
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'users_reports_to_fkey';
                        columns: ['reports_to'];
                        isOneToOne: false;
                        referencedRelation: 'users';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            append_invitation_file: {
                Args: { p_file: Json; p_invitation_id: string; p_max_files?: number };
                Returns: Json;
            };
            assign_lead_with_activity: {
                Args: {
                    p_acting_user_id: string;
                    p_agent_id: string;
                    p_lead_id: string;
                };
                Returns: Json;
            };
            auth_user_role: {
                Args: never;
                Returns: Database['public']['Enums']['user_role'];
            };
            can_access_candidate: {
                Args: { cand_created_by: string; cand_manager_id: string };
                Returns: boolean;
            };
            can_access_candidate_user: {
                Args: { p_candidate_id: string };
                Returns: boolean;
            };
            can_access_lead: {
                Args: { lead_assigned_to: string; lead_created_by: string };
                Returns: boolean;
            };
            can_manage_event: { Args: { p_created_by: string }; Returns: boolean };
            check_phone_eligible: { Args: { phone_input: string }; Returns: Json };
            cleanup_old_notifications: { Args: never; Returns: number };
            cleanup_orphaned_users: { Args: never; Returns: number };
            create_default_pipeline: {
                Args: { p_job_id: string };
                Returns: undefined;
            };
            create_lead_with_activity: {
                Args: {
                    p_email: string;
                    p_full_name: string;
                    p_notes: string;
                    p_phone: string;
                    p_product_interest: string;
                    p_source: string;
                    p_user_id: string;
                };
                Returns: Json;
            };
            create_roadshow_bulk: {
                Args: {
                    p_attendees: Json;
                    p_config: Json;
                    p_created_by: string;
                    p_events: Json;
                };
                Returns: Json;
            };
            delete_candidate: {
                Args: { p_invitation_id: string };
                Returns: undefined;
            };
            get_exam_questions: {
                Args: { p_paper_id: string };
                Returns: {
                    correct_answer: string;
                    created_at: string | null;
                    explanation: string | null;
                    explanation_has_latex: boolean | null;
                    has_latex: boolean | null;
                    id: string;
                    options: Json;
                    paper_id: string;
                    question_number: number;
                    question_text: string;
                }[];
                SetofOptions: {
                    from: '*';
                    to: 'exam_questions';
                    isOneToOne: false;
                    isSetofReturn: true;
                };
            };
            get_lead_pipeline_stats:
                | {
                      Args: { p_user_id: string };
                      Returns: {
                          count: number;
                          status: string;
                      }[];
                  }
                | { Args: { p_is_manager: boolean; p_user_id: string }; Returns: Json };
            get_team_member_ids: { Args: { superior_id: string }; Returns: string[] };
            normalize_sg_phone: { Args: { raw_phone: string }; Returns: string };
            notify_insert: {
                Args: {
                    p_body: string;
                    p_data?: Json;
                    p_title: string;
                    p_type: string;
                    p_user_id: string;
                };
                Returns: undefined;
            };
            redact_audit_data: {
                Args: { p_data: Json; p_table: string };
                Returns: Json;
            };
            show_limit: { Args: never; Returns: number };
            show_trgm: { Args: { '': string }; Returns: string[] };
            submit_exam_attempt:
                | {
                      Args: {
                          p_answers?: Json;
                          p_duration_seconds: number;
                          p_paper_id: string;
                          p_passed: boolean;
                          p_percentage: number;
                          p_personality_results?: Json;
                          p_score: number;
                          p_started_at: string;
                          p_status: string;
                          p_submitted_at: string;
                          p_total_questions: number;
                          p_user_id: string;
                      };
                      Returns: Json;
                  }
                | {
                      Args: {
                          p_answers?: Json;
                          p_duration_seconds: number;
                          p_paper_id: string;
                          p_personality_results?: Json;
                          p_started_at: string;
                          p_status: string;
                          p_submitted_at: string;
                          p_total_questions: number;
                          p_user_id: string;
                      };
                      Returns: Json;
                  };
            sync_auth_metadata: { Args: never; Returns: undefined };
            update_lead_status_with_activity: {
                Args: {
                    p_lead_id: string;
                    p_new_status: string;
                    p_old_status: string;
                    p_user_id: string;
                };
                Returns: Json;
            };
        };
        Enums: {
            candidate_status:
                | 'applied'
                | 'interview_scheduled'
                | 'interviewed'
                | 'approved'
                | 'exam_prep'
                | 'licensed'
                | 'active_agent';
            event_type: 'team_meeting' | 'training' | 'agency_event' | 'roadshow' | 'other' | 'exam';
            interview_status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
            interview_type: 'zoom' | 'in_person';
            item_progress_status: 'not_started' | 'in_progress' | 'completed';
            job_status: 'draft' | 'open' | 'paused' | 'closed' | 'archived';
            lead_activity_type:
                | 'created'
                | 'note'
                | 'call'
                | 'status_change'
                | 'reassignment'
                | 'email'
                | 'meeting'
                | 'follow_up'
                | 'whatsapp';
            lead_source: 'referral' | 'walk_in' | 'online' | 'event' | 'cold_call' | 'other';
            lead_status: 'new' | 'contacted' | 'qualified' | 'proposed' | 'won' | 'lost';
            lifecycle_stage:
                | 'applied'
                | 'interview_scheduled'
                | 'interviewed'
                | 'approved'
                | 'exam_prep'
                | 'licensed'
                | 'active_agent';
            module_item_type: 'material' | 'pre_quiz' | 'quiz' | 'exam' | 'attendance';
            product_interest: 'life' | 'health' | 'ilp' | 'general';
            roadshow_activity_type: 'sitdown' | 'pitch' | 'case_closed' | 'check_in' | 'departure';
            stage_type: 'sourced' | 'screening' | 'assessment' | 'interview' | 'offer' | 'hired' | 'custom';
            user_role: 'admin' | 'director' | 'manager' | 'agent' | 'pa' | 'candidate';
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    public: {
        Enums: {
            candidate_status: [
                'applied',
                'interview_scheduled',
                'interviewed',
                'approved',
                'exam_prep',
                'licensed',
                'active_agent',
            ],
            event_type: ['team_meeting', 'training', 'agency_event', 'roadshow', 'other', 'exam'],
            interview_status: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
            interview_type: ['zoom', 'in_person'],
            item_progress_status: ['not_started', 'in_progress', 'completed'],
            job_status: ['draft', 'open', 'paused', 'closed', 'archived'],
            lead_activity_type: [
                'created',
                'note',
                'call',
                'status_change',
                'reassignment',
                'email',
                'meeting',
                'follow_up',
                'whatsapp',
            ],
            lead_source: ['referral', 'walk_in', 'online', 'event', 'cold_call', 'other'],
            lead_status: ['new', 'contacted', 'qualified', 'proposed', 'won', 'lost'],
            lifecycle_stage: [
                'applied',
                'interview_scheduled',
                'interviewed',
                'approved',
                'exam_prep',
                'licensed',
                'active_agent',
            ],
            module_item_type: ['material', 'pre_quiz', 'quiz', 'exam', 'attendance'],
            product_interest: ['life', 'health', 'ilp', 'general'],
            roadshow_activity_type: ['sitdown', 'pitch', 'case_closed', 'check_in', 'departure'],
            stage_type: ['sourced', 'screening', 'assessment', 'interview', 'offer', 'hired', 'custom'],
            user_role: ['admin', 'director', 'manager', 'agent', 'pa', 'candidate'],
        },
    },
} as const;
