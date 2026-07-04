// ==========================================
// CONFIG.JS - KONEKSI SUPABASE (PERBAIKAN TOTAL)
// ==========================================

const SUPABASE_URL = "https://nualhjpicwjauqitwswy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YWxoanBpY3dqYXVxaXR3c3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzgzMTQsImV4cCI6MjA5NjA1NDMxNH0.7iEwsOYrLMR9gQgEcjr7y4cD93hpDccOx7kBWQHZtzo";

let supabaseClient;

try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Supabase CDN gagal dimuat. Pastikan Anda terhubung ke internet.");
    }
} catch (error) {
    console.error("Error inisialisasi Supabase:", error);
}