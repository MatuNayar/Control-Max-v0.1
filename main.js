/**
 * CONTROL-MAX - Motor Central
 */

const APP_SECTIONS = [
    'inventory-section', 'sales-section', 'purchases-section', 
    'balance-section', 'accounts-section', 'partners-section', 
    'reports-section', 'history-section', 'admin-section'
];

function showSection(sectionId) {
    // Verificación de seguridad
    if (typeof currentUser !== 'undefined' && currentUser) {
        const allowed = ROLE_PERMISSIONS[currentUser.role] || [];
        if (!allowed.includes(sectionId)) {
            alert("Acceso denegado.");
            return;
        }
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

function formatMoney(amount) {
    const number = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number);
}

function addLog(module, type, description, details = null, refId = null) {
    const logs = JSON.parse(localStorage.getItem('logs')) || [];
    const user = sessionStorage.getItem('currentUser') ? JSON.parse(sessionStorage.getItem('currentUser')).username : 'Sistema';
    const entry = { id: Date.now(), timestamp: new Date().toISOString(), user, module, type, description, details, refId };
    logs.unshift(entry);
    localStorage.setItem('logs', JSON.stringify(logs.slice(0, 1000)));
}

document.addEventListener('DOMContentLoaded', () => {
    const tables = ['products', 'balances', 'customers', 'suppliers', 'expenseHistory', 'partners', 'salesHistory', 'users', 'logs'];
    tables.forEach(t => {
        if (!localStorage.getItem(t)) {
            const initValue = t === 'balances' ? { cash: 0, bank: 0 } : [];
            localStorage.setItem(t, JSON.stringify(initValue));
        }
    });

    let users = JSON.parse(localStorage.getItem('users'));
    if (users.length === 0) {
        users.push({ id: 1, username: 'admin', password: 'admin', role: 'admin', active: true });
        localStorage.setItem('users', JSON.stringify(users));
    }

    const session = sessionStorage.getItem('currentUser');
    if (session) unlockSystem(JSON.parse(session));
});