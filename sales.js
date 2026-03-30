/**
 * CONTROL-MAX - Módulo de Ventas POS (Nivel Producción)
 * - Múltiples Carritos (Sesiones)
 * - Lector de Código de Barras y Búsqueda Rápida
 * - Detección automática de OFERTAS y COMBOS
 * - Sistema de Presupuestos (Guardar, Cargar, Imprimir PDF)
 * - Atajos de teclado (F1, F2, F4, Enter)
 * - Historial de Ventas con ID único
 * - Sistema de Devoluciones Avanzado
 */

// ==========================================
// ESTADO GLOBAL DEL POS
// ==========================================
let posSessions = [ { id: Date.now(), items: [], clientName: '' } ];
let activeSessionIndex = 0;
let selectedProductToScan = null; // Almacena temporalmente el producto/combo a agregar

// ==========================================
// 1. IDENTIFICACIÓN Y MIGRACIÓN DE VENTAS
// ==========================================

function generateSaleId() {
    let config = JSON.parse(localStorage.getItem('config')) || { saleCounter: 0 };
    config.saleCounter += 1;
    localStorage.setItem('config', JSON.stringify(config));
    return 'V-' + String(config.saleCounter).padStart(6, '0');
}

// Migrar ventas antiguas para que tengan ID y status
function migrateSalesSystem() {
    let sales = JSON.parse(localStorage.getItem('salesHistory')) || [];
    let changed = false;
    sales.forEach(s => {
        if (!s.saleId) { s.saleId = generateSaleId(); changed = true; }
        if (!s.status) { s.status = 'completada'; changed = true; }
        // Asegurar que tengan el contador de devueltos
        if (s.items) {
            s.items.forEach(i => { if (typeof i.returnedQty === 'undefined') { i.returnedQty = 0; changed = true; } });
        }
    });
    if (changed) localStorage.setItem('salesHistory', JSON.stringify(sales));
}
migrateSalesSystem(); // Ejecutar al cargar el script

// ==========================================
// 2. INICIALIZACIÓN Y NAVEGACIÓN
// ==========================================

