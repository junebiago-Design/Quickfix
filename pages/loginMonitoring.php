 
            <!-- ── LOGIN MONITORING PAGE ── -->
            <div class="page" id="page-login-monitoring">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;width:100%;">
                            <div class="toolbar" style="flex:1;flex-wrap:wrap;gap:8px;">
                                <div class="search-wrap" style="min-width:150px;flex:1;">
                                    <span class="search-icon">🔍</span>
                                    <input type="text" id="lm-search" placeholder="Search logs..." oninput="filterLoginLogs()">
                                </div>
                                <select class="filter-select" id="lm-status-filter" onchange="filterLoginLogs()">
                                    <option value="">All Status</option>
                                    <option value="success">✅ Success</option>
                                    <option value="failed">❌ Failed</option>
                                </select>
                                <select class="filter-select" id="lm-employee-filter" onchange="filterLoginLogs()">
                                    <option value="">All Employees</option>
                                </select>
                                <select class="filter-select" id="lm-department-filter" onchange="filterLoginLogs()">
                                    <option value="">All Departments</option>
                                </select>
                                <select class="filter-select" id="lm-company-filter" onchange="filterLoginLogs()">
                                    <option value="">All Companies</option>
                                </select>
                            </div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <input type="date" id="lm-date-from" class="filter-select" style="width:auto;" onchange="filterLoginLogs()">
                                <span style="color:var(--text3);align-self:center;">to</span>
                                <input type="date" id="lm-date-to" class="filter-select" style="width:auto;" onchange="filterLoginLogs()">
                            </div>
                            <button class="btn btn-primary" onclick="exportLoginReport()">📊 Export Report</button>
                            <button class="btn btn-ghost" onclick="clearLoginLogsUI()" title="Clear logs older than 30 days">🗑️ Clean Old</button>
                        </div>
                    </div>

                    <div class="stats-grid" id="lm-stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">📊</div>
                            <div class="stat-info">
                                <h4>Total Logins</h4>
                                <span class="stat-number" id="lm-total">0</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">✅</div>
                            <div class="stat-info">
                                <h4>Success Rate</h4>
                                <span class="stat-number" id="lm-success-rate">0%</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⚠️</div>
                            <div class="stat-info">
                                <h4>Failed Attempts</h4>
                                <span class="stat-number" id="lm-failed">0</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">👤</div>
                            <div class="stat-info">
                                <h4>Unique Users</h4>
                                <span class="stat-number" id="lm-unique-users">0</span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📅</div>
                            <div class="stat-info">
                                <h4>Last 24 Hours</h4>
                                <span class="stat-number" id="lm-last24">0</span>
                            </div>
                        </div>
                    </div>
                    <div id="lm-pagination" style="display:flex;left-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px;">
                        <!-- Pagination will be rendered here -->
                    </div>
                    <div class="card">
                        <div class="card-header" style="justify-content:space-between;">
                            <span>Login Logs</span>
                            <span class="text-muted" style="font-size:0.75rem;" id="lm-count">0 records</span>
                        </div>
                        <div class="table-wrap" style="max-height:600px;overflow-y:auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Login Time</th>
                                        <th>Status</th>
                                        <th>IP Address</th>
                                        <th>Location</th>
                                        <th>Device</th>
                                        <th>Browser</th>
                                        <th>Duration</th>
                                    </tr>
                                </thead>
                                <tbody id="lm-tbody">
                                    <tr>
                                        <td colspan="8"><div class="empty-state"><span class="es-icon">🔐</span><h3>No login logs found</h3><p>Login activity will appear here as users log in.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div><!-- end #main -->
