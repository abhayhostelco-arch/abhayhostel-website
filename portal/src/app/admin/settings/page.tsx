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
      <header className="page-heading"><div><p className="eyebrow">System</p><h1>Portal Settings</h1><p>Manage alert rules and the transparent Growth Score rubric.</p></div></header>
      <div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections"><a href="#alert-rules">Alert Rules<span>Notifications and thresholds</span></a><a href="#growth-score">Growth Score<span>Weights and targets</span></a></nav><div><section id="alert-rules" className="panel settings-section"><div className="panel-title"><div><h2>Alert Rules</h2><span>Configure conditions that require Mentor attention.</span></div></div><AlertSettingsForm settings={settings} /></section><section id="growth-score" className="panel settings-section section-gap"><div className="panel-title"><div><h2>Growth Score</h2><span>Changes recalculate eligible reports from the scoring launch date.</span></div></div><ScoreSettingsForm settings={scoreSettings} /></section></div></div>
    </main>
  );
}
