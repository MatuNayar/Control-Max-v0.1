/**
 * CONTROL-MAX - Módulo de Cuentas Corrientes (Clientes y Proveedores)
 */

// Estado global de los datos (se hidratan desde Firebase al entrar a la sección).
let customers = [];
let suppliers = [];
let selectedEntityId = null;
let selectedEntityType = null; // 'customer' o 'supplier'

function hydrateAccounts() {
    customers = DB.get('customers', []);
    suppliers = DB.get('suppliers', []);
}

// Refresco en vivo cuando cambian clientes/proveedores desde otra PC.
DB.onChange('customers', () => {
    customers = DB.get('customers', []);
    const sec = document.getElementById('accounts-section');
    if (sec && sec.style.display !== 'none') renderEntities('clientes');
});
DB.onChange('suppliers', () => {
    suppliers = DB.get('suppliers', []);
    const sec = document.getElementById('accounts-section');
    if (sec && sec.style.display !== 'none') renderEntities('proveedores');
});

/**
 * Navegación de sub-pestañas
 */
function showSubTabAccount(tabId) {
    hydrateAccounts();
    document.querySelectorAll('.account-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-${tabId}`);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('#accounts-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    renderEntities(tabId);
}

/**
 * Renderiza Clientes o Proveedores en formato de Tarjetas
 */
function renderEntities(type) {
    // type: 'clientes' o 'proveedores'
    const isClient = (type === 'clientes');
    const list = isClient ? customers : suppliers;
    const containerId = isClient ? 'customers-cards-container' : 'suppliers-cards-container';
    const container = document.getElementById(containerId);
    
    if (!container) return;
    container.innerHTML = '';

    const activeList = list.filter(e => e.active !== false);

    if (activeList.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:#999;">No hay ${type} registrados.</p>`;
        return;
    }

    activeList.forEach(e => {
        const balanceValue = parseFloat(e.balance) || 0;
        const labelSaldo = isClient ? 'Deuda:' : 'Le debemos:';
        
        // Color del saldo: Rojo si hay deuda, verde si está en 0 o a favor
        const balanceColor = isClient 
            ? (balanceValue > 0 ? 'var(--danger)' : 'var(--success)') 
            : (balanceValue > 0 ? 'var(--danger)' : 'var(--success)');

        container.innerHTML += `
            <div class="client-item-card">
                <div class="client-info">
                    <h3>${e.name}</h3>
                    <span>ID: ${e.taxId || 'S/D'}</span>
                </div>
                <div style="text-align:right">
                    <span style="font-size: 0.75rem; color: #888;">${labelSaldo}</span><br>
                    <strong style="color: ${balanceColor}">
                        $ ${formatMoney(balanceValue)}
                    </strong><br>
                    <button class="sub-btn" style="margin-top:8px; padding: 4px 12px; font-size:0.8rem;" 
                        onclick="openProfile('${isClient ? 'customer' : 'supplier'}', ${e.id})">
                        Ver / Cobrar
                    </button>
                </div>
            </div>
        `;
    });
}

// ==========================================
// GESTIÓN DE PERFILES (CLIENTES Y PROVEEDORES)
// ==========================================

/**
 * Abre el perfil (Cualquier entidad)
 */
function openProfile(type, id) {
    selectedEntityType = type;
    selectedEntityId = id;

    const isClient = (type === 'customer');
    const list = isClient ? customers : suppliers;
    const entity = list.find(e => e.id === id);
    if (!entity) return;

    // Configurar Modal
    const modalId = isClient ? 'client-profile-modal' : 'supplier-profile-modal';
    const prefix = isClient ? 'prof-client' : 'prof-supp';
    
    document.getElementById(modalId).style.display = 'flex';
    document.getElementById(`${prefix}-name`).innerText = entity.name;
    
    const debtEl = document.getElementById(`${prefix}-debt`);
    debtEl.innerText = `$ ${formatMoney(entity.balance)}`;
    debtEl.style.color = entity.balance > 0 ? 'var(--danger)' : 'var(--success)';

    renderIndividualHistory(entity, isClient);
}

function closeClientProfile() {
    document.getElementById('client-profile-modal').style.display = 'none';
}

function closeSupplierProfile() {
    document.getElementById('supplier-profile-modal').style.display = 'none';
}

/**
 * Dibuja el historial en dos columnas (Pago / Deuda)
 */
function renderIndividualHistory(entity, isClient) {
    const containerId = isClient ? 'client-individual-history' : 'supp-individual-history';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!entity.history || entity.history.length === 0) {
        container.innerHTML = '<p style="color:#ccc; text-align:center; padding:20px;">Sin movimientos</p>';
        return;
    }

    [...entity.history].reverse().forEach(h => {
        const isPago = (h.type === 'PAGO');
        const row = document.createElement('div');
        row.className = 'hist-row';

        if (isPago) {
            // Columna Izquierda: Pagos (Signo -)
            row.innerHTML = `
                <div class="hist-cell">
                    <span class="hist-amount val-pago">-${formatMoney(h.amount)}</span>
                    <span class="hist-date">${h.date}</span>
                </div>
                <div class="hist-cell"></div>
            `;
        } else {
            // Columna Derecha: Deudas (Signo +)
            row.innerHTML = `
                <div class="hist-cell"></div>
                <div class="hist-cell" style="text-align: right;">
                    <span class="hist-amount val-deuda">+${formatMoney(h.amount)}</span>
                    <span class="hist-date" style="text-align: right;">${h.date}</span>
                </div>
            `;
        }
        container.appendChild(row);
    });
}

