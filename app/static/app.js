/* ========================================
   ContactHub — Application Logic
   ======================================== */

const API_URL = '/api';
let contacts = [];
let currentView = 'grid';
let searchTimeout = null;
let currentDetailContact = null;
let deleteTargetId = null;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    loadContacts();
    loadStats();
    setupKeyboardShortcuts();
});

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('search-input').focus();
        }
        // Escape to close modals
        if (e.key === 'Escape') {
            closeModal();
            closeDetail();
            closeDeleteModal();
        }
        // Ctrl+N to add new contact
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openModal();
        }
    });
}

// ==================== API CALLS ====================

async function loadContacts(search = '') {
    showLoading(true);
    try {
        const url = search
            ? `${API_URL}/contacts?search=${encodeURIComponent(search)}`
            : `${API_URL}/contacts`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load contacts');
        contacts = await res.json();
        renderContacts();
    } catch (err) {
        showToast('Gagal memuat kontak: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        if (!res.ok) throw new Error('Failed to load stats');
        const stats = await res.json();
        animateNumber('stat-total', stats.total_contacts);
        animateNumber('stat-companies', stats.total_companies);
    } catch (err) {
        console.error('Stats error:', err);
    }
}

async function createContact(data) {
    const res = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to create contact');
    }
    return res.json();
}

async function updateContact(id, data) {
    const res = await fetch(`${API_URL}/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to update contact');
    }
    return res.json();
}

async function deleteContact(id) {
    const res = await fetch(`${API_URL}/contacts/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to delete contact');
    }
    return res.json();
}

// ==================== RENDERING ====================

