
        <!-- Departments -->
            <div class="page" id="page-departments">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div class="toolbar">
                            <div class="search-wrap">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="department-search" placeholder="Search departments…" oninput="renderDepartments()">
                            </div>
                            <select class="filter-select" id="department-filter-status" onchange="renderDepartments()">
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">In-Active</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="openDepartmentModal()">+ Add Department</button>
                    </div>
                    <div class="card">
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Description</th>
                                        <th>Company</th>
                                        <th>Manager</th>
                                        <th>Employees</th>
                                        <th>Status</th>
                                        <th>Added</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="departments-tbody">
                                    <tr>
                                        <td colspan="8"><div class="empty-state"><span class="es-icon">🏢</span><h3>No departments yet</h3><p>Click "Add Department" to create your first one.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
