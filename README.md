# 1.1.0 update

Each card shows:

- Task title (clickable → opens the read‑only view modal or switches to the Task page)
- Description preview (if any)
- Assignee badges (with a star for the current user)
- Department / stage label
- Due date (highlighted overdue)
- Priority badge
- Notes count (comments + revisions)
- “Files” count (if the `getDealFiles` helper is available)


### Summary of Updates to dashboard.js

	#Removed the Total Employees and Total Roles stat cards.

	#Added a My Overdue Tasks stat card (tasks assigned to the current user that are past due and not in a final stage).

	#Retained My Active Tasks and My Completed Tasks – all counts are now filtered exclusively to the currently logged‑in user (using currentUser.employeeId or currentUser.contactId).

	#Kept the Pending Announcements stat card as a global count.

	#The Upcoming Announcements list (below the stat grid) remains unchanged and shows all pending announcements globally.

## All task-related dashboard stats now reflect only the user’s personal workload.