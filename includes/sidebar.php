    <!-- Inject user data from session -->
    <script>
       window.__tmsUser = <?php echo json_encode($user) ?>;
    </script>

    <div id="app-shell" style="display:none;">
        <!-- SIDEBAR OVERLAY -->
        <div id="sidebar-overlay" onclick="closeSidebar()"></div>

        <!-- SIDEBAR -->
        <nav id="sidebar">
            <div class="sidebar-logo">
                <div class="logo-icon">⬡</div>
                <div>
                    <div class="logo-text">TMS</div>
                    <div class="logo-sub">Task Management</div>
                </div>
            </div>
            <div class="sidebar-nav">
                <div class="nav-section-label" style="margin-top:8px">Account</div>
                <div class="nav-item" data-page="profile" onclick="navigate('profile')">
                    <span class="nav-icon">👤</span> My Profile
                </div>

                <div class="nav-section-label">Workspace</div>
                <div class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">
                    <span class="nav-icon">⊞</span> Dashboard
                </div>
                <div class="nav-item" data-page="deals" onclick="navigate('deals')">
                    <span class="nav-icon">📋</span> Task
                </div>

                <div class="nav-section-label" style="margin-top:8px">Company Settings</div>
                <div class="nav-item" data-page="contacts" onclick="navigate('contacts')">
                    <span class="nav-icon">👥</span> Add Employee
                </div>

                <div class="nav-item" data-page="employee-directory" onclick="navigate('employee-directory')">
                    <span class="nav-icon">👤</span> Employee
                </div>

                <div class="nav-item" data-page="departments" onclick="navigate('departments')">
                    <span class="nav-icon">🏢</span> Departments
                </div>
                <div class="nav-item" data-page="companies" onclick="navigate('companies')">
                    <span class="nav-icon">🏬</span> Companies
                </div>

                <div class="nav-section-label" style="margin-top:8px">System Settings</div>
                <div class="nav-item" data-page="roles" onclick="navigate('roles')" id="nav-roles">
                    <span class="nav-icon">🛡️</span> Roles
                </div>
                <div class="nav-item" data-page="users" onclick="navigate('users')" id="nav-users">
                    <span class="nav-icon">🔑</span> Users
                </div>

                <div class="nav-section-label" style="margin-top:8px">System Directory</div>
                <div class="nav-item" data-page="tasks" onclick="navigate('tasks')">
                    <span class="nav-icon">📢</span> Announcement
                </div>
                <div class="nav-item" data-page="notes" onclick="navigate('notes')">
                    <span class="nav-icon">◫</span> Notes
                </div>
                <div class="nav-item" data-page="task-activity" onclick="navigate('task-activity')">
                    <span class="nav-icon">🕓</span> Task Activity
                </div>

                <div class="nav-section-label" style="margin-top:8px">Security & Monitoring</div>
                <div class="nav-item" data-page="page-access" onclick="navigate('page-access')" id="nav-page-access">
                    <span class="nav-icon">🧭</span> Page Access
                </div>
                <div class="nav-item" data-page="login-monitoring" onclick="navigate('login-monitoring')" id="nav-login-monitoring">
                    <span class="nav-icon">🔐</span> Login Monitoring
                </div>
            </div>

            <div class="sidebar-footer">
                <span id="sidebar-footer-email"><?= htmlspecialchars($user['email'] ?? '') ?></span>
                Task Management System · TMS V 1.2.1
            </div>
        </nav>
