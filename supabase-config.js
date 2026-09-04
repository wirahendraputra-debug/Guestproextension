const SUPABASE_URL = "https://bsbzfbyakexjxbcsceuk.supabase.co";
const SUPABASE_KEY = "sb_publishable_5v-oyfJKdwqFoG1khsN_cQ_BFrrAgAW";

const supabaseHeaders = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};
