# Isolated QA stack for the calculator tutor review. Never points at Production.
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/calc_tutor_e2e
export ADMIN_EMAILS=qa-admin@tutai.invalid TEXTBOOK_INLINE_PROCESSING=off NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_SITE_URL=http://localhost:3302
unset GEMINI_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
