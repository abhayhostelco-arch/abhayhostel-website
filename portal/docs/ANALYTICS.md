# Portal analytics

Analytics is intentionally disabled. The portal does not send events to a third party or store analytics events in Supabase.

Event call sites use the provider-neutral `trackAnalyticsEvent` function from `src/lib/client-analytics.ts`:

```ts
trackAnalyticsEvent("resource_open", {
  outcome: "success",
  category: "reading",
});
```

For server-action results, add a safe `analytics` event to `ActionState` and call the reusable `useActionAnalytics(state)` hook in the form component. Login and password recovery demonstrate this pattern.

`trackAnalyticsEvent` is currently a no-op. Add the selected provider only inside that module later. Do not send personal or secret values when analytics is enabled.
