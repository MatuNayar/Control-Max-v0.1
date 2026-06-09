/**
 * CONTROL-MAX - Módulo de Socios Avanzado
 * - Aportes Físicos y Contables (Sin afectar Caja/Banco)
 * - Retiros de Dinero
 * - Retiros de Mercadería (Carrito, Escáner, Costo/Venta)
 */

let partners = [];   // se hidrata desde Firebase al entrar a la sección Socios
let partnerCart = [];

function hydratePartners() {
    partners = DB.get('partners', []);
}

// Refresco en vivo cuando cambian los socios desde otra PC.
DB.onChange('partners', () => {
    partners = DB.get('partners', []);
    const sec = document.getElementById('partners-section');
    if (sec && sec.style.display !== 'none') renderPartners();
});

// ==========================================
// 1. NAVEGACIÓN Y RENDERIZADO PRINCIPAL
// ==========================================

function showSubTabPartner(tabId) {
    hydratePartners();
    document.querySelectorAll('.partner-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-partners-${tabId}`);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('#partners-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if(tabId === 'listado') renderPartners();
    if(tabId === 'aporte' || tabId === 'retiro') updatePartnerSelects();
    
    // Limpiezas
    if(tabId === 'retiro') {
        const radioDinero = document.querySelector('input[name="with-type"][value="dinero"]');
        if (radioDinero) radioDinero.checked = true;
        toggleWithMode();
        partnerCart = [];
        renderPartnerCart();
    }
}

function renderPartners() {
    const tbody = document.getElementById('partners-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    const activePartners = partners.filter(p => p.active !== false);

    if (activePartners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay socios registrados.</td></tr>';
        return;
    }

    activePartners.forEach(p => {
        const inv = parseFloat(p.totalContribution) || 0;
        const withdr = parseFloat(p.totalWithdrawals) || 0;
        const net = inv - withdr;

        tbody.innerHTML += `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td style="color: var(--success); font-weight:500;">$ ${formatMoney(inv)}</td>
                <td style="color: var(--danger); font-weight:500;">$ ${formatMoney(withdr)}</td>
                <td style="font-weight:bold; color: ${net >= 0 ? 'var(--primary)' : 'var(--danger)'}">$ ${formatMoney(net)}</td>
                <td>
                    <button class="btn-edit" onclick="openPartnerProfile(${p.id})" title="Ver Historial"><i class="fas fa-id-card"></i> Perfil</button>
                    <button class="btn-delete" onclick="deletePartner(${p.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function updatePartnerSelects() {
    const selCont = document.getElementById('cont-partner-select');
    const selWith = document.getElementById('with-partner-select');
    const options = '<option value="">-- Seleccione Socio --</option>' + partners.filter(p => p.active !== false).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    
    if (selCont) selCont.innerHTML = options; 
    if (selWith) selWith.innerHTML = options;
}

// ==========================================
// 2. APORTES DE CAPITAL (FÍSICO O CONTABLE)
// ==========================================

function toggleContObs() {
    const method = document.getElementById('cont-method').value;
    const lbl = document.getElementById('lbl-cont-detail');
    if (method === 'contable') { 
        lbl.innerHTML = '<span style="color:var(--danger);">*</span> Detalle Obligatorio:'; 
    } else { 
        lbl.innerText = 'Detalle / Observación:'; 
    }
}

document.getElementById('contribution-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('cont-partner-select').value);
    const amount = parseFloat(document.getElementById('cont-amount').value);
    const method = document.getElementById('cont-method').value;
    const detail = document.getElementById('cont-detail').value.trim();

    if (!id || isNaN(amount) || amount <= 0) return notify("Datos inválidos.");
    if (method === 'contable' && !detail) return notify("Para aportes contables, debe especificar obligatoriamente en qué consiste (Ej: 'Entrega de computadora').");

    // 1. Impacto Financiero SOLO si es físico (Ingreso de dinero a la empresa)
    if (method !== 'contable') {
        if (typeof updateBalancesStorage === 'function') {
            if (method === 'cash') await updateBalancesStorage(amount, 0);
            else await updateBalancesStorage(0, amount);
        } else return notify("Error: Módulo de balance no disponible.");
    }

    // 2. Actualizar Socio
    const idx = partners.findIndex(p => p.id === id);
    if (idx !== -1) {
        partners[idx].totalContribution = (parseFloat(partners[idx].totalContribution) || 0) + amount;
        
        let typeStr = method === 'contable' ? 'Contable (Sin Dinero)' : (method === 'cash' ? 'Efectivo' : 'Banco');
        
        if (!partners[idx].history) partners[idx].history = [];
        partners[idx].history.push({
            date: new Date().toLocaleString(),
            type: 'APORTE',
            subtype: method,
            amount: amount,
            detail: `${detail ? detail : 'Aporte de Capital'} [${typeStr}]`
        });

        await DB.set('partners', partners);
        
        if (typeof addLog === 'function') addLog('SOCIOS', 'APORTE', `Aporte ${method==='contable'?'Contable':'Físico'} de $${formatMoney(amount)} por ${partners[idx].name}`);

        notify("Aporte registrado correctamente.");
        this.reset();
        toggleContObs();
        showSubTabPartner('listado');
    }
});

// ==========================================
// 3. RETIROS (DINERO O MERCADERÍA)
// ==========================================

function toggleWithMode() {
    const radioSelected = document.querySelector('input[name="with-type"]:checked');
    if (!radioSelected) return;
    
    const type = radioSelected.value;
    document.getElementById('with-money-zone').style.display = type === 'dinero' ? 'block' : 'none';
    document.getElementById('with-items-zone').style.display = type === 'mercaderia' ? 'block' : 'none';
    
    document.getElementById('with-amount').required = (type === 'dinero');
}

// Atajo F2 para buscador
document.addEventListener('keydown', function(e) {
    const section = document.getElementById('partners-section');
    const subTab = document.getElementById('sub-partners-retiro');
    const withItemsZone = document.getElementById('with-items-zone');
    
    if (section && subTab && withItemsZone && 
        section.style.display !== 'none' && 
        subTab.style.display !== 'none' && 
        withItemsZone.style.display !== 'none') {
        
        if (e.key === 'F2') {
            e.preventDefault();
            document.getElementById('with-prod-search').focus();
        }
    }
});

// Búsqueda y Escáner (Presiona Enter rápido)
document.getElementById('with-prod-search')?.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addProdToPartnerCart();
    }
});

function addProdToPartnerCart() {
    const searchInput = document.getElementById('with-prod-search');
    const val = searchInput.value.trim().toLowerCase();
    const qtyInput = document.getElementById('with-prod-qty');
    const qty = parseInt(qtyInput.value) || 1;

    if (!val || qty <= 0) return;

    let dbProducts = DB.get('products', []);
    const prod = dbProducts.find(p => p.active !== false && (p.code.toLowerCase() === val || p.name.toLowerCase() === val));

    if (!prod) { 
        notify("Producto no encontrado."); 
        searchInput.select(); 
        return; 
    }

    const exist = partnerCart.find(i => i.id === prod.id);
    const qtyInCart = exist ? exist.qty : 0;

    // Validación de stock
    if (prod.stock < (qtyInCart + qty)) {
        return notify(`Stock insuficiente de ${prod.name}. Disponible total: ${prod.stock}`);
    }

    if (exist) {
        exist.qty += qty;
    } else {
        partnerCart.push({ 
            id: prod.id, 
            code: prod.code, 
            name: prod.name, 
            cost: prod.cost || 0, 
            price: prod.price || 0, 
            qty: qty 
        });
    }

    searchInput.value = '';
    qtyInput.value = 1;
    searchInput.focus(); // Retorna foco para el siguiente escaneo
    renderPartnerCart();
}

function renderPartnerCart() {
    const tbody = document.getElementById('partner-cart-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let total = 0;
    const calcType = document.querySelector('input[name="with-price-calc"]:checked').value;

    partnerCart.forEach((item, index) => {
        const unitPrice = calcType === 'costo' ? item.cost : item.price;
        const sub = unitPrice * item.qty;
        total += sub;

        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>$${formatMoney(unitPrice)} <small style="color:#aaa;">(${calcType})</small></td>
                <td style="text-align:center;">
                    <input type="number" value="${item.qty}" min="1" style="width:60px; text-align:center; padding:3px;" onchange="updatePartnerCartQty(${index}, this.value)">
                </td>
                <td style="text-align:right; font-weight:bold;">$${formatMoney(sub)}</td>
                <td style="text-align:center;"><button type="button" class="btn-delete" onclick="partnerCart.splice(${index},1); renderPartnerCart();"><i class="fas fa-trash"></i></button></td>
            </tr>
        `;
    });

    document.getElementById('partner-cart-total').innerText = formatMoney(total);
}

function updatePartnerCartQty(index, newQty) {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty <= 0) { 
        partnerCart.splice(index, 1); 
    } else {
        // Validar stock en la modificación manual
        let dbProducts = DB.get('products', []);
        const prod = dbProducts.find(p => p.id === partnerCart[index].id);
        if (prod && prod.stock < qty) { 
            notify(`Stock máximo disponible: ${prod.stock}`); 
            partnerCart[index].qty = prod.stock; 
        } else { 
            partnerCart[index].qty = qty; 
        }
    }
    renderPartnerCart();
}

// EJECUCIÓN FINAL DEL RETIRO (Dinero o Mercadería)
document.getElementById('withdrawal-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('with-partner-select').value);
    const withType = document.querySelector('input[name="with-type"]:checked').value;
    
    if (!id) return notify("Seleccione un socio.");
    
    const idx = partners.findIndex(p => p.id === id);
    if (idx === -1) return;

    let finalAmount = 0;
    let historyRecord = {};
    let logStr = "";

    // ------------------------------------------
    // RAMA 1: RETIRO DE DINERO (Sale de Caja/Banco)
    // ------------------------------------------
    if (withType === 'dinero') {
        const amount = parseFloat(document.getElementById('with-amount').value);
        const method = document.getElementById('with-method').value;
        const detail = document.getElementById('with-detail').value.trim();

        if (isNaN(amount) || amount <= 0) return notify("Monto inválido.");

        let balances = DB.get('balances', { cash: 0, bank: 0 });
        if (method === 'cash' && balances.cash < amount) return notify(`Fondos en Caja insuficientes. Disp: $${formatMoney(balances.cash)}`);
        if (method === 'bank' && balances.bank < amount) return notify(`Fondos en Banco insuficientes. Disp: $${formatMoney(balances.bank)}`);

        if (typeof updateBalancesStorage === 'function') {
            if (method === 'cash') await updateBalancesStorage(-amount, 0);
            else await updateBalancesStorage(0, -amount);
        }

        finalAmount = amount;
        historyRecord = {
            date: new Date().toLocaleString(), type: 'RETIRO', subtype: 'dinero', method: method, amount: amount,
            detail: `${detail || 'Retiro de Efectivo/Banco'} [${method==='cash'?'Caja':'Banco'}]`
        };
        logStr = `Retiro de dinero ($${formatMoney(amount)}) por ${partners[idx].name}`;
    } 
    
    // ------------------------------------------
    // RAMA 2: RETIRO DE MERCADERÍA (Solo afecta Stock)
    // ------------------------------------------
    else if (withType === 'mercaderia') {
        if (partnerCart.length === 0) return notify("Agregue al menos un producto al carrito de retiro.");
        
        let dbProducts = DB.get('products', []);
        const calcType = document.querySelector('input[name="with-price-calc"]:checked').value;
        const obs = document.getElementById('with-items-obs').value.trim();

        let totalCart = 0;
        let itemsDetailStr = [];

        // Descontar Stock y Calcular
        partnerCart.forEach(item => {
            const unitPrice = calcType === 'costo' ? item.cost : item.price;
            const sub = unitPrice * item.qty;
            totalCart += sub;
            itemsDetailStr.push(`${item.qty}x ${item.name}`);

            const prodDB = dbProducts.find(p => p.id === item.id);
            if (prodDB) prodDB.stock -= item.qty;
        });

        await DB.set('products', dbProducts);
        
        finalAmount = totalCart;
        historyRecord = {
            date: new Date().toLocaleString(), type: 'RETIRO', subtype: 'mercaderia', priceCalc: calcType, amount: totalCart, items: [...partnerCart],
            detail: `Retiro Mercadería (${calcType.toUpperCase()}): ${itemsDetailStr.join(', ')}. ${obs}`
        };
        logStr = `Retiro de mercadería valuado en $${formatMoney(totalCart)} por ${partners[idx].name}`;
    }

    // Impacto General en el balance del Socio
    if (typeof partners[idx].totalWithdrawals === 'undefined') partners[idx].totalWithdrawals = 0;
    partners[idx].totalWithdrawals += finalAmount;
    if (!partners[idx].history) partners[idx].history = [];
    partners[idx].history.push(historyRecord);

    await DB.set('partners', partners);
    if (typeof addLog === 'function') addLog('SOCIOS', 'RETIRO', logStr);

    notify("✅ Retiro registrado correctamente.");
    
    this.reset();
    partnerCart = [];
    renderPartnerCart();
    document.querySelector('input[name="with-type"][value="dinero"]').checked = true;
    toggleWithMode();
    showSubTabPartner('listado');
});

