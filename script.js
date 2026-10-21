const currentTime = document.getElementById('currentTime');
const itemForm = document.getElementById('itemForm');
const rows = document.getElementById('inventoryRows');
const searchInput = document.getElementById('searchInput');
const emptyMessage = document.getElementById('emptyMessage');
const currencySelect = document.getElementById('currencySelect');
const salesPeriod = document.getElementById('salesPeriod');
const salesMonth = document.getElementById('salesMonth');
const salesYear = document.getElementById('salesYear');
const salesRows = document.getElementById('salesRows');
const salesEmptyMessage = document.getElementById('salesEmptyMessage');
const salesSummary = document.getElementById('salesSummary');
const storageKey = 'offlineInventoryItems';
const salesStorageKey = 'offlineInventorySales';
const currencyStorageKey = 'offlineInventoryCurrency';
const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'PHP'];

let items = loadItems();
let sales = loadSales();
let currency = loadCurrency();
let editingId = null;
let activeSaleId = null;
let pendingDelete = null;
const deleteDialog = document.getElementById('deleteDialog');
const deleteDialogTitle = document.getElementById('deleteDialogTitle');
const deleteDialogMessage = document.getElementById('deleteDialogMessage');
currencySelect.value = currency;
populateSalesFilters();

function loadItems() {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveItems() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
        alert('Unable to save inventory in this browser.');
    }
}

function loadSales() {
    try {
        const saved = JSON.parse(localStorage.getItem(salesStorageKey) || '[]');
        return Array.isArray(saved) ? saved.filter(sale =>
            sale && typeof sale.date === 'string' && !Number.isNaN(Date.parse(sale.date)) &&
            typeof sale.name === 'string' && typeof sale.sku === 'string' &&
            Number.isInteger(sale.quantity) && sale.quantity > 0 &&
            Number.isFinite(sale.unitPrice) && sale.unitPrice >= 0
        ) : [];
    } catch {
        return [];
    }
}

function saveSales() {
    try {
        localStorage.setItem(salesStorageKey, JSON.stringify(sales));
    } catch {
        alert('Unable to save sales history in this browser.');
    }
}

function populateSalesFilters() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    salesMonth.replaceChildren(...monthNames.map((name, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = name;
        return option;
    }));
    salesMonth.value = String(new Date().getMonth());
    updateSalesYears();
}

function updateSalesYears() {
    const selectedYear = salesYear.value || String(new Date().getFullYear());
    const years = new Set([new Date().getFullYear(), ...sales.map(sale => new Date(sale.date).getFullYear())]);
    salesYear.replaceChildren(...[...years].sort((a, b) => b - a).map(year => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        return option;
    }));
    salesYear.value = years.has(Number(selectedYear)) ? selectedYear : String(new Date().getFullYear());
}

function loadCurrency() {
    try {
        const savedCurrency = localStorage.getItem(currencyStorageKey);
        return supportedCurrencies.includes(savedCurrency) ? savedCurrency : 'USD';
    } catch {
        return 'USD';
    }
}

function showTime() {
    if (currentTime) currentTime.textContent = new Date().toLocaleString();
}

function formatPrice(price) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
}

function askToDelete(title, message, action) {
    pendingDelete = action;
    deleteDialogTitle.textContent = title;
    deleteDialogMessage.textContent = message;
    deleteDialog.showModal();
    document.getElementById('cancelDelete').focus();
}

