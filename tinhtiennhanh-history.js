(function () {
    const historyViewEl = document.getElementById("historyView");
    const historyListEl = document.getElementById("historyList");
    const historyBtn = document.getElementById("historyBtn");
    const historyClearBtn = document.getElementById("historyClear");

    function renderHistory() {
        if (!historyListEl) return;
        historyListEl.innerHTML = "";
        const history = window.TinhTienOrder.getHistory();
        
        if (history.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "history-empty";
            emptyEl.textContent = "Chưa có giao dịch nào";
            historyListEl.appendChild(emptyEl);
            if (historyClearBtn) {
                historyClearBtn.classList.remove("is-expanded");
                historyClearBtn.style.display = "none";
            }
            if (historyViewEl) {
                historyViewEl.classList.remove("delete-mode-active");
            }
            return;
        } else {
            if (historyClearBtn) {
                historyClearBtn.style.display = "";
            }
        }

        history.forEach((item) => {
            const card = document.createElement("div");
            card.className = "history-card";
            card.innerHTML = `
                <div class="history-card-left">
                    <div class="history-table-badge">${item.tableId}</div>
                    <div class="history-info-col">
                        <div class="history-total">${window.TinhTienOrder.shortMoney(item.total)}</div>
                        <div class="history-datetime">
                            <span class="history-time">${item.time}</span>
                            <span class="history-date">${item.date}</span>
                        </div>
                    </div>
                </div>
                <div class="history-card-middle">
                    <div class="history-summary" title="${item.summary || ""}">${item.summary || ""}</div>
                </div>
                <div class="history-card-right">
                    <button class="history-card-delete" data-id="${item.id}" aria-label="Xóa giao dịch">🗑️</button>
                </div>
            `;
            historyListEl.appendChild(card);
        });
    }

    function showHistoryView() {
        if (typeof window.showView === "function") {
            window.showView("historyView");
            renderHistory();
        }
    }

    if (historyBtn) {
        historyBtn.addEventListener("click", showHistoryView);
    }

    if (historyClearBtn) {
        historyClearBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            
            if (!historyClearBtn.classList.contains("is-expanded")) {
                historyClearBtn.classList.add("is-expanded");
                historyViewEl.classList.add("delete-mode-active");
            } else {
                const confirmed = confirm("Bạn có chắc muốn xóa toàn bộ lịch sử giao dịch?");
                if (confirmed) {
                    window.TinhTienOrder.clearHistory();
                    historyClearBtn.classList.remove("is-expanded");
                    historyViewEl.classList.remove("delete-mode-active");
                    renderHistory();
                }
            }
        });
    }

    document.addEventListener("click", (event) => {
        if (historyClearBtn && !historyClearBtn.contains(event.target)) {
            if (event.target.closest(".history-card-delete")) {
                return;
            }
            historyClearBtn.classList.remove("is-expanded");
            historyViewEl.classList.remove("delete-mode-active");
        }
    });

    if (historyListEl) {
        historyListEl.addEventListener("click", (event) => {
            const deleteBtn = event.target.closest(".history-card-delete");
            if (!deleteBtn) return;

            const id = Number(deleteBtn.dataset.id);
            window.TinhTienOrder.deleteHistoryItem(id);
            renderHistory();
        });
    }

    window.TinhTienHistory = {
        renderHistory
    };
})();
