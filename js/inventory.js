/**
 * CONTROL-MAX - Módulo de Inventario Avanzado
 * - Buscador avanzado y Excel
 * - Actualización Masiva e Individual
 * - Ofertas y Combos (Proporcional)
 * - Mermas (Pérdidas)
 * - Generador Automático de Códigos
 * - Impresión de Etiquetas A4 Profesionales (5 Columnas)
 */

// Estos arrays se hidratan desde Firebase (DB) al entrar a la sección Inventario.
let products = [];
let masterRubros = [];
let masterMarcas = [];
let offers = [];
let combos = [];
let losses = [];
let labelPrintList = [];

// ==========================================
// 0. INICIALIZACIÓN
// ==========================================

// Trae las colecciones desde la caché de DB a las variables globales del módulo.
// La sección ya hizo DB.ensure(...) antes de llamar acá (ver showSection/showSubTab).
function hydrateInventory() {
    products = DB.get('products', []);
    masterRubros = DB.get('masterRubros', []);
    masterMarcas = DB.get('masterMarcas', []);
    offers = DB.get('offers', []);
    combos = DB.get('combos', []);
    losses = DB.get('losses', []);
    labelPrintList = DB.get('printQueue', []);
    initInventory();
}

function initInventory() {
    let changed = false;
    products.forEach(p => {
        if (p.rubro && !masterRubros.includes(p.rubro.toUpperCase())) { masterRubros.push(p.rubro.toUpperCase()); changed = true; }
        if (p.marca && !masterMarcas.includes(p.marca.toUpperCase())) { masterMarcas.push(p.marca.toUpperCase()); changed = true; }
    });
    masterRubros.sort(); masterMarcas.sort();
    if (changed) { DB.set('masterRubros', masterRubros); DB.set('masterMarcas', masterMarcas); }
}

// Refresco en vivo cuando cambian los productos desde otra PC.
DB.onChange('products', () => {
    products = DB.get('products', []);
    const sec = document.getElementById('inventory-section');
    if (sec && sec.style.display !== 'none') { updateGlobalDatalist(); renderInventory(); }
});

// ==========================================
// 1. NAVEGACIÓN Y RENDERIZADO
// ==========================================
function showSubTab(tabId) {
    hydrateInventory();
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
    if (tabId === 'editar-prod') updateCategoryDatalists();
    if (tabId === 'precios') { updateCategorySelectsBulk(); updateIndSearchList(); document.getElementById('ind-preview-box').style.display = 'none'; document.getElementById('bulk-preview-container').style.display = 'none'; }
    if (tabId === 'descuentos') toggleDiscountView('ofertas');
    if (tabId === 'perdidas') { renderLosses(); document.getElementById('loss-prod-search').value = ''; document.getElementById('loss-current-stock').value = ''; document.getElementById('loss-qty').value = 1; document.getElementById('loss-obs').value = ''; selectedLossProd = null; }
    if (tabId === 'categorias') renderCategoryManagers();
    if (tabId === 'etiquetas') { document.getElementById('label-prod-search').value = ''; document.getElementById('label-qty').value = 1; renderLabelList(); }
}

function updateGlobalDatalist() { const list = document.getElementById('global-prod-list'); if(list) list.innerHTML = products.filter(p => p.active !== false).map(p => `<option value="${p.code}">${p.name}</option>`).join(''); }
function updateFilterSelects() { const rSel = document.getElementById('filter-rubro'); const mSel = document.getElementById('filter-marca'); if(rSel) rSel.innerHTML = '<option value="">Todos los Rubros</option>' + masterRubros.map(r => `<option value="${r}">${r}</option>`).join(''); if(mSel) mSel.innerHTML = '<option value="">Todas las Marcas</option>' + masterMarcas.map(m => `<option value="${m}">${m}</option>`).join(''); }
function updateCategoryDatalists() { const rList = document.getElementById('list-rubros-global'); const mList = document.getElementById('list-marcas-global'); if(rList) rList.innerHTML = masterRubros.map(r => `<option value="${r}">`).join(''); if(mList) mList.innerHTML = masterMarcas.map(m => `<option value="${m}">`).join(''); }
function updateCategorySelectsBulk() { const rSel = document.getElementById('bulk-upd-rubro'); const mSel = document.getElementById('bulk-upd-marca'); if(rSel) rSel.innerHTML = '<option value="">Todos</option>' + masterRubros.map(r => `<option value="${r}">${r}</option>`).join(''); if(mSel) mSel.innerHTML = '<option value="">Todas</option>' + masterMarcas.map(m => `<option value="${m}">${m}</option>`).join(''); }

