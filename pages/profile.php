  
            <!-- My Profile -->
            <div class="page" id="page-profile">
                <div class="page-body">
                    <!-- Profile header -->
                    <div class="card" style="margin-bottom:16px;">
                        <div class="card-body" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                            <div id="profile-avatar" style="width:64px;height:64px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.4rem;flex-shrink:0;">?</div>
                            <div style="flex:1;min-width:200px;">
                                <div id="profile-fullname" style="font-weight:700;font-size:1.15rem;">—</div>
                                <div style="font-size:0.85rem;color:var(--text3);margin-top:2px;">
                                    <span id="profile-username">—</span>
                                    <span style="margin:0 6px;">·</span>
                                    <span id="profile-role">—</span>
                                </div>
                                <div style="margin-top:8px;" id="profile-status-badge"></div>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-grid">
                        <!-- Employee Details -->
                        <div class="card">
                            <div class="card-header"><span>Employee Details</span></div>
                            <div class="card-body" style="padding:18px 20px;">
                                <div id="profile-employee-details" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.85rem;"></div>
                            </div>
                        </div>
                        <!-- Change Password -->
                        <div class="card">
                            <div class="card-header"><span>Change Password</span></div>
                            <div class="card-body" style="padding:18px 20px;">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">Current Password *</label>
                                        <input type="password" id="profile-current-password" placeholder="Enter current password">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">New Password *</label>
                                        <input type="password" id="profile-new-password" placeholder="Enter new password">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Confirm New Password *</label>
                                        <input type="password" id="profile-confirm-password" placeholder="Re-enter new password">
                                    </div>
                                </div>
                                <div style="margin-top:14px;text-align:right;">
                                    <button class="btn btn-primary" onclick="changeMyPassword()">Update Password</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-grid" style="margin-top:16px;">
                        <!-- My Active Tasks -->
                        <div class="card">
                            <div class="card-header">
                                <span>My Active Tasks</span>
                                <span class="text-muted" style="font-size:0.75rem;font-weight:400;" id="profile-tasks-count"></span>
                            </div>
                            <div class="card-body" style="padding:16px;">
                                <div id="profile-tasks-list" class="task-list"></div>
                            </div>
                        </div>
                        <!-- Pending Notes -->
                        <div class="card">
                            <div class="card-header">
                                <span>Pending Comments / Revisions</span>
                                <span class="text-muted" style="font-size:0.75rem;font-weight:400;" id="profile-notes-count"></span>
                            </div>
                            <div class="card-body" style="padding:8px 0;">
                                <div id="profile-notes-list"></div>
                            </div>
                        </div>
                    </div>

                    <div class="card" style="margin-top:16px;">
                        <div class="card-header">
                            <span>My Recent Activity</span>
                            <span class="text-muted" style="font-size:0.75rem;font-weight:400;" id="profile-activity-count"></span>
                        </div>
                        <div class="card-body">
                            <ul class="activity-list" id="profile-activity-list"></ul>
                        </div>
                    </div>
                </div>
            </div>