function csvCell(value) {
    let text = String(value);
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(data, filename) {
    const csv = '\uFEFF' + data.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv() {
    const data = [
        ['Product', 'SKU', 'Quantity', `Unit price (${currency})`],
        ...items.map(item => [item.name, item.sku, item.quantity, Number(item.price).toFixed(2)])
    ];
    downloadCsv(data, 'inventory.csv');
}

function exportSalesCsv() {
    const data = [
        ['Date', 'Product', 'SKU', 'Quantity sold', `Unit price (${currency})`, `Total (${currency})`],
        ...sales.map(sale => [
            sale.date,
            sale.name,
            sale.sku,
            sale.quantity,
            Number(sale.unitPrice).toFixed(2),
            (sale.quantity * sale.unitPrice).toFixed(2)
        ])
    ];
    downloadCsv(data, 'sales.csv');
}

function addCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
}

function renderSales() {
    updateSalesYears();
    const mode = salesPeriod.value;
    salesMonth.hidden = mode !== 'month';
    salesYear.hidden = mode === 'all';
    const month = Number(salesMonth.value);
    const year = Number(salesYear.value);
    const shownSales = sales.filter(sale => {
        const date = new Date(sale.date);
        return mode === 'all' || (mode === 'year' && date.getFullYear() === year) ||
            (mode === 'month' && date.getFullYear() === year && date.getMonth() === month);
    }).sort((a, b) => b.date.localeCompare(a.date));

    const unitsSold = shownSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const revenue = shownSales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
    salesSummary.textContent = `${unitsSold} units sold · ${formatPrice(revenue)} revenue`;
    salesRows.replaceChildren();
    for (const sale of shownSales) {
        const row = document.createElement('tr');
        addCell(row, new Date(sale.date).toLocaleString());
        addCell(row, sale.name);
        addCell(row, sale.sku);
        addCell(row, sale.quantity);
        addCell(row, formatPrice(sale.unitPrice));
        addCell(row, formatPrice(sale.quantity * sale.unitPrice));
        const actions = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'danger';
        deleteButton.dataset.action = 'delete-sale';
        deleteButton.dataset.index = String(sales.indexOf(sale));
        deleteButton.textContent = 'Delete';
        deleteButton.setAttribute('aria-label', `Delete sale of ${sale.name}`);
        actions.appendChild(deleteButton);
        row.appendChild(actions);
        salesRows.appendChild(row);
    }
    salesEmptyMessage.hidden = shownSales.length > 0;
    salesEmptyMessage.textContent = sales.length === 0 ? 'No sales recorded yet.' : 'No sales for this period.';
}

function render() {
    const query = searchInput.value.trim().toLowerCase();
    const shownItems = items.filter(item =>
        item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
    );

    document.getElementById('productCount').textContent = items.length;
    document.getElementById('unitCount').textContent = items.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('lowStockCount').textContent = items.filter(item => item.quantity <= 5).length;
    rows.replaceChildren();

    for (const item of shownItems) {
        const row = document.createElement('tr');
        addCell(row, item.name);
        addCell(row, item.sku);

        const quantityCell = addCell(row, '');
        const badge = document.createElement('span');
        badge.className = item.quantity <= 5 ? 'stock low' : 'stock';
        badge.textContent = item.quantity;
        quantityCell.appendChild(badge);
        addCell(row, formatPrice(item.price));

        const actions = document.createElement('td');
        actions.className = 'actions';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'secondary';
        editButton.dataset.action = 'edit';
        editButton.dataset.id = item.id;
        editButton.textContent = 'Edit';
        const saleButton = document.createElement('button');
        saleButton.type = 'button';
        saleButton.className = 'primary';
        saleButton.style.width = 'auto';
        saleButton.style.marginTop = '0';
        saleButton.dataset.action = 'sale';
        saleButton.dataset.id = item.id;
        saleButton.textContent = 'Record sale';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'danger';
        deleteButton.dataset.action = 'delete';
        deleteButton.dataset.id = item.id;
        deleteButton.textContent = 'Delete';
        actions.append(saleButton, editButton, deleteButton);
        row.appendChild(actions);
        rows.appendChild(row);

        if (activeSaleId === item.id) {
            const saleRow = document.createElement('tr');
            const saleCell = document.createElement('td');
            saleCell.colSpan = 5;
            const saleForm = document.createElement('form');
            saleForm.dataset.saleId = item.id;
            saleForm.style.cssText = 'display:flex;align-items:end;gap:9px;flex-wrap:wrap;padding:8px 0';
            const quantityLabel = document.createElement('label');
            quantityLabel.htmlFor = `saleQuantity-${item.id}`;
            quantityLabel.textContent = `Quantity sold (1–${item.quantity})`;
            quantityLabel.style.margin = '0';
            const quantityInput = document.createElement('input');
            quantityInput.id = `saleQuantity-${item.id}`;
            quantityInput.name = 'quantity';
            quantityInput.type = 'number';
            quantityInput.min = '1';
            quantityInput.max = String(item.quantity);
            quantityInput.step = '1';
            quantityInput.required = true;
            quantityInput.value = '1';
            quantityInput.style.width = '130px';
            const recordButton = document.createElement('button');
            recordButton.type = 'submit';
            recordButton.className = 'primary';
            recordButton.style.cssText = 'width:auto;margin:0';
            recordButton.textContent = 'Save sale';
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'secondary';
            cancelButton.dataset.action = 'cancel-sale';
            cancelButton.dataset.id = item.id;
            cancelButton.textContent = 'Cancel';
            saleForm.append(quantityLabel, quantityInput, recordButton, cancelButton);
            saleCell.appendChild(saleForm);
            saleRow.appendChild(saleCell);
            rows.appendChild(saleRow);
        }
    }

    emptyMessage.hidden = shownItems.length > 0;
    emptyMessage.textContent = items.length === 0
        ? 'No products yet. Add one using the form.'
        : 'No products match your search.';
    renderSales();
}

function resetForm() {
    itemForm.reset();
    editingId = null;
    document.getElementById('formHeading').textContent = 'Add product';
    document.getElementById('submitButton').textContent = 'Add product';
    document.getElementById('cancelEdit').hidden = true;
}

itemForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!itemForm.reportValidity()) return;

    const name = itemForm.elements.name.value.trim();
    const sku = itemForm.elements.sku.value.trim();
    const quantity = Number(itemForm.elements.quantity.value);
    const price = Number(itemForm.elements.price.value);
    if (!name || !sku || !Number.isInteger(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) return;

    const duplicateSku = items.some(item => item.sku.toLowerCase() === sku.toLowerCase() && item.id !== editingId);
    if (duplicateSku) {
        alert('That SKU is already in use.');
        return;
    }

    if (editingId) {
        const item = items.find(entry => entry.id === editingId);
        if (item) Object.assign(item, { name, sku, quantity, price });
    } else {
        items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, sku, quantity, price });
    }

    saveItems();
    resetForm();
    render();
});