function renderInventory(dataToRender = null) {
    const tbody = document.getElementById('inventory-body'); if (!tbody) return; tbody.innerHTML = '';
    const list = dataToRender || products.filter(p => p.active !== false);
    if(list.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No se encontraron productos.</td></tr>'; return; }

    list.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.code}</td><td><strong>${p.name}</strong></td><td><span class="badge" style="background:#eee; color:#333;">${p.rubro || '-'}</span></td><td><span class="badge" style="background:#eee; color:#333;">${p.marca || '-'}</span></td>
            <td style="font-weight:bold; color:${p.stock <= 5 ? 'var(--danger)' : 'inherit'}">${p.stock || 0}</td><td style="color:var(--success); font-weight:bold;">$ ${formatMoney(p.price)}</td>
            <td><button class="btn-edit" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button><button class="btn-delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    });
}

function filterProducts() {
    const text = document.getElementById('search-input').value.toLowerCase(), fRubro = document.getElementById('filter-rubro').value, fMarca = document.getElementById('filter-marca').value;
    const filtered = products.filter(p => p.active !== false && (p.name.toLowerCase().includes(text) || p.code.toLowerCase().includes(text)) && (fRubro === '' || p.rubro === fRubro) && (fMarca === '' || p.marca === fMarca));
    renderInventory(filtered);
}

