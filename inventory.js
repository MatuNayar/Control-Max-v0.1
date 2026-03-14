/**
 * CONTROL-MAX - Módulo de Inventario Avanzado y Ofertas
 */

let products = JSON.parse(localStorage.getItem('products')) || [];
let masterRubros = JSON.parse(localStorage.getItem('masterRubros')) || [];
let masterMarcas = JSON.parse(localStorage.getItem('masterMarcas')) || [];

// Nuevas variables globales para Ofertas y Combos
let offers = JSON.parse(localStorage.getItem('offers')) || [];
let combos = JSON.parse(localStorage.getItem('combos')) || [];

// ==========================================
// 0. INICIALIZACIÓN Y MIGRACIÓN DE DATOS
// ==========================================
function initInventory() {
    let changed = false;
    products.forEach(p => {
        if (p.rubro && !masterRubros.includes(p.rubro.toUpperCase())) { masterRubros.push(p.rubro.toUpperCase()); changed = true; }
        if (p.marca && !masterMarcas.includes(p.marca.toUpperCase())) { masterMarcas.push(p.marca.toUpperCase()); changed = true; }
    });
    
    masterRubros.sort();
    masterMarcas.sort();

    if (changed) {
        localStorage.setItem('masterRubros', JSON.stringify(masterRubros));
        localStorage.setItem('masterMarcas', JSON.stringify(masterMarcas));
    }
}
initInventory();

// ==========================================
// 1. NAVEGACIÓN Y RENDERIZADO BÁSICO
// ==========================================
function showSubTab(tabId) {
    document.querySelectorAll('.sub-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`sub-${tabId}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('#inventory-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(`'${tabId}'`)) btn.classList.add('active');
    });

    const editTabBtn = document.getElementById('tab-btn-editar');
    if (tabId !== 'editar-prod' && editTabBtn) editTabBtn.style.display = 'none'; 

    updateGlobalDatalist();

    if (tabId === 'listado') { updateFilterSelects(); renderInventory(); }
    if (tabId === 'nuevo-prod') { prepareInventorySelectors(); updateCategoryDatalists(); document.getElementById('product-form').reset(); }
    if (tabId === 'editar-prod') { updateCategoryDatalists(); }
    if (tabId === 'precios') { 
        updateCategorySelectsBulk(); updateIndSearchList(); 
        document.getElementById('ind-preview-box').style.display = 'none';
        document.getElementById('bulk-preview-container').style.display = 'none';
    }
    if (tabId === 'descuentos') { toggleDiscountView('ofertas'); }
    if (tabId === 'categorias') { renderCategoryManagers(); }
}

function updateFilterSelects() {
    const rSel = document.getElementById('filter-rubro');
    const mSel = document.getElementById('filter-marca');
    if(rSel) rSel.innerHTML = '<option value="">Todos los Rubros</option>' + masterRubros.map(r => `<option value="${r}">${r}</option>`).join('');
    if(mSel) mSel.innerHTML = '<option value="">Todas las Marcas</option>' + masterMarcas.map(m => `<option value="${m}">${m}</option>`).join('');
}

function updateCategoryDatalists() {
    const rList = document.getElementById('list-rubros-global');
    const mList = document.getElementById('list-marcas-global');
    if(rList) rList.innerHTML = masterRubros.map(r => `<option value="${r}">`).join('');
    if(mList) mList.innerHTML = masterMarcas.map(m => `<option value="${m}">`).join('');
}

function updateCategorySelectsBulk() {
    const rSel = document.getElementById('bulk-upd-rubro');
    const mSel = document.getElementById('bulk-upd-marca');
    if(rSel) rSel.innerHTML = '<option value="">Todos</option>' + masterRubros.map(r => `<option value="${r}">${r}</option>`).join('');
    if(mSel) mSel.innerHTML = '<option value="">Todas</option>' + masterMarcas.map(m => `<option value="${m}">${m}</option>`).join('');
}

function updateGlobalDatalist() {
    const list = document.getElementById('global-prod-list');
    if(list) list.innerHTML = products.filter(p => p.active !== false).map(p => `<option value="${p.code}">${p.name}</option>`).join('');
}

