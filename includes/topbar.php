
<!-- TOPBAR -->
<div class="topbar">
    <button class="hamburger" onclick="toggleSidebar()">☰</button>
    <div class="topbar-title-wrap" style="flex:1; min-width:0;">
        <div class="topbar-title" id="topbar-title"></div>
        <span class="topbar-sub" id="sidebar-user-name" style="color:var(--text2);font-weight:600;"></span>
        <div class="topbar-sub" id="topbar-sub"></div>
    </div>
    <div style="display:flex;align-items:center;gap:14px;" id="topbar-actions">
        <div class="live-indicator" id="live-indicator">
            <span class="pulse-dot"></span>
            <span>Live</span>
        </div>
        <!-- Reload Data button with ID -->
        <button class="btn btn-danger" id="reload-data-btn" onclick="reloadData()" style="font-size:0.8rem;">⟳ Reload Data</button>
        <button class="btn btn-ghost" onclick="logout()" style="font-size:0.8rem;">Logout</button>
    </div>
    <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
        <span class="toggle-knob" id="theme-toggle-knob">🌙</span>
    </button>
</div>