/**
 * CONTROL-MAX - Módulo de Reportes y Dashboard
 * - Compatible con desgloses de Combos y Ofertas
 * - Cálculo Proporcional por Rubro
 * - Top de Productos Individuales
 */

let mainChart, rubroChart, categoryChart;
let topType = 'qty'; // 'qty' (cantidad) o 'profit' (ganancia)

// ==========================================
// 1. UTILIDADES DE FORMATO Y FECHA
// ==========================================

const formatCompactNumber = (number) => {
    if (number >= 1000000) return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (number >= 1000) return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return number.toString();
};

const normalizeDate = (dateString) => {
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    return d;
};

const isToday = (dateString) => {
    const d = normalizeDate(dateString);
    const now = normalizeDate(new Date());
    return d.getTime() === now.getTime();
};

const isThisMonth = (dateString) => {
    const d = new Date(dateString);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isThisWeek = (dateString) => {
    const d = normalizeDate(dateString);
    const now = normalizeDate(new Date());
    const day = now.getDay() || 7; 
    const monday = new Date(now);
    monday.setHours(0,0,0,0);
    monday.setDate(now.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return d >= monday && d <= sunday;
};

// ==========================================
// 2. GESTIÓN DE PESTAÑAS Y MIGRACIÓN
// ==========================================

function showSubTabReports(tabId) {
    document.querySelectorAll('.report-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-reports-${tabId}`);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('#reports-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    migrateSalesData(); 
    
    if(tabId === 'dashboard') initDashboard();
    if(tabId === 'stats') initStats();
}

function migrateSalesData() {
    let sales = JSON.parse(localStorage.getItem('salesHistory')) || [];
    let changed = false;

    sales.forEach(s => {
        if (!s.type) { s.type = 'venta'; changed = true; }
        if (!s.status) { s.status = 'completada'; changed = true; }
        if (!s.date) { s.date = new Date().toISOString(); changed = true; }
    });

    if (changed) {
        localStorage.setItem('salesHistory', JSON.stringify(sales));
    }
}

// ==========================================
// 3. DASHBOARD PRINCIPAL (KPIs + GRÁFICO HISTÓRICO)
// ==========================================

function initDashboard() {
    const history = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const cust = JSON.parse(localStorage.getItem('customers')) || [];
    const supp = JSON.parse(localStorage.getItem('suppliers')) || [];
    
    const validSales = history.filter(s => s.type === 'venta' && s.status === 'completada');

    // -- CÁLCULOS KPI --
    const salesToday = validSales.filter(s => isToday(s.date)).reduce((a, b) => a + b.total, 0);
    const salesWeek = validSales.filter(s => isThisWeek(s.date)).reduce((a, b) => a + b.total, 0);
    const salesMonth = validSales.filter(s => isThisMonth(s.date)).reduce((a, b) => a + b.total, 0);
    
    const debtCust = cust.reduce((a, b) => a + (parseFloat(b.balance) > 0 ? parseFloat(b.balance) : 0), 0);
    const debtSupp = supp.reduce((a, b) => a + (parseFloat(b.balance) > 0 ? parseFloat(b.balance) : 0), 0);

    // CÁLCULO DE MARGEN MENSUAL DESGLOSANDO COMBOS
    let marginMonth = 0;
    const monthSales = validSales.filter(s => isThisMonth(s.date));
    
    monthSales.forEach(s => {
        let saleCost = 0;
        if (s.items && Array.isArray(s.items)) {
            s.items.forEach(item => {
                if (item.isCombo) {
                    // Costo del combo = suma (costo producto * cant en combo) * cant combos vendidos
                    item.comboItems.forEach(ci => {
                        saleCost += (parseFloat(ci.cost || 0) * ci.qty * item.qty);
                    });
                } else {
                    saleCost += (parseFloat(item.cost || 0) * item.qty);
                }
            });
        }
        marginMonth += (s.total - saleCost);
    });

    // -- RENDER DOM --
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.innerText = `$ ${formatMoney(val)}`;
    };

    setVal('rep-sales-today', salesToday);
    setVal('rep-sales-week', salesWeek);
    setVal('rep-sales-month', salesMonth);
    setVal('rep-debt-cust', debtCust);
    setVal('rep-debt-supp', debtSupp);
    
    const marginEl = document.getElementById('rep-margin');
    if (marginEl) {
        marginEl.innerText = `$ ${formatMoney(marginMonth)}`;
        marginEl.style.color = marginMonth >= 0 ? 'var(--success)' : 'var(--danger)'; 
    }

    renderTopProducts(validSales);
    updateMainChart(validSales);
}

// ==========================================
// 4. TOP PRODUCTOS (Desglosando Combos)
// ==========================================

function renderTopProducts(sales) {
    const list = document.getElementById('top-products-list');
    if (!list) return;

    const stats = {};
    const allProducts = JSON.parse(localStorage.getItem('products')) || [];

    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (item.isCombo) {
                // Desarmar Combo y sumar individualidades
                item.comboItems.forEach(ci => {
                    if(!stats[ci.id]) {
                        const p = allProducts.find(prod => prod.id === ci.id);
                        stats[ci.id] = { name: ci.name, qty: 0, profit: 0, cost: ci.cost || (p ? p.cost : 0) };
                    }
                    const totalQtySold = ci.qty * item.qty; // (Cant que trae el combo) * (Combos vendidos)
                    stats[ci.id].qty += totalQtySold;
                    // Ganancia = (Precio Proporcional Asignado - Costo Original) * Cantidad
                    stats[ci.id].profit += (ci.proportionalPrice - stats[ci.id].cost) * totalQtySold;
                });
            } else {
                // Producto normal
                if(!stats[item.id]) {
                    const p = allProducts.find(prod => prod.id === item.id);
                    stats[item.id] = { name: item.name, qty: 0, profit: 0, cost: item.cost || (p ? p.cost : 0) };
                }
                stats[item.id].qty += item.qty;
                stats[item.id].profit += (item.price - stats[item.id].cost) * item.qty;
            }
        });
    });

    const sorted = Object.values(stats).sort((a, b) => b[topType] - a[topType]).slice(0, 5);
    list.innerHTML = '';
    
    if (sorted.length === 0) {
        list.innerHTML = '<li style="text-align:center; color:#999;">Sin datos aún</li>';
        return;
    }

    sorted.forEach(p => {
        list.innerHTML += `<li>
            <span>${p.name}</span>
            <strong>${topType === 'qty' ? p.qty + ' un.' : '$ ' + formatMoney(p.profit)}</strong>
        </li>`;
    });
}

