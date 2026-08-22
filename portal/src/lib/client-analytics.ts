"use client";

export type AnalyticsParameters = Record<string, string | number | boolean | null>;

export function trackAnalyticsEvent(
  _name: string,
  _parameters: AnalyticsParameters = {},
): void {
  void _name;
  void _parameters;
  // Intentionally empty. Add the chosen analytics provider here later.
}
