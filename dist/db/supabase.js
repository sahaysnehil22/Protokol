import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
let supabaseClient = null;
export function isSupabaseConfigured() {
    return Boolean(config.supabaseUrl && config.supabaseKey);
}
export function getSupabaseClient() {
    if (!isSupabaseConfigured()) {
        return null;
    }
    if (!supabaseClient) {
        supabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
    }
    return supabaseClient;
}
