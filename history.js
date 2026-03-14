/**
 * CONTROL-MAX - Módulo de Historial (Audit Log)
 * Optimizado para lectura fácil, filtros y detalle visual.
 */

let historySortDesc = true;
let historyPage = 1;
const logsPerPage = 15; // Cantidad de registros por página

// ==========================================
// 1. INICIALIZACIÓN Y FILTROS
// ==========================================

function showSubTabHistory() {
    populateUserFilter();
    applyHistoryFilters();
}

/**
 * Llena el selector de usuarios leyendo la base de datos
 */
function populateUserFilter() {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const select = document.getElementById('hist-filter-user');
    if (!select) return;
    
    // Guardar selección actual para no perderla si se recarga
    const currentVal = select.value;
    
    select.innerHTML = '<option value="all">Todos los usuarios</option>';
    users.forEach(u => {
        select.innerHTML += `<option value="${u.username}">${u.username}</option>`;
    });

    if (currentVal) select.value = currentVal;
}

/**
 * Limpia todos los inputs de la barra de búsqueda
 */
function resetHistoryFilters() {
    document.getElementById('hist-date-start').value = '';
    document.getElementById('hist-date-end').value = '';
    document.getElementById('hist-filter-module').value = 'all';
    document.getElementById('hist-filter-user').value = 'all';
    document.getElementById('hist-search').value = '';
    historyPage = 1; // Volver a la página 1
    applyHistoryFilters();
}

/**
 * Aplica los filtros seleccionados a la base de datos de logs
 */