// ==========================================
// 4. PERFIL HISTÓRICO Y CRUD BÁSICO
// ==========================================

function openPartnerProfile(id) {
    const p = partners.find(x => x.id === id); if (!p) return;
    const modal = document.getElementById('partner-profile-modal'); if (modal) modal.style.display = 'flex';
    const inv = parseFloat(p.totalContribution) || 0, withdr = parseFloat(p.totalWithdrawals) || 0, net = inv - withdr;

    document.getElementById('prof-partner-name').innerText = p.name;
    document.getElementById('prof-partner-inv').innerText = `$ ${formatMoney(inv)}`;
    document.getElementById('prof-partner-with').innerText = `$ ${formatMoney(withdr)}`;
    document.getElementById('prof-partner-net').innerText = `$ ${formatMoney(net)}`;

    const container = document.getElementById('partner-individual-history');
    container.innerHTML = '';
    if (!p.history || p.history.length === 0) { container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Sin movimientos.</p>'; return; }

    [...p.history].reverse().forEach(h => {
        const row = document.createElement('div'); row.className = 'hist-row';
        if (h.type === 'APORTE') {
            const extraColor = h.subtype === 'contable' ? 'color:#8e44ad;' : 'color:var(--success)';
            row.innerHTML = `<div class="hist-cell"><span class="hist-amount val-pago" style="${extraColor}">+ $ ${formatMoney(h.amount)}</span><span class="hist-date">${h.date}<br><small>${h.detail}</small></span></div><div class="hist-cell"></div>`;
        } else {
            const extraColor = h.subtype === 'mercaderia' ? 'color:#e67e22;' : 'color:var(--danger)';
            row.innerHTML = `<div class="hist-cell"></div><div class="hist-cell" style="text-align: right;"><span class="hist-amount val-deuda" style="${extraColor}">- $ ${formatMoney(h.amount)}</span><span class="hist-date">${h.date}<br><small>${h.detail}</small></span></div>`;
        }
        container.appendChild(row);
    });
}

function closePartnerProfile() { document.getElementById('partner-profile-modal').style.display = 'none'; }
function openPartnerModal() { document.getElementById('partner-modal').style.display = 'flex'; }
function closePartnerModal() { document.getElementById('partner-modal').style.display = 'none'; document.getElementById('partner-form')?.reset(); }

document.getElementById('partner-form')?.addEventListener('submit', async function(e) {
    e.preventDefault(); const name = document.getElementById('partner-name').value.trim(); if (!name) return;
    partners.push({ id: Date.now(), name: name, totalContribution: 0, totalWithdrawals: 0, history: [], active: true });
    await DB.set('partners', partners);
    closePartnerModal(); renderPartners(); notify("Socio creado.");
});

async function deletePartner(id) {
    if (await confirmAction('¿Ocultar socio?')) {
        const index = partners.findIndex(p => p.id === id);
        if(index !== -1) { partners[index].active = false; await DB.set('partners', partners); renderPartners(); }
    }
}