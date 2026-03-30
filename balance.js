/**
 * CONTROL-MAX - Módulo de Balance y Gastos
 * - Saldos y Transferencias
 * - Historial de Gastos
 * - Gestión Dinámica de Categorías con Colores
 */

let balances = JSON.parse(localStorage.getItem('balances')) || { cash: 0, bank: 0 };
let expenseHistory = JSON.parse(localStorage.getItem('expenseHistory')) || [];

// Categorías de Gastos por defecto (Se auto-instalan la primera vez para mantener compatibilidad)
let expenseCategories = JSON.parse(localStorage.getItem('expenseCategories')) || [
    { id: 1, name: 'Servicios', description: 'Luz, Agua, Gas, Internet', color: '#3498db' },
    { id: 2, name: 'Impuestos', description: 'Cargas impositivas, AFIP', color: '#e74c3c' },
    { id: 3, name: 'Varios', description: 'Gastos menores y generales', color: '#95a5a6' }
];

// Forzar guardado la primera vez
if (!localStorage.getItem('expenseCategories')) {
    localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories));
}

// ==========================================
// 1. NAVEGACIÓN Y RENDERIZADO BÁSICO
// ==========================================

function showSubTabBalance(tabId) {
    document.querySelectorAll('.balance-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-${tabId}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('#balance-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if (tabId === 'saldo') renderBalances();
    if (tabId === 'gastos') {
        updateExpCategorySelect();
        renderExpenseHistory();
    }
    if (tabId === 'cat-gastos') {
        renderExpCategories();
    }
}

function renderBalances() {
    const cashEl = document.getElementById('cash-amount');
    const bankEl = document.getElementById('bank-amount');
    const totalEl = document.getElementById('total-amount');

    if (cashEl) cashEl.innerText = `$ ${formatMoney(balances.cash)}`;
    if (bankEl) bankEl.innerText = `$ ${formatMoney(balances.bank)}`;
    if (totalEl) {
        const total = balances.cash + balances.bank;
        totalEl.innerText = `$ ${formatMoney(total)}`;
    }
}

function updateBalancesStorage(cashDiff, bankDiff) {
    balances.cash += parseFloat(cashDiff) || 0;
    balances.bank += parseFloat(bankDiff) || 0;
    localStorage.setItem('balances', JSON.stringify(balances));
    renderBalances();
}

function makeTransfer() {
    const amountInput = document.getElementById('transfer-amount');
    const amount = parseFloat(amountInput.value);
    const origin = document.getElementById('transfer-origin').value;

    if (isNaN(amount) || amount <= 0) return alert("Monto inválido.");

    if (origin === 'cash') {
        if (balances.cash < amount) return alert("Efectivo insuficiente.");
        updateBalancesStorage(-amount, amount);
    } else {
        if (balances.bank < amount) return alert("Saldo bancario insuficiente.");
        updateBalancesStorage(amount, -amount);
    }

    if (typeof addLog === 'function') addLog('BALANCE', 'TRANSFERENCIA', `Transferencia de $${amount} desde ${origin === 'cash' ? 'Caja' : 'Banco'}`);

    alert("Movimiento realizado.");
    amountInput.value = '';
    showSubTabBalance('saldo');
}

// ==========================================
// 2. GESTIÓN DE GASTOS
// ==========================================

document.getElementById('expense-form')?.addEventListener('submit', function(e) {
    e.preventDefault();

    const desc = document.getElementById('exp-desc').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const method = document.getElementById('exp-method').value;
    const category = document.getElementById('exp-category').value;

    if (isNaN(amount) || amount <= 0) return alert("Monto inválido.");

    if (method === 'cash' && balances.cash < amount) return alert("Efectivo insuficiente en caja.");
    if (method === 'bank' && balances.bank < amount) return alert("Saldo bancario insuficiente.");

    if (method === 'cash') updateBalancesStorage(-amount, 0);
    else updateBalancesStorage(0, -amount);

    const expenseRecord = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        desc: desc,
        amount: amount,
        method: method,
        category: category || 'Sin Categoría'
    };

    expenseHistory.push(expenseRecord);
    localStorage.setItem('expenseHistory', JSON.stringify(expenseHistory));
    
    if (typeof addLog === 'function') addLog('BALANCE', 'GASTO', `Gasto registrado: $${formatMoney(amount)} (${category})`);

    this.reset();
    alert("✅ Gasto registrado y descontado.");
    renderExpenseHistory();
});

