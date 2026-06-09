/**
 * CONTROL-MAX - Motor Central
 */

const APP_SECTIONS = [
    'inventory-section', 'sales-section', 'purchases-section',
    'balance-section', 'accounts-section', 'partners-section',
    'reports-section', 'history-section', 'admin-section'
];

async function showSection(sectionId) {
    // Verificación de seguridad
    if (typeof currentUser !== 'undefined' && currentUser) {
        const allowed = ROLE_PERMISSIONS[currentUser.role] || [];
        if (!allowed.includes(sectionId)) {
            notify("Acceso denegado.");
            return;
        }
    }

    // Carga perezosa: traer de Firebase las colecciones que usa esta sección.
    try {
        await DB.ensureMany(DB.SECTION_KEYS[sectionId] || []);
    } catch (e) {
        console.error('Error cargando datos de la sección', sectionId, e);
        notify("No se pudieron cargar los datos. Revisá tu conexión / la configuración de Firebase.");
        return;
    }

    // Ocultar todo
    APP_SECTIONS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Mostrar sección
    const target = document.getElementById(`${sectionId}-section`);
    if (target) {
        target.style.display = 'block';
        window.scrollTo(0,0);
    }

    // Sincronización
    if (sectionId === 'inventory') showSubTab('listado');
    if (sectionId === 'sales') updateSalesDropdown();
    if (sectionId === 'balance') renderBalances();
    if (sectionId === 'accounts') showSubTabAccount('clientes');
    if (sectionId === 'partners') showSubTabPartner('listado');
    if (sectionId === 'reports') showSubTabReports('dashboard');
    if (sectionId === 'history') showSubTabHistory();
    if (sectionId === 'admin') showSubTabAdmin('usuarios');

    // Sidebar UI
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${sectionId}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Notificación unificada (reemplaza a alert()). Decide automáticamente:
 *  - Éxito corto  -> toast verde en la esquina (no bloquea).
 *  - Éxito con detalle (varias líneas) -> modal de éxito.
 *  - Error / validación -> modal rojo (error) o ámbar (aviso).
 * Si SweetAlert2 no está disponible, cae al alert() nativo.
 */
function notify(message) {
    const msg = String(message == null ? '' : message);

    if (typeof Swal === 'undefined') { window.alert(msg); return; }

    const isSuccess = /✅|éxito|exito|correcta|exitosa|registrad|guardad|cread|actualiz|procesada|completada|reiniciad|realizado|enviad|restaurad|restauraci/i.test(msg);

    if (isSuccess) {
        if (msg.includes('\n') || msg.length > 55) {
            return Swal.fire({ icon: 'success', title: 'Listo', html: msg.replace(/\n/g, '<br>') });
        }
        return Swal.fire({
            toast: true, position: 'top-end', icon: 'success', title: msg,
            showConfirmButton: false, timer: 2800, timerProgressBar: true
        });
    }

    const isError = /error|incorrect|inválid|invalid|insuficiente|denegad|no coincide|no encontrad|crítico|no se pud|no v[aá]lid/i.test(msg);
    return Swal.fire({
        icon: isError ? 'error' : 'warning',
        title: isError ? 'Error' : 'Atención',
        html: msg.replace(/\n/g, '<br>')
    });
}

/**
 * Confirmación unificada (reemplaza a confirm()). Devuelve una Promesa<boolean>.
 * Usar siempre con await:  if (await confirmAction("¿Eliminar?")) { ... }
 * Si SweetAlert2 no está disponible, cae al confirm() nativo.
 */
async function confirmAction(message, opts = {}) {
    const { confirmText = 'Sí, continuar', icon = 'warning' } = opts;
    if (typeof Swal === 'undefined') return window.confirm(message);
    const r = await Swal.fire({
        title: '¿Estás seguro?',
        html: String(message).replace(/\n/g, '<br>'),
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#6c757d',
        reverseButtons: true,
        focusCancel: true
    });
    return r.isConfirmed;
}

function formatMoney(amount) {
    const number = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

function addLog(module, type, description, details = null, refId = null) {
    const user = sessionStorage.getItem('currentUser') ? JSON.parse(sessionStorage.getItem('currentUser')).username : 'Sistema';
    const entry = { id: Date.now(), timestamp: new Date().toISOString(), user, module, type, description, details, refId };
    // Se agrega un solo registro (push) sin descargar todo el historial.
    if (typeof DB !== 'undefined') DB.push('logs', entry);
}

// ==========================================
//  ARRANQUE
// ==========================================

function domReadyPromise() {
    return new Promise(resolve => {
        if (document.readyState !== 'loading') resolve();
        else document.addEventListener('DOMContentLoaded', resolve);
    });
}

// Restaura sesión / muestra login una vez que Firebase está inicializado y el DOM listo.
function bootSession() {
    const overlay = document.getElementById('db-loading-overlay');
    if (overlay) overlay.style.display = 'none';

    const session = sessionStorage.getItem('currentUser');
    if (session && typeof unlockSystem === 'function') {
        unlockSystem(JSON.parse(session));
    }
}

Promise.all([domReadyPromise(), DB.init()])
    .then(bootSession)
    .catch(err => {
        console.error('Error inicializando Firebase', err);
        const t = document.getElementById('db-loading-text');
        if (t) t.innerText = 'Error al conectar. Revisá la configuración de Firebase en js/db.js y tu conexión a internet.';
    });
