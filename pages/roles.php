    <!-- Roles -->
            <div class="page" id="page-roles">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div class="toolbar">
                            <div class="search-wrap">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="role-search" placeholder="Search roles…" oninput="renderRoles()">
                            </div>
                            <select class="filter-select" id="role-filter-status" onchange="renderRoles()">
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">In-Active</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="openRoleModal()">+ Add Role</button>
                    </div>
                    <div class="card">
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Role Name</th>
                                        <th>Description</th>
                                        <th>Employees</th>
                                        <th>Status</th>
                                        <th>Created At</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="roles-tbody">
                                    <tr>
                                        <td colspan="6"><div class="empty-state"><span class="es-icon">🛡️</span><h3>No roles yet</h3><p>Click "Add Role" to create your first one.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

   