function renderContacts() {
    const grid = document.getElementById('contacts-grid');
    const emptyState = document.getElementById('empty-state');

    if (contacts.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    grid.innerHTML = contacts.map((contact, index) => {
        const initials = getInitials(contact.name);
        const color = contact.avatar_color || '#6C63FF';

        return `
            <div class="contact-card" 
                 style="animation-delay: ${index * 0.05}s" 
                 onclick="openDetail(${contact.id})"
                 id="contact-card-${contact.id}">
                <div class="card-top">
                    <div class="card-avatar" style="background: ${color}">
                        ${initials}
                    </div>
                    <div class="card-info">
                        <div class="card-name">${escapeHtml(contact.name)}</div>
                        <div class="card-role">${escapeHtml(contact.role || 'No role')}</div>
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn" onclick="event.stopPropagation(); editContact(${contact.id})" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="card-action-btn danger" onclick="event.stopPropagation(); openDeleteModal(${contact.id}, '${escapeHtml(contact.name)}')" title="Hapus">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="card-details">
                    <div class="card-detail">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span>${escapeHtml(contact.email)}</span>
                    </div>
                    ${contact.phone ? `
                    <div class="card-detail">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <span>${escapeHtml(contact.phone)}</span>
                    </div>
                    ` : ''}
                </div>
                ${contact.company ? `
                <div class="card-tags">
                    <span class="card-tag card-tag-company">${escapeHtml(contact.company)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ==================== MODAL HANDLERS ====================

function openModal(contactId = null) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const submitText = document.getElementById('form-submit-text');
    const form = document.getElementById('contact-form');

    form.reset();
    document.getElementById('contact-id').value = '';
    document.getElementById('form-color').value = '#6C63FF';

    if (contactId) {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
            title.textContent = 'Edit Kontak';
            submitText.textContent = 'Simpan Perubahan';
            document.getElementById('contact-id').value = contact.id;
            document.getElementById('form-name').value = contact.name || '';
            document.getElementById('form-email').value = contact.email || '';
            document.getElementById('form-phone').value = contact.phone || '';
            document.getElementById('form-company').value = contact.company || '';
            document.getElementById('form-role').value = contact.role || '';
            document.getElementById('form-notes').value = contact.notes || '';
            document.getElementById('form-color').value = contact.avatar_color || '#6C63FF';
        }
    } else {
        title.textContent = 'Tambah Kontak Baru';
        submitText.textContent = 'Simpan Kontak';
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        document.getElementById('form-name').focus();
    }, 300);
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function closeModalOutside(event) {
    if (event.target === event.currentTarget) {
        closeModal();
    }
}

async function submitForm(event) {
    event.preventDefault();

    const contactId = document.getElementById('contact-id').value;
    const data = {
        name: document.getElementById('form-name').value.trim(),
        email: document.getElementById('form-email').value.trim(),
        phone: document.getElementById('form-phone').value.trim() || null,
        company: document.getElementById('form-company').value.trim() || null,
        role: document.getElementById('form-role').value.trim() || null,
        notes: document.getElementById('form-notes').value.trim() || null,
        avatar_color: document.getElementById('form-color').value,
    };

    if (!data.name || !data.email) {
        showToast('Nama dan email wajib diisi!', 'error');
        return;
    }

    const submitBtn = document.getElementById('form-submit-btn');
    submitBtn.disabled = true;

    try {
        if (contactId) {
            await updateContact(contactId, data);
            showToast('Kontak berhasil diperbarui! ✨', 'success');
        } else {
            await createContact(data);
            showToast('Kontak baru berhasil ditambahkan! 🎉', 'success');
        }

        closeModal();
        loadContacts();
        loadStats();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

// ==================== DETAIL VIEW ====================

function openDetail(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    currentDetailContact = contact;
    const overlay = document.getElementById('detail-overlay');
    const color = contact.avatar_color || '#6C63FF';

    document.getElementById('detail-header').style.background = `linear-gradient(180deg, ${color}15 0%, transparent 100%)`;
    document.getElementById('detail-avatar').style.background = color;
    document.getElementById('detail-avatar').textContent = getInitials(contact.name);
    document.getElementById('detail-name').textContent = contact.name;

    const roleCompany = [contact.role, contact.company].filter(Boolean).join(' • ');
    document.getElementById('detail-role-company').textContent = roleCompany || 'Tidak ada informasi';

    document.getElementById('detail-email').textContent = contact.email;

    const phoneRow = document.getElementById('detail-phone-row');
    if (contact.phone) {
        phoneRow.style.display = 'flex';
        document.getElementById('detail-phone').textContent = contact.phone;
    } else {
        phoneRow.style.display = 'none';
    }

    const companyRow = document.getElementById('detail-company-row');
    if (contact.company) {
        companyRow.style.display = 'flex';
        document.getElementById('detail-company').textContent = contact.company;
    } else {
        companyRow.style.display = 'none';
    }

    if (contact.created_at) {
        document.getElementById('detail-created').textContent = formatDate(contact.created_at);
    }

    const notesSection = document.getElementById('detail-notes-section');
    if (contact.notes) {
        notesSection.style.display = 'block';
        document.getElementById('detail-notes').textContent = contact.notes;
    } else {
        notesSection.style.display = 'none';
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetail() {
    const overlay = document.getElementById('detail-overlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    currentDetailContact = null;
}

function closeDetailOutside(event) {
    if (event.target === event.currentTarget) {
        closeDetail();
    }
}

function editFromDetail() {
    if (currentDetailContact) {
        const id = currentDetailContact.id;
        closeDetail();
        setTimeout(() => openModal(id), 200);
    }
}

function deleteFromDetail() {
    if (currentDetailContact) {
        const contact = currentDetailContact;
        closeDetail();
        setTimeout(() => openDeleteModal(contact.id, contact.name), 200);
    }
}

// ==================== EDIT & DELETE ====================

function editContact(contactId) {
    openModal(contactId);
}

function openDeleteModal(contactId, contactName) {
    deleteTargetId = contactId;
    const overlay = document.getElementById('delete-overlay');
    document.getElementById('delete-message').textContent =
        `Kontak "${contactName}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.`;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
    const overlay = document.getElementById('delete-overlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    deleteTargetId = null;
}

async function confirmDelete() {
    if (!deleteTargetId) return;

    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true;

    try {
        await deleteContact(deleteTargetId);
        showToast('Kontak berhasil dihapus 🗑️', 'success');
        closeDeleteModal();
        loadContacts();
        loadStats();
    } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ==================== SEARCH ====================

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById('search-input').value.trim();
        loadContacts(query);
    }, 300);
}

// ==================== VIEW TOGGLE ====================

function setView(view) {
    currentView = view;
    const grid = document.getElementById('contacts-grid');
    const gridBtn = document.getElementById('view-grid');
    const listBtn = document.getElementById('view-list');

    if (view === 'list') {
        grid.classList.add('list-view');
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
    } else {
        grid.classList.remove('list-view');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    }
}

// ==================== SIDEBAR ====================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// ==================== COLOR PICKER ====================

function setColor(color) {
    document.getElementById('form-color').value = color;
}

// ==================== UTILITIES ====================

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

function showLoading(show) {
    const loader = document.getElementById('loading-state');
    const grid = document.getElementById('contacts-grid');
    const empty = document.getElementById('empty-state');

    if (show) {
        loader.style.display = 'flex';
        grid.style.display = 'none';
        empty.style.display = 'none';
    } else {
        loader.style.display = 'none';
        grid.style.display = '';
    }
}

function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    const start = parseInt(el.textContent) || 0;
    const duration = 500;
    const startTime = Date.now();

    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);
        el.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    update();
}

// ==================== TOAST NOTIFICATIONS ====================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconSvg = type === 'success'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
