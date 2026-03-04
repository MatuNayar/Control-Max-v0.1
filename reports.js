/**
 * CONTROL-MAX - Módulo de Reportes y Estadísticas
 */

let mainChart, rubroChart, categoryChart, historyChart;
let topType = 'qty'; // 'qty' o 'profit'

function showSubTabReports(tabId) {
    document.querySelectorAll('.report-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-reports-${tabId}`).style.display = 'block';
    
    document.querySelectorAll('#reports-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if(tabId === 'dashboard') initDashboard();
    if(tabId === 'stats') initStats();
}

// --- UTILIDADES DE FECHA ---
const isToday = (date) => new Date().toDateString() === new Date(date).toDateString();

const isThisWeek = (date) => {
    const now = new Date();
    const d = new Date(date);
    const day = now.getDay() || 7; // Lunes = 1
    const monday = new Date(now.setDate(now.getDate() - day + 1)).setHours(0,0,0,0);
    const sunday = new Date(now.setDate(now.getDate() - day + 7)).setHours(23,59,59,999);
    return d >= monday && d <= sunday;
};

const isThisMonth = (date) => {
    const now = new Date();
    const d = new Date(date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

// --- LÓGICA DASHBOARD ---
function initDashboard() {
    const history = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const cust = JSON.parse(localStorage.getItem('customers')) || [];
    const supp = JSON.parse(localStorage.getItem('suppliers')) || [];

    // KPI Cards
    const salesToday = history.filter(s => isToday(s.date)).reduce((a, b) => a + b.total, 0);
    const salesWeek = history.filter(s => isThisWeek(s.date)).reduce((a, b) => a + b.total, 0);
    const salesMonth = history.filter(s => isThisMonth(s.date)).reduce((a, b) => a + b.total, 0);
    
    // Deudas (Saldos negativos en cuentas corrientes)
    const debtCust = cust.reduce((a, b) => a + (b.balance < 0 ? Math.abs(b.balance) : 0), 0);
    const debtSupp = supp.reduce((a, b) => a + (b.balance < 0 ? Math.abs(b.balance) : 0), 0);

    // Margen Estimado (Ventas Mes - Costo de lo vendido en el mes)
    let costMonth = 0;
    history.filter(s => isThisMonth(s.date)).forEach(s => {
        s.items.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            costMonth += (p ? p.cost : 0) * item.qty;
        });
    });

    document.getElementById('rep-sales-today').innerText = `$ ${formatMoney(salesToday)}`;
    document.getElementById('rep-sales-week').innerText = `$ ${formatMoney(salesWeek)}`;
    document.getElementById('rep-sales-month').innerText = `$ ${formatMoney(salesMonth)}`;
    document.getElementById('rep-debt-cust').innerText = `$ ${formatMoney(debtCust)}`;
    document.getElementById('rep-debt-supp').innerText = `$ ${formatMoney(debtSupp)}`;
    document.getElementById('rep-margin').innerText = `$ ${formatMoney(salesMonth - costMonth)}`;

    renderTopProducts();
    updateMainChart();
}

function renderTopProducts() {
    const history = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const stats = {};

    history.forEach(sale => {
        sale.items.forEach(item => {
            if(!stats[item.id]) {
                const p = products.find(prod => prod.id === item.id);
                stats[item.id] = { name: item.name, qty: 0, profit: 0, cost: p ? p.cost : 0 };
            }
            stats[item.id].qty += item.qty;
            stats[item.id].profit += (item.price - stats[item.id].cost) * item.qty;
        });
    });

    const sorted = Object.values(stats).sort((a, b) => b[topType] - a[topType]).slice(0, 5);
    const list = document.getElementById('top-products-list');
    list.innerHTML = '';
    sorted.forEach(p => {
        list.innerHTML += `<li>
            <span>${p.name}</span>
            <strong>${topType === 'qty' ? p.qty + ' unid.' : '$ ' + formatMoney(p.profit)}</strong>
        </li>`;
    });
}

function toggleTopType() {
    topType = (topType === 'qty') ? 'profit' : 'qty';
    document.getElementById('btn-toggle-top').innerText = (topType === 'qty') ? 'Ver por Ganancia' : 'Ver por Cantidad';
    renderTopProducts();
}

function updateMainChart() {
    const range = document.getElementById('chart-range-select').value;
    const history = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const ctx = document.getElementById('mainChart').getContext('2d');

    let labels = [];
    let data = [];
    const now = new Date();

    if(range === 'month') {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for(let i = 1; i <= daysInMonth; i++) {
            labels.push(i);
            const dayTotal = history.filter(s => {
                const d = new Date(s.date);
                return d.getDate() === i && isThisMonth(s.date);
            }).reduce((a, b) => a + b.total, 0);
            data.push(dayTotal);
        }
    } else {
        for(let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.getDate() + "/" + (d.getMonth() + 1));
            const dayTotal = history.filter(s => new Date(s.date).toDateString() === d.toDateString())
                                    .reduce((a, b) => a + b.total, 0);
            data.push(dayTotal);
        }
    }

    if(mainChart) mainChart.destroy();
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Ventas $', data, backgroundColor: '#3498db' }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

// --- LÓGICA ESTADÍSTICAS ---
function initStats() {
    const history = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const expenses = JSON.parse(localStorage.getItem('expenseHistory')) || [];

    const totalSales = history.reduce((a, b) => a + b.total, 0);
    const totalExp = expenses.reduce((a, b) => a + b.amount, 0);
    
    let totalCost = 0;
    history.forEach(s => {
        s.items.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            totalCost += (p ? p.cost : 0) * item.qty;
        });
    });

    document.getElementById('st-sales-total').innerText = `$ ${formatMoney(totalSales)}`;
    document.getElementById('st-cost-total').innerText = `$ ${formatMoney(totalCost)}`;
    document.getElementById('st-expenses-total').innerText = `$ ${formatMoney(totalExp)}`;
    document.getElementById('st-net-profit').innerText = `$ ${formatMoney(totalSales - totalCost - totalExp)}`;

    renderRubroChart(history);
    renderExpensePie(expenses);
}

function renderRubroChart(history) {
    const rubros = {};
    history.forEach(s => {
        s.items.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            const r = p ? p.rubro : 'Sin Rubro';
            rubros[r] = (rubros[r] || 0) + item.subtotal;
        });
    });

    const ctx = document.getElementById('rubroChart').getContext('2d');
    if(rubroChart) rubroChart.destroy();
    rubroChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(rubros),
            datasets: [{ label: 'Ventas por Rubro', data: Object.values(rubros), backgroundColor: '#27ae60' }]
        }
    });
}

function renderExpensePie(expenses) {
    const cats = {};
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });

    const ctx = document.getElementById('categoryChart').getContext('2d');
    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: ['#e74c3c','#f1c40f','#3498db','#9b59b6','#1abc9c'] }]
        }
    });
}