function applyHistoryFilters() {
    let logs = JSON.parse(localStorage.getItem('logs')) || [];
    
    const start = document.getElementById('hist-date-start').value;
    const end = document.getElementById('hist-date-end').value;
    const mod = document.getElementById('hist-filter-module').value;
    const user = document.getElementById('hist-filter-user').value;
    const search = document.getElementById('hist-search').value.toLowerCase();

    const filtered = logs.filter(l => {
        const date = l.timestamp.split('T')[0];
        
        // Filtro Fecha (Corte por día)
        const matchDate = (!start || date >= start) && (!end || date <= end);
        // Filtro Módulo
        const matchMod = (mod === 'all' || l.module === mod);
        // Filtro Usuario
        const matchUser = (user === 'all' || l.user === user);
        // Filtro Texto (Descripción o ID Referencia)
        const matchSearch = !search || 
                            (l.description && l.description.toLowerCase().includes(search)) || 
                            (l.refId && l.refId.toString().includes(search));

        return matchDate && matchMod && matchUser && matchSearch;
    });

    // Ordenamiento por fecha
    if (historySortDesc) {
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else {
        filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    renderHistoryTable(filtered);
}

// ==========================================
// 2. RENDERIZADO DE TABLA Y PAGINACIÓN
// ==========================================

function renderHistoryTable(data) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">No se encontraron registros.</td></tr>';
        document.getElementById('history-pagination').innerHTML = '';
        return;
    }

    // Lógica de Paginación
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / logsPerPage);
    
    // Evitar quedar en una página vacía al filtrar
    if (historyPage > totalPages) historyPage = 1;
    
    const startIdx = (historyPage - 1) * logsPerPage;
    const paginated = data.slice(startIdx, startIdx + logsPerPage);

    // Dibujar Filas
    paginated.forEach(l => {
        const dateObj = new Date(l.timestamp);
        const dateStr = dateObj.toLocaleDateString() + '<br><small style="color:#888">' + 
                        dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + '</small>';
        
        const badgeClass = getBadgeClass(l.module);
        const iconHtml = getActionIcon(l.type);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${l.user || 'Sistema'}</strong></td>
            <td><span class="badge ${badgeClass}">${l.module}</span></td>
            <td>${iconHtml} <span style="font-size:0.85rem">${l.type}</span></td>
            <td>${l.description}</td>
            <td style="text-align:center;">
                ${l.details ? `<button class="btn-secondary" style="padding:4px 8px;" onclick="viewEventDetail(${l.id})" title="Ver Detalles"><i class="fas fa-search-plus"></i></button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPaginationControls(totalItems, totalPages);
}

function renderPaginationControls(totalItems, totalPages) {
    const container = document.getElementById('history-pagination');
    if (!container) return;
    
    let html = `<span style="color:#666;">Página <strong>${historyPage}</strong> de <strong>${totalPages}</strong> (${totalItems} registros)</span>`;
    
    html += `<div style="display:flex; gap:5px;">`;
    
    // Botón Anterior
    if (historyPage > 1) {
        html += `<button class="btn-secondary" onclick="changeHistoryPage(-1)">Anterior</button>`;
    } else {
        html += `<button class="btn-secondary" disabled style="opacity:0.5; cursor:not-allowed">Anterior</button>`;
    }

    // Botón Siguiente
    if (historyPage < totalPages) {
        html += `<button class="btn-secondary" onclick="changeHistoryPage(1)">Siguiente</button>`;
    } else {
        html += `<button class="btn-secondary" disabled style="opacity:0.5; cursor:not-allowed">Siguiente</button>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

function changeHistoryPage(dir) {
    historyPage += dir;
    applyHistoryFilters(); // Re-renderiza con la nueva página
}

function toggleHistoryOrder() {
    historySortDesc = !historySortDesc;
    historyPage = 1; // Volver al inicio al cambiar orden
    applyHistoryFilters();
}

// ==========================================
// 3. UTILIDADES VISUALES (BADGES E ICONOS)
// ==========================================

function getBadgeClass(module) {
    switch (module) {
        case 'VENTAS': return 'badge-ventas';
        case 'COMPRAS': return 'badge-compras';
        case 'INVENTARIO': return 'badge-inventario';
        case 'AUTH': return 'badge-auth';
        case 'ADMIN': return 'badge-admin';
        case 'SOCIOS': return 'badge-socios';
        default: return 'badge-admin';
    }
}

function getActionIcon(type) {
    const t = (type || '').toUpperCase();
    
    if (t.includes('ALTA') || t.includes('CREAR') || t.includes('VENTA') || t.includes('APORTE')) 
        return '<i class="fas fa-plus-circle action-icon text-create"></i>';
    
    if (t.includes('BAJA') || t.includes('ELIMINAR') || t.includes('RETIRO')) 
        return '<i class="fas fa-trash-alt action-icon text-delete"></i>';
    
    if (t.includes('EDICION') || t.includes('EDITAR')) 
        return '<i class="fas fa-pencil-alt action-icon text-update"></i>';
    
    return '<i class="fas fa-info-circle action-icon text-info"></i>';
}

// ==========================================
// 4. MODAL DE DETALLE DEL EVENTO
// ==========================================

function viewEventDetail(id) {
    const logs = JSON.parse(localStorage.getItem('logs')) || [];
    const entry = logs.find(l => l.id === id);
    if (!entry || !entry.details) return;

    const modal = document.getElementById('event-detail-modal');
    const content = document.getElementById('event-detail-content');
    
    // Renderizado estructurado del detalle
    let html = `<table class="detail-table"><tbody>`;
    
    // Recorremos las propiedades del objeto guardado en 'details'
    for (const [key, value] of Object.entries(entry.details)) {
        let displayValue = value;

        // Caso 1: Array de items (Ej: Carrito de ventas o compras masivas)
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            displayValue = renderItemsTable(value);
        } 
        // Caso 2: Objeto anidado (Ej: Métodos de pago {cash: 100, bank: 0})
        else if (typeof value === 'object' && value !== null) {
            displayValue = `<div style="background:#f4f4f4; padding:8px; border-radius:4px; font-family:monospace;">`;
            for (const [subKey, subValue] of Object.entries(value)) {
                displayValue += `<strong>${subKey}:</strong> ${subValue} <br>`;
            }
            displayValue += `</div>`;
        }

        html += `
            <tr>
                <th>${capitalize(key)}</th>
                <td>${displayValue}</td>
            </tr>
        `;
    }
    
    html += `</tbody></table>`;
    
    // Fila final con metadatos técnicos
    html += `<div style="margin-top:15px; font-size:0.8rem; color:#999; text-align:right;">
                ID Evento: ${entry.id}
             </div>`;

    content.innerHTML = html;
    modal.style.display = 'flex';
}

/**
 * Transforma un array de productos en una mini tabla HTML incrustada
 */
function renderItemsTable(items) {
    let t = `<table style="width:100%; font-size:0.85rem; background:#fff; border:1px solid #ddd; border-collapse: collapse;">
             <thead style="background:#eee;">
                <tr>
                    <th style="padding:5px; border:1px solid #ddd;">Cant</th>
                    <th style="padding:5px; border:1px solid #ddd;">Producto</th>
                    <th style="padding:5px; border:1px solid #ddd;">Total</th>
                </tr>
             </thead><tbody>`;
             
    items.forEach(i => {
        // Soporta diferentes estructuras (qty/quantity, name/product, subtotal/total)
        const qty = i.qty || i.quantity || 0;
        const name = i.name || i.product || '-';
        const total = i.subtotal || i.total || 0;
        
        t += `<tr>
                <td style="padding:5px; border:1px solid #ddd; text-align:center;">${qty}</td>
                <td style="padding:5px; border:1px solid #ddd;">${name}</td>
                <td style="padding:5px; border:1px solid #ddd; text-align:right;">$${formatMoney(total)}</td>
              </tr>`;
    });
    t += `</tbody></table>`;
    return t;
}

function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function closeEventDetail() {
    const modal = document.getElementById('event-detail-modal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// 5. EXPORTACIÓN A CSV
// ==========================================

function exportHistoryCSV() {
    const logs = JSON.parse(localStorage.getItem('logs')) || [];
    if (logs.length === 0) return alert("No hay datos en el historial para exportar.");

    // Cabeceras del CSV
    let csv = "Fecha,Hora,Usuario,Modulo,Accion,Descripcion\n";
    
    logs.forEach(l => {
        const d = new Date(l.timestamp);
        const date = d.toLocaleDateString();
        const time = d.toLocaleTimeString();
        // Limpiamos comillas en la descripción para no romper el CSV
        const desc = (l.description || '').replace(/"/g, '""');
        
        csv += `${date},${time},${l.user},${l.module},${l.type},"${desc}"\n`;
    });

    // Crear el archivo y forzar descarga
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `auditoria_controlmax_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}