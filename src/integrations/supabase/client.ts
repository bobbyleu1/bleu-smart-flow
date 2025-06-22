
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eezaljhphekuchbqgkth.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlemFsamhwaGVrdWNoYnFna3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NzkzMzcsImV4cCI6MjA2NjE1NTMzN30.peBGG3l6fEX3FSgo5yXJABBUrOx61pDc9ur0XDMmMB4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
