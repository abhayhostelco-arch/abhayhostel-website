import type { DailyEntry, Profile, ScoreSettings } from "@/lib/types";
import { daysAgoInIndia, todayInIndia } from "@/lib/date";
import { timeToMinutes } from "@/lib/analytics";

export type GrowthBreakdown = {
  sadhana: number;
  study: number;
  discipline: number;
  seva: number;
  overall: number;
};

export type DailyGrowthScore = GrowthBreakdown & {
  date: string;
  submitted: boolean;
};

export type StudentGrowthReport = GrowthBreakdown & {
  studentId: string;
  studentName: string;
  eligibleDays: number;
  submittedDays: number;
  rank: number;
  daily: DailyGrowthScore[];
};

export type GrowthReport = {
  students: StudentGrowthReport[];
  averages: GrowthBreakdown;
  dates: string[];
};

const clampScore = (value: number) => Math.max(0, Math.min(100, value));
const progress = (actual: number, target: number) => clampScore((actual / target) * 100);

function punctualityScore(actual: string, target: string, grace: number, overnight = false): number {
  let actualMinutes = timeToMinutes(actual);
  let targetMinutes = timeToMinutes(target);
  if (overnight) {
    if (actualMinutes < 12 * 60) actualMinutes += 1440;
    if (targetMinutes < 12 * 60) targetMinutes += 1440;
  }
  const lateBy = Math.max(0, actualMinutes - targetMinutes);
  return clampScore(100 - (lateBy / grace) * 100);
}

function weightedOverall(scores: Omit<GrowthBreakdown, "overall">, settings: ScoreSettings): number {
  return (
    scores.sadhana * settings.sadhana_weight +
    scores.study * settings.study_weight +
    scores.discipline * settings.discipline_weight +
    scores.seva * settings.seva_weight
  ) / 100;
}

export function scoreDailyEntry(entry: DailyEntry, settings: ScoreSettings): GrowthBreakdown {
  const sadhanaParts = [
    { weight: 37.5, score: progress(entry.chanting_rounds ?? 0, settings.chanting_target_rounds), included: true },
    { weight: 25, score: entry.morning_arati_attended ? 100 : 0, included: true },
    { weight: 25, score: entry.gita_class_status === "present" ? 100 : 0, included: entry.gita_class_status !== "no_class" },
    { weight: 12.5, score: progress(entry.evening_reading_minutes, settings.evening_reading_target_minutes), included: true },
  ];
  const availableSadhanaWeight = sadhanaParts.filter((part) => part.included).reduce((sum, part) => sum + part.weight, 0);
  const sadhana = sadhanaParts
    .filter((part) => part.included)
    .reduce((sum, part) => sum + part.score * part.weight, 0) / availableSadhanaWeight;
  const study = progress(entry.study_minutes, settings.study_target_minutes) * 0.8 + (entry.library_attended ? 20 : 0);
  const discipline = (
    punctualityScore(entry.wake_time, settings.wake_target_time, settings.discipline_grace_minutes) +
    punctualityScore(entry.sleep_time, settings.bedtime_target_time, settings.discipline_grace_minutes, true)
  ) / 2;
  const seva = progress(entry.seva_minutes, settings.seva_target_minutes);
  const categories = { sadhana, study, discipline, seva };
  return { ...categories, overall: weightedOverall(categories, settings) };
}

function listDates(start: string, end: string): string[] {
  if (start > end) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const zero = (): GrowthBreakdown => ({ sadhana: 0, study: 0, discipline: 0, seva: 0, overall: 0 });

export function buildGrowthReport(
  students: Profile[],
  entries: DailyEntry[],
  settings: ScoreSettings,
  rangeDays: number,
  now = new Date(),
): GrowthReport {
  const end = todayInIndia(now);
  const rangeStart = daysAgoInIndia(rangeDays - 1, now);
  const globalStart = rangeStart > settings.score_start_date ? rangeStart : settings.score_start_date;
  const allDates = listDates(globalStart, end);
  const entryMap = new Map(entries.map((entry) => [`${entry.student_id}:${entry.entry_date}`, entry]));
  const reports = students.filter((student) => student.is_active).map((student) => {
    const studentStart = student.joined_on && student.joined_on > globalStart ? student.joined_on : globalStart;
    const dates = allDates.filter((date) => date >= studentStart);
    const daily = dates.map((date): DailyGrowthScore => {
      const entry = entryMap.get(`${student.id}:${date}`);
      return entry
        ? { date, submitted: true, ...scoreDailyEntry(entry, settings) }
        : { date, submitted: false, ...zero() };
    });
    const divisor = Math.max(daily.length, 1);
    const sums = daily.reduce((sum, day) => ({
      sadhana: sum.sadhana + day.sadhana,
      study: sum.study + day.study,
      discipline: sum.discipline + day.discipline,
      seva: sum.seva + day.seva,
      overall: sum.overall + day.overall,
    }), zero());
    return {
      studentId: student.id,
      studentName: student.full_name,
      eligibleDays: daily.length,
      submittedDays: daily.filter((day) => day.submitted).length,
      sadhana: sums.sadhana / divisor,
      study: sums.study / divisor,
      discipline: sums.discipline / divisor,
      seva: sums.seva / divisor,
      overall: sums.overall / divisor,
      rank: 0,
      daily,
    };
  }).sort((a, b) => Math.round(b.overall) - Math.round(a.overall) || a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" }));

  reports.forEach((report, index) => {
    report.rank = index + 1;
  });

  const divisor = Math.max(reports.length, 1);
  const aggregate = reports.reduce((sum, report) => ({
    sadhana: sum.sadhana + report.sadhana,
    study: sum.study + report.study,
    discipline: sum.discipline + report.discipline,
    seva: sum.seva + report.seva,
    overall: sum.overall + report.overall,
  }), zero());
  return {
    students: reports,
    averages: {
      sadhana: aggregate.sadhana / divisor,
      study: aggregate.study / divisor,
      discipline: aggregate.discipline / divisor,
      seva: aggregate.seva / divisor,
      overall: aggregate.overall / divisor,
    },
    dates: allDates,
  };
}

export function roundedScores(scores: GrowthBreakdown): GrowthBreakdown {
  return {
    sadhana: Math.round(scores.sadhana),
    study: Math.round(scores.study),
    discipline: Math.round(scores.discipline),
    seva: Math.round(scores.seva),
    overall: Math.round(scores.overall),
  };
}
