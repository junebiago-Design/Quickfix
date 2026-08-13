   <!-- Page Access -->
            <div class="page" id="page-page-access">
                <div class="page-body">
                    <div class="section-toolbar">
                        <p style="font-size:0.85rem;color:var(--text3);margin:0;max-width:640px;">Dashboard and My Profile are always visible to everyone. Everything else here can be shown or hidden per role — including inherited roles. System Administrator always sees every page.</p>
                        <button class="btn btn-primary" onclick="savePageAccess()">Save Changes</button>
                    </div>
                    <div class="card">
                        <div class="table-wrap">
                            <table class="permission-matrix">
                                <thead id="page-access-thead"></thead>
                                <tbody id="page-access-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