// ==========================================
// 2. EXPORTAR A EXCEL
// ==========================================
function exportInventoryExcel() {
    if (typeof XLSX === 'undefined') return notify("Error: Librería Excel no cargada.");
    const activeProducts = products.filter(p => p.active !== false);
    if(activeProducts.length === 0) return notify("No hay productos para exportar.");
    const dataForExcel = activeProducts.map(p => ({ "Código": p.code, "Nombre del Producto": p.name, "Rubro": p.rubro || '', "Marca": p.marca || '', "Costo ($)": p.cost || 0, "Precio Venta ($)": p.price || 0, "Stock Físico": p.stock || 0 }));
    const worksheet = XLSX.utils.json_to_sheet(dataForExcel); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    worksheet['!cols'] = [ {wch: 15}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15} ];
    XLSX.writeFile(workbook, `Inventario_ControlMax_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
}

// ==========================================
// 3. ACTUALIZADOR DE PRECIOS
// ==========================================
let indUpdateItemTemp = null, bulkUpdateList = [];
function updateIndSearchList() { const datalist = document.getElementById('ind-list-prods'); if (datalist) datalist.innerHTML = products.filter(p => p.active !== false).map(p => `<option value="${p.code}">${p.name}</option>`).join(''); }
function autoFillIndUpdate() { document.getElementById('ind-preview-box').style.display = 'none'; }

function previewIndPriceUpdate() {
    const searchVal = document.getElementById('ind-upd-search').value.trim().toLowerCase(), type = document.getElementById('ind-upd-type').value, val = parseFloat(document.getElementById('ind-upd-val').value);
    if (!searchVal) return notify("Busque un producto."); if (isNaN(val)) return notify("Ingrese valor numérico.");
    const prod = products.find(p => p.active !== false && (p.code.toLowerCase() === searchVal || p.name.toLowerCase() === searchVal)); if (!prod) return notify("Producto no encontrado.");
    let newPrice = type === 'exact' ? val : (type === 'amount' ? prod.price + val : prod.price * (1 + (val / 100))); newPrice = Math.max(Math.round(newPrice * 100) / 100, 0);
    indUpdateItemTemp = { id: prod.id, name: prod.name, oldPrice: prod.price, newPrice: newPrice };
    document.getElementById('ind-preview-text').innerHTML = `<strong>${prod.name}</strong><br>Precio Actual: $${formatMoney(prod.price)} <i class="fas fa-arrow-right" style="color:var(--accent);"></i> <strong style="color:var(--success); font-size:1.3rem;">Nuevo: $${formatMoney(newPrice)}</strong>`;
    document.getElementById('ind-preview-box').style.display = 'block';
}

function applyIndPriceUpdate() {
    if (!indUpdateItemTemp) return;
    const prodIndex = products.findIndex(p => p.id === indUpdateItemTemp.id);
    if (prodIndex !== -1) { products[prodIndex].price = indUpdateItemTemp.newPrice; DB.set('products', products); notify("Precio actualizado exitosamente."); document.getElementById('ind-upd-search').value = ''; document.getElementById('ind-upd-val').value = ''; document.getElementById('ind-preview-box').style.display = 'none'; indUpdateItemTemp = null; }
}

function previewBulkPriceUpdate() {
    const fRubro = document.getElementById('bulk-upd-rubro').value, fMarca = document.getElementById('bulk-upd-marca').value, percent = parseFloat(document.getElementById('bulk-upd-percent').value);
    if (isNaN(percent) || percent === 0) return notify("Ingrese un porcentaje válido.");
    bulkUpdateList = products.filter(p => p.active !== false && (fRubro === '' || p.rubro === fRubro) && (fMarca === '' || p.marca === fMarca));
    if (bulkUpdateList.length === 0) return notify("No se encontraron productos.");
    const tbody = document.getElementById('bulk-preview-body'); tbody.innerHTML = ''; document.getElementById('bulk-count').innerText = bulkUpdateList.length;
    bulkUpdateList.forEach(p => { const oldPrice = p.price, newPrice = Math.round((oldPrice * (1 + (percent / 100))) * 100) / 100, diff = newPrice - oldPrice; p._newTempPrice = newPrice; tbody.innerHTML += `<tr><td>${p.code} - ${p.name}</td><td>$ ${formatMoney(oldPrice)}</td><td style="color:var(--primary); font-weight:bold;">$ ${formatMoney(newPrice)}</td><td style="color:${diff > 0 ? 'var(--success)' : 'var(--danger)'}">${diff > 0 ? '+' : ''}$ ${formatMoney(diff)}</td></tr>`; });
    document.getElementById('bulk-preview-container').style.display = 'block';
}

async function applyBulkPriceUpdate() {
    if (bulkUpdateList.length === 0) return;
    if (await confirmAction(`¿Aplicar cambio a ${bulkUpdateList.length} productos?`, { confirmText: 'Aplicar', icon: 'question' })) {
        let updateCount = 0;
        bulkUpdateList.forEach(tempItem => { const realProd = products.find(p => p.id === tempItem.id); if (realProd && realProd._newTempPrice) { realProd.price = realProd._newTempPrice; delete realProd._newTempPrice; updateCount++; } });
        DB.set('products', products); notify(`¡Éxito! Se actualizaron ${updateCount} productos.`); document.getElementById('bulk-upd-percent').value = ''; document.getElementById('bulk-preview-container').style.display = 'none'; bulkUpdateList = [];
    }
}

// ==========================================
// 4. OFERTAS Y COMBOS
// ==========================================
function toggleDiscountView(view) {
    document.getElementById('view-ofertas').style.display = view === 'ofertas' ? 'block' : 'none'; document.getElementById('view-combos').style.display = view === 'combos' ? 'block' : 'none'; document.getElementById('btn-tab-ofertas').classList.toggle('active', view === 'ofertas'); document.getElementById('btn-tab-combos').classList.toggle('active', view === 'combos');
    if(view === 'ofertas') renderOffers(); if(view === 'combos') { renderCombos(); document.getElementById('combo-code').value = `CMB-${Math.floor(Math.random()*100000)}`; }
}

let selectedOfferProd = null;
function fillOfferProd() { const val = document.getElementById('offer-prod-search').value.trim().toLowerCase(); selectedOfferProd = products.find(p => p.active !== false && (p.code.toLowerCase() === val || p.name.toLowerCase() === val)); if (selectedOfferProd) { document.getElementById('offer-normal-price').value = `$ ${formatMoney(selectedOfferProd.price)}`; calcOfferPreview(); } }
function calcOfferPreview() { if (!selectedOfferProd) return; const type = document.getElementById('offer-type').value, val = parseFloat(document.getElementById('offer-val').value) || 0; let final = type === 'percent' ? selectedOfferProd.price * (1 - (val/100)) : (type === 'amount' ? selectedOfferProd.price - val : val); document.getElementById('offer-preview-price').innerText = formatMoney(Math.max(final, 0)); }
function saveOffer() { if (!selectedOfferProd) return notify("Seleccione producto."); const type = document.getElementById('offer-type').value, val = parseFloat(document.getElementById('offer-val').value) || 0, expiry = document.getElementById('offer-expiry').value; if (!expiry) return notify("Seleccione vencimiento."); offers = offers.filter(o => o.productId !== selectedOfferProd.id); offers.push({ id: Date.now(), productId: selectedOfferProd.id, name: selectedOfferProd.name, type, value: val, expiry }); DB.set('offers', offers); notify("Oferta guardada."); document.getElementById('offer-prod-search').value = ''; renderOffers(); }
function renderOffers() { const tbody = document.getElementById('offers-body'); tbody.innerHTML = ''; const today = new Date().setHours(0,0,0,0); offers = offers.filter(o => new Date(o.expiry).getTime() >= today); DB.set('offers', offers); offers.forEach(o => { const prod = products.find(p => p.id === o.productId); let desc = o.type === 'percent' ? `-${o.value}%` : (o.type === 'amount' ? `-$${o.value}` : `Fijo: $${o.value}`); tbody.innerHTML += `<tr><td>${o.name}</td><td>${prod ? '$'+formatMoney(prod.price) : 'N/A'}</td><td style="color:var(--success); font-weight:bold;">${desc}</td><td>${new Date(o.expiry).toLocaleDateString()}</td><td><button class="btn-delete" onclick="deleteOffer(${o.id})"><i class="fas fa-trash"></i></button></td></tr>`; }); }
function deleteOffer(id) { offers = offers.filter(o => o.id !== id); DB.set('offers', offers); renderOffers(); }

let comboTempItems = [];
function addProdToCombo() { const val = document.getElementById('combo-prod-search').value.toLowerCase(), qty = parseInt(document.getElementById('combo-prod-qty').value) || 1; const p = products.find(x => x.active !== false && (x.code.toLowerCase() === val || x.name.toLowerCase() === val)); if(!p) return notify("No encontrado."); const exist = comboTempItems.find(i => i.id === p.id); if(exist) exist.qty += qty; else comboTempItems.push({ id: p.id, code: p.code, name: p.name, cost: p.cost, price: p.price, qty: qty }); document.getElementById('combo-prod-search').value = ''; document.getElementById('combo-prod-qty').value = 1; renderComboTemp(); }
function renderComboTemp() { const tbody = document.getElementById('combo-temp-body'); let tCost = 0, tNormal = 0; tbody.innerHTML = ''; comboTempItems.forEach((i, idx) => { let subP = i.price * i.qty; tCost += i.cost * i.qty; tNormal += subP; tbody.innerHTML += `<tr><td>${i.name}</td><td>${i.qty}</td><td>$${formatMoney(i.cost)}</td><td>$${formatMoney(i.price)}</td><td style="font-weight:bold;">$${formatMoney(subP)}</td><td><button class="btn-delete" onclick="comboTempItems.splice(${idx},1); renderComboTemp();"><i class="fas fa-times"></i></button></td></tr>`; }); document.getElementById('combo-total-cost').innerText = formatMoney(tCost); document.getElementById('combo-total-normal').innerText = formatMoney(tNormal); calcComboFinal(); }
function calcComboFinal() { const tNormal = comboTempItems.reduce((acc, i) => acc + (i.price * i.qty), 0), type = document.getElementById('combo-price-type').value, val = parseFloat(document.getElementById('combo-price-val').value) || 0; const final = type === 'manual' ? val : tNormal * (1 - (val/100)); document.getElementById('combo-final-price').innerText = formatMoney(Math.max(final, 0)); return Math.max(final, 0); }
function saveCombo() { const name = document.getElementById('combo-name').value.trim(), code = document.getElementById('combo-code').value, finalPrice = calcComboFinal(); if(!name || comboTempItems.length === 0 || finalPrice <= 0) return notify("Datos inválidos."); const factor = finalPrice / comboTempItems.reduce((acc, i) => acc + (i.price * i.qty), 0); let currentSum = 0; const itemsProporcional = comboTempItems.map((item, index) => { let propUnit = index === comboTempItems.length - 1 ? (finalPrice - currentSum) / item.qty : Math.round((item.price * factor) * 100) / 100; currentSum += (propUnit * item.qty); return { ...item, proportionalPrice: Math.round(propUnit*100)/100 }; }); combos.push({ id: Date.now(), isCombo: true, name, code, finalPrice, cost: comboTempItems.reduce((acc, i) => acc + (i.cost * i.qty), 0), items: itemsProporcional }); DB.set('combos', combos); notify("Combo Guardado."); comboTempItems = []; document.getElementById('combo-name').value = ''; document.getElementById('combo-price-val').value = ''; document.getElementById('combo-price-type').value = 'manual'; renderComboTemp(); toggleDiscountView('combos'); }
function renderCombos() { const tbody = document.getElementById('combos-body'); tbody.innerHTML = ''; combos.forEach(c => { tbody.innerHTML += `<tr><td>${c.code}</td><td><strong>${c.name}</strong></td><td>${c.items.length} prods</td><td style="color:#8e44ad; font-weight:bold;">$${formatMoney(c.finalPrice)}</td><td><button class="btn-delete" onclick="deleteCombo(${c.id})"><i class="fas fa-trash"></i></button></td></tr>`; }); }
async function deleteCombo(id) { if(await confirmAction("¿Eliminar Combo?")) { combos = combos.filter(c => c.id !== id); DB.set('combos', combos); renderCombos(); } }

// ==========================================
// 5. MERMAS (PÉRDIDAS)
// ==========================================
let selectedLossProd = null;
function autoFillLoss() { const val = document.getElementById('loss-prod-search').value.trim().toLowerCase(); selectedLossProd = products.find(p => p.active !== false && (p.code.toLowerCase() === val || p.name.toLowerCase() === val)); if (selectedLossProd) document.getElementById('loss-current-stock').value = selectedLossProd.stock; else document.getElementById('loss-current-stock').value = ''; }
function registerLoss() {
    if (!selectedLossProd) return notify("Seleccione producto."); const qty = parseInt(document.getElementById('loss-qty').value), reason = document.getElementById('loss-reason').value, obs = document.getElementById('loss-obs').value.trim();
    if (isNaN(qty) || qty <= 0) return notify("Cantidad inválida."); if (qty > selectedLossProd.stock) return notify(`No hay stock suficiente.\nDisponible: ${selectedLossProd.stock}`);
    const prodIndex = products.findIndex(p => p.id === selectedLossProd.id);
    if(prodIndex !== -1) {
        products[prodIndex].stock -= qty; const lossValue = products[prodIndex].cost * qty;
        losses.push({ id: Date.now(), date: new Date().toLocaleString(), productId: products[prodIndex].id, productName: products[prodIndex].name, qty: qty, reason: reason, obs: obs, lossValue: lossValue });
        DB.set('products', products); DB.set('losses', losses);
        if (typeof addLog === 'function') addLog('INVENTARIO', 'MERMA', `Merma ${qty}x ${products[prodIndex].name}`);
        notify("Pérdida registrada."); document.getElementById('loss-prod-search').value = ''; document.getElementById('loss-current-stock').value = ''; document.getElementById('loss-qty').value = 1; document.getElementById('loss-obs').value = ''; selectedLossProd = null; renderLosses(); updateGlobalDatalist();
    }
}
function renderLosses() { const tbody = document.getElementById('losses-body'); if(!tbody) return; tbody.innerHTML = ''; if (losses.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#999; padding:20px;">No hay mermas.</td></tr>`; return; } [...losses].reverse().forEach(l => { tbody.innerHTML += `<tr><td><small>${l.date}</small></td><td><strong>${l.productName}</strong><br><small style="color:#888">${l.obs || ''}</small></td><td style="text-align:center; font-weight:bold;">${l.qty}</td><td><span class="badge" style="background:#ffebee; border:1px solid #ffcdd2; color:#c62828;">${l.reason}</span></td><td style="text-align:right; color:var(--danger); font-weight:bold;">-$ ${formatMoney(l.lossValue)}</td></tr>`; }); }

