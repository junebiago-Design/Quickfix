  
            <!-- Companies -->
            <div class="page" id="page-companies">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div class="toolbar">
                            <div class="search-wrap">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="company-search" placeholder="Search companies…" oninput="renderCompanies()">
                            </div>
                            <select class="filter-select" id="company-filter-status" onchange="renderCompanies()">
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">In-Active</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="openCompanyModal()">+ Add Company</button>
                    </div>
                    <div class="card">
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Industry</th>
                                        <th>Phone</th>
                                        <th>Website</th>
                                        <th>Employees</th>
                                        <th>Status</th>
                                        <th>Added</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody id="companies-tbody">
                                    <tr>
                                        <td colspan="8"><div class="empty-state"><span class="es-icon">🏬</span><h3>No companies yet</h3><p>Click "Add Company" to create your first one.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
