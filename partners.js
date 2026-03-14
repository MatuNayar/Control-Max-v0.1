/**
 * CONTROL-MAX - Módulo de Socios (Partners)
 * Gestión de Capital, Aportes y Retiros.
 */

// Carga inicial segura
let partners = JSON.parse(localStorage.getItem('partners')) || [];

/**
 * Navegación de sub-pestañas de Socios
 */
function showSubTabPartner(tabId) {
    document.querySelectorAll('.partner-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-partners-${tabId}`);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('#partners-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if(tabId === 'listado') renderPartners();
    if(tabId === 'aporte' || tabId === 'retiro') updatePartnerSelects();
}

/**
 * Renderiza la tabla principal de socios con sus métricas calculadas
 */
function renderPartners() {
    const tbody = document.getElementById('partners-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const activePartners = partners.filter(p => p.active !== false);

    if (activePartners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay socios registrados.</td></tr>';
        return;
    }

    activePartners.forEach(p => {
        // Asegurar valores numéricos para evitar NaN
        const inv = parseFloat(p.totalContribution) || 0;
        const withdr = parseFloat(p.totalWithdrawals) || 0;
        const net = inv - withdr;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td style="color: var(--success); font-weight:500;">$ ${formatMoney(inv)}</td>
            <td style="color: var(--danger); font-weight:500;">$ ${formatMoney(withdr)}</td>
            <td style="font-weight:bold; color: ${net >= 0 ? 'var(--primary)' : 'var(--danger)'}">
                $ ${formatMoney(net)}
            </td>
            <td>
                <button class="btn-edit" onclick="openPartnerProfile(${p.id})" title="Ver Historial y Detalle">
                    <i class="fas fa-id-card"></i> Perfil
                </button>
                <button class="btn-delete" onclick="deletePartner(${p.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// GESTIÓN DEL PERFIL (HISTORIAL Y ESTADÍSTICAS)
// ==========================================

function openPartnerProfile(id) {
    const p = partners.find(x => x.id === id);
    if (!p) return;

    const modal = document.getElementById('partner-profile-modal');
    if (modal) modal.style.display = 'flex';

    // 1. Cargar Datos de Cabecera
    const inv = parseFloat(p.totalContribution) || 0;
    const withdr = parseFloat(p.totalWithdrawals) || 0;
    const net = inv - withdr;

    document.getElementById('prof-partner-name').innerText = p.name;
    document.getElementById('prof-partner-inv').innerText = `$ ${formatMoney(inv)}`;
    document.getElementById('prof-partner-with').innerText = `$ ${formatMoney(withdr)}`;
    document.getElementById('prof-partner-net').innerText = `$ ${formatMoney(net)}`;

    // 2. Renderizar Historial
    renderPartnerHistory(p);
}

function closePartnerProfile() {
    const modal = document.getElementById('partner-profile-modal');
    if (modal) modal.style.display = 'none';
}

function renderPartnerHistory(partner) {
    const container = document.getElementById('partner-individual-history');
    if (!container) return;
    container.innerHTML = '';

    if (!partner.history || partner.history.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Sin movimientos registrados.</p>';
        return;
    }

    // Ordenar: más reciente primero
    const sortedHistory = [...partner.history].reverse();

    sortedHistory.forEach(h => {
        const row = document.createElement('div');
        row.className = 'hist-row';

        // Estructura: Izquierda (Aportes/Verde) | Derecha (Retiros/Rojo)
        if (h.type === 'APORTE') {
            row.innerHTML = `
                <div class="hist-cell">
                    <span class="hist-amount val-pago" style="color:var(--success)">+ $ ${formatMoney(h.amount)}</span>
                    <span class="hist-date">${h.date}<br><small>${h.detail || 'Aporte'}</small></span>
                </div>
                <div class="hist-cell"></div>
            `;
        } else {
            // RETIRO
            row.innerHTML = `
                <div class="hist-cell"></div>
                <div class="hist-cell" style="text-align: right;">
                    <span class="hist-amount val-deuda" style="color:var(--danger)">- $ ${formatMoney(h.amount)}</span>
                    <span class="hist-date">${h.date}<br><small>${h.detail || 'Retiro'}</small></span>
                </div>
            `;
        }
        container.appendChild(row);
    });
}

// ==========================================
// REGISTRO DE MOVIMIENTOS (APORTES Y RETIROS)
// ==========================================

function updatePartnerSelects() {
    const selCont = document.getElementById('cont-partner-select');
    const selWith = document.getElementById('with-partner-select');
    
    const activePartners = partners.filter(p => p.active !== false);
    const options = '<option value="">-- Seleccione Socio --</option>' + 
                    activePartners.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    if (selCont) selCont.innerHTML = options;
    if (selWith) selWith.innerHTML = options;
}

// --- APORTE (Dinero Entra a la Empresa) ---
document.getElementById('contribution-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('cont-partner-select').value);
    const amount = parseFloat(document.getElementById('cont-amount').value);
    const method = document.getElementById('cont-method').value;
    const detail = document.getElementById('cont-detail').value.trim();

    if (!id || amount <= 0) return alert("Datos inválidos.");

    // 1. Impacto Financiero (Entra dinero)
    if (typeof updateBalancesStorage === 'function') {
        if (method === 'cash') updateBalancesStorage(amount, 0);
        else updateBalancesStorage(0, amount);
    } else {
        return alert("Error: Módulo de balance no disponible.");
    }

    // 2. Actualizar Socio
    const idx = partners.findIndex(p => p.id === id);
    if (idx !== -1) {
        partners[idx].totalContribution = (parseFloat(partners[idx].totalContribution) || 0) + amount;
        
        if (!partners[idx].history) partners[idx].history = [];
        partners[idx].history.push({
            date: new Date().toLocaleString(),
            type: 'APORTE',
            amount: amount,
            method: method,
            detail: detail || 'Aporte de Capital'
        });

        savePartners();
        
        // Log de Auditoría
        if (typeof addLog === 'function') addLog('SOCIOS', 'APORTE', `Aporte de $${formatMoney(amount)} por ${partners[idx].name}`);

        alert("Aporte registrado correctamente.");
        this.reset();
        showSubTabPartner('listado');
    }
});

// --- RETIRO (Dinero Sale de la Empresa) ---
document.getElementById('withdrawal-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('with-partner-select').value);
    const amount = parseFloat(document.getElementById('with-amount').value);
    const method = document.getElementById('with-method').value;
    const detail = document.getElementById('with-detail').value.trim();

    if (!id || amount <= 0) return alert("Datos inválidos.");

    // 1. Verificar Fondos (Protección de Caja)
    let balances = JSON.parse(localStorage.getItem('balances')) || { cash: 0, bank: 0 };
    if (method === 'cash' && balances.cash < amount) {
        return alert(`Fondos insuficientes en Caja. Disponible: $${formatMoney(balances.cash)}`);
    }
    if (method === 'bank' && balances.bank < amount) {
        return alert(`Fondos insuficientes en Banco. Disponible: $${formatMoney(balances.bank)}`);
    }

    // 2. Impacto Financiero (Sale dinero)
    if (typeof updateBalancesStorage === 'function') {
        if (method === 'cash') updateBalancesStorage(-amount, 0);
        else updateBalancesStorage(0, -amount);
    }

    // 3. Actualizar Socio
    const idx = partners.findIndex(p => p.id === id);
    if (idx !== -1) {
        // Inicializar si no existe (para socios antiguos)
        if (typeof partners[idx].totalWithdrawals === 'undefined') partners[idx].totalWithdrawals = 0;
        
        partners[idx].totalWithdrawals += amount;
        
        if (!partners[idx].history) partners[idx].history = [];
        partners[idx].history.push({
            date: new Date().toLocaleString(),
            type: 'RETIRO',
            amount: amount,
            method: method,
            detail: detail || 'Retiro de Utilidades'
        });

        savePartners();
        
        // Log de auditoría
        if (typeof addLog === 'function') {
            addLog('SOCIOS', 'RETIRO', `Retiro de $${formatMoney(amount)} por ${partners[idx].name}`);
        }

        alert("Retiro registrado correctamente.");
        this.reset();
        showSubTabPartner('listado');
    }
});

// ==========================================
// CRUD BÁSICO
// ==========================================

function openPartnerModal() {
    document.getElementById('partner-modal').style.display = 'flex';
}

function closePartnerModal() {
    document.getElementById('partner-modal').style.display = 'none';
    document.getElementById('partner-form')?.reset();
}

document.getElementById('partner-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('partner-name').value.trim();
    if (!name) return;

    partners.push({
        id: Date.now(),
        name: name,
        totalContribution: 0,
        totalWithdrawals: 0,
        history: [],
        active: true
    });

    savePartners();
    closePartnerModal();
    renderPartners();
    alert("Socio creado exitosamente.");
});

function deletePartner(id) {
    if(confirm('¿Desea eliminar a este socio? (Solo se ocultará del listado, los movimientos contables persisten)')) {
        const index = partners.findIndex(p => p.id === id);
        if(index !== -1) {
            partners[index].active = false;
            savePartners();
            renderPartners();
        }
    }
}

function savePartners() {
    localStorage.setItem('partners', JSON.stringify(partners));
}

// Inicialización y Migración de Datos Antiguos
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si los objetos socios tienen la propiedad nueva, si no, agregarla.
    let changed = false;
    partners.forEach(p => {
        if (typeof p.totalWithdrawals === 'undefined') {
            p.totalWithdrawals = 0;
            changed = true;
        }
        if (!p.history) {
            p.history = [];
            changed = true;
        }
    });
    if (changed) savePartners();
    
    // Si estamos en la sección de socios, renderizar
    if(document.getElementById('partners-section')) {
        // Chequear pestaña activa por si se recarga
        if (document.getElementById('sub-partners-listado') && document.getElementById('sub-partners-listado').style.display !== 'none') {
             renderPartners();
        }
    }
});