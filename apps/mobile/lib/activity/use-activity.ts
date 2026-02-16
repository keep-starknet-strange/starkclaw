/**
 * useActivity - hook to read activity from the activity store.
 * 
 * Provides real-time activity list including tx status updates from polling.
 */

import * as React from "react";

import { listActivity, type ActivityItem } from "../activity/activity";

const REFRESH_INTERVAL_MS = 5_000;

export function useActivity(): ActivityItem[] {
  const [activities, setActivities] = React.useState<ActivityItem[]>([]);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      const items = await listActivity();
      if (mounted) {
        setActivities(items);
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
  }, []);

  return activities;
}