function showSubTabSales(tabId) {
    document.querySelectorAll('.sales-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-sales-${tabId}`).style.display = 'block';

    document.querySelectorAll('#sales-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if (tabId === 'pos') {
        renderCartTabs();
        updateSalesDropdown(); 
        document.getElementById('pos-search').focus(); 
    }
    if (tabId === 'quotes') {
        renderQuotes();
    }
    if (tabId === 'history') {
        renderSalesHistory();
    }
}

function updateSalesDropdown() {
    const datalist = document.getElementById('list-clients');
    if (!datalist) return;
    const customers = JSON.parse(localStorage.getItem('customers')) || [];
    datalist.innerHTML = customers.filter(c => c.active !== false).map(c => `<option value="${c.name}">`).join('');
}

// ==========================================
// 3. MÚLTIPLES CARRITOS (SESIONES)
// ==========================================

function renderCartTabs() {
    const container = document.getElementById('cart-tabs');
    if (!container) return;
    container.innerHTML = '';

    posSessions.forEach((session, idx) => {
        const btn = document.createElement('div');
        btn.className = `cart-tab ${idx === activeSessionIndex ? 'active' : ''}`;
        
        const tabName = session.clientName ? session.clientName.substring(0, 10) : `Carrito ${idx + 1}`;
        
        btn.innerHTML = `
            <span onclick="switchCart(${idx})" style="flex-grow:1;">${tabName}</span>
            ${posSessions.length > 1 ? `<span class="close-tab" onclick="removeCart(${idx})"><i class="fas fa-times"></i></span>` : ''}
        `;
        container.appendChild(btn);
    });

    const newBtn = document.createElement('button');
    newBtn.className = 'cart-tab btn-new-cart';
    newBtn.innerHTML = '+ Nuevo (F1)';
    newBtn.onclick = createNewCart;
    container.appendChild(newBtn);

    renderActiveCart();
}

function createNewCart() {
    posSessions.push({ id: Date.now(), items: [], clientName: '' });
    activeSessionIndex = posSessions.length - 1;
    renderCartTabs();
    document.getElementById('sales-client-search').value = '';
    document.getElementById('pos-search').focus();
}

function switchCart(index) {
    posSessions[activeSessionIndex].clientName = document.getElementById('sales-client-search').value;
    activeSessionIndex = index;
    renderCartTabs();
    document.getElementById('sales-client-search').value = posSessions[activeSessionIndex].clientName;
    document.getElementById('pos-search').focus();
}

function removeCart(index) {
    if (posSessions.length <= 1) return;
    posSessions.splice(index, 1);
    if (activeSessionIndex >= posSessions.length) activeSessionIndex = posSessions.length - 1;
    renderCartTabs();
}

// ==========================================
// 4. BUSCADOR INTELIGENTE (OFERTAS Y COMBOS)
// ==========================================

document.getElementById('pos-search')?.addEventListener('input', function(e) {
    const val = e.target.value.trim().toLowerCase();
    const resultBox = document.getElementById('pos-autocomplete');
    selectedProductToScan = null;

    if (val.length === 0) {
        resultBox.style.display = 'none';
        return;
    }

    const dbProducts = JSON.parse(localStorage.getItem('products')) || [];
    const dbCombos = JSON.parse(localStorage.getItem('combos')) || [];
    const dbOffers = JSON.parse(localStorage.getItem('offers')) || [];
    const today = new Date().setHours(0,0,0,0);

    const filteredProds = dbProducts.filter(p => p.active !== false && p.stock > 0 && (p.name.toLowerCase().includes(val) || p.code.toLowerCase().includes(val)));
    const filteredCombos = dbCombos.filter(c => c.name.toLowerCase().includes(val) || c.code.toLowerCase().includes(val));

    resultBox.innerHTML = '';
    
    // Combos
    filteredCombos.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `<strong style="color:#8e44ad;">[COMBO] ${c.code}</strong> - ${c.name} | $${formatMoney(c.finalPrice)}`;
        li.onclick = () => { selectItemForCart(c, true); resultBox.style.display = 'none'; };
        resultBox.appendChild(li);
    });

    // Productos y Ofertas
    filteredProds.forEach(p => {
        let finalP = p.price;
        let isOffer = false;
        
        const activeOffer = dbOffers.find(o => o.productId === p.id && new Date(o.expiry).getTime() >= today);
        if(activeOffer) {
            isOffer = true;
            if(activeOffer.type === 'percent') finalP = p.price * (1 - activeOffer.value/100);
            else if(activeOffer.type === 'amount') finalP = p.price - activeOffer.value;
            else if(activeOffer.type === 'exact') finalP = activeOffer.value;
        }

        const li = document.createElement('li');
        li.innerHTML = `<strong>${p.code}</strong> - ${p.name} | ${isOffer ? `<span style="color:var(--success); font-weight:bold;">$${formatMoney(finalP)} (OFERTA)</span>` : `$${formatMoney(p.price)}`} (Stock: ${p.stock})`;
        
        p._activePrice = finalP; 
        p._isOffer = isOffer;

        li.onclick = () => { selectItemForCart(p, false); resultBox.style.display = 'none'; };
        resultBox.appendChild(li);
    });

    if (resultBox.innerHTML !== '') resultBox.style.display = 'block';
    else resultBox.style.display = 'none';
});