// ==========================================
// 6. GESTOR DE RUBROS Y MARCAS
// ==========================================
function checkAndSaveCategory(type, val) { if (!val) return val; val = val.trim().toUpperCase(); if (type === 'rubro' && !masterRubros.includes(val)) { masterRubros.push(val); masterRubros.sort(); DB.set('masterRubros', masterRubros); } else if (type === 'marca' && !masterMarcas.includes(val)) { masterMarcas.push(val); masterMarcas.sort(); DB.set('masterMarcas', masterMarcas); } return val; }
function renderCategoryManagers() { const rList = document.getElementById('list-mgr-rubros'); const mList = document.getElementById('list-mgr-marcas'); rList.innerHTML = ''; mList.innerHTML = ''; masterRubros.forEach(r => rList.innerHTML += `<li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span>${r}</span><button class="btn-delete" onclick="deleteCategory('rubro', '${r}')"><i class="fas fa-trash"></i></button></li>`); masterMarcas.forEach(m => mList.innerHTML += `<li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span>${m}</span><button class="btn-delete" onclick="deleteCategory('marca', '${m}')"><i class="fas fa-trash"></i></button></li>`); }
function addCategory(type) { const input = document.getElementById(`new-${type}-input`); if (!input.value.trim()) return; checkAndSaveCategory(type, input.value); input.value = ''; renderCategoryManagers(); updateFilterSelects(); updateCategoryDatalists(); }
async function deleteCategory(type, name) { const inUse = products.some(p => p.active !== false && p[type] === name); if (inUse) return notify(`En uso.`); if (await confirmAction(`¿Eliminar ${name}?`)) { if (type === 'rubro') { masterRubros = masterRubros.filter(r => r !== name); DB.set('masterRubros', masterRubros); } else { masterMarcas = masterMarcas.filter(m => m !== name); DB.set('masterMarcas', masterMarcas); } renderCategoryManagers(); updateFilterSelects(); updateCategoryDatalists(); } }

