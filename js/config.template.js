const CONFIG = {
    supabase: {
        url: '${SUPABASE_URL}',
        anonKey: '${SUPABASE_ANON_KEY}'
    },
    mapbox: {
        accessToken: '${MAPBOX_ACCESS_TOKEN}',
    },
    dateRange: {
        START_DATE: '2019-01',   // Start of slider range
        MAX_DATE: '2026-03',     // End of slider range
        DEFAULT_DATE: '2025-03'  // Default month shown on load
    }
};