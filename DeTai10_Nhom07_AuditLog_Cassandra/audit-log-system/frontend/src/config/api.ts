/**
 * Frontend API Configuration
 * Supports environment-based API base URL with fallback to local proxy '/api'
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string) || '/api';

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const APP_CONFIG = {
  appName: 'Audit Log & Operation Monitoring',
  version: '1.0.0',
  database: 'Apache Cassandra 4.1 (Wide-Column NoSQL)',
  defaultPageLimit: 100,
  refreshIntervalMs: 20000,
};
