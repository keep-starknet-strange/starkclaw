/**
 * useActivity - hook to read activity from the activity store.
 * 
 * Provides real-time activity list including tx status updates from polling.
 * Only polls when isLive is true.
 */

import * as React from "react";

import { listActivity, type ActivityItem } from "../activity/activity";

const REFRESH_INTERVAL_MS = 5_000;

export function useActivity(isLive: boolean): ActivityItem[] {
  const [activities, setActivities] = React.useState<ActivityItem[]>([]);

  React.useEffect(() => {
    // Skip polling in demo mode
    if (!isLive) {
      setActivities([]);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const items = await listActivity();
        if (mounted) {
          setActivities(items);
        }
      } catch (err) {
        // Log error but don't throw - keep polling stable
        console.warn("useActivity: failed to load activities:", err);
      }
    };

    // Initial load
    load();

    // Set up polling for UI updates
    const interval = setInterval(load, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isLive]);

  return activities;
}