// Comportamiento del Escáner (Presiona Enter rápido)
document.getElementById('pos-search')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = this.value.trim().toLowerCase();
        document.getElementById('pos-autocomplete').style.display = 'none';

        if (selectedProductToScan) { addCurrentToCart(); return; }

        const dbProducts = JSON.parse(localStorage.getItem('products')) || [];
        const dbCombos = JSON.parse(localStorage.getItem('combos')) || [];
        
        const exactCombo = dbCombos.find(c => c.code.toLowerCase() === val);
        if(exactCombo) { 
            selectItemForCart(exactCombo, true); 
            addCurrentToCart(); 
            return; 
        }

        const exactMatch = dbProducts.find(p => p.code.toLowerCase() === val && p.active !== false);
        if (exactMatch) {
            const dbOffers = JSON.parse(localStorage.getItem('offers')) || [];
            const today = new Date().setHours(0,0,0,0);
            const activeOffer = dbOffers.find(o => o.productId === exactMatch.id && new Date(o.expiry).getTime() >= today);
            
            let finalP = exactMatch.price;
            let isOffer = false;
            
            if(activeOffer) {
                isOffer = true;
                if(activeOffer.type === 'percent') finalP = exactMatch.price * (1 - activeOffer.value/100);
                else if(activeOffer.type === 'amount') finalP = exactMatch.price - activeOffer.value;
                else if(activeOffer.type === 'exact') finalP = activeOffer.value;
            }
            
            exactMatch._activePrice = finalP;
            exactMatch._isOffer = isOffer;
            
            selectItemForCart(exactMatch, false); 
            addCurrentToCart(); 
            return; 
        }

        alert("Producto o Combo no encontrado.");
        this.select();
    }
});

function selectItemForCart(item, isCombo) {
    document.getElementById('pos-search').value = item.name;
    selectedProductToScan = { ...item, isCombo: isCombo };
    document.getElementById('pos-qty').focus(); 
}

// ==========================================
// 5. GESTIÓN DEL CARRITO
// ==========================================

function addCurrentToCart() {
    const qtyInput = document.getElementById('pos-qty');
    const qty = parseInt(qtyInput.value);

    if (!selectedProductToScan) return alert("Busque y seleccione un producto primero.");
    if (isNaN(qty) || qty <= 0) return alert("Cantidad inválida.");

    const activeCart = posSessions[activeSessionIndex].items;
    const dbProducts = JSON.parse(localStorage.getItem('products')) || [];
    
    // VALIDAR STOCK 
    if (selectedProductToScan.isCombo) {
        let canAdd = true;
        let missingProd = '';
        selectedProductToScan.items.forEach(ci => {
            const prodDB = dbProducts.find(p => p.id === ci.id);
            const requiredStock = ci.qty * qty; 
            if (!prodDB || prodDB.stock < requiredStock) { 
                canAdd = false; 
                missingProd = prodDB ? prodDB.name : ci.name;
            }
        });
        if(!canAdd) return alert(`Stock insuficiente de "${missingProd}" para armar el combo.`);
    } else {
        const inCart = activeCart.find(item => item.id === selectedProductToScan.id && !item.isCombo);
        const qtyInCart = inCart ? inCart.qty : 0;
        if (selectedProductToScan.stock < (qtyInCart + qty)) {
            return alert(`Stock insuficiente. Disponible: ${selectedProductToScan.stock}`);
        }
    }

    const priceToUse = selectedProductToScan.isCombo ? selectedProductToScan.finalPrice : selectedProductToScan._activePrice;
    const existIdx = activeCart.findIndex(i => i.id === selectedProductToScan.id && i.isCombo === selectedProductToScan.isCombo);
    
    if (existIdx !== -1) {
        activeCart[existIdx].qty += qty;
        activeCart[existIdx].subtotal = activeCart[existIdx].qty * activeCart[existIdx].price;
    } else {
        activeCart.push({
            id: selectedProductToScan.id,
            isCombo: selectedProductToScan.isCombo,
            isOffer: selectedProductToScan._isOffer || false,
            code: selectedProductToScan.code,
            name: selectedProductToScan.name,
            price: priceToUse,
            cost: selectedProductToScan.cost || 0,
            qty: qty,
            returnedQty: 0, // Campo necesario para devoluciones
            subtotal: priceToUse * qty,
            comboItems: selectedProductToScan.isCombo ? selectedProductToScan.items : null
        });
    }

    document.getElementById('pos-search').value = '';
    qtyInput.value = 1;
    selectedProductToScan = null;
    document.getElementById('pos-search').focus();
    renderActiveCart();
}

