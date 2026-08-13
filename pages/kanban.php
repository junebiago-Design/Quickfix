      
            <!-- Deals (Kanban) -->
            <div class="page" id="page-deals">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
                            <div class="toolbar" style="flex:1; flex-wrap:wrap; gap:8px;">
                                <div class="search-wrap" style="min-width:150px; flex:1;">
                                    <span class="search-icon">🔍</span>
                                    <input type="text" id="kanban-search" placeholder="Search tasks…" oninput="renderKanban()">
                                </div>
                                <select class="filter-select" id="kanban-filter-status" onchange="renderKanban()">
                                    <option value="">All Tasks</option>
                                    <option value="overdue">Overdue</option>
                                    <option value="completed">Completed</option>
                                    <option value="high">High Priority</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" id="deals-add-btn" onclick="openDealModal()">+ Add Task</button>
                        </div>
                        <div class="pipeline-summary" id="pipeline-summary" style="margin-top:8px;"></div>
                    </div>
                    <div class="kanban-board" id="kanban-board"></div>
                </div>
            </div>
