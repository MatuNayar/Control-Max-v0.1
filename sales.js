/**
 * CONTROL-MAX - Módulo de Ventas (Punto de Venta)
 */

let cart = [];

/**
 * Actualiza los selectores de productos y la lista de clientes
 */
function updateSalesDropdown() {
    const select = document.getElementById('sales-product-select');
    if (!select) return;

    // 1. Cargar Productos con stock activo
    select.innerHTML = '<option value="">-- Seleccionar Producto --</option>';
    const available = products.filter(p => p.active !== false && p.stock > 0);
    
    available.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} [${p.code}] - $ ${formatMoney(p.price)} (Stock: ${p.stock})`;
        select.appendChild(opt);
    });

    // 2. Actualizar Datalist de Clientes para el buscador
    updateClientDatalist();
}

/**
 * Refresca las sugerencias del buscador de clientes
 */
function updateClientDatalist() {
    const datalist = document.getElementById('list-clients');
    if (!datalist) return;

    const customers = JSON.parse(localStorage.getItem('customers')) || [];
    datalist.innerHTML = customers
        .filter(c => c.active !== false)
        .map(c => `<option value="${c.name}">`)
        .join('');
}

/**
 * Agrega un producto al carrito temporal
 */
function addToCart() {
    const prodId = parseInt(document.getElementById('sales-product-select').value);
    const qty = parseInt(document.getElementById('sales-qty').value);

    if (!prodId || isNaN(qty) || qty <= 0) {
        return alert("Seleccione un producto y una cantidad válida.");
    }

    const product = products.find(p => p.id === prodId);

    if (product) {
        // Validar stock disponible considerando el carrito actual
        const inCart = cart.find(item => item.id === prodId);
        const qtyInCart = inCart ? inCart.qty : 0;

        if (product.stock < (qtyInCart + qty)) {
            return alert(`Stock insuficiente. Disponible: ${product.stock}`);
        }

        if (inCart) {
            inCart.qty += qty;
            inCart.subtotal = inCart.qty * inCart.price;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                qty: qty,
                subtotal: parseFloat(product.price) * qty
            });
        }

        renderCart();
        document.getElementById('sales-qty').value = 1;
    }
}

/**
 * Dibuja la tabla del carrito y calcula el total
 */
function renderCart() {
    const tbody = document.getElementById('cart-body');
    const totalEl = document.getElementById('cart-total');
    if (!tbody) return;

    tbody.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.subtotal;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>$ ${formatMoney(item.subtotal)}</td>
            <td><button onclick="removeFromCart(${index})" class="btn-delete"><i class="fas fa-times"></i></button></td>
        `;
        tbody.appendChild(tr);
    });

    totalEl.innerText = formatMoney(total);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

/**
 * Controla la visibilidad del panel de pago múltiple
 */
function toggleCombinedPayment() {
    const method = document.getElementById('payment-method').value;
    const combinedBox = document.getElementById('combined-inputs');
    if (combinedBox) {
        combinedBox.style.display = (method === 'combined') ? 'flex' : 'none';
    }
}

/**
 * FINALIZAR VENTA - Procesa stock, dinero y deuda de clientes
 */
function checkout() {
    if (cart.length === 0) return alert("El carrito está vacío.");

    // 1. Validar Cliente
    const clientName = document.getElementById('sales-client-search').value.trim();
    if (!clientName) return alert("Debe ingresar el nombre del cliente para continuar.");

    // 2. Calcular Totales y Medios de Pago
    const total = cart.reduce((acc, i) => acc + i.subtotal, 0);
    const method = document.getElementById('payment-method').value;
    
    let pCash = 0, pBank = 0, pCtaCte = 0;

    if (method === 'cash') pCash = total;
    else if (method === 'bank') pBank = total;
    else if (method === 'ctacte') pCtaCte = total;
    else {
        // Pago Combinado
        pCash = parseFloat(document.getElementById('pay-cash').value) || 0;
        pBank = parseFloat(document.getElementById('pay-bank').value) || 0;
        pCtaCte = parseFloat(document.getElementById('pay-ctacte').value) || 0;

        const sumaTotal = Math.round((pCash + pBank + pCtaCte) * 100) / 100;
        const totalReal = Math.round(total * 100) / 100;

        if (sumaTotal !== totalReal) {
            return alert(`Error: La suma de pagos ($ ${formatMoney(sumaTotal)}) no coincide con el total ($ ${formatMoney(totalReal)})`);
        }
    }

    // 3. Gestión del Cliente (Buscar o Crear)
    let customers = JSON.parse(localStorage.getItem('customers')) || [];
    let client = customers.find(c => c.name.toLowerCase() === clientName.toLowerCase() && c.active !== false);

    if (!client) {
        client = {
            id: Date.now(),
            name: clientName,
            balance: 0,
            active: true,
            phone: '',
            taxId: '',
            history: [] // Inicializar historial para clientes nuevos
        };
        customers.push(client);
    }

    // 4. REGISTRAR DEUDA EN EL HISTORIAL DEL CLIENTE
    if (pCtaCte > 0) {
        client.balance = Math.round((client.balance + pCtaCte) * 100) / 100;
        
        if (!client.history) client.history = [];
        client.history.push({
            date: new Date().toLocaleString(),
            type: 'DEUDA', // <--- Esto hace que aparezca en la columna derecha (+)
            amount: pCtaCte,
            note: 'Venta a cuenta corriente'
        });
    }

    // 5. IMPACTO FINANCIERO Y STOCK
    // A. Balance General (Entra dinero a Caja o Banco)
    if (typeof updateBalancesStorage === 'function') {
        updateBalancesStorage(pCash, pBank);
    }

    // B. Descontar Stock del Inventario
    cart.forEach(item => {
        const prod = products.find(p => p.id === item.id);
        if (prod) prod.stock -= item.qty;
    });

    // 6. GUARDAR HISTORIAL GENERAL (Para el módulo de Reportes)
    const saleRecord = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        client: client.name,
        items: [...cart],
        total: total,
        payments: { cash: pCash, bank: pBank, ctacte: pCtaCte }
    };
    let salesHistory = JSON.parse(localStorage.getItem('salesHistory')) || [];
    salesHistory.push(saleRecord);

    // 7. PERSISTENCIA TOTAL
    localStorage.setItem('products', JSON.stringify(products));
    localStorage.setItem('customers', JSON.stringify(customers));
    localStorage.setItem('salesHistory', JSON.stringify(salesHistory));

    // Auditoría (Módulo Historial)
    if (typeof addLog === 'function') {
        addLog('VENTAS', 'VENTA', `Venta a ${client.name} por total de $ ${formatMoney(total)}`, saleRecord, saleRecord.id);
    }

    // 8. CIERRE Y LIMPIEZA
    alert(`¡Venta procesada!\nCliente: ${client.name}\nTotal: $ ${formatMoney(total)}`);
    
    cart = [];
    renderCart();
    updateSalesDropdown(); // Refrescar stock en los selectores
    document.getElementById('sales-client-search').value = '';
    
    // Limpiar inputs de pago combinado
    if (document.getElementById('pay-cash')) document.getElementById('pay-cash').value = '0';
    if (document.getElementById('pay-bank')) document.getElementById('pay-bank').value = '0';
    if (document.getElementById('pay-ctacte')) document.getElementById('pay-ctacte').value = '0';
}

/**
 * Inicialización forzada por seguridad
 */
document.addEventListener('DOMContentLoaded', () => {
    updateSalesDropdown();
});