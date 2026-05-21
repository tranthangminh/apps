const tableViewEl = document.getElementById("tableView");
const orderViewEl = document.getElementById("orderView");
const tableBackEl = document.getElementById("tableBack");

function renderTableButton(button) {
    const tableId = button.dataset.table;
    const snapshot = window.TinhTienOrder.getTableSnapshot(tableId);
    const summaryText = snapshot.items
        .map((item) => `${item.count} ${item.name}`)
        .join("<br>");

    button.classList.toggle("is-active-order", snapshot.hasOrder && !snapshot.isPaid);
    button.classList.toggle("is-paid-order", snapshot.isPaid);
    button.innerHTML = `
        <div class="table-left-info">
            <span class="table-name">${tableId}</span>
            <span class="table-total">${snapshot.hasOrder ? window.TinhTienOrder.shortMoney(snapshot.total) : ""}</span>
        </div>
        <div class="table-summary-col">
            <span class="table-summary">${summaryText}</span>
        </div>
        <div class="table-actions">
            <button class="table-action table-pay" type="button" data-pay="${tableId}" ${snapshot.hasOrder && !snapshot.isPaid ? "" : "disabled"}>
                <span class="action-icon">💳</span>
                <span>Trả</span>
            </button>
            <button class="table-action table-finish" type="button" data-finish="${tableId}" ${snapshot.hasOrder ? "" : "disabled"}>
                <span class="action-icon">✅</span>
                <span>Xong</span>
            </button>
        </div>
    `;
}

function renderTables() {
    tableViewEl.querySelectorAll("[data-table]").forEach(renderTableButton);
}

function showTableView() {
    renderTables();
    orderViewEl.classList.add("is-hidden");
    tableViewEl.classList.remove("is-hidden");
}

function showOrderView(tableId) {
    window.TinhTienOrder.setActiveTable(tableId);
    tableBackEl.textContent = `Bàn ${tableId}`;
    tableViewEl.classList.add("is-hidden");
    orderViewEl.classList.remove("is-hidden");
}

tableViewEl.addEventListener("click", (event) => {
    const payButton = event.target.closest("button[data-pay]");
    if (payButton) {
        window.TinhTienOrder.markTablePaid(payButton.dataset.pay);
        renderTables();
        return;
    }

    const finishButton = event.target.closest("button[data-finish]");
    if (finishButton) {
        window.TinhTienOrder.clearTableOrder(finishButton.dataset.finish);
        renderTables();
        return;
    }

    const tableButton = event.target.closest("[data-table]");
    if (!tableButton) return;
    showOrderView(tableButton.dataset.table);
});

tableViewEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("button[data-pay], button[data-finish]")) return;

    const tableButton = event.target.closest("[data-table]");
    if (!tableButton) return;

    event.preventDefault();
    showOrderView(tableButton.dataset.table);
});

tableBackEl.addEventListener("click", () => {
    window.TinhTienOrder.saveCurrentOrder();
    showTableView();
});

window.TinhTienOrder.initOrder();
showTableView();
