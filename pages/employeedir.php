         <!-- Employee Directory -->
            <div class="page" id="page-employee-directory">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;width:100%;">
                            <div class="toolbar" style="flex:1;flex-wrap:wrap;gap:8px;">
                                <div class="search-wrap" style="min-width:150px;flex:1;">
                                    <span class="search-icon">🔍</span>
                                    <input type="text" id="ed-search" placeholder="Search employees..." oninput="filterEmployeeDirectory()">
                                </div>
                                <select class="filter-select" id="ed-department-filter" onchange="filterEmployeeDirectory()">
                                    <option value="">All Departments</option>
                                </select>
                                <select class="filter-select" id="ed-company-filter" onchange="filterEmployeeDirectory()">
                                    <option value="">All Companies</option>
                                </select>
                                <select class="filter-select" id="ed-role-filter" onchange="filterEmployeeDirectory()">
                                    <option value="">All Roles</option>
                                </select>
                                <select class="filter-select" id="ed-status-filter" onchange="filterEmployeeDirectory()">
                                    <option value="">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">In-Active</option>
                                </select>
                            </div>
                            <button class="btn btn-ghost" onclick="resetEmployeeDirectoryFilters()">🔄 Reset Filters</button>
                        </div>
                    </div>

                    <div class="stats-grid" id="ed-stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">👤</div>
                            <div class="stat-info">
                                <h4>Total Employees</h4>
                                <span class="stat-number" id="ed-total-count">0</span>
                            </div>
                        </div>
                        <div class="stat-card" style="--card-accent:var(--green);">
                            <div class="stat-icon">✅</div>
                            <div class="stat-info">
                                <h4>Active</h4>
                                <span class="stat-number" id="ed-active-count">0</span>
                            </div>
                        </div>
                        <div class="stat-card" style="--card-accent:var(--red);">
                            <div class="stat-icon">⛔</div>
                            <div class="stat-info">
                                <h4>In-Active</h4>
                                <span class="stat-number" id="ed-inactive-count">0</span>
                            </div>
                        </div>
                        <div class="stat-card" style="--card-accent:var(--accent);">
                            <div class="stat-icon">🟢</div>
                            <div class="stat-info">
                                <h4>Online Now</h4>
                                <span class="stat-number" id="ed-online-count">0</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header" style="justify-content:space-between;">
                            <span>Employee Directory</span>
                            <span class="text-muted" style="font-size:0.75rem;" id="ed-count-label">0 employees</span>
                        </div>
                        <div class="table-wrap" style="max-height:600px;overflow-y:auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Department</th>
                                        <th>Company</th>
                                        <th>Role</th>
                                        <th>Last Active</th>
                                        <th>Duration</th>
                                        <th>Last Login</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody id="ed-tbody">
                                    <tr>
                                        <td colspan="8"><div class="empty-state"><span class="es-icon">👤</span><h3>No employees found</h3><p>Employees will appear here as they are added.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
