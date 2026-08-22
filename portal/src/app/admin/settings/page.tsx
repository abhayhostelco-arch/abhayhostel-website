import type { Metadata } from "next";
import { AlertSettingsForm } from "@/components/alert-settings-form";
import { ScoreSettingsForm } from "@/components/score-settings-form";
import { requireProfile } from "@/lib/auth";
import { getAlertSettings, getScoreSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireProfile(["super_admin"]);
  const [settings, scoreSettings] = await Promise.all([getAlertSettings(), getScoreSettings()]);
  return (
    <main className="page-container">
      <header className="page-heading"><div><p className="eyebrow">Super Admin only</p><h1>Portal settings</h1><p>Manage alert rules and the transparent Growth Score rubric.</p></div></header>
      <section className="panel narrow-panel"><div className="panel-title"><h2>Alert settings</h2></div><AlertSettingsForm settings={settings} /></section>
      <section className="panel narrow-panel section-gap"><div className="panel-title"><h2>Growth Score settings</h2></div><ScoreSettingsForm settings={scoreSettings} /></section>
    </main>
  );
}