function renderExpenseHistory() {
    const tbody = document.getElementById('expenses-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (expenseHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">No hay gastos registrados.</td></tr>';
        return;
    }

    [...expenseHistory].reverse().slice(0, 15).forEach(exp => {
        // Buscar el color de la categoría para dibujarlo
        const cat = expenseCategories.find(c => c.name === exp.category);
        const color = cat ? cat.color : '#95a5a6';

        tbody.innerHTML += `
            <tr>
                <td><strong>${exp.desc}</strong> <br><small style="color:#888;">${exp.date}</small></td>
                <td><span class="badge" style="background-color:${color}22; color:${color}; border:1px solid ${color};">${exp.category}</span></td>
                <td>${exp.method === 'cash' ? 'Efectivo' : 'Banco'}</td>
                <td style="color:var(--danger); font-weight:bold;">- $ ${formatMoney(exp.amount)}</td>
            </tr>
        `;
    });
}

// ==========================================
// 3. GESTIÓN DE CATEGORÍAS (CRUD)
// ==========================================

function updateExpCategorySelect() {
    const select = document.getElementById('exp-category');
    if (!select) return;
    select.innerHTML = expenseCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function renderExpCategories() {
    const tbody = document.getElementById('exp-cat-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    expenseCategories.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td style="text-align:center;">
                    <div style="width:25px; height:25px; background-color:${c.color}; border-radius:5px; border:1px solid #ccc; display:inline-block;"></div>
                </td>
                <td><strong>${c.name}</strong></td>
                <td style="color:#666; font-size:0.9rem;">${c.description || '-'}</td>
                <td style="text-align:center;">
                    <button class="btn-edit" onclick="editExpCategory(${c.id})" style="padding:4px;"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" onclick="deleteExpCategory(${c.id}, '${c.name}')" style="padding:4px;"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

document.getElementById('exp-cat-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('exp-cat-id').value;
    const name = document.getElementById('exp-cat-name').value.trim();
    const desc = document.getElementById('exp-cat-desc').value.trim();
    const color = document.getElementById('exp-cat-color').value;

    if (!name) return alert("El nombre de la categoría es obligatorio.");

    // Evitar nombres duplicados
    const isDuplicate = expenseCategories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id != id);
    if (isDuplicate) return alert("Ya existe una categoría con este nombre.");

    if (id) {
        // MODO EDICIÓN
        const idx = expenseCategories.findIndex(c => c.id == id);
        if (idx !== -1) {
            const oldName = expenseCategories[idx].name;
            
            // Inteligencia de Integración: Actualizar historial antiguo
            if (oldName !== name) {
                let updatedHistory = false;
                expenseHistory.forEach(exp => {
                    if (exp.category === oldName) {
                        exp.category = name;
                        updatedHistory = true;
                    }
                });
                if(updatedHistory) localStorage.setItem('expenseHistory', JSON.stringify(expenseHistory));
            }
            
            expenseCategories[idx] = { id: parseInt(id), name, description: desc, color };
            if (typeof addLog === 'function') addLog('ADMIN', 'EDICION', `Editada categoría de gasto: ${name}`);
        }
    } else {
        // MODO CREACIÓN
        expenseCategories.push({ id: Date.now(), name, description: desc, color });
        if (typeof addLog === 'function') addLog('ADMIN', 'CREACION', `Creada categoría de gasto: ${name}`);
    }

    localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories));
    alert("Categoría guardada correctamente.");
    
    resetExpCatForm();
    renderExpCategories();
    updateExpCategorySelect(); 
    
    // Si la función existe (se recarga el gráfico)
    if (typeof initStats === 'function') initStats();
});

function editExpCategory(id) {
    const cat = expenseCategories.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('exp-cat-id').value = cat.id;
    document.getElementById('exp-cat-name').value = cat.name;
    document.getElementById('exp-cat-desc').value = cat.description || '';
    document.getElementById('exp-cat-color').value = cat.color || '#3498db';
    document.getElementById('exp-cat-form-title').innerText = "Editar Categoría";
}

function deleteExpCategory(id, name) {
    const inUse = expenseHistory.some(exp => exp.category === name);
    if (inUse) {
        return alert(`❌ ACCIÓN DENEGADA.\nExisten gastos registrados bajo la categoría "${name}". No se puede eliminar para mantener la integridad de los reportes.`);
    }

    if (confirm(`¿Está seguro de eliminar la categoría "${name}"?`)) {
        expenseCategories = expenseCategories.filter(c => c.id !== id);
        localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories));
        if (typeof addLog === 'function') addLog('ADMIN', 'BAJA', `Eliminada categoría de gasto: ${name}`);
        renderExpCategories();
        updateExpCategorySelect();
    }
}

function resetExpCatForm() {
    document.getElementById('exp-cat-form')?.reset();
    document.getElementById('exp-cat-id').value = '';
    document.getElementById('exp-cat-color').value = '#3498db';
    document.getElementById('exp-cat-form-title').innerText = "Nueva Categoría";
}

// Carga Inicial
document.addEventListener('DOMContentLoaded', renderBalances);