// ==========================================
// 7. GENERADOR AUTOMÁTICO DE CÓDIGOS
// ==========================================
function getPrefixForRubro(rubro) {
    if (!rubro) return "GEN";
    let prefixes = DB.get('rubroPrefixes', {});
    let rUpper = rubro.toUpperCase().trim();
    if (prefixes[rUpper]) return prefixes[rUpper];
    let auto = rUpper.replace(/[AEIOU]/g, '').substring(0, 3).padEnd(3, 'X');
    if (auto === 'XXX') auto = rUpper.substring(0, 3).padEnd(3, 'X');
    prefixes[rUpper] = auto; DB.set('rubroPrefixes', prefixes); return auto;
}

function generateProductCode(rubro) {
    let prefix = getPrefixForRubro(rubro);
    let config = DB.get('config', {});
    if (!config.codeCounters) config.codeCounters = {};
    if (!config.codeCounters[prefix]) config.codeCounters[prefix] = 0;
    let productsDb = DB.get('products', []);
    let newCode = ""; let isUnique = false;
    while (!isUnique) {
        config.codeCounters[prefix]++;
        newCode = `${prefix}-${String(config.codeCounters[prefix]).padStart(4, '0')}`;
        isUnique = !productsDb.some(p => p.code === newCode);
    }
    DB.set('config', config);
    return newCode;
}

