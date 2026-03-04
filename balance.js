/**
 * CONTROL-MAX - Módulo de Balance y Gastos
 */

let balances = JSON.parse(localStorage.getItem('balances')) || { cash: 0, bank: 0 };
let expenseHistory = JSON.parse(localStorage.getItem('expenseHistory')) || [];

/**
 * Navegación interna de Balance
 */
function showSubTabBalance(tabId) {
    document.querySelectorAll('.balance-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-${tabId}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('#balance-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if (tabId === 'saldo') renderBalances();
    if (tabId === 'gastos') renderExpenseHistory();
}

/**
 * Muestra los saldos actuales con formato 1.000,50
 */
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

/**
 * FUNCIÓN CENTRAL DE DINERO: Suma o resta de las cuentas
 */
function updateBalancesStorage(cashDiff, bankDiff) {
    balances.cash += parseFloat(cashDiff) || 0;
    balances.bank += parseFloat(bankDiff) || 0;

    localStorage.setItem('balances', JSON.stringify(balances));
    renderBalances();
}

/**
 * Transferencia entre Efectivo y Banco
 */
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

    alert("Movimiento realizado.");
    amountInput.value = '';
    showSubTabBalance('saldo');
}

/**
 * Registro de Gastos
 */
document.getElementById('expense-form')?.addEventListener('submit', function(e) {
    e.preventDefault();

    const desc = document.getElementById('exp-desc').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const method = document.getElementById('exp-method').value;
    const category = document.getElementById('exp-category').value;

    if (isNaN(amount) || amount <= 0) return alert("Monto inválido.");

    // Validar fondos
    if (method === 'cash' && balances.cash < amount) return alert("Efectivo insuficiente.");
    if (method === 'bank' && balances.bank < amount) return alert("Saldo bancario insuficiente.");

    // Descontar
    if (method === 'cash') updateBalancesStorage(-amount, 0);
    else updateBalancesStorage(0, -amount);

    // Guardar historial
    expenseHistory.push({
        date: new Date().toLocaleDateString(),
        desc, amount, method, category
    });

    localStorage.setItem('expenseHistory', JSON.stringify(expenseHistory));
    this.reset();
    alert("Gasto registrado.");
    renderExpenseHistory();
});

function renderExpenseHistory() {
    const tbody = document.getElementById('expenses-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    [...expenseHistory].reverse().slice(0, 10).forEach(exp => {
        tbody.innerHTML += `
            <tr>
                <td>${exp.desc} <br><small>${exp.date}</small></td>
                <td><span class="sub-btn" style="font-size:0.7rem; padding:2px 8px;">${exp.category}</span></td>
                <td>${exp.method === 'cash' ? 'Efectivo' : 'Banco'}</td>
                <td style="color:var(--danger); font-weight:bold;">- $ ${formatMoney(exp.amount)}</td>
            </tr>
        `;
    });
}

document.addEventListener('DOMContentLoaded', renderBalances);