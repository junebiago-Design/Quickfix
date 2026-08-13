    <!-- Notes -->
            <div class="page" id="page-notes">
                <div class="page-body" style="padding-bottom:0;">
                    <div class="section-toolbar" style="margin-bottom:14px;">
                        <div class="toolbar">
                            <div class="search-wrap">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="note-search" placeholder="Search notes…" oninput="renderNotes()">
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="openNoteModal()">+ Add Note</button>
                    </div>
                    <div class="notes-layout">
                        <div class="notes-list-pane">
                            <div class="notes-list-header">
                                <span>All Notes</span>
                                <span class="text-muted" style="font-size:0.75rem;" id="notes-count">0</span>
                            </div>
                            <div id="notes-list"></div>
                        </div>
                        <div class="notes-detail-pane" id="note-detail">
                            <div class="empty-state" style="height:100%;">
                                <span class="es-icon">◫</span>
                                <h3>Select a note</h3>
                                <p>Choose a note from the left to view its content.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>