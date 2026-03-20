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
        MAX_DATE: '2026-02',     // End of slider range
        DEFAULT_DATE: '2025-02'  // Default month shown on load
    }
};