function renderActiveCart() {
    const tbody = document.getElementById('cart-body');
    const totalEl = document.getElementById('cart-total');
    if (!tbody) return;

    tbody.innerHTML = '';
    let total = 0;
    const activeCart = posSessions[activeSessionIndex].items;

    activeCart.forEach((item, index) => {
        total += item.subtotal;
        
        let badges = '';
        if (item.isCombo) badges = '<span style="background:#8e44ad; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-right:5px;">COMBO</span>';
        if (item.isOffer) badges = '<span style="background:var(--success); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-right:5px;">OFERTA</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div>${badges}<strong>${item.name}</strong></div>
                <small style="color:#888;">Cod: ${item.code} | $${formatMoney(item.price)} C/U</small>
            </td>
            <td style="text-align:center; font-size:1.1rem; font-weight:bold;">${item.qty}</td>
            <td style="text-align:right; font-size:1.1rem;">$ ${formatMoney(item.subtotal)}</td>
            <td style="text-align:center;">
                <button onclick="removeFromActiveCart(${index})" class="btn-delete" title="Quitar"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    totalEl.innerText = formatMoney(total);
}

function removeFromActiveCart(index) {
    posSessions[activeSessionIndex].items.splice(index, 1);
    renderActiveCart();
}

// ==========================================
// 6. ATAJOS DE TECLADO GLOBALES
// ==========================================
document.addEventListener('keydown', function(e) {
    const salesSection = document.getElementById('sales-section');
    const posSubTab = document.getElementById('sub-sales-pos');
    
    if (salesSection && posSubTab && salesSection.style.display !== 'none' && posSubTab.style.display !== 'none') {
        if (e.key === 'F1') { e.preventDefault(); createNewCart(); }
        else if (e.key === 'F2') { e.preventDefault(); document.getElementById('pos-search').focus(); }
        else if (e.key === 'F4') { e.preventDefault(); checkout(); }
        else if (e.key === 'Enter' && document.activeElement.id === 'pos-qty') {
            e.preventDefault();
            addCurrentToCart();
        }
    }
});

// ==========================================
// 7. SISTEMA DE PRESUPUESTOS
// ==========================================

function saveAsQuote() {
    const cart = posSessions[activeSessionIndex];
    if (cart.items.length === 0) return alert("El carrito está vacío.");
    
    const clientName = document.getElementById('sales-client-search').value.trim() || 'Consumidor Final';
    let quotes = JSON.parse(localStorage.getItem('quotes')) || [];
    
    quotes.push({
        id: Date.now(),
        date: new Date().toLocaleString(),
        client: clientName,
        items: [...cart.items],
        total: cart.items.reduce((acc, i) => acc + i.subtotal, 0)
    });
    
    localStorage.setItem('quotes', JSON.stringify(quotes));
    alert("✅ Presupuesto guardado exitosamente.");
    
    cart.items = [];
    document.getElementById('sales-client-search').value = '';
    renderActiveCart();
}

function renderQuotes() {
    const tbody = document.getElementById('quotes-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let quotes = JSON.parse(localStorage.getItem('quotes')) || [];
    if (quotes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay presupuestos guardados.</td></tr>';
        return;
    }

    [...quotes].reverse().forEach(q => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${q.date}</td>
            <td><strong>${q.client}</strong></td>
            <td>${q.items.length} items</td>
            <td style="font-weight:bold; color:var(--primary);">$ ${formatMoney(q.total)}</td>
            <td>
                <button class="btn-secondary" onclick="printQuote(${q.id})" title="Imprimir" style="padding:5px; font-size:0.9rem;"><i class="fas fa-print"></i></button>
                <button class="btn-primary" onclick="loadQuoteToCart(${q.id})" title="Pasar a Caja" style="padding:5px; font-size:0.9rem;"><i class="fas fa-shopping-cart"></i></button>
                <button class="btn-delete" onclick="deleteQuote(${q.id})" title="Eliminar" style="padding:5px; font-size:0.9rem;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteQuote(id) {
    if(confirm("¿Eliminar presupuesto?")) {
        let quotes = JSON.parse(localStorage.getItem('quotes')) || [];
        quotes = quotes.filter(q => q.id !== id);
        localStorage.setItem('quotes', JSON.stringify(quotes));
        renderQuotes();
    }
}

function loadQuoteToCart(id) {
    let quotes = JSON.parse(localStorage.getItem('quotes')) || [];
    const q = quotes.find(x => x.id === id);
    if (!q) return;

    posSessions.push({
        id: Date.now(),
        items: [...q.items],
        clientName: q.client === 'Consumidor Final' ? '' : q.client
    });
    
    activeSessionIndex = posSessions.length - 1;
    showSubTabSales('pos'); 
    document.getElementById('sales-client-search').value = posSessions[activeSessionIndex].clientName;
}

function printQuote(id) {
    let quotes = JSON.parse(localStorage.getItem('quotes')) || [];
    const q = quotes.find(x => x.id === id);
    if (!q) return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    let itemsHTML = '';
    q.items.forEach(i => {
        itemsHTML += `<tr style="border-bottom: 1px dashed #ccc;"><td style="padding: 5px 0;">${i.qty}x ${i.name}</td><td style="text-align: right;">$${formatMoney(i.subtotal)}</td></tr>`;
    });

    const htmlContent = `
        <html><head><title>Presupuesto</title>
        <style>
            body { font-family: monospace; font-size: 14px; padding: 10px; }
            .text-center { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .total { font-size: 18px; font-weight: bold; margin-top: 15px; text-align: right; }
        </style></head>
        <body onload="window.print(); window.close();">
            <div class="text-center"><h2>PRESUPUESTO</h2><p>Fecha: ${q.date}<br>Cliente: ${q.client}</p></div>
            <hr style="border:1px dashed #000;">
            <table>${itemsHTML}</table>
            <div class="total">TOTAL: $ ${formatMoney(q.total)}</div>
            <br><p class="text-center"><em>Documento no válido como factura.</em></p>
        </body></html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// ==========================================
// 8. PROCESO DE COBRO (CHECKOUT)
// ==========================================

function toggleCombinedPayment() {
    const method = document.getElementById('payment-method').value;
    const combinedBox = document.getElementById('combined-inputs');
    if (combinedBox) combinedBox.style.display = (method === 'combined') ? 'flex' : 'none';
}

function checkout() {
    const cart = posSessions[activeSessionIndex].items;
    if (cart.length === 0) return alert("El carrito está vacío.");

    const clientInput = document.getElementById('sales-client-search');
    let clientName = clientInput.value.trim() || "Consumidor Final";

    const total = Math.round(cart.reduce((acc, i) => acc + i.subtotal, 0) * 100) / 100;
    const method = document.getElementById('payment-method').value;
    
    let pCash = 0, pBank = 0, pCtaCte = 0;

    if (method === 'cash') pCash = total;
    else if (method === 'bank') pBank = total;
    else if (method === 'ctacte') pCtaCte = total;
    else {
        pCash = parseFloat(document.getElementById('pay-cash').value) || 0;
        pBank = parseFloat(document.getElementById('pay-bank').value) || 0;
        pCtaCte = parseFloat(document.getElementById('pay-ctacte').value) || 0;

        const sumaTotal = Math.round((pCash + pBank + pCtaCte) * 100) / 100;
        if (Math.abs(sumaTotal - total) > 0.05) {
            return alert(`Error: Total a pagar $${formatMoney(total)} no coincide con la suma $${formatMoney(sumaTotal)}`);
        }
    }

    // Gestionar Cliente
    let customers = JSON.parse(localStorage.getItem('customers')) || [];
    let client = customers.find(c => c.name.toLowerCase() === clientName.toLowerCase() && c.active !== false);

    if (!client && clientName !== "Consumidor Final") {
        client = { id: Date.now(), name: clientName, balance: 0, active: true, history: [] };
        customers.push(client);
    }

    if (pCtaCte > 0) {
        if (clientName === "Consumidor Final") return alert("Debe ingresar un cliente específico para vender a Cuenta Corriente.");
        client.balance = Math.round((parseFloat(client.balance || 0) + pCtaCte) * 100) / 100;
        client.history.push({ date: new Date().toLocaleString(), type: 'DEUDA', amount: pCtaCte, note: 'Compra en POS' });
    }

    // Impacto Financiero y de Stock
    if (typeof updateBalancesStorage === 'function') updateBalancesStorage(pCash, pBank);
    
    let dbProducts = JSON.parse(localStorage.getItem('products')) || [];
    cart.forEach(item => {
        if (item.isCombo) {
            item.comboItems.forEach(ci => {
                const prod = dbProducts.find(p => p.id === ci.id);
                if(prod) prod.stock -= (ci.qty * item.qty);
            });
        } else {
            const prod = dbProducts.find(p => p.id === item.id);
            if(prod) prod.stock -= item.qty;
        }
    });

    // Guardar Venta
    const saleRecord = {
        id: Date.now(),
        saleId: generateSaleId(), // NUEVO ID CORRELATIVO
        date: new Date().toISOString(),
        type: 'venta',
        status: 'completada',
        client: clientName,
        clientId: client ? client.id : null,
        items: [...cart], 
        total: total,
        payments: { cash: pCash, bank: pBank, ctacte: pCtaCte }
    };

    let salesHistory = JSON.parse(localStorage.getItem('salesHistory')) || [];
    salesHistory.push(saleRecord);

    localStorage.setItem('products', JSON.stringify(dbProducts));
    localStorage.setItem('customers', JSON.stringify(customers));
    localStorage.setItem('salesHistory', JSON.stringify(salesHistory));

    if (typeof addLog === 'function') addLog('VENTAS', 'VENTA', `Venta ${saleRecord.saleId} por $ ${formatMoney(total)}`, saleRecord, saleRecord.id);

    alert(`✅ Venta procesada correctamente.\nID: ${saleRecord.saleId}\nTotal: $ ${formatMoney(total)}`);
    
    posSessions[activeSessionIndex].items = [];
    document.getElementById('sales-client-search').value = '';
    document.getElementById('payment-method').value = 'cash';
    toggleCombinedPayment();
    renderActiveCart();
    document.getElementById('pos-search').focus();

    if (typeof products !== 'undefined') products = dbProducts; 
    if (typeof initDashboard === 'function') setTimeout(initDashboard, 50); 
}

// ==========================================
// 9. HISTORIAL DE VENTAS Y DEVOLUCIONES
// ==========================================

function renderSalesHistory() {
    const tbody = document.getElementById('sales-history-body');
    if (!tbody) return;
    
    const start = document.getElementById('sh-date-start').value;
    const end = document.getElementById('sh-date-end').value;
    const search = document.getElementById('sh-search').value.toLowerCase();
    
    let sales = JSON.parse(localStorage.getItem('salesHistory')) || [];

    const filtered = sales.filter(s => {
        const date = s.date.split('T')[0];
        const matchDate = (!start || date >= start) && (!end || date <= end);
        const matchSearch = !search || 
                            (s.saleId && s.saleId.toLowerCase().includes(search)) || 
                            (s.client && s.client.toLowerCase().includes(search));
        return matchDate && matchSearch && s.type === 'venta';
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No se encontraron ventas.</td></tr>';
        return;
    }

    [...filtered].reverse().forEach(s => {
        const d = new Date(s.date);
        
        let statusBadge = '';
        if(s.status === 'completada') statusBadge = '<span class="badge" style="background:#d4edda; color:#155724; border:1px solid #c3e6cb;">Completada</span>';
        if(s.status === 'parcial') statusBadge = '<span class="badge" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba;">Dev. Parcial</span>';
        if(s.status === 'devuelta') statusBadge = '<span class="badge" style="background:#f8d7da; color:#721c24; border:1px solid #f5c6cb;">Devuelta</span>';

        tbody.innerHTML += `
            <tr>
                <td><strong>${s.saleId}</strong></td>
                <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td>${s.client || 'Consumidor Final'}</td>
                <td style="font-weight:bold; color:var(--primary);">$${formatMoney(s.total)}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-secondary" onclick="viewEventDetail(${s.id})" title="Ver Detalles" style="padding:4px 8px;"><i class="fas fa-eye"></i></button>
                    ${s.status !== 'devuelta' ? `<button class="btn-delete" onclick="openReturnModal(${s.id})" title="Procesar Devolución" style="padding:4px 8px; border:1px solid var(--danger);"><i class="fas fa-undo"></i></button>` : ''}
                </td>
            </tr>
        `;
    });
}

// LÓGICA DE DEVOLUCIONES
let currentReturnSale = null;

function openReturnModal(id) {
    let sales = JSON.parse(localStorage.getItem('salesHistory')) || [];
    currentReturnSale = sales.find(s => s.id === id);
    if (!currentReturnSale) return;

    document.getElementById('ret-sale-id').innerText = currentReturnSale.saleId;
    const tbody = document.getElementById('ret-items-body');
    tbody.innerHTML = '';

    currentReturnSale.items.forEach((item, index) => {
        const available = item.qty - (item.returnedQty || 0);
        if (available > 0) {
            tbody.innerHTML += `
                <tr>
                    <td>${item.name} ${item.isCombo ? '(COMBO)' : ''}</td>
                    <td>$${formatMoney(item.price)}</td>
                    <td style="text-align:center;">${available} disp.</td>
                    <td><input type="number" class="ret-qty-input" data-index="${index}" data-price="${item.price}" data-max="${available}" value="0" min="0" max="${available}" style="width:70px; text-align:center;" oninput="calcReturnTotal()"></td>
                </tr>
            `;
        }
    });

    document.getElementById('ret-pay-cash').value = 0;
    document.getElementById('ret-pay-bank').value = 0;
    document.getElementById('ret-pay-ctacte').value = 0;
    document.getElementById('ret-total-amount').innerText = "0.00";

    document.getElementById('return-modal').style.display = 'flex';
}

function closeReturnModal() {
    document.getElementById('return-modal').style.display = 'none';
    currentReturnSale = null;
}

function calcReturnTotal() {
    let total = 0;
    document.querySelectorAll('.ret-qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        const price = parseFloat(input.getAttribute('data-price'));
        total += (qty * price);
    });
    document.getElementById('ret-total-amount').innerText = formatMoney(total);
    return total;
}

function processReturn() {
    const totalToRefund = Math.round(calcReturnTotal() * 100) / 100;
    if (totalToRefund <= 0) return alert("Debe seleccionar al menos un producto para devolver.");

    const rCash = parseFloat(document.getElementById('ret-pay-cash').value) || 0;
    const rBank = parseFloat(document.getElementById('ret-pay-bank').value) || 0;
    const rCtaCte = parseFloat(document.getElementById('ret-pay-ctacte').value) || 0;
    
    const sumRefunds = Math.round((rCash + rBank + rCtaCte) * 100) / 100;

    if (Math.abs(sumRefunds - totalToRefund) > 0.05) {
        return alert(`ERROR: La suma de reintegros ($${sumRefunds}) no coincide con el total a devolver ($${totalToRefund}).`);
    }

    const retType = document.querySelector('input[name="ret-type"]:checked').value;
    let dbProducts = JSON.parse(localStorage.getItem('products')) || [];
    let losses = JSON.parse(localStorage.getItem('losses')) || [];
    
    let itemsReturned = [];
    let totalOriginalQty = 0;
    let totalCurrentReturned = 0;

    // 1. PROCESAR PRODUCTOS Y STOCK
    document.querySelectorAll('.ret-qty-input').forEach(input => {
        const returnQty = parseInt(input.value) || 0;
        const itemIndex = parseInt(input.getAttribute('data-index'));
        const item = currentReturnSale.items[itemIndex];
        
        totalOriginalQty += item.qty;

        if (returnQty > 0) {
            item.returnedQty = (item.returnedQty || 0) + returnQty;
            itemsReturned.push({ ...item, qtyReturned: returnQty });

            // Lógica de Stock
            if (item.isCombo) {
                item.comboItems.forEach(ci => {
                    const prod = dbProducts.find(p => p.id === ci.id);
                    if (prod) {
                        if (retType === 'normal') prod.stock += (ci.qty * returnQty);
                        if (retType === 'defective') {
                            losses.push({ id: Date.now()+Math.random(), date: new Date().toLocaleString(), productId: prod.id, productName: prod.name, qty: ci.qty * returnQty, reason: 'Devolución Defectuosa', lossValue: ci.cost * ci.qty * returnQty });
                        }
                    }
                });
            } else {
                const prod = dbProducts.find(p => p.id === item.id);
                if (prod) {
                    if (retType === 'normal') prod.stock += returnQty;
                    if (retType === 'defective') {
                        losses.push({ id: Date.now()+Math.random(), date: new Date().toLocaleString(), productId: prod.id, productName: prod.name, qty: returnQty, reason: 'Devolución Defectuosa', lossValue: item.cost * returnQty });
                    }
                }
            }
        } else {
            totalCurrentReturned += (item.returnedQty || 0); // Sumar lo que ya se había devuelto antes
        }
        totalCurrentReturned += returnQty;
    });

    // 2. ACTUALIZAR ESTADO VENTA
    currentReturnSale.status = (totalCurrentReturned >= totalOriginalQty) ? 'devuelta' : 'parcial';

    // 3. IMPACTO FINANCIERO
    if (typeof updateBalancesStorage === 'function') updateBalancesStorage(-rCash, -rBank);

    if (rCtaCte > 0 && currentReturnSale.clientId) {
        let customers = JSON.parse(localStorage.getItem('customers')) || [];
        let client = customers.find(c => c.id === currentReturnSale.clientId);
        if (client) {
            client.balance = Math.round((parseFloat(client.balance) - rCtaCte) * 100) / 100;
            client.history.push({ date: new Date().toLocaleString(), type: 'PAGO', amount: rCtaCte, note: `Nota de Crédito por Devolución ${currentReturnSale.saleId}` });
            localStorage.setItem('customers', JSON.stringify(customers));
        }
    }

    // 4. GUARDAR REGISTROS
    let returnsDb = JSON.parse(localStorage.getItem('returns')) || [];
    returnsDb.push({
        id: Date.now(), saleId: currentReturnSale.saleId, saleDbId: currentReturnSale.id,
        items: itemsReturned, totalRefund: totalToRefund, distribution: { cash: rCash, bank: rBank, ctacte: rCtaCte },
        type: retType, date: new Date().toISOString()
    });

    let salesHistory = JSON.parse(localStorage.getItem('salesHistory')) || [];
    const sIndex = salesHistory.findIndex(s => s.id === currentReturnSale.id);
    if (sIndex !== -1) salesHistory[sIndex] = currentReturnSale;

    localStorage.setItem('salesHistory', JSON.stringify(salesHistory));
    localStorage.setItem('products', JSON.stringify(dbProducts));
    localStorage.setItem('losses', JSON.stringify(losses));
    localStorage.setItem('returns', JSON.stringify(returnsDb));

    if (typeof addLog === 'function') addLog('VENTAS', 'DEVOLUCION', `Devolución $${totalToRefund} (Venta ${currentReturnSale.saleId})`);

    alert("✅ Devolución procesada correctamente.");
    closeReturnModal();
    renderSalesHistory();
    if (typeof products !== 'undefined') products = dbProducts; 
}