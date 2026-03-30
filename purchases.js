/**
 * CONTROL-MAX - Módulo de Compras (Individual y Masiva)
 * Integrado con Autogeneración de Códigos y Cola de Impresión de Etiquetas.
 */

let bulkRowsCount = 0;

// ==========================================
// 1. INICIALIZACIÓN Y NAVEGACIÓN
// ==========================================

function showSubTabPurchase(tabId) {
    document.querySelectorAll('.purchase-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-${tabId}`).style.display = 'block';

    document.querySelectorAll('#purchases-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    preparePurchaseSelectors(tabId); 
    
    if (tabId === 'individual') updatePurchaseDatalist();
    if (tabId === 'grande' && bulkRowsCount === 0) addBulkRow();
}

function preparePurchaseSelectors(type) {
    const prefix = type === 'individual' ? 'pay-ind' : 'pay-bulk';
    const provSelect = document.getElementById(`${prefix}-prov-select`);
    const partSelect = document.getElementById(`${prefix}-part-select`);
    const suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
    const partners = JSON.parse(localStorage.getItem('partners')) || [];

    if (provSelect) {
        provSelect.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>';
        suppliers.filter(s => s.active !== false).forEach(s => provSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    }

    if (partSelect) {
        partSelect.innerHTML = '<option value="">-- Seleccionar Socio --</option>';
        partners.filter(p => p.active !== false).forEach(p => partSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`);
    }
}

function updatePurchaseDatalist() {
    const list = document.getElementById('prod-list');
    if (!list) return;
    list.innerHTML = '';
    products.filter(p => p.active !== false).forEach(p => {
        list.innerHTML += `<option value="${p.code}">${p.name}</option>`;
        if (p.code !== p.name) list.innerHTML += `<option value="${p.name}">`; 
    });
}

// ==========================================
// 2. LÓGICA DE COMPRA INDIVIDUAL
// ==========================================

function autoFillIndividual() {
    const val = document.getElementById('p-ind-search').value.toLowerCase();
    const prod = products.find(p => p.active !== false && (p.code.toLowerCase() === val || p.name.toLowerCase() === val));
    if (prod) {
        document.getElementById('p-ind-cost').value = prod.cost || 0;
        document.getElementById('p-ind-price').value = prod.price || 0;
        calcIndTotal();
    }
}

function calcIndTotal() {
    const qty = parseFloat(document.getElementById('p-ind-qty').value) || 0;
    const cost = parseFloat(document.getElementById('p-ind-cost').value) || 0;
    document.getElementById('p-ind-total-display').value = `$ ${formatMoney(qty * cost)}`;
}

function saveIndividualPurchase() {
    const val = document.getElementById('p-ind-search').value.toLowerCase();
    const qty = parseFloat(document.getElementById('p-ind-qty').value) || 0;
    const cost = parseFloat(document.getElementById('p-ind-cost').value) || 0;
    const price = parseFloat(document.getElementById('p-ind-price').value) || 0;

    const prod = products.find(p => p.active !== false && (p.code.toLowerCase() === val || p.name.toLowerCase() === val));
    if (!prod) return alert("Error: Debe seleccionar un producto existente del inventario para compra individual.");
    if (qty <= 0) return alert("Error: La cantidad debe ser mayor a 0.");

    const totalCompra = Math.round((qty * cost) * 100) / 100;
    const paymentData = getPaymentData('ind'); 

    if (!validatePaymentSum(totalCompra, paymentData)) return;
    if (!executeFinancialTransaction(paymentData, `Compra Individual: ${prod.name} (x${qty})`, totalCompra)) return;

    prod.stock += qty;
    prod.cost = cost;
    prod.price = price;
    localStorage.setItem('products', JSON.stringify(products));

    logGlobalPurchase([{ name: prod.name, qty: qty, cost: cost, total: totalCompra }], paymentData, totalCompra);

    // Auto-agregar a la cola de impresión de etiquetas
    if (typeof addToPrintQueue === 'function') {
        addToPrintQueue(prod, qty);
    }

    alert("Compra Individual Registrada Exitosamente. Etiquetas enviadas a la cola de impresión.");
    
    document.getElementById('p-ind-search').value = '';
    document.getElementById('p-ind-qty').value = 1;
    document.getElementById('p-ind-cost').value = '';
    document.getElementById('p-ind-price').value = '';
    resetPaymentInputs('ind');
    calcIndTotal();
    if(typeof updateGlobalDatalist === 'function') updateGlobalDatalist();
}

// ==========================================
// 3. LÓGICA DE COMPRA MASIVA (BULK)
// ==========================================

function addBulkRow() {
    bulkRowsCount++;
    const tbody = document.getElementById('bulk-body');
    const tr = document.createElement('tr');
    tr.id = `bulk-row-${bulkRowsCount}`;
    tr.className = 'data-grid-row';
    
    tr.innerHTML = `
        <td><input type="text" class="grid-input b-code" list="global-prod-list" placeholder="Auto..." onchange="checkBulkProduct(${bulkRowsCount})"></td>
        <td><input type="text" class="grid-input b-name" placeholder="Nombre completo"></td>
        <td><input type="text" class="grid-input b-rubro" list="list-rubros-global" placeholder="Ej: Bebidas"></td>
        <td><input type="text" class="grid-input b-marca" list="list-marcas-global" placeholder="Ej: Coca Cola"></td>
        <td><input type="number" class="grid-input b-qty center-text" value="1" min="1" onchange="calcBulkTotal()"></td>
        <td><input type="number" class="grid-input b-cost right-text" placeholder="0.00" step="0.01" onchange="calcBulkTotal()"></td>
        <td><input type="number" class="grid-input b-price right-text" placeholder="0.00" step="0.01"></td>
        <td style="text-align:right;"><span class="b-subtotal grid-subtotal">$ 0.00</span></td>
        <td style="text-align:center;"><button class="btn-grid-delete" onclick="removeBulkRow(${bulkRowsCount})"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function checkBulkProduct(id) {
    const row = document.getElementById(`bulk-row-${id}`);
    const codeInput = row.querySelector('.b-code');
    const val = codeInput.value.trim().toLowerCase();
    
    if (!val) return; 
    
    const prod = products.find(p => p.active !== false && (p.code.toLowerCase() === val || p.name.toLowerCase() === val));

    if (prod) {
        codeInput.value = prod.code; 
        row.querySelector('.b-name').value = prod.name;
        row.querySelector('.b-rubro').value = prod.rubro || '';
        row.querySelector('.b-marca').value = prod.marca || '';
        row.querySelector('.b-cost').value = prod.cost || 0;
        row.querySelector('.b-price').value = prod.price || 0;
    }
    calcBulkTotal();
}

function removeBulkRow(id) {
    const row = document.getElementById(`bulk-row-${id}`);
    if(row) row.remove();
    calcBulkTotal();
}

function calcBulkTotal() {
    let total = 0;
    document.querySelectorAll('#bulk-body tr').forEach(tr => {
        const q = parseFloat(tr.querySelector('.b-qty').value) || 0;
        const c = parseFloat(tr.querySelector('.b-cost').value) || 0;
        const sub = Math.round((q * c) * 100) / 100;
        tr.querySelector('.b-subtotal').innerText = `$ ${formatMoney(sub)}`;
        total += sub;
    });
    document.getElementById('bulk-total-display').innerText = formatMoney(total);
}

function saveBulkPurchase() {
    const itemsToProcess = [];
    let totalCompra = 0;
    let error = null;

    const rows = document.querySelectorAll('#bulk-body tr');
    if (rows.length === 0) return alert("La tabla está vacía.");

    for (const tr of rows) {
        let code = tr.querySelector('.b-code').value.trim();
        const name = tr.querySelector('.b-name').value.trim();
        const rubro = tr.querySelector('.b-rubro').value.trim();
        const marca = tr.querySelector('.b-marca').value.trim();
        const qty = parseFloat(tr.querySelector('.b-qty').value) || 0;
        const cost = parseFloat(tr.querySelector('.b-cost').value) || 0;
        const price = parseFloat(tr.querySelector('.b-price').value) || 0;

        if (!name) { error = "Todos los productos deben tener Nombre."; break; }
        if (qty <= 0) { error = "Las cantidades deben ser mayores a 0."; break; }

        let existingProd = code ? products.find(p => p.code === code) : null;
        
        if (!existingProd) {
            if (!rubro || !marca) { error = `El producto nuevo "${name}" requiere Rubro y Marca.`; break; }
            
            // Generación automática de código si se deja vacío
            if (!code) {
                if (typeof generateProductCode === 'function') {
                    code = generateProductCode(rubro);
                } else {
                    code = 'PROD-' + Date.now().toString().slice(-4);
                }
            }
            
            if (typeof checkAndSaveCategory === 'function') {
                checkAndSaveCategory('rubro', rubro);
                checkAndSaveCategory('marca', marca);
            }
        }

        itemsToProcess.push({
            isNew: !existingProd,
            id: existingProd ? existingProd.id : Date.now() + Math.random(),
            code: code, 
            name: name, 
            rubro: rubro, 
            marca: marca, 
            qty: qty, 
            cost: cost, 
            price: price,
            total: qty * cost
        });
        
        totalCompra += (qty * cost);
    }

    if (error) return alert(error);
    totalCompra = Math.round(totalCompra * 100) / 100;

    const paymentData = getPaymentData('bulk');
    if (!validatePaymentSum(totalCompra, paymentData)) return;
    if (!executeFinancialTransaction(paymentData, `Compra Masiva (${itemsToProcess.length} items)`, totalCompra)) return;

    let newProductsCount = 0;
    
    itemsToProcess.forEach(item => {
        let productObj = null;

        if (item.isNew) {
            productObj = {
                id: Math.floor(item.id),
                code: item.code,
                name: item.name,
                rubro: item.rubro,
                marca: item.marca,
                cost: item.cost,
                price: item.price,
                stock: item.qty,
                active: true
            };
            products.push(productObj);
            newProductsCount++;
        } else {
            const prod = products.find(p => p.code === item.code);
            if (prod) {
                prod.stock += item.qty;
                prod.cost = item.cost;
                prod.price = item.price; 
                prod.name = item.name;
                prod.rubro = item.rubro;
                prod.marca = item.marca;
                productObj = prod;
            }
        }

        // Auto-agregar a la cola de impresión de etiquetas la cantidad comprada
        if (productObj && typeof addToPrintQueue === 'function') {
            addToPrintQueue(productObj, item.qty);
        }
    });

    localStorage.setItem('products', JSON.stringify(products));

    logGlobalPurchase(itemsToProcess, paymentData, totalCompra);

    alert(`Compra Masiva Registrada Exitosamente.\n- Items Procesados: ${itemsToProcess.length}\n- Nuevos Creados Auto: ${newProductsCount}\n\nLas etiquetas se han enviado a la cola de impresión.`);
    
    document.getElementById('bulk-body').innerHTML = '';
    bulkRowsCount = 0;
    addBulkRow();
    resetPaymentInputs('bulk');
    document.getElementById('bulk-total-display').innerText = '0.00';
    updatePurchaseDatalist();
    if(typeof updateGlobalDatalist === 'function') updateGlobalDatalist();
}

// ==========================================
// 4. UTILIDADES COMUNES (MOTOR CONTABLE)
// ==========================================

function getPaymentData(prefix) {
    return {
        cash: parseFloat(document.getElementById(`pay-${prefix}-cash`).value) || 0,
        bank: parseFloat(document.getElementById(`pay-${prefix}-bank`).value) || 0,
        ctacte: parseFloat(document.getElementById(`pay-${prefix}-ctacte`).value) || 0,
        partner: parseFloat(document.getElementById(`pay-${prefix}-partner`).value) || 0,
        provId: document.getElementById(`pay-${prefix}-prov-select`).value,
        partId: document.getElementById(`pay-${prefix}-part-select`).value
    };
}

function resetPaymentInputs(prefix) {
    document.getElementById(`pay-${prefix}-cash`).value = 0;
    document.getElementById(`pay-${prefix}-bank`).value = 0;
    document.getElementById(`pay-${prefix}-ctacte`).value = 0;
    document.getElementById(`pay-${prefix}-partner`).value = 0;
    document.getElementById(`pay-${prefix}-prov-select`).value = "";
    document.getElementById(`pay-${prefix}-part-select`).value = "";
}

function validatePaymentSum(totalRequired, p) {
    const sum = Math.round((p.cash + p.bank + p.ctacte + p.partner) * 100) / 100;
    if (Math.abs(sum - totalRequired) > 0.05) {
        alert(`Error en distribución de pago:\n\nTotal a Pagar: $ ${formatMoney(totalRequired)}\nSuma Ingresada: $ ${formatMoney(sum)}\nDiferencia: $ ${formatMoney(totalRequired - sum)}`);
        return false;
    }
    if (p.ctacte > 0 && !p.provId) { alert("Seleccione un Proveedor para asignar la Cuenta Corriente."); return false; }
    if (p.partner > 0 && !p.partId) { alert("Seleccione un Socio para asignar el Aporte de Capital."); return false; }
    return true;
}

function executeFinancialTransaction(p, description, totalAmount) {
    const dateStr = new Date().toLocaleString();

    if (p.cash > 0 || p.bank > 0) {
        if (typeof updateBalancesStorage === 'function') updateBalancesStorage(-p.cash, -p.bank);
        else { alert("Error crítico: Módulo balance no disponible."); return false; }
    }

    if (p.ctacte > 0 && p.provId) {
        let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
        const idx = suppliers.findIndex(s => s.id == p.provId);
        if (idx !== -1) {
            suppliers[idx].balance = (parseFloat(suppliers[idx].balance) || 0) + p.ctacte; 
            if (!suppliers[idx].history) suppliers[idx].history = [];
            suppliers[idx].history.push({ date: dateStr, type: 'COMPRA', amount: p.ctacte, note: description });
            localStorage.setItem('suppliers', JSON.stringify(suppliers));
        }
    }

    if (p.partner > 0 && p.partId) {
        let partners = JSON.parse(localStorage.getItem('partners')) || [];
        const idx = partners.findIndex(pt => pt.id == p.partId);
        if (idx !== -1) {
            partners[idx].totalContribution = (parseFloat(partners[idx].totalContribution) || 0) + p.partner;
            localStorage.setItem('partners', JSON.stringify(partners));
        }
    }

    return true;
}

function logGlobalPurchase(items, p, total) {
    let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
    const record = {
        id: Date.now(), timestamp: new Date().toISOString(), itemsCount: items.length,
        itemsDetail: items.length > 3 ? `${items[0].name}, ${items[1].name} y ${items.length - 2} más...` : items.map(i => `${i.name} (x${i.qty})`).join(', '),
        totalCost: total, funding: { cash: p.cash, bank: p.bank, supplierCredit: p.ctacte, partnerInvestment: p.partner }, providerId: p.provId || null, partnerId: p.partId || null
    };
    purchases.push(record); localStorage.setItem('purchases', JSON.stringify(purchases));
    if (typeof addLog === 'function') addLog('COMPRAS', 'ALTA', `Compra registrada por $${formatMoney(total)} (${record.itemsDetail})`);
}