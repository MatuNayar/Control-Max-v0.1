/**
 * CONTROL-MAX - Módulo de Compras (Refactorizado)
 * Maneja compras individuales y masivas con creación de productos y contabilidad estricta.
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

    preparePurchaseSelectors(tabId); // Cargar listas de proveedores/socios
    
    if (tabId === 'individual') updatePurchaseDatalist();
    if (tabId === 'grande' && bulkRowsCount === 0) addBulkRow();
}

/**
 * Carga los selectores de Proveedores y Socios dinámicamente
 * @param {string} type - 'individual' o 'grande'
 */
function preparePurchaseSelectors(type) {
    const prefix = type === 'individual' ? 'pay-ind' : 'pay-bulk';
    
    const provSelect = document.getElementById(`${prefix}-prov-select`);
    const partSelect = document.getElementById(`${prefix}-part-select`);
    
    const suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
    const partners = JSON.parse(localStorage.getItem('partners')) || [];

    if (provSelect) {
        provSelect.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>';
        suppliers.filter(s => s.active !== false).forEach(s => {
            provSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }

    if (partSelect) {
        partSelect.innerHTML = '<option value="">-- Seleccionar Socio --</option>';
        partners.filter(p => p.active !== false).forEach(p => {
            partSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    }
}

function updatePurchaseDatalist() {
    const list = document.getElementById('prod-list');
    if (!list) return;
    list.innerHTML = '';
    // Llenamos el datalist para búsqueda rápida
    products.filter(p => p.active !== false).forEach(p => {
        list.innerHTML += `<option value="${p.code}">${p.name}</option>`;
        if (p.code !== p.name) {
            list.innerHTML += `<option value="${p.name}">`; 
        }
    });
}

// ==========================================
// 2. LÓGICA DE COMPRA INDIVIDUAL
// ==========================================

function autoFillIndividual() {
    const val = document.getElementById('p-ind-search').value;
    const prod = products.find(p => p.code === val || p.name === val);
    if (prod) {
        document.getElementById('p-ind-cost').value = prod.cost || 0;
        document.getElementById('p-ind-price').value = prod.price || 0;
        calcIndTotal();
    }
}

function calcIndTotal() {
    const qty = parseFloat(document.getElementById('p-ind-qty').value) || 0;
    const cost = parseFloat(document.getElementById('p-ind-cost').value) || 0;
    const total = qty * cost;
    document.getElementById('p-ind-total-display').value = `$ ${formatMoney(total)}`;
}

function saveIndividualPurchase() {
    // A. Obtener Datos del Producto
    const val = document.getElementById('p-ind-search').value;
    const qty = parseFloat(document.getElementById('p-ind-qty').value) || 0;
    const cost = parseFloat(document.getElementById('p-ind-cost').value) || 0;
    const price = parseFloat(document.getElementById('p-ind-price').value) || 0;

    const prod = products.find(p => p.code === val || p.name === val);
    if (!prod) return alert("Error: Debe seleccionar un producto existente del inventario.");
    if (qty <= 0) return alert("Error: La cantidad debe ser mayor a 0.");

    const totalCompra = Math.round((qty * cost) * 100) / 100;

    // B. Obtener Datos de Pago
    const paymentData = getPaymentData('ind'); // Prefijo 'pay-ind'

    // C. Validar Totales (Suma exacta)
    if (!validatePaymentSum(totalCompra, paymentData)) return;

    // D. Ejecutar Transacción Contable
    if (!executeFinancialTransaction(paymentData, `Compra: ${prod.name} (x${qty})`, totalCompra)) return;

    // E. Actualizar Inventario
    prod.stock += qty;
    prod.cost = cost;
    prod.price = price;
    localStorage.setItem('products', JSON.stringify(products));

    // F. Registrar Log
    logGlobalPurchase([
        { name: prod.name, qty: qty, cost: cost, total: totalCompra }
    ], paymentData, totalCompra);

    alert("Compra Individual Registrada Exitosamente.");
    
    // G. Resetear
    document.getElementById('p-ind-search').value = '';
    document.getElementById('p-ind-qty').value = 1;
    document.getElementById('p-ind-cost').value = '';
    document.getElementById('p-ind-price').value = '';
    resetPaymentInputs('ind');
    calcIndTotal();
}

// ==========================================
// 3. LÓGICA DE COMPRA MASIVA (BULK)
// ==========================================

function addBulkRow() {
    bulkRowsCount++;
    const tbody = document.getElementById('bulk-body');
    const tr = document.createElement('tr');
    tr.id = `bulk-row-${bulkRowsCount}`;
    
    // Tabla con campos para crear productos nuevos
    tr.innerHTML = `
        <td>
            <input type="text" class="b-code" list="prod-list" placeholder="Cód." onchange="checkBulkProduct(${bulkRowsCount})" style="width:100%">
        </td>
        <td>
            <input type="text" class="b-name" placeholder="Nombre" style="width:100%">
        </td>
        <td>
            <input type="text" class="b-rubro" placeholder="Rubro" style="width:100%">
        </td>
        <td>
            <input type="text" class="b-marca" placeholder="Marca" style="width:100%">
        </td>
        <td><input type="number" class="b-qty" value="1" min="1" onchange="calcBulkTotal()" style="width:100%"></td>
        <td><input type="number" class="b-cost" step="0.01" onchange="calcBulkTotal()" style="width:100%"></td>
        <td><input type="number" class="b-price" step="0.01" style="width:100%"></td>
        <td><span class="b-subtotal" style="font-weight:bold; font-size:0.9rem;">$ 0.00</span></td>
        <td><button class="btn-delete" onclick="removeBulkRow(${bulkRowsCount})"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(tr);
}

/**
 * Verifica si el código existe.
 * - Si existe: Autocompleta los datos.
 * - Si no: Deja los campos vacíos para alta manual.
 */
function checkBulkProduct(id) {
    const row = document.getElementById(`bulk-row-${id}`);
    const codeInput = row.querySelector('.b-code');
    const val = codeInput.value.trim();
    
    const prod = products.find(p => p.code === val || p.name === val);

    if (prod) {
        // Producto Existente: Rellenar
        codeInput.value = prod.code; 
        row.querySelector('.b-name').value = prod.name;
        row.querySelector('.b-rubro').value = prod.rubro || '';
        row.querySelector('.b-marca').value = prod.marca || '';
        row.querySelector('.b-cost').value = prod.cost || 0;
        row.querySelector('.b-price').value = prod.price || 0;
    } else {
        // Producto Nuevo: Limpiar (menos código)
        row.querySelector('.b-name').value = ''; 
        row.querySelector('.b-rubro').value = '';
        row.querySelector('.b-marca').value = '';
        row.querySelector('.b-cost').value = '';
        row.querySelector('.b-price').value = '';
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
    // A. Recopilar y Validar Items
    const itemsToProcess = [];
    let totalCompra = 0;
    let error = null;

    const rows = document.querySelectorAll('#bulk-body tr');
    if (rows.length === 0) return alert("La tabla está vacía.");

    for (const tr of rows) {
        const code = tr.querySelector('.b-code').value.trim();
        const name = tr.querySelector('.b-name').value.trim();
        const rubro = tr.querySelector('.b-rubro').value.trim();
        const marca = tr.querySelector('.b-marca').value.trim();
        const qty = parseFloat(tr.querySelector('.b-qty').value) || 0;
        const cost = parseFloat(tr.querySelector('.b-cost').value) || 0;
        const price = parseFloat(tr.querySelector('.b-price').value) || 0;

        if (!code || !name) {
            error = "Todos los productos deben tener Código y Nombre.";
            break;
        }
        if (qty <= 0) {
            error = "Las cantidades deben ser mayores a 0.";
            break;
        }

        // Detectar si es Nuevo o Existente
        const existingProd = products.find(p => p.code === code);
        
        // Validación extra para productos nuevos
        if (!existingProd && (!rubro || !marca)) {
            error = `El producto nuevo "${name}" (Cód: ${code}) requiere Rubro y Marca.`;
            break;
        }

        itemsToProcess.push({
            isNew: !existingProd,
            id: existingProd ? existingProd.id : Date.now() + Math.random(),
            code, name, rubro, marca, qty, cost, price,
            total: qty * cost
        });
        
        totalCompra += (qty * cost);
    }

    if (error) return alert(error);
    totalCompra = Math.round(totalCompra * 100) / 100;

    // B. Obtener Datos de Pago Global
    const paymentData = getPaymentData('bulk');

    // C. Validar Totales
    if (!validatePaymentSum(totalCompra, paymentData)) return;

    // D. Ejecutar Transacción Contable
    if (!executeFinancialTransaction(paymentData, `Compra Masiva (${itemsToProcess.length} items)`, totalCompra)) return;

    // E. Actualizar Inventario (Crear o Actualizar)
    let newProductsCount = 0;
    
    itemsToProcess.forEach(item => {
        if (item.isNew) {
            // CREAR NUEVO
            products.push({
                id: Math.floor(item.id),
                code: item.code,
                name: item.name,
                rubro: item.rubro,
                marca: item.marca,
                cost: item.cost,
                price: item.price,
                stock: item.qty,
                active: true
            });
            newProductsCount++;
        } else {
            // ACTUALIZAR EXISTENTE
            const prod = products.find(p => p.code === item.code);
            if (prod) {
                prod.stock += item.qty;
                prod.cost = item.cost;
                prod.price = item.price; 
                prod.name = item.name;
                prod.rubro = item.rubro;
                prod.marca = item.marca;
            }
        }
    });

    localStorage.setItem('products', JSON.stringify(products));

    // F. Registrar Log
    logGlobalPurchase(itemsToProcess, paymentData, totalCompra);

    alert(`Compra Masiva Registrada.\n- Items Procesados: ${itemsToProcess.length}\n- Productos Nuevos Creados: ${newProductsCount}`);
    
    // G. Limpiar UI
    document.getElementById('bulk-body').innerHTML = '';
    bulkRowsCount = 0;
    addBulkRow();
    resetPaymentInputs('bulk');
    document.getElementById('bulk-total-display').innerText = '0.00';
    updatePurchaseDatalist(); // Actualizar lista de búsqueda
}


// ==========================================
// 4. UTILIDADES COMUNES (EL MOTOR CONTABLE)
// ==========================================

/**
 * Extrae los valores de los inputs de pago
 */
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

/**
 * Valida que la suma de los medios de pago coincida con el total
 */
function validatePaymentSum(totalRequired, p) {
    const sum = Math.round((p.cash + p.bank + p.ctacte + p.partner) * 100) / 100;
    
    // Tolerancia para errores de punto flotante
    if (Math.abs(sum - totalRequired) > 0.05) {
        alert(`Error en distribución de pago:\n\n` + 
              `Total a Pagar: $ ${formatMoney(totalRequired)}\n` + 
              `Suma Ingresada: $ ${formatMoney(sum)}\n` +
              `Diferencia: $ ${formatMoney(totalRequired - sum)}`);
        return false;
    }
    
    if (p.ctacte > 0 && !p.provId) { 
        alert("Error: Seleccione un Proveedor para asignar la Cuenta Corriente."); 
        return false; 
    }
    if (p.partner > 0 && !p.partId) { 
        alert("Error: Seleccione un Socio para asignar el Aporte de Capital."); 
        return false; 
    }
    
    return true;
}

/**
 * Ejecuta los movimientos financieros en las bases de datos
 */
function executeFinancialTransaction(p, description, totalAmount) {
    const dateStr = new Date().toLocaleString();

    // 1. CAJA Y BANCO (Salidas)
    if (p.cash > 0 || p.bank > 0) {
        if (typeof updateBalancesStorage === 'function') {
            updateBalancesStorage(-p.cash, -p.bank);
        } else {
            alert("Error crítico: No se encuentra el módulo de balance.");
            return false;
        }
    }

    // 2. PROVEEDORES (Aumentar Deuda)
    if (p.ctacte > 0 && p.provId) {
        let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
        const idx = suppliers.findIndex(s => s.id == p.provId);
        
        if (idx !== -1) {
            // Saldo positivo = Deuda nuestra
            suppliers[idx].balance = (parseFloat(suppliers[idx].balance) || 0) + p.ctacte; 
            
            if (!suppliers[idx].history) suppliers[idx].history = [];
            suppliers[idx].history.push({
                date: dateStr,
                type: 'COMPRA', 
                amount: p.ctacte,
                note: description
            });
            localStorage.setItem('suppliers', JSON.stringify(suppliers));
        }
    }

    // 3. SOCIOS (Aumentar Inversión)
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

/**
 * Guarda el registro en el historial global de compras
 */
function logGlobalPurchase(items, p, total) {
    let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
    
    const record = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        itemsCount: items.length,
        itemsDetail: items.length > 3 
            ? `${items[0].name}, ${items[1].name} y ${items.length - 2} más...` 
            : items.map(i => `${i.name} (x${i.qty})`).join(', '),
        totalCost: total,
        funding: {
            cash: p.cash,
            bank: p.bank,
            supplierCredit: p.ctacte,
            partnerInvestment: p.partner
        },
        providerId: p.provId || null,
        partnerId: p.partId || null
    };

    purchases.push(record);
    localStorage.setItem('purchases', JSON.stringify(purchases));
    
    if (typeof addLog === 'function') {
        addLog('COMPRAS', 'ALTA', `Compra registrada por $${formatMoney(total)} (${record.itemsDetail})`);
    }
}