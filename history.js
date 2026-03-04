/**
 * CONTROL-MAX - Módulo de Historial
 */

let historySortDesc = true;
let historyPage = 1;
const logsPerPage = 20;

function showSubTabHistory() {
    // Al entrar, cargar usuarios en el filtro y renderizar
    populateUserFilter();
    applyHistoryFilters();
}

function populateUserFilter() {
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const select = document.getElementById('hist-filter-user');
    select.innerHTML = '<option value="all">Todos los usuarios</option>';
    users.forEach(u => {
        select.innerHTML += `<option value="${u.username}">${u.username}</option>`;
    });
}

function applyHistoryFilters() {
    let logs = JSON.parse(localStorage.getItem('logs')) || [];
    
    const start = document.getElementById('hist-date-start').value;
    const end = document.getElementById('hist-date-end').value;
    const mod = document.getElementById('hist-filter-module').value;
    const user = document.getElementById('hist-filter-user').value;
    const search = document.getElementById('hist-search').value.toLowerCase();

    const filtered = logs.filter(l => {
        const date = l.timestamp.split('T')[0];
        const matchDate = (!start || date >= start) && (!end || date <= end);
        const matchMod = (mod === 'all' || l.module === mod);
        const matchUser = (user === 'all' || l.user === user);
        const matchSearch = !search || 
                            l.description.toLowerCase().includes(search) || 
                            (l.refId && l.refId.toString().includes(search));

        return matchDate && matchMod && matchUser && matchSearch;
    });

    if (!historySortDesc) filtered.reverse();

    renderHistoryTable(filtered);
}

function renderHistoryTable(data) {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';

    // Paginación
    const startIdx = (historyPage - 1) * logsPerPage;
    const paginated = data.slice(startIdx, startIdx + logsPerPage);

    paginated.forEach(l => {
        const dateObj = new Date(l.timestamp);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:0.85rem">${dateStr}</td>
            <td><small>${l.user}</small></td>
            <td><span class="sub-btn" style="font-size:0.6rem; padding:2px 6px;">${l.module}</span></td>
            <td><strong>${l.type}</strong></td>
            <td>${l.description}</td>
            <td><button class="btn-edit" onclick="viewEventDetail('${l.id}')"><i class="fas fa-eye"></i></button></td>
        `;
        tbody.appendChild(tr);
    });

    renderPaginationControls(data.length);
}

function viewEventDetail(id) {
    const logs = JSON.parse(localStorage.getItem('logs')) || [];
    const entry = logs.find(l => l.id === id);
    if (!entry) return;

    const modal = document.getElementById('event-detail-modal');
    const content = document.getElementById('event-detail-content');
    
    content.textContent = JSON.stringify(entry, null, 4);
    modal.style.display = 'flex';
}

function closeEventDetail() {
    document.getElementById('event-detail-modal').style.display = 'none';
}

function toggleHistoryOrder() {
    historySortDesc = !historySortDesc;
    applyHistoryFilters();
}

function exportHistoryCSV() {
    const logs = JSON.parse(localStorage.getItem('logs')) || [];
    if (logs.length === 0) return alert("No hay datos para exportar");

    let csv = "Fecha,Usuario,Modulo,Tipo,Descripcion\n";
    logs.forEach(l => {
        csv += `${l.timestamp},${l.user},${l.module},${l.type},"${l.description.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `historial_control_max_${new Date().getTime()}.csv`);
    link.click();
}

function renderPaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / logsPerPage);
    const container = document.getElementById('history-pagination');
    container.innerHTML = `<small>Página ${historyPage} de ${totalPages} (${totalItems} registros) </small>`;
    
    if (historyPage > 1) {
        container.innerHTML += `<button class="btn-secondary" onclick="changeHistoryPage(-1)" style="padding:2px 8px"><</button> `;
    }
    if (historyPage < totalPages) {
        container.innerHTML += `<button class="btn-secondary" onclick="changeHistoryPage(1)" style="padding:2px 8px">></button>`;
    }
}

function changeHistoryPage(dir) {
    historyPage += dir;
    applyHistoryFilters();
}