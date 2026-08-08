System-wide duplicate validation has been implemented across all primary entities to prevent duplicate records, sanitize string inputs, and support seamless self-edits.

**Validation Standards**

* **Sanitization:** All checks trim leading and trailing whitespace and run case-insensitive comparisons.
* **Edit Exclusions:** Logic excludes the record currently being updated (e.g., using `editingId`), ensuring self-saves do not trigger duplicate errors.
* **Error Handling:** When a duplicate is detected, a toast error notification displays and the save operation immediately aborts.

**Entity Check Mapping**

| Entity | Check Function | Target Function | Logic Notes |
| --- | --- | --- | --- |
| **Company** | `isCompanyNameTaken()` | `saveCompany()` | Prevents duplicate company names |
| **Department** | `isDepartmentNameTaken()` | `saveDepartment()` | Prevents duplicate department names |
| **Role** | `isRoleNameTaken()` | `saveRole()` | Prevents duplicate role names |
| **Contact** | `isContactEmailTaken()`, `isContactNameTaken()` | `saveContact()` | Prevents duplicate emails and full names |
| **Deal / Task** | `isDealTitleTaken()` | `saveDeal()` | Prevents duplicate deal/task titles |
| **User** | `isUsernameTaken()` | `saveUser()` | Prevents duplicate usernames |

**File-Level Modifications**

* **`helpers.js`**: Added `isContactNameTaken()` and `employeeHasUser()` helper functions.
* **`contacts.js`**: Implemented the duplicate full-name check in `saveContact()` and updated the **Role** field to be required.
* **`users.js`**: Integrated the duplicate username check in `saveUser()` and added logic using `employeeHasUser()` to prevent linking a user to an employee already assigned to an account.
* **`kanban.js`**: Added title duplicate checking via `isDealTitleTaken(title, editingId)` inside `saveDeal()`.