function renderInventory(dataToRender = null) {
    const tbody = document.getElementById('inventory-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = dataToRender || products.filter(p => p.active !== false);

    if(list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No se encontraron productos.</td></tr>';
        return;
    }

    list.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.code}</td>
            <td><strong>${p.name}</strong></td>
            <td><span class="badge" style="background:#eee; color:#333;">${p.rubro || '-'}</span></td>
            <td><span class="badge" style="background:#eee; color:#333;">${p.marca || '-'}</span></td>
            <td style="font-weight:bold; color:${p.stock <= 5 ? 'var(--danger)' : 'inherit'}">${p.stock || 0}</td>
            <td style="color:var(--success); font-weight:bold;">$ ${formatMoney(p.price)}</td>
            <td>
                <button class="btn-edit" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterProducts() {
    const text = document.getElementById('search-input').value.toLowerCase();
    const fRubro = document.getElementById('filter-rubro').value;
    const fMarca = document.getElementById('filter-marca').value;
    
    const filtered = products.filter(p => {
        if(p.active === false) return false;
        const matchText = p.name.toLowerCase().includes(text) || p.code.toLowerCase().includes(text);
        const matchRubro = fRubro === '' || p.rubro === fRubro;
        const matchMarca = fMarca === '' || p.marca === fMarca;
        return matchText && matchRubro && matchMarca;
    });
    renderInventory(filtered);
}

// ==========================================
// 2. EXPORTACIÓN A EXCEL (.xlsx)
// ==========================================
function exportInventoryExcel() {
    if (typeof XLSX === 'undefined') return alert("Error: Librería Excel no cargada.");
    const activeProducts = products.filter(p => p.active !== false);
    if(activeProducts.length === 0) return alert("No hay productos para exportar.");

    const dataForExcel = activeProducts.map(p => ({
        "Código": p.code, "Nombre del Producto": p.name, "Rubro": p.rubro || '',
        "Marca": p.marca || '', "Costo ($)": p.cost || 0, "Precio Venta ($)": p.price || 0, "Stock Físico": p.stock || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    worksheet['!cols'] = [ {wch: 15}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15} ];
    XLSX.writeFile(workbook, `Inventario_ControlMax_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
}

// ==========================================
// 3. ACTUALIZADOR DE PRECIOS (INDIVIDUAL / MASIVO)
// ==========================================
let indUpdateItemTemp = null;
let bulkUpdateList = [];

function updateIndSearchList() {
    const datalist = document.getElementById('ind-list-prods');
    if (datalist) datalist.innerHTML = products.filter(p => p.active !== false).map(p => `<option value="${p.code}">${p.name}</option>`).join('');
}

function autoFillIndUpdate() { document.getElementById('ind-preview-box').style.display = 'none'; }

function previewIndPriceUpdate() {
    const searchVal = document.getElementById('ind-upd-search').value.trim().toLowerCase();
    const type = document.getElementById('ind-upd-type').value;
    const val = parseFloat(document.getElementById('ind-upd-val').value);

    if (!searchVal) return alert("Debe buscar un producto.");
    if (isNaN(val)) return alert("Debe ingresar un valor numérico.");

    const prod = products.find(p => p.active !== false && (p.code.toLowerCase() === searchVal || p.name.toLowerCase() === searchVal));
    if (!prod) return alert("Producto no encontrado.");

    let newPrice = 0;
    if (type === 'exact') newPrice = val;
    else if (type === 'amount') newPrice = prod.price + val;
    else if (type === 'percent') newPrice = prod.price * (1 + (val / 100));

    newPrice = Math.round(newPrice * 100) / 100;
    if (newPrice < 0) newPrice = 0;

    indUpdateItemTemp = { id: prod.id, name: prod.name, oldPrice: prod.price, newPrice: newPrice };

    document.getElementById('ind-preview-text').innerHTML = `<strong>${prod.name}</strong><br>
        Precio Actual: $${formatMoney(prod.price)} <i class="fas fa-arrow-right" style="color:var(--accent);"></i> 
        <strong style="color:var(--success); font-size:1.3rem;">Nuevo: $${formatMoney(newPrice)}</strong>`;
    document.getElementById('ind-preview-box').style.display = 'block';
}

function applyIndPriceUpdate() {
    if (!indUpdateItemTemp) return;
    const prodIndex = products.findIndex(p => p.id === indUpdateItemTemp.id);
    if (prodIndex !== -1) {
        products[prodIndex].price = indUpdateItemTemp.newPrice;
        localStorage.setItem('products', JSON.stringify(products));
        alert("Precio actualizado exitosamente.");
        document.getElementById('ind-upd-search').value = '';
        document.getElementById('ind-upd-val').value = '';
        document.getElementById('ind-preview-box').style.display = 'none';
        indUpdateItemTemp = null;
    }
}

function previewBulkPriceUpdate() {
    const fRubro = document.getElementById('bulk-upd-rubro').value;
    const fMarca = document.getElementById('bulk-upd-marca').value;
    const percent = parseFloat(document.getElementById('bulk-upd-percent').value);

    if (isNaN(percent) || percent === 0) return alert("Ingrese un porcentaje válido.");

    bulkUpdateList = products.filter(p => {
        if (p.active === false) return false;
        const matchRubro = fRubro === '' || p.rubro === fRubro;
        const matchMarca = fMarca === '' || p.marca === fMarca;
        return matchRubro && matchMarca;
    });

    if (bulkUpdateList.length === 0) return alert("No se encontraron productos con esos filtros.");

    const tbody = document.getElementById('bulk-preview-body');
    tbody.innerHTML = '';
    document.getElementById('bulk-count').innerText = bulkUpdateList.length;

    bulkUpdateList.forEach(p => {
        const oldPrice = p.price;
        const newPrice = Math.round((oldPrice * (1 + (percent / 100))) * 100) / 100;
        const diff = newPrice - oldPrice;
        p._newTempPrice = newPrice;

        tbody.innerHTML += `<tr>
            <td>${p.code} - ${p.name}</td><td>$ ${formatMoney(oldPrice)}</td>
            <td style="color:var(--primary); font-weight:bold;">$ ${formatMoney(newPrice)}</td>
            <td style="color:${diff > 0 ? 'var(--success)' : 'var(--danger)'}">${diff > 0 ? '+' : ''}$ ${formatMoney(diff)}</td>
        </tr>`;
    });
    document.getElementById('bulk-preview-container').style.display = 'block';
}

function applyBulkPriceUpdate() {
    if (bulkUpdateList.length === 0) return;
    if (confirm(`¿Aplicar cambio a ${bulkUpdateList.length} productos?`)) {
        let updateCount = 0;
        bulkUpdateList.forEach(tempItem => {
            const realProd = products.find(p => p.id === tempItem.id);
            if (realProd && realProd._newTempPrice) {
                realProd.price = realProd._newTempPrice;
                delete realProd._newTempPrice; 
                updateCount++;
            }
        });
        localStorage.setItem('products', JSON.stringify(products));
        alert(`¡Éxito! Se actualizaron ${updateCount} productos.`);
        document.getElementById('bulk-upd-percent').value = '';
        document.getElementById('bulk-preview-container').style.display = 'none';
        bulkUpdateList = [];
    }
}

// ==========================================
// 4. NUEVO: OFERTAS Y COMBOS (Proporcional)
// ==========================================

function toggleDiscountView(view) {
    document.getElementById('view-ofertas').style.display = view === 'ofertas' ? 'block' : 'none';
    document.getElementById('view-combos').style.display = view === 'combos' ? 'block' : 'none';
    document.getElementById('btn-tab-ofertas').classList.toggle('active', view === 'ofertas');
    document.getElementById('btn-tab-combos').classList.toggle('active', view === 'combos');

    if(view === 'ofertas') renderOffers();
    if(view === 'combos') { 
        renderCombos(); 
        document.getElementById('combo-code').value = `CMB-${Math.floor(Math.random()*100000)}`; 
    }
}

// --- LÓGICA DE OFERTAS ---
let selectedOfferProd = null;

function fillOfferProd() {
    const val = document.getElementById('offer-prod-search').value.trim().toLowerCase();
    selectedOfferProd = products.find(p => p.active !== false && (p.code.toLowerCase() === val || p.name.toLowerCase() === val));
    if (selectedOfferProd) {
        document.getElementById('offer-normal-price').value = `$ ${formatMoney(selectedOfferProd.price)}`;
        calcOfferPreview();
    }
}

function calcOfferPreview() {
    if (!selectedOfferProd) return;
    const type = document.getElementById('offer-type').value;
    const val = parseFloat(document.getElementById('offer-val').value) || 0;
    let final = selectedOfferProd.price;

    if(type === 'percent') final = final * (1 - (val/100));
    else if(type === 'amount') final -= val;
    else if(type === 'exact') final = val;

    document.getElementById('offer-preview-price').innerText = formatMoney(Math.max(final, 0));
}

function saveOffer() {
    if (!selectedOfferProd) return alert("Seleccione un producto.");
    const type = document.getElementById('offer-type').value;
    const val = parseFloat(document.getElementById('offer-val').value) || 0;
    const expiry = document.getElementById('offer-expiry').value;

    if (!expiry) return alert("Seleccione una fecha de vencimiento.");

    offers = offers.filter(o => o.productId !== selectedOfferProd.id); // Reemplazar si existe
    offers.push({ id: Date.now(), productId: selectedOfferProd.id, name: selectedOfferProd.name, type, value: val, expiry });
    
    localStorage.setItem('offers', JSON.stringify(offers));
    alert("Oferta guardada.");
    document.getElementById('offer-prod-search').value = '';
    renderOffers();
}

function renderOffers() {
    const tbody = document.getElementById('offers-body');
    tbody.innerHTML = '';
    
    // Limpiar vencidas
    const today = new Date().setHours(0,0,0,0);
    offers = offers.filter(o => new Date(o.expiry).getTime() >= today);
    localStorage.setItem('offers', JSON.stringify(offers));

    offers.forEach(o => {
        const prod = products.find(p => p.id === o.productId);
        let desc = o.type === 'percent' ? `-${o.value}%` : (o.type === 'amount' ? `-$${o.value}` : `Fijo: $${o.value}`);
        tbody.innerHTML += `<tr>
            <td>${o.name}</td>
            <td>${prod ? '$'+formatMoney(prod.price) : 'N/A'}</td>
            <td style="color:var(--success); font-weight:bold;">${desc}</td>
            <td>${new Date(o.expiry).toLocaleDateString()}</td>
            <td><button class="btn-delete" onclick="deleteOffer(${o.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}
function deleteOffer(id) { offers = offers.filter(o => o.id !== id); localStorage.setItem('offers', JSON.stringify(offers)); renderOffers(); }

// --- LÓGICA DE COMBOS (Reparto Proporcional) ---
let comboTempItems = [];

function addProdToCombo() {
    const val = document.getElementById('combo-prod-search').value.toLowerCase();
    const qty = parseInt(document.getElementById('combo-prod-qty').value) || 1;
    const p = products.find(x => x.active !== false && (x.code.toLowerCase() === val || x.name.toLowerCase() === val));
    
    if(!p) return alert("Producto no encontrado.");
    
    const exist = comboTempItems.find(i => i.id === p.id);
    if(exist) exist.qty += qty;
    else comboTempItems.push({ id: p.id, code: p.code, name: p.name, cost: p.cost, price: p.price, qty: qty });
    
    document.getElementById('combo-prod-search').value = '';
    document.getElementById('combo-prod-qty').value = 1;
    renderComboTemp();
}

function renderComboTemp() {
    const tbody = document.getElementById('combo-temp-body');
    let tCost = 0, tNormal = 0;
    tbody.innerHTML = '';
    
    comboTempItems.forEach((i, idx) => {
        let subC = i.cost * i.qty, subP = i.price * i.qty;
        tCost += subC; tNormal += subP;
        tbody.innerHTML += `<tr>
            <td>${i.name}</td><td>${i.qty}</td><td>$${formatMoney(i.cost)}</td><td>$${formatMoney(i.price)}</td>
            <td style="font-weight:bold;">$${formatMoney(subP)}</td>
            <td><button class="btn-delete" onclick="comboTempItems.splice(${idx},1); renderComboTemp();"><i class="fas fa-times"></i></button></td>
        </tr>`;
    });

    document.getElementById('combo-total-cost').innerText = formatMoney(tCost);
    document.getElementById('combo-total-normal').innerText = formatMoney(tNormal);
    calcComboFinal();
}

function calcComboFinal() {
    const tNormal = comboTempItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const type = document.getElementById('combo-price-type').value;
    const val = parseFloat(document.getElementById('combo-price-val').value) || 0;
    
    let final = tNormal;
    if(type === 'manual') final = val;
    else if (type === 'percent') final = tNormal * (1 - (val/100));

    document.getElementById('combo-final-price').innerText = formatMoney(Math.max(final, 0));
    return Math.max(final, 0);
}

function saveCombo() {
    const name = document.getElementById('combo-name').value.trim();
    const code = document.getElementById('combo-code').value;
    const finalPrice = calcComboFinal();

    if(!name || comboTempItems.length === 0 || finalPrice <= 0) return alert("Nombre, productos o precio inválido.");

    // LÓGICA CORE: REPARTO PROPORCIONAL EXACTO
    const totalNormal = comboTempItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const factor = finalPrice / totalNormal;
    
    let currentSum = 0;
    const itemsProporcional = comboTempItems.map((item, index) => {
        let propUnit;
        
        // El último elemento absorbe los centavos residuales del redondeo
        if (index === comboTempItems.length - 1) {
            propUnit = (finalPrice - currentSum) / item.qty;
        } else {
            propUnit = Math.round((item.price * factor) * 100) / 100;
            currentSum += (propUnit * item.qty);
        }
        
        return { ...item, proportionalPrice: Math.round(propUnit*100)/100 };
    });

    const totalCost = comboTempItems.reduce((acc, i) => acc + (i.cost * i.qty), 0);

    combos.push({
        id: Date.now(), isCombo: true, name, code, finalPrice, cost: totalCost, items: itemsProporcional
    });

    localStorage.setItem('combos', JSON.stringify(combos));
    alert("Combo Creado Exitosamente.");
    
    comboTempItems = [];
    document.getElementById('combo-name').value = '';
    document.getElementById('combo-price-val').value = '';
    document.getElementById('combo-price-type').value = 'manual';
    renderComboTemp();
    toggleDiscountView('combos');
}

function renderCombos() {
    const tbody = document.getElementById('combos-body');
    tbody.innerHTML = '';
    combos.forEach(c => {
        tbody.innerHTML += `<tr>
            <td>${c.code}</td><td><strong>${c.name}</strong></td><td>${c.items.length} prods</td>
            <td style="color:#8e44ad; font-weight:bold;">$${formatMoney(c.finalPrice)}</td>
            <td><button class="btn-delete" onclick="deleteCombo(${c.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}
function deleteCombo(id) {
    if(confirm("¿Eliminar Combo?")) {
        combos = combos.filter(c => c.id !== id);
        localStorage.setItem('combos', JSON.stringify(combos));
        renderCombos();
    }
}

// ==========================================
// 5. GESTOR DE RUBROS Y MARCAS (AUTOGUARDADO)
// ==========================================

function checkAndSaveCategory(type, val) {
    if (!val) return val;
    val = val.trim().toUpperCase(); 
    if (type === 'rubro' && !masterRubros.includes(val)) {
        masterRubros.push(val); masterRubros.sort();
        localStorage.setItem('masterRubros', JSON.stringify(masterRubros));
    }
    else if (type === 'marca' && !masterMarcas.includes(val)) {
        masterMarcas.push(val); masterMarcas.sort();
        localStorage.setItem('masterMarcas', JSON.stringify(masterMarcas));
    }
    return val;
}

function renderCategoryManagers() {
    const rList = document.getElementById('list-mgr-rubros');
    const mList = document.getElementById('list-mgr-marcas');
    rList.innerHTML = ''; mList.innerHTML = '';
    masterRubros.forEach(r => rList.innerHTML += `<li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span>${r}</span><button class="btn-delete" onclick="deleteCategory('rubro', '${r}')"><i class="fas fa-trash"></i></button></li>`);
    masterMarcas.forEach(m => mList.innerHTML += `<li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span>${m}</span><button class="btn-delete" onclick="deleteCategory('marca', '${m}')"><i class="fas fa-trash"></i></button></li>`);
}

function addCategory(type) {
    const input = document.getElementById(`new-${type}-input`);
    if (!input.value.trim()) return;
    checkAndSaveCategory(type, input.value);
    input.value = '';
    renderCategoryManagers(); updateFilterSelects(); updateCategoryDatalists();
}

function deleteCategory(type, name) {
    const inUse = products.some(p => p.active !== false && p[type] === name);
    if (inUse) return alert(`No se puede eliminar. Hay productos activos usando este ${type}.`);
    if (confirm(`¿Eliminar ${type}: ${name}?`)) {
        if (type === 'rubro') { masterRubros = masterRubros.filter(r => r !== name); localStorage.setItem('masterRubros', JSON.stringify(masterRubros)); } 
        else { masterMarcas = masterMarcas.filter(m => m !== name); localStorage.setItem('masterMarcas', JSON.stringify(masterMarcas)); }
        renderCategoryManagers(); updateFilterSelects(); updateCategoryDatalists();
    }
}

// ==========================================
// 6. ALTA DE PRODUCTO Y EDICIÓN
// ==========================================
function prepareInventorySelectors() {
    const provSelect = document.getElementById('prod-prov-select');
    const partSelect = document.getElementById('pay-inv-partner-select');
    const suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
    const partners = JSON.parse(localStorage.getItem('partners')) || [];
    if (provSelect) provSelect.innerHTML = '<option value="">-- Sin Proveedor --</option>' + suppliers.filter(s => s.active !== false).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (partSelect) partSelect.innerHTML = '<option value="">-- Seleccionar Socio --</option>' + partners.filter(p => p.active !== false).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function calcNewProdTotal() {
    const cost = parseFloat(document.getElementById('prod-cost').value) || 0;
    const qty = parseFloat(document.getElementById('prod-stock-init').value) || 0;
    const display = document.getElementById('prod-total-buy');
    if (display) display.value = formatMoney(cost * qty);
}

function createPurchaseRecord(data) {
    const { prodName, qty, total, payments, ids } = data;
    const isoDate = new Date().toISOString();

    if (payments.cash > 0 || payments.bank > 0) {
        if (typeof updateBalancesStorage === 'function') updateBalancesStorage(-payments.cash, -payments.bank);
    }
    if (payments.ctacte > 0 && ids.provider) {
        let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
        const idx = suppliers.findIndex(s => s.id == ids.provider);
        if (idx !== -1) {
            suppliers[idx].balance = (parseFloat(suppliers[idx].balance) || 0) + payments.ctacte;
            if (!suppliers[idx].history) suppliers[idx].history = [];
            suppliers[idx].history.push({ date: new Date().toLocaleString(), type: 'COMPRA', amount: payments.ctacte, note: `Compra Stock: ${prodName}` });
            localStorage.setItem('suppliers', JSON.stringify(suppliers));
        }
    }
    if (payments.partner > 0 && ids.partner) {
        let partners = JSON.parse(localStorage.getItem('partners')) || [];
        const idx = partners.findIndex(p => p.id == ids.partner);
        if (idx !== -1) {
            partners[idx].totalContribution = (parseFloat(partners[idx].totalContribution) || 0) + payments.partner;
            localStorage.setItem('partners', JSON.stringify(partners));
        }
    }
    let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
    purchases.push({ id: Date.now(), timestamp: isoDate, product: prodName, quantity: qty, totalCost: total, funding: { cash: payments.cash, bank: payments.bank, supplierCredit: payments.ctacte, partnerInvestment: payments.partner }, providerId: ids.provider || null, partnerId: ids.partner || null });
    localStorage.setItem('purchases', JSON.stringify(purchases));
    return true;
}

document.getElementById('product-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value;
    const code = document.getElementById('prod-code').value;
    const rubro = checkAndSaveCategory('rubro', document.getElementById('prod-rubro').value);
    const marca = checkAndSaveCategory('marca', document.getElementById('prod-marca').value);
    const cost = parseFloat(document.getElementById('prod-cost').value) || 0;
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const qty = parseFloat(document.getElementById('prod-stock-init').value) || 0;
    const totalReal = Math.round((cost * qty) * 100) / 100;

    const pCash = parseFloat(document.getElementById('pay-inv-cash').value) || 0;
    const pBank = parseFloat(document.getElementById('pay-inv-bank').value) || 0;
    const pCtaCte = parseFloat(document.getElementById('pay-inv-ctacte').value) || 0;
    const pPartner = parseFloat(document.getElementById('pay-inv-partner').value) || 0;
    const provId = document.getElementById('prod-prov-select').value;
    const partId = document.getElementById('pay-inv-partner-select').value;

    if (totalReal > 0) {
        const sumaPagos = Math.round((pCash + pBank + pCtaCte + pPartner) * 100) / 100;
        if (Math.abs(sumaPagos - totalReal) > 0.1) return alert(`Error: El total de pagos no coincide con el Costo Total.`);
        if (pCtaCte > 0 && !provId) return alert("Error: Seleccione proveedor.");
        if (pPartner > 0 && !partId) return alert("Error: Seleccione socio.");

        const success = createPurchaseRecord({ prodName: name, qty: qty, total: totalReal, payments: { cash: pCash, bank: pBank, ctacte: pCtaCte, partner: pPartner }, ids: { provider: provId, partner: partId } });
        if (!success) return; 
    }

    products.push({ id: Date.now(), name, code, rubro, marca, cost, price, stock: qty, active: true });
    localStorage.setItem('products', JSON.stringify(products));
    alert("¡Producto creado!");
    this.reset();
    showSubTab('listado');
    updateGlobalDatalist();
});

function editProduct(id) {
    const p = products.find(p => p.id === id);
    if (!p) return;
    const editTabBtn = document.getElementById('tab-btn-editar');
    if (editTabBtn) editTabBtn.style.display = 'inline-block';
    
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('edit-prod-name').value = p.name;
    document.getElementById('edit-prod-code').value = p.code;
    updateCategoryDatalists();
    document.getElementById('edit-prod-rubro').value = p.rubro || '';
    document.getElementById('edit-prod-marca').value = p.marca || '';
    document.getElementById('edit-prod-cost').value = p.cost || 0;
    document.getElementById('edit-prod-price').value = p.price || 0;
    document.getElementById('edit-prod-stock').value = p.stock || 0;
    showSubTab('editar-prod');
}

function cancelEdit() { showSubTab('listado'); }

document.getElementById('edit-product-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-prod-id').value);
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        products[index].name = document.getElementById('edit-prod-name').value;
        products[index].code = document.getElementById('edit-prod-code').value;
        products[index].rubro = checkAndSaveCategory('rubro', document.getElementById('edit-prod-rubro').value);
        products[index].marca = checkAndSaveCategory('marca', document.getElementById('edit-prod-marca').value);
        products[index].cost = parseFloat(document.getElementById('edit-prod-cost').value) || 0;
        products[index].price = parseFloat(document.getElementById('edit-prod-price').value) || 0;
        
        localStorage.setItem('products', JSON.stringify(products));
        alert("¡Cambios guardados!");
        showSubTab('listado'); 
        updateGlobalDatalist();
    }
});

function deleteProduct(id) {
    if (confirm("¿Eliminar este producto?")) {
        const idx = products.findIndex(p => p.id === id);
        if (idx !== -1) {
            products[idx].active = false;
            localStorage.setItem('products', JSON.stringify(products));
            renderInventory();
            updateGlobalDatalist();
        }
    }
}