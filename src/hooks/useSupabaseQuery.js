import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for resilient Supabase data fetching.
 * Features: Loading state, Error state, Exponential Backoff Retries.
 * 
 * @param {Function} queryFn - A function that returns a Supabase query (e.g., () => supabase.from('table').select('*'))
 * @param {Array} deps - Dependency array for re-fetching
 * @param {Object} options - { maxRetries: 3, enabled: true }
 */
export function useSupabaseQuery(queryFn, deps = [], options = {}) {
    const { maxRetries = 3, enabled = true } = options;
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const [retryCount, setRetryCount] = useState(0);

    const fetchData = useCallback(async (currentRetry = 0) => {
        if (!enabled) return;

        setIsLoading(true);
        setError(null);

        try {
            const { data: result, error: supabaseError } = await queryFn();

            if (supabaseError) {
                throw supabaseError;
            }

            setData(result);
            setRetryCount(0); // Reset retry count on success
        } catch (err) {
            console.error(`Supabase Query Error (Attempt ${currentRetry + 1}):`, err);

            if (currentRetry < maxRetries) {
                const backoffTime = Math.pow(2, currentRetry) * 1000;
                console.warn(`Retrying in ${backoffTime}ms...`);

                setTimeout(() => {
                    setRetryCount(currentRetry + 1);
                    fetchData(currentRetry + 1);
                }, backoffTime);
            } else {
                setError(err);
            }
        } finally {
            if (currentRetry === maxRetries || !error) {
                setIsLoading(false);
            }
        }
    }, [queryFn, maxRetries, enabled]);

    useEffect(() => {
        if (enabled) {
            fetchData();
        }
    }, deps);

    return { data, error, isLoading, refetch: () => fetchData(0) };
}
