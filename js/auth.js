/**
 * CONTROL-MAX - Módulo de Autenticación y Seguridad
 */

let currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || null;

// Definición de permisos por Rol
const ROLE_PERMISSIONS = {
    'admin': ['inventory', 'sales', 'purchases', 'balance', 'accounts', 'partners', 'reports', 'history', 'admin'],
    'vendedor': ['sales', 'inventory', 'reports'],
    'contable': ['balance', 'accounts', 'purchases', 'reports']
};

/**
 * PROCESO DE LOGIN
 */
document.getElementById('login-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const uInput = document.getElementById('login-username').value.trim();
    const pInput = document.getElementById('login-password').value;

    try {
        await DB.ensure('users');
    } catch (err) {
        return notify("No se pudo conectar con la base de datos. Revisá tu conexión / la configuración de Firebase.");
    }

    const users = DB.get('users', []);

    // Buscar coincidencia exacta
    const userFound = users.find(u => 
        u.username.toLowerCase() === uInput.toLowerCase() && 
        u.password === pInput && 
        u.active === true
    );

    if (userFound) {
        sessionStorage.setItem('currentUser', JSON.stringify(userFound));
        currentUser = userFound;
        
        // Desbloquear Interfaz
        unlockSystem(userFound);
        
        if (typeof addLog === 'function') addLog('AUTH', 'LOGIN', `Usuario ${userFound.username} ingresó`);
    } else {
        notify("Credenciales incorrectas o usuario desactivado.");
    }
});

/**
 * Función para mostrar el sistema y ocultar el login
 */
function unlockSystem(user) {
    // 1. Eliminar el bloqueo del login
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';

    // 2. Mostrar Sidebar y App
    document.getElementById('main-sidebar').style.display = 'flex';
    document.getElementById('app').style.display = 'block';

    // 3. Mostrar Rol
    const roleDisplay = document.getElementById('display-user-role');
    if (roleDisplay) roleDisplay.innerText = `Rol: ${user.role.toUpperCase()}`;

    // 4. Filtrar permisos
    applyPermissions();

    // 5. Ir a Inventario por defecto
    showSection('inventory');
}

/**
 * Oculta/Muestra botones de la sidebar según el rol
 */
function applyPermissions() {
    if (!currentUser) return;
    const allowed = ROLE_PERMISSIONS[currentUser.role] || [];
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const action = btn.getAttribute('onclick');
        if (action) {
            const sectionName = action.match(/'([^']+)'/)[1];
            btn.style.display = allowed.includes(sectionName) ? 'flex' : 'none';
        }
    });

    // Restricción extra: solo admin ve botones de borrar
    if (currentUser.role !== 'admin') {
        document.querySelectorAll('.btn-delete').forEach(b => b.style.display = 'none');
    }
}

async function logout() {
    if (await confirmAction("¿Cerrar sesión?", { confirmText: 'Cerrar sesión', icon: 'question' })) {
        sessionStorage.removeItem('currentUser');
        window.location.reload();
    }
}

// La restauración de sesión la maneja bootSession() en main.js, una vez que
// Firebase está inicializado y el DOM listo.