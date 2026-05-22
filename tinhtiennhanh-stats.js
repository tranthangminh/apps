(function () {
    const statsContentEl = document.getElementById("statsContent");
    const statsBtn = document.getElementById("statsBtn");

    function renderStats() {
        if (!statsContentEl) return;
        statsContentEl.innerHTML = "";
        
        if (!window.TinhTienOrder || typeof window.TinhTienOrder.getHistory !== "function") return;
        const history = window.TinhTienOrder.getHistory();
        
        const totalRevenue = history.reduce((sum, item) => sum + item.total, 0);
        const totalBills = history.length;
        const avgValue = totalBills > 0 ? totalRevenue / totalBills : 0;

        statsContentEl.innerHTML = `
            <div class="stats-card revenue">
                <span class="stats-card-label">Tổng doanh thu</span>
                <strong class="stats-card-value">${window.TinhTienOrder.shortMoney(totalRevenue)}</strong>
            </div>
            <div class="stats-card bills">
                <span class="stats-card-label">Tổng hóa đơn</span>
                <strong class="stats-card-value">${totalBills}</strong>
            </div>
            <div class="stats-card average">
                <span class="stats-card-label">Trung bình/Hóa đơn</span>
                <strong class="stats-card-value">${window.TinhTienOrder.shortMoney(Math.round(avgValue))}</strong>
            </div>
        `;
    }

    if (statsBtn) {
        statsBtn.addEventListener("click", () => {
            if (typeof window.showView === "function") {
                window.showView("statsView");
                renderStats();
            }
        });
    }

    window.TinhTienStats = {
        renderStats
    };
})();
