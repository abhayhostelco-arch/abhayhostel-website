# Abhay Hostel Repository Instructions

## Deployment and Git Push Safety

- Never run `git push`, publish a branch, create a remote tag, or otherwise send repository changes to a remote unless the user explicitly requests that remote action in the current task.
- A request to implement, finish, verify, commit, or prepare changes does not authorize a push.
- When a commit is requested without an explicit push request, create the commit locally and report that it remains unpushed.
- Do not reuse push permission from an earlier task or message for later changes; obtain a new explicit instruction each time.
- Pushing this repository triggers an automatic deployment and incurs cost, so the default is always to keep changes local.