// ==========================================
// 8. IMPRESIÓN DE ETIQUETAS A4 PROFESIONALES
// ==========================================

function autoFillLabelQty() {
    const val = document.getElementById('label-prod-search').value.toLowerCase();
    const p = products.find(x => x.active !== false && (x.code.toLowerCase() === val || x.name.toLowerCase() === val));
    if (p) document.getElementById('label-qty').value = 1;
}

function addToPrintQueue(product, qtyToAdd) {
    if (!product || isNaN(qtyToAdd) || qtyToAdd <= 0) return;
    const exist = labelPrintList.find(i => i.id === product.id);
    if(exist) exist.qty += qtyToAdd;
    else labelPrintList.push({ id: product.id, code: product.code, name: product.name, price: product.price, qty: qtyToAdd });
    DB.set('printQueue', labelPrintList);
    renderLabelList();
}

function addProdToLabelList() {
    const val = document.getElementById('label-prod-search').value.toLowerCase();
    const qty = parseInt(document.getElementById('label-qty').value) || 1;
    const p = products.find(x => x.active !== false && (x.code.toLowerCase() === val || x.name.toLowerCase() === val));
    if(!p) return notify("Producto no encontrado.");
    addToPrintQueue(p, qty);
    document.getElementById('label-prod-search').value = '';
    document.getElementById('label-qty').value = 1;
}

function updateLabelQty(index, delta) {
    const newVal = labelPrintList[index].qty + delta;
    if (newVal <= 0) labelPrintList.splice(index, 1);
    else labelPrintList[index].qty = newVal;
    DB.set('printQueue', labelPrintList); renderLabelList();
}

function updateLabelQtyManual(index, inputObj) {
    const newVal = parseInt(inputObj.value);
    if (isNaN(newVal) || newVal <= 0) labelPrintList.splice(index, 1);
    else labelPrintList[index].qty = newVal;
    DB.set('printQueue', labelPrintList); renderLabelList();
}

function renderLabelList() {
    const tbody = document.getElementById('label-list-body'); if (!tbody) return; tbody.innerHTML = '';
    let totalLabels = 0;
    labelPrintList.forEach((item, index) => {
        totalLabels += item.qty;
        tbody.innerHTML += `<tr>
            <td>${item.name}</td><td>${item.code}</td>
            <td style="text-align:center;">
                <button class="btn-secondary" style="padding:2px 8px; font-size:0.8rem;" onclick="updateLabelQty(${index}, -1)">-</button>
                <input type="number" value="${item.qty}" style="width:60px; text-align:center; padding:5px; margin:0 5px;" onchange="updateLabelQtyManual(${index}, this)">
                <button class="btn-secondary" style="padding:2px 8px; font-size:0.8rem;" onclick="updateLabelQty(${index}, 1)">+</button>
            </td>
            <td style="text-align:center;"><button class="btn-delete" onclick="labelPrintList.splice(${index},1); DB.set('printQueue', labelPrintList); renderLabelList();"><i class="fas fa-trash"></i></button></td>
        </tr>`; 
    });
    const counterEl = document.getElementById('label-total-count'); if(counterEl) counterEl.innerText = totalLabels;
}

