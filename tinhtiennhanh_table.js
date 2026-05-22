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

function showView(viewId) {
    const restrictedViews = ["historyView", "statsView", "settingsView"];
    if (restrictedViews.includes(viewId)) {
        if (!window.TinhTienAuth || !window.TinhTienAuth.isUnlocked()) {
            if (window.TinhTienAuth && window.TinhTienAuth.promptPassword) {
                window.TinhTienAuth.promptPassword(
                    () => {
                        showView(viewId);
                        if (viewId === "historyView" && window.TinhTienHistory) {
                            window.TinhTienHistory.renderHistory();
                        } else if (viewId === "statsView" && window.TinhTienStats) {
                            window.TinhTienStats.renderStats();
                        }
                    },
                    () => {
                        showTableView();
                    }
                );
            } else {
                showTableView();
            }
            return;
        }
    }

    const views = ["tableView", "orderView", "historyView", "statsView", "settingsView"];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle("is-hidden", id !== viewId);
        }
    });

    const menuBtns = {
        tableView: "tablesBtn",
        historyView: "historyBtn",
        statsView: "statsBtn",
        settingsView: "settingsBtn"
    };
    Object.entries(menuBtns).forEach(([vId, btnId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.toggle("is-active", vId === viewId);
        }
    });
}

function showTableView() {
    renderTables();
    showView("tableView");
}

function showOrderView(tableId) {
    window.TinhTienOrder.setActiveTable(tableId);
    tableBackEl.textContent = `⤶ ${tableId}`;
    showView("orderView");
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

// Swipe right (left → right) on order view to go back to table view
(function () {
    let startX = 0;
    let startY = 0;

    orderViewEl.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    orderViewEl.addEventListener("touchend", (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        // Vuốt phải >= 60px, và vuốt dọc < 60px để tránh nhầm lẫn
        if (dx > 60 && Math.abs(dy) < 60) {
            window.TinhTienOrder.saveCurrentOrder();
            showTableView();
        }
    }, { passive: true });
})();

const tablesBtn = document.getElementById("tablesBtn");
if (tablesBtn) {
    tablesBtn.addEventListener("click", showTableView);
}

const orderPayBtn = document.getElementById("orderPayBtn");
const orderFinishBtn = document.getElementById("orderFinishBtn");

if (orderPayBtn) {
    orderPayBtn.addEventListener("click", () => {
        const activeTable = window.TinhTienOrder.getActiveTable ? window.TinhTienOrder.getActiveTable() : null;
        if (activeTable) {
            window.TinhTienOrder.markTablePaid(activeTable);
            showTableView();
        }
    });
}

if (orderFinishBtn) {
    orderFinishBtn.addEventListener("click", () => {
        const activeTable = window.TinhTienOrder.getActiveTable ? window.TinhTienOrder.getActiveTable() : null;
        if (activeTable) {
            window.TinhTienOrder.clearTableOrder(activeTable);
            showTableView();
        }
    });
}

window.TinhTienOrder.initOrder();
window.renderTables = renderTables;
window.showView = showView;
showTableView();
