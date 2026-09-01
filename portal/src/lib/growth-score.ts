import type { DailyEntry, Profile, ScoreSettings, StudentGroup } from "@/lib/types";
import { startOfIndiaWeek, todayInIndia } from "@/lib/date";
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
  studentGroup: StudentGroup | null;
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

const CHANTING_TARGET_ROUNDS = 2;
const READING_TARGET_MINUTES = 30;
const STUDY_TARGET_MINUTES = 6 * 60;
const BEDTIME_TARGET = "22:00:00";
const WAKE_TARGET = "05:00:00";
const DISCIPLINE_COMPONENT_POINTS = 25;
const DISCIPLINE_LATE_INTERVAL_MINUTES = 30;
const DISCIPLINE_LATE_DEDUCTION = 5;
const SEVA_WEEKLY_TARGET_MINUTES = 180;

const clampScore = (value: number) => Math.max(0, Math.min(100, value));
const progress = (actual: number, target: number) => clampScore((actual / target) * 100);

function disciplineComponent(actual: string, target: string, overnight = false): number {
  let actualMinutes = timeToMinutes(actual);
  let targetMinutes = timeToMinutes(target);
  if (overnight) {
    if (actualMinutes < 12 * 60) actualMinutes += 1440;
    if (targetMinutes < 12 * 60) targetMinutes += 1440;
  }
  const lateIntervals = Math.ceil(Math.max(0, actualMinutes - targetMinutes) / DISCIPLINE_LATE_INTERVAL_MINUTES);
  return Math.max(0, DISCIPLINE_COMPONENT_POINTS - lateIntervals * DISCIPLINE_LATE_DEDUCTION);
}

function equalOverall(scores: Omit<GrowthBreakdown, "overall">): number {
  return (scores.sadhana + scores.study + scores.discipline + scores.seva) / 4;
}

export function scoreDailyEntry(entry: DailyEntry, _settings: ScoreSettings, weeklySevaScore = 0): GrowthBreakdown {
  const sadhanaParts = [
    progress(entry.chanting_rounds ?? 0, CHANTING_TARGET_ROUNDS),
    (entry.morning_arati_status ?? (entry.morning_arati_attended ? "present" : "absent")) === "present" ? 100 : 0,
    ...(entry.gita_class_status === "no_class" ? [] : [entry.gita_class_status === "present" ? 100 : 0]),
    progress(entry.evening_reading_minutes, READING_TARGET_MINUTES),
  ];
  const sadhana = sadhanaParts.reduce((sum, score) => sum + score, 0) / sadhanaParts.length;
  const study = progress(entry.study_minutes, STUDY_TARGET_MINUTES);
  const discipline = disciplineComponent(entry.sleep_time, BEDTIME_TARGET, true) + disciplineComponent(entry.wake_time, WAKE_TARGET);
  const categories = { sadhana, study, discipline, seva: clampScore(weeklySevaScore) };
  return { ...categories, overall: equalOverall(categories) };
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

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayCount(start: string, end: string): number {
  if (start > end) return 0;
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;
}

function laterDate(...dates: Array<string | null | undefined>): string {
  return dates.filter((date): date is string => Boolean(date)).reduce((latest, date) => date > latest ? date : latest);
}

const zero = (): GrowthBreakdown => ({ sadhana: 0, study: 0, discipline: 0, seva: 0, overall: 0 });

const studentGroupOrder = (group: StudentGroup | null) => group === "abhay_hostel" ? 0 : group === "krishna_home" ? 1 : 2;

export function compareGrowthStudents(
  a: Pick<StudentGrowthReport, "studentId" | "studentName">,
  b: Pick<StudentGrowthReport, "studentId" | "studentName">,
  aScore: number,
  bScore: number,
): number {
  return bScore - aScore
    || a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" })
    || a.studentId.localeCompare(b.studentId);
}

export function buildGrowthReport(
  students: Profile[],
  entries: DailyEntry[],
  settings: ScoreSettings,
  rangeDays: number,
  now = new Date(),
  reportEnd?: string,
): GrowthReport {
  const currentDate = todayInIndia(now);
  const end = reportEnd ?? currentDate;
  const rangeStart = addDays(end, -(rangeDays - 1));
  const globalStart = rangeStart > settings.score_start_date ? rangeStart : settings.score_start_date;
  const allDates = listDates(globalStart, end);
  const entryMap = new Map(entries.map((entry) => [`${entry.student_id}:${entry.entry_date}`, entry]));
  const reports: StudentGrowthReport[] = students.filter((student) => student.is_active).map((student) => {
    const studentStart = student.joined_on && student.joined_on > globalStart ? student.joined_on : globalStart;
    const dates = allDates.filter((date) => date >= studentStart);
    const weekScores = new Map<string, number>();
    for (const weekStart of new Set(dates.map(startOfIndiaWeek))) {
      const weekEnd = addDays(weekStart, 6);
      const eligibleStart = laterDate(weekStart, settings.score_start_date, student.joined_on);
      const eligibleEnd = weekStart <= currentDate && currentDate < weekEnd ? currentDate : weekEnd;
      const eligibleDays = dayCount(eligibleStart, eligibleEnd);
      const target = SEVA_WEEKLY_TARGET_MINUTES * eligibleDays / 7;
      const totalMinutes = entries
        .filter((entry) => entry.student_id === student.id && entry.entry_date >= eligibleStart && entry.entry_date <= eligibleEnd)
        .reduce((sum, entry) => sum + entry.seva_minutes, 0);
      weekScores.set(weekStart, target > 0 ? progress(totalMinutes, target) : 0);
    }
    const daily = dates.map((date): DailyGrowthScore => {
      const entry = entryMap.get(`${student.id}:${date}`);
      return entry
        ? { date, submitted: true, ...scoreDailyEntry(entry, settings, weekScores.get(startOfIndiaWeek(date)) ?? 0) }
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
      studentGroup: student.student_group ?? null,
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
  }).sort((a, b) => studentGroupOrder(a.studentGroup) - studentGroupOrder(b.studentGroup) || compareGrowthStudents(a, b, a.overall, b.overall));

  let rankedGroup: StudentGroup | null | undefined;
  let groupRank = 0;
  reports.forEach((report) => {
    if (report.studentGroup !== rankedGroup) {
      rankedGroup = report.studentGroup;
      groupRank = 0;
    }
    report.rank = ++groupRank;
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

export type WeeklyCategoryPoint = Omit<GrowthBreakdown, "overall"> & { date: string };

export function buildWeeklyCategorySeries(report: GrowthReport, studentId?: string): WeeklyCategoryPoint[] {
  const selected = studentId ? report.students.find((student) => student.studentId === studentId) : undefined;
  return report.dates.slice(-7).map((date) => {
    const values = selected
      ? selected.daily.filter((day) => day.date === date)
      : report.students.map((student) => student.daily.find((day) => day.date === date)).filter((day): day is DailyGrowthScore => Boolean(day));
    const divisor = Math.max(values.length, 1);
    return {
      date: date.slice(5),
      sadhana: Math.round(values.reduce((sum, day) => sum + day.sadhana, 0) / divisor),
      study: Math.round(values.reduce((sum, day) => sum + day.study, 0) / divisor),
      discipline: Math.round(values.reduce((sum, day) => sum + day.discipline, 0) / divisor),
      seva: Math.round(values.reduce((sum, day) => sum + day.seva, 0) / divisor),
    };
  });
}
