/**
 * CONTROL-MAX - Módulo de Inventario con Gestión Contable
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
    } else {
        console.warn(`No se encontró la sub-pestaña: sub-${tabId}`);
    }

    // 3. Actualizar estado visual de los botones
    document.querySelectorAll('#inventory-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        // Buscamos el botón que tenga el tabId en su onclick
        if (btn.getAttribute('onclick').includes(`'${tabId}'`)) {
            btn.classList.add('active');
        }
    });

    // 4. Cargar datos específicos
    if (tabId === 'listado') renderInventory();
    if (tabId === 'nuevo-prod') {
        if (typeof prepareInventorySelectors === 'function') prepareInventorySelectors();
        if (typeof updateDatalists === 'function') updateDatalists();
    }
}

function renderInventory(dataToRender = null) {
    const tbody = document.getElementById('inventory-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = dataToRender || products.filter(p => p.active !== false);

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

// Evento Guardar
document.getElementById('product-form')?.addEventListener('submit', function(e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const cost = parseFloat(document.getElementById('prod-cost').value) || 0;
    const qty = parseFloat(document.getElementById('prod-stock-init').value) || 0;
    const totalReal = Math.round((cost * qty) * 100) / 100;

    const pCash = parseFloat(document.getElementById('pay-inv-cash').value) || 0;
    const pBank = parseFloat(document.getElementById('pay-inv-bank').value) || 0;
    const pCtaCte = parseFloat(document.getElementById('pay-inv-ctacte').value) || 0;
    const pPartner = parseFloat(document.getElementById('pay-inv-partner').value) || 0;
    
    const provId = document.getElementById('prod-prov-select').value;
    const partId = document.getElementById('pay-inv-partner-select').value;

    if (!id && totalReal > 0) {
        const sumaPagos = Math.round((pCash + pBank + pCtaCte + pPartner) * 100) / 100;
        if (sumaPagos !== totalReal) return alert(`El pago ($${sumaPagos}) no coincide con el total ($${totalReal})`);
        if (pCtaCte > 0 && !provId) return alert("Seleccione un proveedor.");
        if (pPartner > 0 && !partId) return alert("Seleccione un socio.");

        if (typeof updateBalancesStorage === 'function') updateBalancesStorage(-pCash, -pBank);
        
        if (pCtaCte > 0) {
            let sups = JSON.parse(localStorage.getItem('suppliers')) || [];
            const idx = sups.findIndex(s => s.id == provId);
            if (idx !== -1) {
                sups[idx].balance = (parseFloat(sups[idx].balance) || 0) - pCtaCte;
                localStorage.setItem('suppliers', JSON.stringify(sups));
            }
        }
        if (pPartner > 0) {
            let parts = JSON.parse(localStorage.getItem('partners')) || [];
            const idx = parts.findIndex(p => p.id == partId);
            if (idx !== -1) {
                parts[idx].totalContribution = (parseFloat(parts[idx].totalContribution) || 0) + pPartner;
                localStorage.setItem('partners', JSON.stringify(parts));
            }
        }
    }

    const productData = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('prod-name').value,
        code: document.getElementById('prod-code').value,
        desc: document.getElementById('prod-desc').value,
        rubro: document.getElementById('prod-rubro').value,
        marca: document.getElementById('prod-marca').value,
        cost: cost,
        price: parseFloat(document.getElementById('prod-price').value) || 0,
        stock: id ? (products.find(p => p.id == id).stock) : qty,
        active: true
    };

    if (id) {
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) products[index] = productData;
    } else {
        products.push(productData);
    }

    localStorage.setItem('products', JSON.stringify(products));
    if (typeof addLog === 'function') addLog('INVENTARIO', id ? 'EDICION' : 'CREACION', `Producto: ${productData.name}`);

    alert("¡Guardado correctamente!");
    this.reset();
    showSubTab('listado');
});

function editProduct(id) {
    const p = products.find(p => p.id === id);
    if (!p) return;
    document.getElementById('edit-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-code').value = p.code;
    document.getElementById('prod-desc').value = p.desc || '';
    document.getElementById('prod-rubro').value = p.rubro;
    document.getElementById('prod-marca').value = p.marca;
    document.getElementById('prod-cost').value = p.cost;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-stock-init').value = p.stock;
    document.getElementById('prod-stock-init').disabled = true;
    showSubTab('nuevo-prod');
}

function deleteProduct(id) {
    if (confirm("¿Desea eliminar este producto?")) {
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
        (p.name.toLowerCase().includes(text) || p.code.toLowerCase().includes(text) || (p[type] && p[type].toLowerCase().includes(text)))
    );
    renderInventory(filtered);
}