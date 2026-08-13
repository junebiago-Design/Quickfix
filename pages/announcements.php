      <!-- Tasks (Announcements) -->
            <div class="page" id="page-tasks">
                <div class="page-body">
                    <div class="section-toolbar">
                        <div class="toolbar">
                            <div class="search-wrap">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="task-search" placeholder="Search announcements…" oninput="renderTasks()">
                            </div>
                            <select class="filter-select" id="task-filter" onchange="renderTasks()">
                                <option value="">All Announcements</option>
                                <option value="todo">Unpublished</option>
                                <option value="done">Published</option>
                                <option value="high">High Priority</option>
                                <option value="overdue">Overdue</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" id="tasks-add-btn" onclick="openTaskModal()">+ Add Announcement</button>
                    </div>
                    <div class="task-list" id="task-list"></div>
                </div>
            </div>