async function clearLabelList() { if(await confirmAction("¿Vaciar toda la cola de impresión?")) { labelPrintList = []; DB.set('printQueue', labelPrintList); renderLabelList(); } }

function printLabels() {
    if(labelPrintList.length === 0) return notify("Agregue productos a la cola de impresión.");
    
    const showPrice = document.getElementById('label-show-price').checked;
    const printArea = document.getElementById('print-area'); 
    printArea.innerHTML = '';
    
    const labelsPerSheet = 55; // 5 columnas x 11 filas aprox
    let currentSheet = null;
    let labelCount = 0;

    labelPrintList.forEach(item => {
        for(let i = 0; i < item.qty; i++) {
            if (labelCount % labelsPerSheet === 0) {
                currentSheet = document.createElement('div'); 
                currentSheet.className = 'a4-sheet';
                printArea.appendChild(currentSheet);
            }

            currentSheet.innerHTML += `
                <div class="label-item">
                    <div class="label-name">${item.name}</div>
                    <div class="barcode-wrapper">
                        <svg class="barcode" 
                             jsbarcode-value="${item.code}" 
                             jsbarcode-height="25" 
                             jsbarcode-width="1.2" 
                             jsbarcode-displayvalue="true" 
                             jsbarcode-fontSize="10" 
                             jsbarcode-margin="0"></svg>
                    </div>
                    ${showPrice ? `<div class="label-price">$${formatMoney(item.price)}</div>` : ''}
                </div>
            `;
            labelCount++;
        }
    });

    try { JsBarcode(".barcode").init(); } catch(e) { console.error(e); }
    setTimeout(() => { window.print(); }, 500);
}

// ==========================================
// 9. ALTA Y EDICIÓN DE PRODUCTO
// ==========================================
function prepareInventorySelectors() {
    const provSelect = document.getElementById('prod-prov-select'), partSelect = document.getElementById('pay-inv-partner-select');
    const suppliers = DB.get('suppliers', []), partners = DB.get('partners', []);
    if (provSelect) provSelect.innerHTML = '<option value="">-- Sin Proveedor --</option>' + suppliers.filter(s => s.active !== false).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (partSelect) partSelect.innerHTML = '<option value="">-- Seleccionar Socio --</option>' + partners.filter(p => p.active !== false).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}
function calcNewProdTotal() { const cost = parseFloat(document.getElementById('prod-cost').value) || 0, qty = parseFloat(document.getElementById('prod-stock-init').value) || 0; const display = document.getElementById('prod-total-buy'); if (display) display.value = formatMoney(cost * qty); }

async function createPurchaseRecord(data) {
    const { prodName, qty, total, payments, ids } = data; const isoDate = new Date().toISOString();
    if (payments.cash > 0 || payments.bank > 0) { if (typeof updateBalancesStorage === 'function') await updateBalancesStorage(-payments.cash, -payments.bank); }
    if (payments.ctacte > 0 && ids.provider) { let suppliers = DB.get('suppliers', []); const idx = suppliers.findIndex(s => s.id == ids.provider); if (idx !== -1) { suppliers[idx].balance = (parseFloat(suppliers[idx].balance) || 0) + payments.ctacte; if (!suppliers[idx].history) suppliers[idx].history = []; suppliers[idx].history.push({ date: new Date().toLocaleString(), type: 'COMPRA', amount: payments.ctacte, note: `Compra Stock: ${prodName}` }); await DB.set('suppliers', suppliers); } }
    if (payments.partner > 0 && ids.partner) { let partners = DB.get('partners', []); const idx = partners.findIndex(p => p.id == ids.partner); if (idx !== -1) { partners[idx].totalContribution = (parseFloat(partners[idx].totalContribution) || 0) + payments.partner; await DB.set('partners', partners); } }
    let purchases = DB.get('purchases', []); purchases.push({ id: Date.now(), timestamp: isoDate, product: prodName, quantity: qty, totalCost: total, funding: { cash: payments.cash, bank: payments.bank, supplierCredit: payments.ctacte, partnerInvestment: payments.partner }, providerId: ids.provider || null, partnerId: ids.partner || null }); await DB.set('purchases', purchases); return true;
}