function toggleTopType() {
    topType = (topType === 'qty') ? 'profit' : 'qty';
    const btn = document.getElementById('btn-toggle-top');
    if(btn) btn.innerText = (topType === 'qty') ? 'Ver por Ganancia' : 'Ver por Cantidad';
    initDashboard();
}

/**
 * GRÁFICO DE LÍNEA: Histórico de Ventas
 */
function updateMainChart(salesData) {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    
    if (canvas.parentNode) {
        canvas.parentNode.style.height = '280px'; 
        canvas.parentNode.style.position = 'relative';
    }

    const ctx = canvas.getContext('2d');
    
    let labels = [];
    let data = [];
    const today = new Date();
    const daysToShow = 30;

    for (let i = daysToShow - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const loopDateStr = d.toLocaleDateString(); 
        
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

        const dayTotal = salesData.filter(s => {
            const saleDate = new Date(s.date).toLocaleDateString();
            return saleDate === loopDateStr;
        }).reduce((sum, sale) => sum + sale.total, 0);

        data.push(dayTotal);
    }

    if (mainChart) mainChart.destroy();
    
    mainChart = new Chart(ctx, {
        type: 'line', 
        data: {
            labels,
            datasets: [{ 
                label: 'Ventas', data, 
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(52, 152, 219, 0.4)');
                    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.0)');
                    return gradient;
                },
                borderColor: '#3498db', borderWidth: 2, pointRadius: 0, pointHoverRadius: 6, fill: true, tension: 0.4
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => 'Ventas: $ ' + formatMoney(c.parsed.y) } } },
            scales: { 
                x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
                y: { beginAtZero: true, grid: { borderDash: [5, 5], color: '#f0f0f0' }, ticks: { callback: (val) => '$' + formatCompactNumber(val), font: { size: 10 } } } 
            } 
        }
    });
}

// ==========================================
// 5. ESTADÍSTICAS DETALLADAS Y GRÁFICOS POR RUBRO
// ==========================================

