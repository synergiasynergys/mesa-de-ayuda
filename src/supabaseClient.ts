import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aifgayietjyhjdcoqvlp.supabase.co'; // ← reemplazá con tu Project URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZmdheWlldGp5aGpkY29xdmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODE1NjgsImV4cCI6MjA5NDk1NzU2OH0.MoBkOUgq9_RkyUdWNUSxT24mgKsQ5hkckwPfqAleljw'; // ← reemplazá con tu clave anon

export const supabase = createClient(supabaseUrl, supabaseKey);
