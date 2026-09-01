# Task 4 report: Separate group scoreboards

## Scope completed

The Task 4 worktree already contained the main scoreboard implementation before this handoff. It had introduced group-aware score data and presentation across the student, mentor, and super-admin dashboards; category leaderboard tabs; reports; score tables; summaries; exports; CSS; and focused tests.

This completion pass preserved that work and added the missing staff student-detail guarantee:

- The detail view now narrows the active scoring cohort to the viewed student's group before fetching entries and building a report.
- Its Growth Score summary now states `Rank #n of group-count · group label`.
- Removed the remaining unused CSS for the deleted Admin Student Overview featured Rank #1 panel.
- Added a regression test that proves the detail page excludes an active student in the other group from the scoring fetch and displays the own-group count.

The final implementation provides:

- Ranking only after the authorized/filter-selected cohort is formed.
- Separate Abhay Hostel and Krishna Home positions, ordered by unrounded score, case-insensitive name, then student ID, including category tabs.
- Unique positions within each group, Top 10 per group, and own-group rank/count for student views.
- Mentor scoreboards limited to the assigned cohort and partitioned by group.
- Super-admin scoreboards partitioned after selected filters.
- No featured Admin Student Overview Rank #1 panel, no combined scoreboard rank, and no avatars in scoreboard/summary rows.

## Test evidence

- RED captured first: `npm test -- src/app/admin/students/[id]/student-detail-group-ranking.test.tsx` failed because the existing detail-page entry query included the other-group student.
- GREEN: the same focused test passed after the cohort/rank-label change.
- Task 4 focused suite: 8 files, 31 tests passed.
- Deterministic full suite: `npm test -- --sequence.concurrent=false` — 41 files, 203 tests passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `git diff --check` passed.

## Audit and concerns

- A final rank/leaderboard consumer audit found only the group-aware ranking utilities, group scoreboard components, and own-group rank labels. The scoreboard components have no `ProfileAvatar` references.
- No live database, Supabase, email, payment, network, deployment, push, or other external calls were made.
- No unresolved functional concerns. The two-board rendering intentionally depends on the student-group migration established by Task 2; profiles lacking a group remain outside the configured hostel boards and retain the existing migration-required label behavior.
