
            <!-- Task Activity -->
            <div class="page" id="page-task-activity">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                            <div class="toolbar" style="flex:1; flex-wrap:wrap; gap:8px;">
                                <div class="search-wrap" style="min-width:150px; flex:1;">
                                    <span class="search-icon">🔍</span>
                                    <input type="text" id="ta-search-title" placeholder="Search by task title…" oninput="renderTaskActivity(1)">
                                </div>
                                <div class="search-wrap" style="min-width:150px; flex:1;">
                                    <span class="search-icon">🔍</span>
                                    <input type="text" id="ta-search-employee" placeholder="Search by employee name…" oninput="renderTaskActivity(1)">
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span class="text-muted" style="font-size:0.75rem;" id="ta-count">0 records</span>
                                <button class="btn btn-primary" onclick="exportTaskActivityReport()">📊 Export Report</button>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header" style="justify-content:flex-end; gap:8px;" id="ta-pagination"></div>
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date &amp; Time</th>
                                        <th>Task</th>
                                        <th>Employee</th>
                                        <th>Action</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody id="ta-tbody">
                                    <tr>
                                        <td colspan="5"><div class="empty-state"><span class="es-icon">🕓</span><h3>No activity yet</h3><p>Task activity will appear here once tasks are created or moved.</p></div></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

    