/**
 * CONTROL-MAX - Módulo de Reportes Contables y Analítica
 * Lógica de Costo de Mercadería Vendida (COGS) y Filtros Globales.
 */

let mainChart, rubroChart, categoryChart;
let topType = 'qty'; // 'qty' o 'profit'
let currentPeriodLabel = "Mes Actual";

// ==========================================
// 1. UTILIDADES Y MANEJO DE FECHAS
// ==========================================

const formatCompactNumber = (number) => {
    if (number >= 1000000) return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (number >= 1000) return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return number.toString();
};

const parseSafeDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (dateStr.includes('T')) return new Date(dateStr); 
    const parts = dateStr.split(',')[0].split(' ')[0].split('/'); 
    if(parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]);
    return new Date(dateStr);
};

const isToday = (d) => {
    const date = parseSafeDate(d), now = new Date();
    return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

// ==========================================
// 2. FILTRO DE TIEMPO GLOBAL
// ==========================================

function getFilteredData(dataArray, dateField = 'date') {
    const range = document.getElementById('global-report-filter').value;
    const now = new Date();
    now.setHours(23,59,59,999);
    
    let startDate = new Date(0); // Para all_time
    
    if (range === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodLabel = "Mes";
    } else if (range === 'last_3_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        currentPeriodLabel = "3 Meses";
    } else if (range === 'last_6_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        currentPeriodLabel = "6 Meses";
    } else if (range === 'this_year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        currentPeriodLabel = "Año";
    } else {
        currentPeriodLabel = "Histórico";
    }

    document.querySelectorAll('.rep-period-label').forEach(el => el.innerText = currentPeriodLabel);

    return dataArray.filter(item => {
        if (!item[dateField]) return false;
        const itemDate = parseSafeDate(item[dateField]);
        return itemDate >= startDate && itemDate <= now;
    });
}

function refreshAllReports() {
    initDashboard();
}

// ==========================================
// 3. NAVEGACIÓN Y CARGA DE DATOS
// ==========================================

function showSubTabReports(tabId) {
    document.querySelectorAll('.report-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-reports-${tabId}`).style.display = 'block';
    
    document.querySelectorAll('#reports-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    initDashboard();
}

function initDashboard() {
    const db = {
        sales: JSON.parse(localStorage.getItem('salesHistory')) || [],
        returns: JSON.parse(localStorage.getItem('returns')) || [],
        products: JSON.parse(localStorage.getItem('products')) || [],
        expenses: JSON.parse(localStorage.getItem('expenseHistory')) || [],
        losses: JSON.parse(localStorage.getItem('losses')) || [],
        balances: JSON.parse(localStorage.getItem('balances')) || { cash: 0, bank: 0 },
        customers: JSON.parse(localStorage.getItem('customers')) || [],
        suppliers: JSON.parse(localStorage.getItem('suppliers')) || [],
        expCats: JSON.parse(localStorage.getItem('expenseCategories')) || []
    };

    // Aplicar Filtro de Tiempo
    const filteredSales = getFilteredData(db.sales.filter(s => s.type === 'venta' && s.status !== 'cancelada'), 'date');
    const filteredReturns = getFilteredData(db.returns, 'date');
    const filteredExpenses = getFilteredData(db.expenses, 'date');
    const filteredLosses = getFilteredData(db.losses, 'date');

    // 1. CÁLCULO DE VENTAS Y COSTOS (COGS)
    let totalSalesPeriod = 0;
    let totalCogsPeriod = 0;
    let qtySalesPeriod = filteredSales.length;
    let prodStats = {}, rubroStats = {};
    let salesToday = 0;

    // Ventas de hoy siempre se muestran fijas
    db.sales.filter(s => s.type === 'venta' && isToday(s.date) && s.status !== 'cancelada').forEach(s => salesToday += s.total);

    filteredSales.forEach(s => {
        totalSalesPeriod += s.total;

        s.items.forEach(item => {
            const netQty = item.qty - (item.returnedQty || 0);
            if (netQty <= 0) return;

            if (item.isCombo) {
                item.comboItems.forEach(ci => {
                    const p = db.products.find(prod => prod.id === ci.id);
                    const r = p && p.rubro ? p.rubro : 'Sin Rubro';
                    const c = ci.cost || (p ? p.cost : 0);
                    const qtyTotal = ci.qty * netQty;
                    const subTotalVenta = ci.proportionalPrice * qtyTotal;

                    totalCogsPeriod += (c * qtyTotal);
                    rubroStats[r] = (rubroStats[r] || 0) + subTotalVenta;

                    if(!prodStats[ci.id]) prodStats[ci.id] = { name: ci.name, qty: 0, profit: 0, cost: c };
                    prodStats[ci.id].qty += qtyTotal;
                    prodStats[ci.id].profit += (ci.proportionalPrice - c) * qtyTotal;
                });
            } else {
                const p = db.products.find(prod => prod.id === item.id);
                const r = p && p.rubro ? p.rubro : 'Sin Rubro';
                const c = item.cost || (p ? p.cost : 0);
                const subTotalVenta = (item.price || 0) * netQty;

                totalCogsPeriod += (c * netQty);
                rubroStats[r] = (rubroStats[r] || 0) + subTotalVenta;

                if(!prodStats[item.id]) prodStats[item.id] = { name: item.name, qty: 0, profit: 0, cost: c };
                prodStats[item.id].qty += netQty;
                prodStats[item.id].profit += (item.price - c) * netQty;
            }
        });
    });

    // Restar devoluciones monetarias
    filteredReturns.forEach(r => {
        totalSalesPeriod -= r.totalRefund;
        if (isToday(r.date)) salesToday -= r.totalRefund;
    });

    // 2. GASTOS Y MERMAS
    const totalExpensesPeriod = filteredExpenses.reduce((a,b) => a + b.amount, 0);
    const totalLossesPeriod = filteredLosses.reduce((a,b) => a + b.lossValue, 0);

    // 3. RESULTADO NETO
    const netProfitPeriod = totalSalesPeriod - totalCogsPeriod - totalExpensesPeriod - totalLossesPeriod;

    // 4. INVENTARIO ACTUAL
    let stockCost = 0, stockPrice = 0;
    db.products.filter(p => p.active !== false && p.stock > 0).forEach(p => {
        stockCost += (p.cost * p.stock);
        stockPrice += (p.price * p.stock);
    });

    // 5. FINANZAS ACTUALES
    const debtCust = db.customers.reduce((a, b) => a + (parseFloat(b.balance) > 0 ? parseFloat(b.balance) : 0), 0);
    const debtSupp = db.suppliers.reduce((a, b) => a + (parseFloat(b.balance) > 0 ? parseFloat(b.balance) : 0), 0);

    // 6. TOPS
    const sortedProds = Object.values(prodStats).sort((a,b) => b[topType] - a[topType]);
    const topProd = sortedProds[0];
    const topRubro = Object.entries(rubroStats).sort((a,b) => b[1] - a[1])[0];

    // ==========================================
    // ACTUALIZACIÓN DEL DOM
    // ==========================================

    // Pestaña: DASHBOARD
    document.getElementById('rep-sales-today').innerText = `$ ${formatMoney(Math.max(salesToday, 0))}`;
    document.getElementById('rep-sales-period').innerText = `$ ${formatMoney(totalSalesPeriod)}`;
    document.getElementById('rep-margin').innerText = `$ ${formatMoney(netProfitPeriod)}`;
    document.getElementById('rep-margin').style.color = netProfitPeriod >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('rep-debt-cust').innerText = `$ ${formatMoney(debtCust)}`;
    document.getElementById('rep-debt-supp').innerText = `$ ${formatMoney(debtSupp)}`;

    // Pestaña: ESTADÍSTICAS
    document.getElementById('st-sales-total').innerText = `$ ${formatMoney(totalSalesPeriod)}`;
    document.getElementById('st-cost-total').innerText = `$ ${formatMoney(totalCogsPeriod)}`;
    document.getElementById('st-expenses-total').innerText = `$ ${formatMoney(totalExpensesPeriod)}`;
    document.getElementById('st-net-profit').innerText = `$ ${formatMoney(netProfitPeriod)}`;
    document.getElementById('st-net-profit').style.color = netProfitPeriod >= 0 ? 'var(--success)' : 'var(--danger)';

    // Pestaña: INDIVIDUAL (NUEVA)
    document.getElementById('ind-stock-cost').innerText = `$ ${formatMoney(stockCost)}`;
    document.getElementById('ind-stock-price').innerText = `$ ${formatMoney(stockPrice)}`;
    document.getElementById('ind-stock-profit').innerText = `$ ${formatMoney(stockPrice - stockCost)}`;
    document.getElementById('ind-ticket-avg').innerText = `$ ${formatMoney(qtySalesPeriod > 0 ? totalSalesPeriod / qtySalesPeriod : 0)}`;
    document.getElementById('ind-top-prod').innerText = topProd ? `${topProd.name} (${topProd.qty} un.)` : '-';
    document.getElementById('ind-top-rubro').innerText = topRubro ? topRubro[0] : '-';
    
    document.getElementById('ind-cash').innerText = `$ ${formatMoney(db.balances.cash)}`;
    document.getElementById('ind-bank').innerText = `$ ${formatMoney(db.balances.bank)}`;
    document.getElementById('ind-ar').innerText = `$ ${formatMoney(debtCust)}`;
    document.getElementById('ind-ap').innerText = `$ ${formatMoney(debtSupp)}`;
    document.getElementById('ind-exp-total').innerText = `$ ${formatMoney(totalExpensesPeriod)}`;
    document.getElementById('ind-loss-total').innerText = `$ ${formatMoney(totalLossesPeriod)}`;

    // GRÁFICOS
    renderTopProductsList(sortedProds.slice(0,5));
    renderLineChart(db.sales, db.returns); 
    renderRubroChart(rubroStats);
    renderCategoryChart(filteredExpenses, db.expCats);
}

// ==========================================
// 4. FUNCIONES DE UI Y GRÁFICOS (CHART.JS)
// ==========================================

function toggleTopType() {
    topType = (topType === 'qty') ? 'profit' : 'qty';
    const btn = document.getElementById('btn-toggle-top');
    if(btn) btn.innerText = (topType === 'qty') ? 'Ver por Ganancia' : 'Ver por Cantidad';
    initDashboard(); 
}

function renderTopProductsList(sortedArray) {
    const list = document.getElementById('top-products-list');
    list.innerHTML = '';
    if (sortedArray.length === 0) { list.innerHTML = '<li style="text-align:center; color:#999;">Sin datos aún</li>'; return; }
    sortedArray.forEach(p => {
        list.innerHTML += `<li><span>${p.name}</span><strong>${topType === 'qty' ? p.qty + ' un.' : '$ ' + formatMoney(p.profit)}</strong></li>`;
    });
}

function renderLineChart(allSales, allReturns) {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let labels = [], data = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(today.getDate() - i);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

        let daySales = allSales.filter(s => s.type === 'venta' && s.status !== 'cancelada' && parseSafeDate(s.date).toLocaleDateString() === d.toLocaleDateString()).reduce((sum, sale) => sum + sale.total, 0);
        let dayReturns = allReturns.filter(r => parseSafeDate(r.date).toLocaleDateString() === d.toLocaleDateString()).reduce((sum, ret) => sum + ret.totalRefund, 0);
        
        data.push(Math.max(daySales - dayReturns, 0));
    }

    if (mainChart) mainChart.destroy();
    mainChart = new Chart(ctx, {
        type: 'line', 
        data: { labels, datasets: [{ label: 'Ventas Netas ($)', data, borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (val) => '$' + formatCompactNumber(val) } } } }
    });
}

function renderRubroChart(rubroStats) {
    const canvas = document.getElementById('rubroChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const sortedRubros = Object.entries(rubroStats).sort((a,b) => b[1] - a[1]).slice(0, 6); 
    const labels = sortedRubros.map(r => r[0]);
    const data = sortedRubros.map(r => r[1]);

    if (rubroChart) rubroChart.destroy();
    rubroChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c', '#34495e'], borderWidth: 2, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } }, tooltip: { callbacks: { label: function(c) { return ` ${c.label}: $${formatMoney(c.parsed)}`; } } } } }
    });
}

function renderCategoryChart(expenses, expCatsDb) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const cats = {};
    expenses.forEach(e => { const c = e.category || 'General'; cats[c] = (cats[c] || 0) + e.amount; });

    const labels = Object.keys(cats);
    const data = Object.values(cats);
    const bgColors = labels.map(labelName => {
        const cat = expCatsDb.find(c => c.name === labelName);
        return cat ? cat.color : '#95a5a6';
    });

    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } }, tooltip: { callbacks: { label: function(c) { return ` ${c.label}: $${formatMoney(c.parsed)}`; } } } } }
    });
}