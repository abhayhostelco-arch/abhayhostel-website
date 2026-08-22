import type { Metadata } from "next";
import { AlertSettingsForm } from "@/components/alert-settings-form";
import { requireProfile } from "@/lib/auth";
import { getAlertSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireProfile(["super_admin"]);
  const settings = await getAlertSettings();
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Super Admin only</p><h1>Alert settings</h1><p>Changes recalculate in-app alerts immediately; no emails are sent.</p></div></header>
      <section className="panel narrow-panel"><AlertSettingsForm settings={settings} /></section>
    </main>
  );
}
