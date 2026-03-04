/**
 * CONTROL-MAX - Módulo de Compras
 */

let bulkRowsCount = 0;

function showSubTabPurchase(tabId) {
    document.querySelectorAll('.purchase-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-${tabId}`).style.display = 'block';

    document.querySelectorAll('#purchases-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if (tabId === 'individual') updatePurchaseDatalist();
    if (tabId === 'grande' && bulkRowsCount === 0) addBulkRow();
}

function updatePurchaseDatalist() {
    const list = document.getElementById('prod-list');
    if (!list) return;
    list.innerHTML = '';
    products.filter(p => p.active !== false).forEach(p => {
        list.innerHTML += `<option value="${p.code}">${p.name}</option>`;
    });
}

function togglePurchaseMethod(type) {
    const method = document.getElementById(`p-${type}-method`).value;
    document.getElementById(`p-${type}-combined`).style.display = (method === 'combined') ? 'flex' : 'none';
}

// --- COMPRA INDIVIDUAL ---
function autoFillIndividual() {
    const val = document.getElementById('p-ind-search').value;
    const prod = products.find(p => p.code === val || p.name === val);
    if (prod) {
        document.getElementById('p-ind-cost').value = prod.cost || 0;
        document.getElementById('p-ind-price').value = prod.price || 0;
    }
}

function saveIndividualPurchase() {
    const val = document.getElementById('p-ind-search').value;
    const qty = parseInt(document.getElementById('p-ind-qty').value);
    const costU = parseFloat(document.getElementById('p-ind-cost').value) || 0;
    const priceV = parseFloat(document.getElementById('p-ind-price').value) || 0;

    const prod = products.find(p => p.code === val || p.name === val);
    if (!prod) return alert("El producto no existe.");

    const total = qty * costU;
    if (!processPurchasePayment('individual', total)) return;

    prod.stock = (parseInt(prod.stock) || 0) + qty;
    prod.cost = costU;
    prod.price = priceV;

    finalizePurchase();
    document.getElementById('p-ind-search').value = '';
}

// --- COMPRA GRANDE ---
function addBulkRow() {
    bulkRowsCount++;
    const tbody = document.getElementById('bulk-body');
    const id = bulkRowsCount;

    const tr = document.createElement('tr');
    tr.id = `bulk-row-${id}`;
    tr.innerHTML = `
        <td><input type="text" class="b-search" placeholder="Cod/Nom" onchange="checkProductInRow(${id})"></td>
        <td><input type="number" class="b-qty" value="1" onchange="calcBulkTotal()"></td>
        <td><input type="number" class="b-cost" step="0.01" onchange="calcBulkTotal()"></td>
        <td><input type="number" class="b-price" step="0.01"></td>
        <td><button class="btn-delete" onclick="removeBulkRow(${id})">✖</button></td>
    `;

    const trExtra = document.createElement('tr');
    trExtra.id = `bulk-extra-${id}`;
    trExtra.className = "extra-fields-row";
    trExtra.style.display = "none";
    trExtra.innerHTML = `
        <td colspan="5">
            <div class="new-prod-fields">
                <small>Nuevo Producto: Complete Rubro y Marca</small>
                <div class="form-row">
                    <input type="text" class="b-rubro" placeholder="Rubro">
                    <input type="text" class="b-marca" placeholder="Marca">
                </div>
            </div>
        </td>
    `;

    tbody.appendChild(tr);
    tbody.appendChild(trExtra);
}

function checkProductInRow(id) {
    const row = document.getElementById(`bulk-row-${id}`);
    const extra = document.getElementById(`bulk-extra-${id}`);
    const val = row.querySelector('.b-search').value;
    const prod = products.find(p => p.code === val || p.name === val);

    if (prod) {
        row.querySelector('.b-cost').value = prod.cost || 0;
        row.querySelector('.b-price').value = prod.price || 0;
        extra.style.display = "none";
    } else if (val !== "") {
        extra.style.display = "table-row";
    }
    calcBulkTotal();
}

function removeBulkRow(id) {
    document.getElementById(`bulk-row-${id}`).remove();
    document.getElementById(`bulk-extra-${id}`).remove();
    calcBulkTotal();
}

function calcBulkTotal() {
    let total = 0;
    document.querySelectorAll('#bulk-body tr[id^="bulk-row-"]').forEach(tr => {
        const q = parseFloat(tr.querySelector('.b-qty').value) || 0;
        const c = parseFloat(tr.querySelector('.b-cost').value) || 0;
        total += (q * c);
    });
    document.getElementById('bulk-total-display').innerText = formatMoney(total);
}

function saveBulkPurchase() {
    const total = parseFloat(document.getElementById('bulk-total-display').innerText.replace(/\./g, '').replace(',', '.'));
    if (!processPurchasePayment('grande', total)) return;

    document.querySelectorAll('#bulk-body tr[id^="bulk-row-"]').forEach(tr => {
        const id = tr.id.replace('bulk-row-', '');
        const extra = document.getElementById(`bulk-extra-${id}`);
        const val = tr.querySelector('.b-search').value;
        const qty = parseInt(tr.querySelector('.b-qty').value);
        const costU = parseFloat(tr.querySelector('.b-cost').value);
        const priceV = parseFloat(tr.querySelector('.b-price').value);

        let prod = products.find(p => p.code === val || p.name === val);
        if (prod) {
            prod.stock += qty;
            prod.cost = costU;
            prod.price = priceV;
        } else if (val !== "") {
            products.push({
                id: Date.now() + Math.random(),
                code: val, name: val, stock: qty, cost: costU, price: priceV,
                rubro: extra.querySelector('.b-rubro').value || "Varios",
                marca: extra.querySelector('.b-marca').value || "Genérica",
                active: true
            });
        }
    });

    finalizePurchase();
    document.getElementById('bulk-body').innerHTML = '';
    bulkRowsCount = 0;
    addBulkRow();
}

// --- PAGO ---
function processPurchasePayment(type, total) {
    const method = document.getElementById(`p-${type}-method`).value;
    let cash = 0, bank = 0;

    if (method === 'cash') cash = total;
    else if (method === 'bank') bank = total;
    else {
        cash = parseFloat(document.getElementById(`p-${type}-pay-cash`).value) || 0;
        bank = parseFloat(document.getElementById(`p-${type}-pay-bank`).value) || 0;
        if (Math.round((cash + bank) * 100) !== Math.round(total * 100)) {
            alert("Montos no coinciden."); return false;
        }
    }

    if (typeof updateBalancesStorage === 'function') {
        updateBalancesStorage(-cash, -bank);
        return true;
    }
    return false;
}

function finalizePurchase() {
    localStorage.setItem('products', JSON.stringify(products));
    alert("Compra registrada.");
    if (typeof renderInventory === 'function') renderInventory();
}