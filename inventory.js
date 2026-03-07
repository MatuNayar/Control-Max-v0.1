/**
 * CONTROL-MAX - Módulo de Inventario con Gestión Contable Avanzada
 */

// Cargar productos con seguridad
let products = JSON.parse(localStorage.getItem('products')) || [];

function showSubTab(tabId) {
    // 1. Ocultar todos los contenidos de sub-pestañas
    const contents = document.querySelectorAll('.sub-content');
    contents.forEach(el => el.style.display = 'none');

    // 2. Mostrar la pestaña solicitada
    const target = document.getElementById(`sub-${tabId}`);
    if (target) {
        target.style.display = 'block';
    }

    // 3. Actualizar estado visual de los botones
    document.querySelectorAll('#inventory-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(`'${tabId}'`)) {
            btn.classList.add('active');
        }
    });

    // 4. Cargar datos específicos
    if (tabId === 'listado') renderInventory();
    if (tabId === 'nuevo-prod') {
        prepareInventorySelectors();
        updateDatalists();
        // Limpiar formulario si es una nueva carga y no una edición
        if(!document.getElementById('edit-id').value) {
            document.getElementById('product-form').reset();
            document.getElementById('prod-stock-init').disabled = false;
        }
    }
}

function renderInventory(dataToRender = null) {
    const tbody = document.getElementById('inventory-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = dataToRender || products.filter(p => p.active !== false);

    if(list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No hay productos registrados.</td></tr>';
        return;
    }

    list.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.code}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.rubro || '-'}</td>
            <td>${p.stock || 0}</td>
            <td>$ ${formatMoney(p.price)}</td>
            <td>
                <button class="btn-edit" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function prepareInventorySelectors() {
    const provSelect = document.getElementById('prod-prov-select');
    const partSelect = document.getElementById('pay-inv-partner-select');
    
    const suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
    const partners = JSON.parse(localStorage.getItem('partners')) || [];

    if (provSelect) {
        provSelect.innerHTML = '<option value="">-- Sin Proveedor --</option>';
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

function updateDatalists() {
    const rList = document.getElementById('list-rubros');
    const mList = document.getElementById('list-marcas');
    
    if (rList) {
        const rubros = [...new Set(products.map(p => p.rubro))].filter(Boolean);
        rList.innerHTML = rubros.map(r => `<option value="${r}">`).join('');
    }
    if (mList) {
        const marcas = [...new Set(products.map(p => p.marca))].filter(Boolean);
        mList.innerHTML = marcas.map(m => `<option value="${m}">`).join('');
    }
}

function calcNewProdTotal() {
    const cost = parseFloat(document.getElementById('prod-cost').value) || 0;
    const qty = parseFloat(document.getElementById('prod-stock-init').value) || 0;
    const total = cost * qty;
    const display = document.getElementById('prod-total-buy');
    if (display) display.value = formatMoney(total);
}

// ==========================================
// LÓGICA DE GUARDADO Y CONTABILIDAD
// ==========================================

/**
 * Función auxiliar para registrar movimientos contables complejos
 * Maneja: Caja, Banco, Cta Cte Proveedores y Aportes de Socios
 */
function createPurchaseRecord(data) {
    const { prodName, qty, total, payments, ids } = data;
    const dateStr = new Date().toLocaleString();
    const isoDate = new Date().toISOString();

    // 1. IMPACTO EN CAJA Y BANCO (Dinero de la empresa)
    // Solo descontamos si hay pago en efectivo o banco
    if (payments.cash > 0 || payments.bank > 0) {
        if (typeof updateBalancesStorage === 'function') {
            updateBalancesStorage(-payments.cash, -payments.bank);
        } else {
            console.error("Error: Función updateBalancesStorage no encontrada.");
            return false;
        }
    }

    // 2. IMPACTO EN PROVEEDORES (Cuenta Corriente / Deuda)
    if (payments.ctacte > 0 && ids.provider) {
        let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
        const idx = suppliers.findIndex(s => s.id == ids.provider);
        
        if (idx !== -1) {
            // AUMENTAR DEUDA: En accounts.js, saldo positivo significa deuda nuestra.
            suppliers[idx].balance = (parseFloat(suppliers[idx].balance) || 0) + payments.ctacte;

            // Registrar movimiento en el historial del proveedor
            if (!suppliers[idx].history) suppliers[idx].history = [];
            suppliers[idx].history.push({
                date: dateStr,
                type: 'COMPRA', // 'COMPRA' se mostrará en la columna de Deuda (+)
                amount: payments.ctacte,
                note: `Compra Stock: ${prodName} (x${qty})`
            });

            localStorage.setItem('suppliers', JSON.stringify(suppliers));
        }
    }

    // 3. IMPACTO EN SOCIOS (Inversión / Aporte de Capital)
    if (payments.partner > 0 && ids.partner) {
        let partners = JSON.parse(localStorage.getItem('partners')) || [];
        const idx = partners.findIndex(p => p.id == ids.partner);
        
        if (idx !== -1) {
            // Aumentar el capital aportado por el socio
            partners[idx].totalContribution = (parseFloat(partners[idx].totalContribution) || 0) + payments.partner;
            
            // Guardamos partners actualizado
            localStorage.setItem('partners', JSON.stringify(partners));
        }
    }

    // 4. REGISTRO GLOBAL DE COMPRAS (Nueva tabla 'purchases' para auditoría)
    let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
    
    purchases.push({
        id: Date.now(),
        timestamp: isoDate,
        product: prodName,
        quantity: qty,
        totalCost: total,
        funding: {
            cash: payments.cash,
            bank: payments.bank,
            supplierCredit: payments.ctacte,
            partnerInvestment: payments.partner
        },
        providerId: ids.provider || null,
        partnerId: ids.partner || null
    });

    localStorage.setItem('purchases', JSON.stringify(purchases));

    return true;
}

// EVENTO SUBMIT DEL FORMULARIO
document.getElementById('product-form')?.addEventListener('submit', function(e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value; // Si tiene ID, es edición
    const name = document.getElementById('prod-name').value;
    
    // Valores numéricos
    const cost = parseFloat(document.getElementById('prod-cost').value) || 0;
    const qty = parseFloat(document.getElementById('prod-stock-init').value) || 0;
    const totalReal = Math.round((cost * qty) * 100) / 100;

    // Valores de la distribución del pago
    const pCash = parseFloat(document.getElementById('pay-inv-cash').value) || 0;
    const pBank = parseFloat(document.getElementById('pay-inv-bank').value) || 0;
    const pCtaCte = parseFloat(document.getElementById('pay-inv-ctacte').value) || 0;
    const pPartner = parseFloat(document.getElementById('pay-inv-partner').value) || 0;
    
    const provId = document.getElementById('prod-prov-select').value;
    const partId = document.getElementById('pay-inv-partner-select').value;

    // --- LÓGICA CONTABLE (Solo para Nuevos Productos) ---
    // Si editamos un producto existente, generalmente solo cambiamos nombre/precio, no volvemos a comprar stock.
    if (!id && totalReal > 0) {
        const sumaPagos = Math.round((pCash + pBank + pCtaCte + pPartner) * 100) / 100;
        
        // Validación de consistencia
        if (Math.abs(sumaPagos - totalReal) > 0.1) { // Tolerancia de centavos
            return alert(`Error: El total de pagos ($${sumaPagos}) no coincide con el Costo Total ($${totalReal})`);
        }
        if (pCtaCte > 0 && !provId) return alert("Error: Debe seleccionar un proveedor para asignar la Cuenta Corriente.");
        if (pPartner > 0 && !partId) return alert("Error: Debe seleccionar un socio para registrar el aporte.");

        // Ejecutar Contabilidad
        const success = createPurchaseRecord({
            prodName: name,
            qty: qty,
            total: totalReal,
            payments: { cash: pCash, bank: pBank, ctacte: pCtaCte, partner: pPartner },
            ids: { provider: provId, partner: partId }
        });

        if (!success) return; // Detener si hubo error crítico
    }

    // --- GUARDADO DEL PRODUCTO ---
    const productData = {
        id: id ? parseInt(id) : Date.now(),
        name: name,
        code: document.getElementById('prod-code').value,
        desc: '', // Campo opcional no presente en form actual, se deja vacío
        rubro: document.getElementById('prod-rubro').value,
        marca: document.getElementById('prod-marca').value,
        cost: cost,
        price: parseFloat(document.getElementById('prod-price').value) || 0,
        stock: id ? (products.find(p => p.id == id).stock) : qty, // Si es edición, mantenemos stock actual
        active: true
    };

    if (id) {
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) products[index] = productData;
    } else {
        products.push(productData);
    }

    localStorage.setItem('products', JSON.stringify(products));
    
    if (typeof addLog === 'function') {
        addLog('INVENTARIO', id ? 'EDICION' : 'CREACION', `Producto: ${productData.name} - Stock: ${qty}`);
    }

    alert("¡Producto guardado correctamente!");
    
    // Limpieza y redirección
    this.reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('prod-stock-init').disabled = false;
    
    // Actualizar UI
    showSubTab('listado');
    if (typeof renderBalances === 'function') renderBalances(); // Actualizar header de balance si existe
});

// ==========================================
// CRUD Y UTILIDADES
// ==========================================

function editProduct(id) {
    const p = products.find(p => p.id === id);
    if (!p) return;
    
    // Cargar datos en el formulario
    document.getElementById('edit-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-code').value = p.code;
    document.getElementById('prod-rubro').value = p.rubro;
    document.getElementById('prod-marca').value = p.marca;
    
    // Costos y Precios
    document.getElementById('prod-cost').value = p.cost;
    document.getElementById('prod-price').value = p.price;
    
    // Stock (Deshabilitado en edición para no generar inconsistencias contables)
    document.getElementById('prod-stock-init').value = p.stock;
    document.getElementById('prod-stock-init').disabled = true;
    
    // Resetear campos de pago (no se usan en edición simple)
    document.getElementById('pay-inv-cash').value = 0;
    document.getElementById('pay-inv-bank').value = 0;
    document.getElementById('pay-inv-ctacte').value = 0;
    document.getElementById('pay-inv-partner').value = 0;
    document.getElementById('prod-total-buy').value = '';

    showSubTab('nuevo-prod');
}

function deleteProduct(id) {
    if (confirm("¿Desea eliminar este producto? (Esta acción es lógica, no borra historial)")) {
        const idx = products.findIndex(p => p.id === id);
        if (idx !== -1) {
            products[idx].active = false;
            localStorage.setItem('products', JSON.stringify(products));
            renderInventory();
        }
    }
}

function filterProducts() {
    const text = document.getElementById('search-input').value.toLowerCase();
    const type = document.getElementById('filter-type').value;
    
    const filtered = products.filter(p => 
        p.active !== false && 
        (
            p.name.toLowerCase().includes(text) || 
            p.code.toLowerCase().includes(text) || 
            (p[type] && p[type].toLowerCase().includes(text))
        )
    );
    renderInventory(filtered);
}