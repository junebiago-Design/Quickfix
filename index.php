<?php
session_start();
// Redirect if not logged in
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: login.html');
    exit;
}
$user = $_SESSION['user'];
?>
<?php include __DIR__ . '/includes/header.php'; ?>
            <body>
            <!-- ── MAIN ── -->
            <div id="main">
 <!-- Dashboard -->  
            <div class="page active" id="page-dashboard">
                <div class="page-body">
                    <div class="stats-grid" id="stats-grid"></div>
                    <div class="dashboard-grid">
                        <div class="card">
                           
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <span>Upcoming Announcements</span>
                            </div>
                            <div class="card-body" id="upcoming-tasks"></div>
                        </div>
                    </div>
                </div>
            </div>
 <!-- Dashboard -->  
            <?php include __DIR__ . '/includes/topbar.php'; ?>
            <?php include __DIR__ . '/pages/roles.php'; ?>
            <?php include __DIR__ . '/pages/department.php'; ?>
            <?php include __DIR__ . '/includes/sidebar.php'; ?>
            <?php include __DIR__ . '/pages/contacts.php'; ?>
            <?php include __DIR__ . '/pages/employeedir.php'; ?>
            <?php include __DIR__ . '/pages/announcements.php'; ?>
            <?php include __DIR__ . '/pages/kanban.php'; ?>
            <?php include __DIR__ . '/pages/notes.php'; ?>
            <?php include __DIR__ . '/pages/taskactivity.php'; ?>  
            <?php include __DIR__ . '/pages/users.php'; ?>
            <?php include __DIR__ . '/pages/pageaccess.php'; ?>
            <?php include __DIR__ . '/pages/companies.php'; ?>
            <?php include __DIR__ . '/pages/profile.php'; ?>
            <?php include __DIR__ . '/pages/loginMonitoring.php'; ?>  
 <!-- ===== MODALS ===== -->
        <!-- Contact Modal -->
        <div class="modal-overlay" id="contact-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="contact-modal-title">Add Employee</span>
                    <button class="icon-btn" onclick="closeModal('contact-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">First Name *</label>
                                <input type="text" id="c-fname" placeholder="John">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Last Name *</label>
                                <input type="text" id="c-lname" placeholder="Doe">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Middle Name</label>
                                <input type="text" id="c-mname" placeholder="Doe">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Role</label>
                                <select id="c-role"><option value="">— Select —</option></select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email *</label>
                            <input type="email" id="c-email" placeholder="john@example.com">
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Phone</label>
                                <input type="tel" id="c-phone" placeholder="+1 555 000 0000">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Company</label>
                                <select id="c-company"><option value="">— Select —</option></select>
                            </div>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Department</label>
                                <select id="c-department" onchange="syncContactCompanyFromDepartment()"><option value="">— Select —</option></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select id="c-status"><option value="active">Active</option><option value="inactive">In-Active</option></select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('contact-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveContact()">Save Employee</button>
                </div>
            </div>
        </div>

        <!-- Task Modal (Deal) -->
        <div class="modal-overlay" id="deal-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="deal-modal-title">Add Task</span>
                    <button class="icon-btn" onclick="closeModal('deal-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Task Title *</label>
                            <input type="text" id="d-title" placeholder="Prepare quarterly report">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="d-desc" placeholder="Task details…" style="min-height:70px;"></textarea>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Due Date *</label>
                                <input type="date" id="d-due">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Priority</label>
                                <select id="d-priority">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Department</label>
                            <select id="d-department" onchange="onDepartmentChangeForDeal()"><option value="">— Select —</option></select>
                            <small style="color:var(--text3);">Auto-assigns all employees in this department to the task.</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Assign To</label>
                            <div id="d-contact-list" style="display:flex;flex-direction:column;gap:6px;"></div>
                            <button type="button" class="btn btn-ghost" style="margin-top:8px;width:100%;" onclick="addDealContactRow()">+ Add Assign To</button>
                            <small style="color:var(--text3);">Department employees are auto-assigned. Use "+ Add Assign To" to add others.</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="d-stage"></select>
                        </div>
                        <div class="form-group" id="deal-modal-attachments-group" style="display:none;">
                            <label class="form-label">Files &amp; Attachments</label>
                            <div id="deal-modal-attachments-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;"></div>
                            <button type="button" class="btn btn-ghost" id="deal-modal-upload-btn" style="width:100%;" onclick="openUploadFromDealModal()">⬆ Upload File</button>
                        </div>
                        <div class="form-group" id="deal-modal-attachments-hint" style="display:none;">
                            <small style="color:var(--text3);">Save this task first, then reopen it to attach files.</small>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('deal-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveDeal()">Save Task</button>
                </div>
            </div>
        </div>

        <!-- Stage Modal -->
        <div class="modal-overlay" id="stage-modal">
            <div class="modal" style="max-width:380px;">
                <div class="modal-header">
                    <span id="stage-modal-title">Add Stage</span>
                    <button class="icon-btn" onclick="closeModal('stage-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Stage Name *</label>
                        <input type="text" id="stage-name" placeholder="e.g. QA Testing">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Color</label>
                        <div class="stage-color-picker" id="stage-color-picker"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Visible To Roles</label>
                        <div id="stage-role-list" style="display:flex;flex-direction:column;gap:6px;"></div>
                        <button type="button" class="btn btn-ghost" style="margin-top:8px;width:100%;" onclick="addStageRoleRow()">+ Add Role</button>
                    </div>
                    <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                        <input type="checkbox" id="stage-final" style="width:16px;height:16px;">
                        <label class="form-label" for="stage-final" style="margin:0;cursor:pointer;">Treat tasks here as completed</label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" id="stage-delete-btn" style="margin-right:auto;display:none;" onclick="deleteStageFromModal()">Delete Stage</button>
                    <button class="btn btn-ghost" onclick="closeModal('stage-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveStage()">Save Stage</button>
                </div>
            </div>
        </div>

        <!-- Announcement Modal -->
        <div class="modal-overlay" id="task-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="task-modal-title">Add Announcement</span>
                    <button class="icon-btn" onclick="closeModal('task-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Announcement Title *</label>
                            <input type="text" id="t-title" placeholder="Company-wide update">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Message</label>
                            <textarea id="t-desc" placeholder="Announcement details…" style="min-height:70px;"></textarea>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Due Date *</label>
                                <input type="date" id="t-due">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Priority</label>
                                <select id="t-priority">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Posted By</label>
                                <input type="text" id="t-assignee" placeholder="e.g. HR Department">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Related Employee</label>
                                <select id="t-contact"><option value="">— None —</option></select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('task-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveTask()">Save Announcement</button>
                </div>
            </div>
        </div>

        <!-- Deal Notes Modal -->
        <div class="modal-overlay" id="deal-notes-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="deal-notes-modal-title">Notes</span>
                    <button class="icon-btn" onclick="closeDealNotesModal()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="deal-notes-tabs">
                        <div class="deal-notes-tab active" data-tab="comments" onclick="switchDealNotesTab('comments')">💬 Comments</div>
                        <div class="deal-notes-tab" data-tab="revisions" onclick="switchDealNotesTab('revisions')">📝 Revisions</div>
                    </div>
                    <div class="deal-notes-modal-list" id="deal-notes-modal-list-comments"></div>
                    <div class="deal-notes-modal-list" id="deal-notes-modal-list-revisions" style="display:none;"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeDealNotesModal()">Close</button>
                    <button class="btn btn-ghost" id="deal-notes-add-comment-btn" onclick="openNoteModal(null, currentDealNotesId, 'comment')">+ Comment</button>
                    <button class="btn btn-primary" id="deal-notes-add-revision-btn" onclick="openNoteModal(null, currentDealNotesId, 'revision')">+ Revision</button>
                </div>
            </div>
        </div>

        <!-- Note Modal -->
        <div class="modal-overlay" id="note-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="note-modal-title">Add Note</span>
                    <button class="icon-btn" onclick="closeModal('note-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="note-form-grid">
                        <div class="form-group">
                            <label class="form-label">Title *</label>
                            <input type="text" id="n-title" placeholder="Meeting recap">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select id="n-type">
                                <option value="comment">💬 Comment</option>
                                <option value="revision">📝 Request Revision</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Content *</label>
                            <textarea id="n-content" placeholder="Write your note here…" style="min-height:120px;"></textarea>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Linked Employee</label>
                                <select id="n-contact"><option value="">— None —</option></select>
                                <small style="color:var(--text3);">Filtered by task assignees.</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label" id="n-deal-label">Linked Task</label>
                                <select id="n-deal" onchange="if (typeof renderNoteModalStageActions === 'function') renderNoteModalStageActions(this.value);"><option value="">— None —</option></select>
                                <span class="form-hint" id="n-deal-lock-hint" style="display:none;">🔒 Locked to the task this note was added from.</span>
                            </div>
                        </div>
                        <div id="note-modal-stage-actions"></div>
                        <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                            <input type="checkbox" id="n-done" style="width:16px;height:16px;">
                            <label class="form-label" for="n-done" style="margin:0;cursor:pointer;">Mark as Done (confirms this comment/revision is resolved)</label>
                        </div>
                        <div class="form-group" style="font-size:0.75rem;color:var(--text3);padding:4px 0;">
                            <span>✍️ Author: <span id="n-author-display">Current User</span></span>
                            <span style="margin-left:12px;">📅 Created: <span id="n-date-display">Now</span></span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('note-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveNote()">Save Note</button>
                </div>
            </div>
        </div>

        <!-- Department Modal -->
        <div class="modal-overlay" id="department-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="department-modal-title">Add Department</span>
                    <button class="icon-btn" onclick="closeModal('department-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Department Name *</label>
                            <input type="text" id="dep-name" placeholder="Engineering">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="dep-desc" placeholder="What this department handles…" style="min-height:70px;"></textarea>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Company</label>
                                <select id="dep-company"><option value="">— None —</option></select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Manager</label>
                                <select id="dep-manager"><option value="">— None —</option></select>
                            </div>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select id="dep-status"><option value="active">Active</option><option value="inactive">In-Active</option></select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('department-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveDepartment()">Save Department</button>
                </div>
            </div>
        </div>

        <!-- Role Modal -->
        <div class="modal-overlay" id="role-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="role-modal-title">Add Role</span>
                    <button class="icon-btn" onclick="closeModal('role-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Role Name *</label>
                            <input type="text" id="role-name" placeholder="e.g. Team Lead">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="role-desc" placeholder="What this role is responsible for…" style="min-height:70px;"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="role-status"><option value="active">Active</option><option value="inactive">In-Active</option></select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Inherits Permissions From</label>
                            <select id="role-inherits-from"><option value="">— None —</option></select>
                            <small style="color:var(--text3);">Optional. This role automatically gets any stage permission its parent has, unless overridden per-stage.</small>
                        </div>
                        <div class="form-group">
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                                <input type="checkbox" id="role-can-add-stage" style="width:auto;">
                                <span class="form-label" style="margin:0;">Can Add Stages (Task page)</span>
                            </label>
                            <small style="color:var(--text3);">Lets this role create new Kanban stages on the Task page. Off by default — unlike per-stage permissions, a role with no explicit setting cannot add stages until granted here.</small>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('role-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveRole()">Save Role</button>
                </div>
            </div>
        </div>

        <!-- Stage Permission Modal -->
        <div class="modal-overlay" id="stage-permission-modal">
            <div class="modal modal-wide">
                <div class="modal-header">
                    <span id="stage-permission-modal-title">Stage Permissions</span>
                    <button class="icon-btn" onclick="closeModal('stage-permission-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:0.85rem;color:var(--text3);margin-bottom:10px;">Every role always sees this stage. These checkboxes control what each role can DO while a task sits here. "Edit" governs editing task cards in this stage; "Stage Edit" separately governs renaming/recoloring/deleting the stage itself.</p>
                    <table class="permission-matrix">
                        <thead id="stage-permission-thead">
                            <tr><th>Role</th><th>Grab</th><th>Drop</th><th>Edit</th><th>Comment</th><th>Revision</th><th>Upload</th><th>Stage Edit</th></tr>
                        </thead>
                        <tbody id="stage-permission-tbody"></tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('stage-permission-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveStagePermissions()">Save Permissions</button>
                </div>
            </div>
        </div>

        <!-- Read-Only Task View Modal -->
        <div class="modal-overlay" id="deal-view-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="deal-view-modal-title">View Task</span>
                    <button class="icon-btn" onclick="closeModal('deal-view-modal')">✕</button>
                </div>
                <div class="modal-body" id="deal-view-modal-body"></div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="closeModal('deal-view-modal')">Close</button>
                </div>
            </div>
        </div>

        <!-- Deal Files Modal -->
        <div class="modal-overlay" id="deal-files-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="deal-files-modal-title">Files</span>
                    <button class="icon-btn" onclick="closeModal('deal-files-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="deal-notes-tabs">
                        <div class="deal-notes-tab active" data-tab="file" onclick="switchFilesTab('file')">📄 Files</div>
                        <div class="deal-notes-tab" data-tab="image" onclick="switchFilesTab('image')">🖼️ Images</div>
                    </div>
                    <div id="deal-files-modal-list-file"></div>
                    <div id="deal-files-modal-list-image" style="display:none;"></div>
                    <div id="deal-files-modal-stage-actions"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="deal-files-upload-btn" onclick="closeModal('deal-files-modal'); openFileUploadModal(currentDealFilesId);">⬆ Upload</button>
                    <button class="btn btn-ghost" onclick="closeModal('deal-files-modal')">Close</button>
                </div>
            </div>
        </div>

        <!-- Upload Files Modal -->
        <div class="modal-overlay" id="file-upload-modal">
            <div class="modal">
                <div class="modal-header">
                    <span>Upload Files</span>
                    <button class="icon-btn" onclick="closeModal('file-upload-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Title *</label>
                            <input type="text" id="f-title" placeholder="e.g. Signed Contract">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select id="f-type" onchange="onFileUploadTypeChange()">
                                <option value="file">📄 Files</option>
                                <option value="image">🖼️ Image</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Upload</label>
                            <input type="file" id="f-upload">
                            <small style="color:var(--text3);">Documents: PDF, Word, Excel, CSV, PowerPoint. Images: JPG, PNG, GIF, WEBP, SVG. Max 10MB.</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Linked Employee</label>
                            <input type="text" id="f-contact" disabled>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Linked Task</label>
                            <input type="text" id="f-deal" disabled>
                        </div>
                    </div>
                    <div id="file-upload-modal-stage-actions"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('file-upload-modal')">Cancel</button>
                    <button class="btn btn-primary" id="file-upload-save-btn" onclick="saveFileUpload()">Save</button>
                </div>
            </div>
        </div>

        <!-- User Modal -->
        <div class="modal-overlay" id="user-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="user-modal-title">Register User</span>
                    <button class="icon-btn" onclick="closeModal('user-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Employee</label>
                            <select id="user-employee"></select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Username *</label>
                            <input type="text" id="user-username" placeholder="e.g. jdoe">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" id="user-password" placeholder="Enter password">
                        </div>
                        <div class="form-group">
                            <label class="form-label">User Role *</label>
                            <select id="user-role"></select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="user-status"><option value="active">Active</option><option value="inactive">In-Active</option></select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('user-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveUser()">Save User</button>
                </div>
            </div>
        </div>

        <!-- Company Modal -->
        <div class="modal-overlay" id="company-modal">
            <div class="modal">
                <div class="modal-header">
                    <span id="company-modal-title">Add Company</span>
                    <button class="icon-btn" onclick="closeModal('company-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Company Name *</label>
                            <input type="text" id="comp-name" placeholder="Acme Corp">
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Industry</label>
                                <input type="text" id="comp-industry" placeholder="Technology">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Phone</label>
                                <input type="tel" id="comp-phone" placeholder="+1 555 000 0000">
                            </div>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" id="comp-email" placeholder="contact@acme.com">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Website</label>
                                <input type="text" id="comp-website" placeholder="acme.com">
                            </div>
                        </div>
                        <div class="form-grid form-grid-2">
                            <div class="form-group">
                                <label class="form-label">Address</label>
                                <input type="text" id="comp-address" placeholder="123 Main St, City">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select id="comp-status"><option value="active">Active</option><option value="inactive">In-Active</option></select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('company-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="saveCompany()">Save Company</button>
                </div>
            </div>
        </div>

        <!-- View Announcement Modal -->
        <div class="modal-overlay" id="view-announcement-modal">
            <div class="modal">
                <div class="modal-header">
                    <span>Announcement</span>
                    <button class="icon-btn" onclick="closeModal('view-announcement-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <div id="view-announcement-body"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('view-announcement-modal')">Close</button>
                </div>
            </div>
        </div>

        <!-- Confirm Delete Modal -->
        <div class="modal-overlay" id="confirm-modal">
            <div class="modal" style="max-width:380px;">
                <div class="modal-header">
                    <span>Confirm Delete</span>
                    <button class="icon-btn" onclick="closeModal('confirm-modal')">✕</button>
                </div>
                <div class="modal-body">
                    <p style="color:var(--text2);font-size:0.9rem;" id="confirm-text">Are you sure you want to delete this item?</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="closeModal('confirm-modal')">Cancel</button>
                    <button class="btn btn-danger" id="confirm-ok">Delete</button>
                </div>
            </div>
        </div>

        <!-- Toast Container -->
        <div id="toast-container"></div>

    </div><!-- end #app-shell -->

    <!-- ===== SCRIPTS ===== -->
    <script src="js/core/api-client.js?v=live-20260731-02"></script>
    <script src="js/services/roles.js"></script>
    <script src="js/services/stages.js"></script>
    <script src="js/services/auth.js"></script>

    <script src="js/modules/theme.js"></script>
    <script src="js/modules/session.js"></script>
    <script src="js/modules/navigation.js"></script>
    <script src="js/modules/helpers.js"></script>
    <script src="js/modules/activity.js"></script>
    <script src="js/modules/task-activity-writer.js"></script>
    <script src="js/modules/task-activity.js"></script>
    <script src="js/modules/seed.js"></script>
    <script src="js/modules/profile.js"></script>
    <script src="js/modules/dashboard.js"></script>
    <script src="js/modules/employee-directory.js"></script>
    <script src="js/modules/contacts.js"></script>
    <script src="js/core/permissions.js"></script>
    <script src="js/modules/notes.js"></script>
    <script src="js/modules/kanban.js?v=20260810-01"></script>
    <script src="js/modules/modals.js"></script>
    <script src="js/modules/deals.js"></script>
    <script src="js/modules/attachments.js?v=20260803-03"></script>
    <script src="js/modules/announcements.js"></script>
    <script src="js/modules/departments.js"></script>
    <script src="js/modules/roles.js"></script>
    <script src="js/core/page-permissions.js"></script>
    <script src="js/modules/users.js"></script>
    <script src="js/modules/companies.js"></script>
    <script src="js/modules/login-monitoring.js"></script>
    <script src="js/modules/init.js"></script>

    <!-- ===== REAL-TIME (SOCKET.IO) ===== -->
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script src="js/modules/realtime-sync.js?v=20260804-01"></script>
    <script src="js/modules/socket-handler.js?v=20260804-01"></script>

    <script>
        // ── login monitoring integration, logout, etc. ──
        (function() {
            'use strict';

            function renderLoginMonitoringIfActive() {
                var lmPage = document.getElementById('page-login-monitoring');
                if (lmPage && lmPage.classList.contains('active') && typeof renderLoginMonitoring === 'function') {
                    renderLoginMonitoring();
                }
            }

            document.addEventListener('DOMContentLoaded', function() {
                var page = document.getElementById('page-task-activity');
                if (page && page.classList.contains('active') && typeof renderTaskActivity === 'function') {
                    renderTaskActivity(1);
                }
                renderLoginMonitoringIfActive();
            });

            if (typeof reloadAllData === 'function') {
                var originalReload = window.reloadAllData;
                window.reloadAllData = function() {
                    return originalReload.apply(this, arguments).then(function() {
                        var p = document.getElementById('page-task-activity');
                        if (p && p.classList.contains('active') && typeof renderTaskActivity === 'function') {
                            renderTaskActivity(1);
                        }
                        renderLoginMonitoringIfActive();
                    });
                };
            }

            if (typeof navigate === 'function') {
                var originalNavigate = window.navigate;
                window.navigate = function(page) {
                    originalNavigate(page);
                    if (page === 'task-activity') {
                        setTimeout(function() {
                            if (typeof renderTaskActivity === 'function') {
                                renderTaskActivity(1);
                            }
                        }, 50);
                    }
                    if (page === 'login-monitoring') {
                        setTimeout(function() {
                            renderLoginMonitoringIfActive();
                        }, 50);
                    }
                };
            }

            document.addEventListener('visibilitychange', function() {
                if (!document.hidden) {
                    var lmPage = document.getElementById('page-login-monitoring');
                    if (lmPage && lmPage.classList.contains('active')) {
                        if (typeof refreshLoginData === 'function') {
                            refreshLoginData().then(function() {
                                if (typeof filterLoginLogs === 'function') {
                                    filterLoginLogs();
                                }
                            });
                        }
                    }
                }
            });

            console.log('✅ Login monitoring integration complete');
        })();

        function logout() {
            if (confirm('Are you sure you want to logout?')) {
                window.location.href = 'auth.php?action=logout';
            }
        }
    </script>
</body>
</html>