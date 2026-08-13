   
            <!-- Users -->
            <div class="page" id="page-users">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div class="toolbar">
                            <div class="search-wrap">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="user-search" placeholder="Search users…" oninput="renderUsers()">
                            </div>
                            <select class="filter-select" id="user-filter-status" onchange="renderUsers()">
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">In-Active</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="openUserModal()">+ Register User</button>
                    </div>
                    <div class="card">
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Employee</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Created At</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="users-tbody">
                                    <tr>
                                        <td colspan="6"><div class="empty-state"><span class="es-icon">🔑</span><h3>No users yet</h3><p>Click "Register User" to create your first one.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