rows.addEventListener('submit', event => {
    const saleForm = event.target.closest('form[data-sale-id]');
    if (!saleForm) return;
    event.preventDefault();
    const item = items.find(entry => entry.id === saleForm.dataset.saleId);
    const quantity = Number(saleForm.elements.quantity.value);
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) return;

    item.quantity -= quantity;
    sales.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        quantity,
        unitPrice: Number(item.price),
        date: new Date().toISOString()
    });
    activeSaleId = null;
    saveItems();
    saveSales();
    render();
});

salesRows.addEventListener('click', event => {
    const button = event.target.closest('button[data-action="delete-sale"]');
    if (!button) return;

    const saleIndex = Number(button.dataset.index);
    const sale = sales[saleIndex];
    if (!sale) return;

    const item = items.find(entry => entry.id === sale.itemId);
    const stockMessage = item
        ? 'The sold quantity will be returned to stock.'
        : 'The product is no longer in inventory, so stock cannot be restored.';
    askToDelete('Delete this sale?', `Delete the sale for ${sale.name}? ${stockMessage}`, () => {
        if (item) {
            item.quantity += sale.quantity;
            saveItems();
        }
        sales.splice(saleIndex, 1);
        saveSales();
        render();
    });
});

rows.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = items.find(entry => entry.id === button.dataset.id);
    if (!item) return;

    if (button.dataset.action === 'sale') {
        if (item.quantity < 1) {
            alert('There is no stock available to sell.');
            return;
        }
        activeSaleId = activeSaleId === item.id ? null : item.id;
        render();
        if (activeSaleId) document.getElementById(`saleQuantity-${item.id}`)?.focus();
    } else if (button.dataset.action === 'cancel-sale') {
        activeSaleId = null;
        render();
    } else if (button.dataset.action === 'edit') {
        activeSaleId = null;
        editingId = item.id;
        itemForm.elements.name.value = item.name;
        itemForm.elements.sku.value = item.sku;
        itemForm.elements.quantity.value = item.quantity;
        itemForm.elements.price.value = item.price;
        document.getElementById('formHeading').textContent = 'Edit product';
        document.getElementById('submitButton').textContent = 'Save changes';
        document.getElementById('cancelEdit').hidden = false;
        document.getElementById('itemName').focus();
    } else if (button.dataset.action === 'delete') {
        askToDelete('Delete product?', `Are you sure you want to delete ${item.name}? This cannot be undone.`, () => {
            items = items.filter(entry => entry.id !== item.id);
            if (editingId === item.id) resetForm();
            saveItems();
            render();
        });
    }
});

searchInput.addEventListener('input', render);
document.getElementById('clearSearch').addEventListener('click', () => {
    searchInput.value = '';
    render();
});
currencySelect.addEventListener('change', () => {
    currency = currencySelect.value;
    try {
        localStorage.setItem(currencyStorageKey, currency);
    } catch {
        alert('Unable to save your currency preference in this browser.');
    }
    render();
});
document.getElementById('exportCsv').addEventListener('click', exportCsv);
document.getElementById('exportSalesCsv').addEventListener('click', exportSalesCsv);
salesPeriod.addEventListener('change', renderSales);
salesMonth.addEventListener('change', renderSales);
salesYear.addEventListener('change', renderSales);
document.getElementById('cancelEdit').addEventListener('click', resetForm);
document.getElementById('cancelDelete').addEventListener('click', () => deleteDialog.close());
document.getElementById('confirmDelete').addEventListener('click', () => {
    const action = pendingDelete;
    pendingDelete = null;
    deleteDialog.close();
    if (action) action();
});
deleteDialog.addEventListener('close', () => {
    pendingDelete = null;
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            // The app remains usable if service workers are unavailable.
        });
    });
}

showTime();
setInterval(showTime, 1000);
render();
