/**
 * CONTROL-MAX - Módulo ADMIN
 */

function showSubTabAdmin(tabId) {
    document.querySelectorAll('.admin-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-admin-${tabId}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('#admin-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if (tabId === 'usuarios') renderUsers();
    if (tabId === 'logs') renderLogs();
}

// --- GESTIÓN DE USUARIOS ---

function renderUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const users = DB.get('users', []);

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${u.username}</strong> ${u.username === 'admin' ? '<small>(Sistema)</small>' : ''}</td>
            <td>${u.role.toUpperCase()}</td>
            <td>
                <span class="sub-btn" style="background:${u.active ? 'var(--success)' : 'var(--danger)'}; color:white; padding:2px 10px; cursor:default">
                    ${u.active ? 'Activo' : 'Suspendido'}
                </span>
            </td>
            <td>
                <button class="btn-edit" onclick="editUser(${u.id})"><i class="fas fa-key"></i></button>
                ${u.username !== 'admin' ? `
                    <button class="btn-delete" onclick="deleteUser(${u.id})"><i class="fas fa-user-slash"></i></button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openUserModal() {
    document.getElementById('user-modal').style.display = 'flex';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
}

function closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
}

document.getElementById('user-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const username = document.getElementById('user-username').value.trim();
    const pass = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    let users = DB.get('users', []);

    if (id) {
        // Editar
        const idx = users.findIndex(u => u.id == id);
        users[idx].username = username;
        users[idx].role = role;
        if (pass !== "") users[idx].password = pass; // Solo actualiza si escribe algo
        addLog('ADMIN', 'USUARIO_EDITADO', `Se editó al usuario: ${username}`);
    } else {
        // Nuevo
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return notify("El nombre de usuario ya existe.");
        }
        users.push({
            id: Date.now(),
            username,
            password: pass || '1234', // Pass por defecto si está vacío
            role,
            active: true
        });
        addLog('ADMIN', 'USUARIO_CREADO', `Se creó al usuario: ${username}`);
    }

    await DB.set('users', users);
    closeUserModal();
    renderUsers();
});

async function deleteUser(id) {
    if (await confirmAction("¿Seguro que desea eliminar este usuario?")) {
        let users = DB.get('users', []);
        const userToDelete = users.find(u => u.id == id);
        users = users.filter(u => u.id != id);
        await DB.set('users', users);
        addLog('ADMIN', 'USUARIO_ELIMINADO', `Se eliminó al usuario: ${userToDelete.username}`);
        renderUsers();
    }
}

// --- BASE DE DATOS (IMPORT/EXPORT) ---

async function exportDatabase() {
    try { await DB.ensureMany(DB.ALL_KEYS); }
    catch (e) { return notify("Error de conexión con la base de datos."); }

    const backup = {};
    DB.ALL_KEYS.forEach(key => { backup[key] = DB.get(key); });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `control_max_backup_${new Date().toLocaleDateString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    addLog('ADMIN', 'BACKUP_EXPORT', "Exportación de base de datos realizada");
}

function importDatabase() {
    const fileInput = document.getElementById('import-file');
    if (!fileInput.files[0]) return notify("Por favor seleccione un archivo .json");

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (await confirmAction("⚠️ ADVERTENCIA: Esto borrará todos los datos actuales en la nube y los reemplazará. ¿Desea continuar?", { confirmText: 'Sí, restaurar' })) {
                await DB.replaceAll(data);
                notify("Restauración completada. El sistema se reiniciará.");
                window.location.reload();
            }
        } catch (err) {
            console.error(err);
            notify("Error: El archivo no es un backup válido de Control-Max o falló la conexión.");
        }
    };
    reader.readAsText(fileInput.files[0]);
}

// Borra TODA la base de datos en la nube (acción destructiva).
async function factoryReset() {
    if (!(await confirmAction("⚠️ ¡ATENCIÓN! Esto BORRARÁ TODOS los datos del sistema en la nube de forma permanente. ¿Continuar?", { confirmText: 'Sí, borrar todo' }))) return;
    if (!(await confirmAction("Confirmación final: esta acción NO se puede deshacer. ¿Borrar todo?", { confirmText: 'Borrar definitivamente' }))) return;
    try {
        await DB.clearAll();
        notify("Sistema reiniciado de fábrica. La página se recargará.");
        window.location.reload();
    } catch (e) {
        console.error(e);
        notify("No se pudo completar el reinicio. Revisá tu conexión.");
    }
}

// --- AUDITORÍA ---

function renderLogs() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const logs = DB.get('logs', []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><small>${l.date}</small></td>
            <td><strong>${l.user}</strong></td>
            <td>${l.action}</td>
        `;
        tbody.appendChild(tr);
    });
}