/**
 * Shared Supabase mock instance — imported by test files, also used
 * by the jest.mock factory in lib/__mocks__/supabase.ts
 */
import { supabase as _supabase } from '../lib/__mocks__/supabase';

export const supabase = _supabase;