// ==========================================
// REGISTRO DE PAGOS (COBROS Y ENTREGAS)
// ==========================================

/**
 * Procesa el pago de un Cliente
 */
async function registerProfilePayment() {
    const amount = parseFloat(document.getElementById('prof-pay-amount').value);
    const method = document.getElementById('prof-pay-method').value;

    if (isNaN(amount) || amount <= 0) return notify("Monto inválido");

    const client = customers.find(c => c.id === selectedEntityId);
    
    // 1. Descontar deuda
    client.balance = Math.round((client.balance - amount) * 100) / 100;

    // 2. Historial
    if (!client.history) client.history = [];
    client.history.push({
        date: new Date().toLocaleString(),
        type: 'PAGO',
        amount: amount,
        note: `Cobro en ${method}`
    });

    // 3. Balance (ENTRA dinero)
    if (typeof updateBalancesStorage === 'function') {
        if (method === 'cash') await updateBalancesStorage(amount, 0);
        else await updateBalancesStorage(0, amount);
    }

    await saveAccountsToStorage();
    openProfile('customer', selectedEntityId); // Refrescar modal
    renderEntities('clientes'); // Refrescar fondo
    document.getElementById('prof-pay-amount').value = '';
    notify("Cobro registrado exitosamente.");
}

/**
 * Procesa el pago a un Proveedor
 */
async function registerSupplierPayment() {
    const amount = parseFloat(document.getElementById('prof-supp-pay-amount').value);
    const method = document.getElementById('prof-supp-pay-method').value;

    if (isNaN(amount) || amount <= 0) return notify("Monto inválido");

    const supp = suppliers.find(s => s.id === selectedEntityId);

    // 1. Descontar deuda
    supp.balance = Math.round((supp.balance - amount) * 100) / 100;

    // 2. Historial
    if (!supp.history) supp.history = [];
    supp.history.push({
        date: new Date().toLocaleString(),
        type: 'PAGO',
        amount: amount,
        note: `Pago a proveedor (${method})`
    });

    // 3. Balance (SALE dinero)
    if (typeof updateBalancesStorage === 'function') {
        if (method === 'cash') await updateBalancesStorage(-amount, 0);
        else await updateBalancesStorage(0, -amount);
    }

    await saveAccountsToStorage();
    openProfile('supplier', selectedEntityId); // Refrescar modal
    renderEntities('proveedores'); // Refrescar fondo
    document.getElementById('prof-supp-pay-amount').value = '';
    notify("Pago registrado y descontado de caja.");
}

// ==========================================
// CRUD BÁSICO
// ==========================================

function openEntityForm(role, id = null) {
    const modal = document.getElementById('entity-modal');
    document.getElementById('entity-type').value = role;
    document.getElementById('modal-title').innerText = role === 'customer' ? 'Nuevo Cliente' : 'Nuevo Proveedor';
    
    if (id) {
        const list = (role === 'customer') ? customers : suppliers;
        const e = list.find(x => x.id === id);
        document.getElementById('entity-id').value = e.id;
        document.getElementById('ent-name').value = e.name;
        document.getElementById('ent-taxid').value = e.taxId || '';
        document.getElementById('ent-phone').value = e.phone || '';
    } else {
        document.getElementById('entity-form').reset();
        document.getElementById('entity-id').value = '';
    }
    modal.style.display = 'flex';
}

function closeEntityForm() {
    document.getElementById('entity-modal').style.display = 'none';
}

document.getElementById('entity-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const role = document.getElementById('entity-type').value;
    const id = document.getElementById('entity-id').value;
    let list = (role === 'customer') ? customers : suppliers;

    const data = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('ent-name').value.trim(),
        taxId: document.getElementById('ent-taxid').value.trim(),
        phone: document.getElementById('ent-phone').value.trim(),
        balance: id ? (list.find(x => x.id == id).balance || 0) : 0,
        history: id ? (list.find(x => x.id == id).history || []) : [],
        active: true
    };

    if (id) {
        const idx = list.findIndex(x => x.id == id);
        list[idx] = data;
    } else {
        list.push(data);
    }

    await saveAccountsToStorage();
    closeEntityForm();
    renderEntities(role === 'customer' ? 'clientes' : 'proveedores');
});

function editEntity(tab, id) {
    openEntityForm(tab === 'clientes' ? 'customer' : 'supplier', id);
}

async function deleteEntity(tab, id) {
    if (await confirmAction("¿Desea eliminar este registro?")) {
        const list = (tab === 'clientes' || tab === 'customer') ? customers : suppliers;
        const e = list.find(x => x.id === id);
        if (e) {
            e.active = false;
            await saveAccountsToStorage();
            renderEntities(tab === 'clientes' ? 'clientes' : 'proveedores');
        }
    }
}

async function saveAccountsToStorage() {
    await Promise.all([
        DB.set('customers', customers),
        DB.set('suppliers', suppliers)
    ]);
    if (typeof updateClientDatalist === 'function') updateClientDatalist();
}

// La carga inicial la maneja showSection('accounts') una vez que los datos
// se trajeron de Firebase.