function initStats() {
    const history = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const expenses = JSON.parse(localStorage.getItem('expenseHistory')) || [];
    const allProducts = JSON.parse(localStorage.getItem('products')) || [];

    const validSales = history.filter(s => s.type === 'venta' && s.status === 'completada');

    const totalSales = validSales.reduce((a, b) => a + b.total, 0);
    const totalExp = expenses.reduce((a, b) => a + b.amount, 0);
    
    let totalCost = 0;
    validSales.forEach(s => {
        s.items.forEach(item => {
            if (item.isCombo) {
                item.comboItems.forEach(ci => {
                    totalCost += (parseFloat(ci.cost || 0) * ci.qty * item.qty);
                });
            } else {
                totalCost += (parseFloat(item.cost || 0) * item.qty);
            }
        });
    });

    const netProfit = totalSales - totalCost - totalExp;

    document.getElementById('st-sales-total').innerText = `$ ${formatMoney(totalSales)}`;
    document.getElementById('st-cost-total').innerText = `$ ${formatMoney(totalCost)}`;
    document.getElementById('st-expenses-total').innerText = `$ ${formatMoney(totalExp)}`;
    
    const profitEl = document.getElementById('st-net-profit');
    if (profitEl) {
        profitEl.innerText = `$ ${formatMoney(netProfit)}`;
        profitEl.style.color = netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    renderRubroChart(validSales, allProducts);
    renderCategoryChart(expenses);
}

/**
 * GRÁFICO DE DONA: Ventas por Rubro (Desglosando Combos)
 */
function renderRubroChart(sales, productsDb) {
    const canvas = document.getElementById('rubroChart');
    if (!canvas) return;
    
    if (canvas.parentNode) {
        canvas.parentNode.style.height = '250px';
        canvas.parentNode.style.position = 'relative';
    }

    const ctx = canvas.getContext('2d');
    const rubros = {};

    sales.forEach(s => {
        s.items.forEach(item => {
            if (item.isCombo) {
                // El combo NO TIENE rubro en sí mismo, se le asigna el dinero a los rubros de lo que lleva adentro.
                item.comboItems.forEach(ci => {
                    const p = productsDb.find(prod => prod.id === ci.id);
                    const r = p && p.rubro ? p.rubro : 'Sin Rubro';
                    // Dinero sumado al rubro = (Precio Proporcional) * (Cant en combo) * (Combos vendidos)
                    const subtotalProporcional = ci.proportionalPrice * ci.qty * item.qty;
                    rubros[r] = (rubros[r] || 0) + subtotalProporcional;
                });
            } else {
                // Producto normal
                const p = productsDb.find(prod => prod.id === item.id);
                const r = p && p.rubro ? p.rubro : 'Sin Rubro';
                rubros[r] = (rubros[r] || 0) + item.subtotal;
            }
        });
    });

    const labels = Object.keys(rubros);
    const data = Object.values(rubros);

    if(rubroChart) rubroChart.destroy();
    
    rubroChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ 
                data: data, 
                backgroundColor: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e74c3c', '#95a5a6', '#34495e', '#16a085'],
                borderWidth: 2, hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } },
                tooltip: { callbacks: { label: function(context) { return ` ${context.label}: $${formatMoney(context.parsed)}`; } } }
            }
        }
    });
}

/**
 * GRÁFICO DE TORTA: Gastos por Categoría
 */
function renderCategoryChart(expenses) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    
    if (canvas.parentNode) {
        canvas.parentNode.style.height = '250px';
        canvas.parentNode.style.position = 'relative';
    }

    const ctx = canvas.getContext('2d');
    const cats = {};

    expenses.forEach(e => { 
        const c = e.category || 'General';
        cats[c] = (cats[c] || 0) + e.amount; 
    });

    if(categoryChart) categoryChart.destroy();
    
    categoryChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(cats),
            datasets: [{ 
                data: Object.values(cats), 
                backgroundColor: ['#e74c3c','#f1c40f','#3498db','#9b59b6','#1abc9c', '#e67e22'],
                borderWidth: 2, hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } },
                tooltip: { callbacks: { label: function(context) { return ` ${context.label}: $${formatMoney(context.parsed)}`; } } }
            }
        }
    });
}