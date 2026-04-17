import { supabase } from "../supabaseClient";

/**
 * Lightweight Logging Utility for Supabase
 */
const logger = {
    log: async (level, message, details = {}) => {
        const logEntry = {
            level,
            message,
            details,
            pathname: typeof window !== 'undefined' ? window.location.pathname : null,
            created_at: new Date().toISOString(),
        };

        console[level === 'fatal' ? 'error' : level](`[${level.toUpperCase()}] ${message}`, details);

        try {
            // ✅ Proactive: Only attempt to log to DB if authenticated
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                const { error } = await supabase
                    .from("system_logs")
                    .insert([{
                        ...logEntry,
                        user_id: session.user?.id || null, // Adjusted for Supabase Auth UUID
                    }]);

                if (error) console.warn("Failed to send log to Supabase:", error);
            }
        } catch (err) {
            // Silently fail to avoid infinite loops or crashing the logger
        }
    },

    info: (msg, dev = {}) => logger.log("info", msg, dev),
    warn: (msg, dev = {}) => logger.log("warn", msg, dev),
    error: (msg, dev = {}) => logger.log("error", msg, dev),
    fatal: (msg, dev = {}) => logger.log("fatal", msg, dev),
};

export default logger;