document.getElementById('product-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    try { await DB.ensureMany(['products','config','rubroPrefixes','masterRubros','masterMarcas','suppliers','partners','purchases','balances']); } catch(err) { return notify("Error de conexión con la base de datos."); }
    const name = document.getElementById('prod-name').value;
    const rubro = checkAndSaveCategory('rubro', document.getElementById('prod-rubro').value);
    const marca = checkAndSaveCategory('marca', document.getElementById('prod-marca').value);
    
    let code = document.getElementById('prod-code').value.trim();
    if (!code) code = generateProductCode(rubro);

    const cost = parseFloat(document.getElementById('prod-cost').value) || 0, price = parseFloat(document.getElementById('prod-price').value) || 0, qty = parseFloat(document.getElementById('prod-stock-init').value) || 0;
    const totalReal = Math.round((cost * qty) * 100) / 100;
    const pCash = parseFloat(document.getElementById('pay-inv-cash').value) || 0, pBank = parseFloat(document.getElementById('pay-inv-bank').value) || 0, pCtaCte = parseFloat(document.getElementById('pay-inv-ctacte').value) || 0, pPartner = parseFloat(document.getElementById('pay-inv-partner').value) || 0;
    const provId = document.getElementById('prod-prov-select').value, partId = document.getElementById('pay-inv-partner-select').value;

    if (totalReal > 0) {
        const sumaPagos = Math.round((pCash + pBank + pCtaCte + pPartner) * 100) / 100;
        if (Math.abs(sumaPagos - totalReal) > 0.1) return notify(`Error: Pagos no coinciden con Costo.`);
        if (pCtaCte > 0 && !provId) return notify("Seleccione proveedor.");
        if (pPartner > 0 && !partId) return notify("Seleccione socio.");
        const success = await createPurchaseRecord({ prodName: name, qty: qty, total: totalReal, payments: { cash: pCash, bank: pBank, ctacte: pCtaCte, partner: pPartner }, ids: { provider: provId, partner: partId } });
        if (!success) return;
    }

    const productObj = { id: Date.now(), name, code, rubro, marca, cost, price, stock: qty, active: true };
    products.push(productObj);
    DB.set('products', products);
    
    if (typeof addLog === 'function') addLog('INVENTARIO', 'CREACION', `Producto: ${name} (${code})`);
    
    if (typeof addToPrintQueue === 'function') addToPrintQueue(productObj, qty > 0 ? qty : 1);

    notify(`¡Producto creado!\nCódigo Asignado: ${code}`); 
    this.reset(); showSubTab('listado'); updateGlobalDatalist();
});

function editProduct(id) {
    const p = products.find(p => p.id === id); if (!p) return;
    const editTabBtn = document.getElementById('tab-btn-editar'); if (editTabBtn) editTabBtn.style.display = 'inline-block';
    document.getElementById('edit-prod-id').value = p.id; document.getElementById('edit-prod-name').value = p.name; document.getElementById('edit-prod-code').value = p.code;
    updateCategoryDatalists();
    document.getElementById('edit-prod-rubro').value = p.rubro || ''; document.getElementById('edit-prod-marca').value = p.marca || '';
    document.getElementById('edit-prod-cost').value = p.cost || 0; document.getElementById('edit-prod-price').value = p.price || 0; document.getElementById('edit-prod-stock').value = p.stock || 0;
    showSubTab('editar-prod');
}
function cancelEdit() { showSubTab('listado'); }

document.getElementById('edit-product-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-prod-id').value), index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        products[index].name = document.getElementById('edit-prod-name').value; products[index].code = document.getElementById('edit-prod-code').value;
        products[index].rubro = checkAndSaveCategory('rubro', document.getElementById('edit-prod-rubro').value); products[index].marca = checkAndSaveCategory('marca', document.getElementById('edit-prod-marca').value);
        products[index].cost = parseFloat(document.getElementById('edit-prod-cost').value) || 0; products[index].price = parseFloat(document.getElementById('edit-prod-price').value) || 0;
        DB.set('products', products);
        notify("¡Cambios guardados!"); showSubTab('listado'); updateGlobalDatalist();
    }
});

async function deleteProduct(id) {
    if (await confirmAction("¿Eliminar este producto?")) {
        const idx = products.findIndex(p => p.id === id);
        if (idx !== -1) { products[idx].active = false; DB.set('products', products); renderInventory(); updateGlobalDatalist(); }
    }
}