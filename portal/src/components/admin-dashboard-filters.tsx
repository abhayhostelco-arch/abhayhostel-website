"use client";

import { useState } from "react";

type DashboardRange = "7" | "30" | "90" | "custom";

export function AdminDashboardFilters({
  initialRange,
  initialStartDate,
  initialEndDate,
  earliestDate,
  today,
  initialMentorId,
  mentors,
}: {
  initialRange: DashboardRange;
  initialStartDate: string;
  initialEndDate: string;
  earliestDate: string;
  today: string;
  initialMentorId?: string;
  mentors: Array<{ id: string; fullName: string }>;
}) {
  const [range, setRange] = useState<DashboardRange>(initialRange);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  return <form className="dashboard-header-filter" method="get" aria-label="Dashboard Filters">
    <label className="visually-hidden" htmlFor="dashboard-range">Report Range</label>
    <select id="dashboard-range" name="range" value={range} onChange={(event) => setRange(event.target.value as DashboardRange)}>
      <option value="7">Last 7 Days</option>
      <option value="30">Last 30 Days</option>
      <option value="90">Last 90 Days</option>
      <option value="custom">Custom Range</option>
    </select>
    {range === "custom" ? <div className="dashboard-custom-range" role="group" aria-label="Custom Date Range">
      <label htmlFor="dashboard-start-date">From</label>
      <input id="dashboard-start-date" name="startDate" type="date" min={earliestDate} max={endDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      <label htmlFor="dashboard-end-date">To</label>
      <input id="dashboard-end-date" name="endDate" type="date" min={startDate} max={today} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
    </div> : null}
    <label className="visually-hidden" htmlFor="mentorId">Filter by Mentor</label>
    <select id="mentorId" name="mentorId" defaultValue={initialMentorId ?? ""}>
      <option value="">All Mentors</option>
      {mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.fullName}</option>)}
    </select>
    <button className="button button-small">Apply</button>
  </form>;
}
