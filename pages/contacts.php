  <!-- Contacts -->
            <div class="page" id="page-contacts">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                            <div class="toolbar" style="flex:1; flex-wrap:wrap; gap:8px;">
                                <div class="search-wrap" style="min-width:150px; flex:1;">
                                    <span class="search-icon">🔍</span>
                                    <input type="text" id="contact-search" placeholder="Search employees…" oninput="renderContacts()">
                                </div>
                                <select class="filter-select" id="contact-filter-status" onchange="renderContacts()">
                                    <option value="">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">In-Active</option>
                                </select>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span class="text-muted" style="font-size:0.75rem;" id="contact-count-label">0 employees</span>
                                <button class="btn btn-primary" onclick="openContactModal()">+ Add Employee</button>
                                <button class="btn btn-primary" onclick="exportContactsReport()">📊 Export Report</button>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Company</th>
                                        <th>Department</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Added</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="contacts-tbody">
                                    <tr>
                                        <td colspan="9"><div class="empty-state"><span class="es-icon">👤</span><h3>No employees yet</h3><p>Click "Add Employee" to create your first one.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
