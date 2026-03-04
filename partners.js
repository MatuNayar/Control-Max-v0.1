/**
 * CONTROL-MAX - Módulo de Socios y Capital Social
 */

let partners = JSON.parse(localStorage.getItem('partners')) || [];

/**
 * Navegación de sub-pestañas de Socios
 */
function showSubTabPartner(tabId) {
    document.querySelectorAll('.partner-content').forEach(el => el.style.display = 'none');
    document.getElementById(`sub-partners-${tabId}`).style.display = 'block';
    
    document.querySelectorAll('#partners-section .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active');
    });

    if(tabId === 'listado') renderPartners();
    if(tabId === 'aporte') updatePartnerSelect();
}

/**
 * Renderiza la lista de socios y sus inversiones totales
 */
function renderPartners() {
    const tbody = document.getElementById('partners-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const activePartners = partners.filter(p => p.active !== false);

    activePartners.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td style="color: var(--success); font-weight:bold;">
                $ ${formatMoney(p.totalContribution || 0)}
            </td>
            <td>
                <button class="btn-delete" onclick="deletePartner(${p.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openPartnerModal() {
    const modal = document.getElementById('partner-modal');
    if(modal) modal.style.display = 'flex';
}

function closePartnerModal() {
    const modal = document.getElementById('partner-modal');
    if(modal) modal.style.display = 'none';
    document.getElementById('partner-form')?.reset();
}

/**
 * Crear nuevo socio
 */
document.getElementById('partner-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('partner-name');
    if(!nameInput) return;

    const newPartner = {
        id: Date.now(),
        name: nameInput.value,
        totalContribution: 0,
        active: true
    };

    partners.push(newPartner);
    savePartners();
    closePartnerModal();
    renderPartners();
});

/**
 * Eliminar socio (Borrador Lógico)
 */
function deletePartner(id) {
    if(confirm('¿Desea eliminar a este socio? Los aportes ya realizados se mantendrán en el balance de la empresa.')) {
        const index = partners.findIndex(p => p.id === id);
        if(index !== -1) {
            partners[index].active = false;
            savePartners();
            renderPartners();
        }
    }
}

/**
 * Actualiza el selector de socios en la pestaña de Aportes
 */
function updatePartnerSelect() {
    const select = document.getElementById('cont-partner-select');
    if(!select) return;

    select.innerHTML = '<option value="">-- Seleccione un Socio --</option>';
    const activePartners = partners.filter(p => p.active !== false);

    activePartners.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

/**
 * Procesa un nuevo aporte de capital
 */
document.getElementById('contribution-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const partnerId = parseInt(document.getElementById('cont-partner-select').value);
    const amount = parseFloat(document.getElementById('cont-amount').value);
    const method = document.getElementById('cont-method').value; // 'cash' o 'bank'

    if(!partnerId || isNaN(amount) || amount <= 0) {
        return alert("Por favor, seleccione un socio e ingrese un monto válido.");
    }

    // 1. Inyectar dinero al Balance (Llamada a balance.js)
    if(typeof updateBalancesStorage === 'function') {
        const partner = partners.find(p => p.id === partnerId);
        
        if(method === 'cash') updateBalancesStorage(amount, 0);
        else updateBalancesStorage(0, amount);
        
        // 2. Actualizar el acumulado del socio
        partner.totalContribution = (partner.totalContribution || 0) + amount;

        savePartners();
        alert(`¡Éxito! Se registró un aporte de capital de $ ${formatMoney(amount)} por parte de ${partner.name}.`);
        
        this.reset();
        showSubTabPartner('listado');
    } else {
        alert("Error crítico: El módulo de Balance no está disponible.");
    }
});

function savePartners() {
    localStorage.setItem('partners', JSON.stringify(partners));
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('partners-section')) renderPartners();
});