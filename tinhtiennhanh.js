const products = [
    { name: "Tô lớn", price: 55000, span: 3 },
    { name: "Tô nhỏ", price: 40000, span: 3 },
    { name: "Trà đá", price: 2000, span: 2 },
    { name: "Nước suối", price: 6000, span: 2 },
    { name: "Nước ngọt", price: 15000, span: 2 },
    { type: "label", name: "+Thịt", icon: "🥩", span: 2 },
    { name: "20k", key: "Thịt +20k", price: 20000, span: 1, compact: true },
    { name: "30k", key: "Thịt +30k", price: 30000, span: 1, compact: true },
    { name: "35k", key: "Thịt +35k", price: 35000, span: 1, compact: true },
    { name: "40k", key: "Thịt +40k", price: 40000, span: 1, compact: true },
    { name: "Mộc lớn", price: 40000, span: 3 },
    { name: "Mộc nhỏ", price: 35000, span: 3 },
    { type: "label", name: "Khác", icon: "#️⃣", optionCount: 4 },
    { name: "3k", key: "Khác 3k", price: 3000, span: 1, compact: true },
    { name: "5k", key: "Khác 5k", price: 5000, span: 1, compact: true },
    { name: "10k", key: "Khác 10k", price: 10000, span: 1, compact: true },
    { name: "20k", key: "Khác 20k", price: 20000, span: 1, compact: true }
];

const cashDenominations = [
    100000,
    10000,
    1000,
    200000,
    20000,
    2000,
    500000,
    50000,
    5000
];

const autoMilestoneMap = [
    [1, 2, 5],
    [2, 5],
    [3, 4, 5],
    [4, 5],
    [5, 6],
    [1, 6, 7],
    [2, 7],
    [3, 8, 9],
    [1, 4, 9],
    [1, 2]
];

const state = {
    orderTotal: 0,
    productCounts: new Map(),
    customerPaid: 0,
    cashHistory: [],
    calcMode: "auto"
};

const storageKey = "fastFoodCalculatorOrder";
const calcModeStorageKey = "fastFoodCalculatorMode";

const orderTotalEl = document.getElementById("orderTotal");
const productGridEl = document.getElementById("productGrid");
const autoGridEl = document.getElementById("autoGrid");
const orderSummaryEl = document.getElementById("orderSummary");
const calcViewportEl = document.getElementById("calcViewport");
const calcTrackEl = document.getElementById("calcTrack");
const cashGridEl = document.getElementById("cashGrid");
const customerPaidEl = document.getElementById("customerPaid");
const manualChangeEl = document.getElementById("manualChange");

function shortMoney(value) {
    return value >= 1000 ? `${value / 1000}k` : `${value}đ`;
}

function getProductKey(product) {
    return product.key || product.name;
}

function calculateOrderTotal() {
    return products.reduce((total, product) => {
        if (product.type === "label") return total;

        const productKey = getProductKey(product);
        const count = state.productCounts.get(productKey) || 0;
        return total + product.price * count;
    }, 0);
}

function saveOrder() {
    const counts = Object.fromEntries(state.productCounts);

    if (Object.keys(counts).length === 0) {
        localStorage.removeItem(storageKey);
        return;
    }

    localStorage.setItem(storageKey, JSON.stringify({ counts }));
}

function loadOrder() {
    const savedOrder = localStorage.getItem(storageKey);
    if (!savedOrder) return;

    try {
        const parsedOrder = JSON.parse(savedOrder);
        const counts = parsedOrder?.counts || {};

        Object.entries(counts).forEach(([productKey, count]) => {
            const normalizedCount = Number(count);
            if (Number.isInteger(normalizedCount) && normalizedCount > 0) {
                state.productCounts.set(productKey, normalizedCount);
            }
        });

        state.orderTotal = calculateOrderTotal();
    } catch {
        localStorage.removeItem(storageKey);
    }
}

function loadCalcMode() {
    const savedMode = localStorage.getItem(calcModeStorageKey);
    if (savedMode === "auto" || savedMode === "manual") {
        state.calcMode = savedMode;
    }
}

function renderTotals() {
    orderTotalEl.textContent = shortMoney(state.orderTotal);
    renderOrderSummary();
    renderAutoOptions();
    renderManualTotals();
}

function renderOrderSummary() {
    orderSummaryEl.innerHTML = "";

    products
        .filter((product) => product.type !== "label")
        .forEach((product) => {
            const productKey = getProductKey(product);
            const count = state.productCounts.get(productKey) || 0;
            if (count === 0) return;

            const item = document.createElement("div");
            item.className = "summary-item";
            item.textContent = `${count} ${productKey}`;
            orderSummaryEl.appendChild(item);
        });
}

function renderProducts() {
    productGridEl.innerHTML = "";

    const createProductTile = (product, index) => {
        const productKey = getProductKey(product);
        const count = state.productCounts.get(productKey) || 0;
        const tile = document.createElement("div");
        tile.className = `tile product-tile product-span-${product.span}${product.compact ? " is-compact" : ""}${count > 0 ? " is-added" : ""}`;
        tile.innerHTML = `
            <button class="product-add" type="button" data-action="add" data-index="${index}" aria-label="Cộng ${productKey}">
                <span class="tile-name">${product.name}${count > 0 ? `<span class="product-count">x${count}</span>` : ""}</span>
                ${product.compact ? "" : `<span class="tile-price">${shortMoney(product.price)}</span>`}
            </button>
            <button class="product-minus" type="button" data-action="minus" data-index="${index}" aria-label="Trừ ${productKey}" ${count === 0 ? "disabled" : ""}>-</button>
        `;
        return tile;
    };

    for (let index = 0; index < products.length; index += 1) {
        const product = products[index];

        if (product.type === "label") {
            const row = document.createElement("div");
            row.className = "option-row";

            const label = document.createElement("div");
            label.className = "tile product-label";
            label.innerHTML = `<span class="tile-name">${product.icon ? `<span class="label-icon">${product.icon}</span>` : product.name}</span>`;
            row.appendChild(label);

            const optionCount = product.optionCount || 4;
            products.slice(index + 1, index + optionCount + 1).forEach((optionProduct, offset) => {
                row.appendChild(createProductTile(optionProduct, index + offset + 1));
            });

            productGridEl.appendChild(row);
            index += optionCount;
            continue;
        }

        productGridEl.appendChild(createProductTile(product, index));
    }
}

function getAutoCashValues(total) {
    if (total <= 0) return [];

    const totalK = Math.ceil(total / 1000);
    const baseK = Math.floor(totalK / 500) * 500;
    const remainderK = totalK - baseK;
    const hundredDigit = Math.floor(remainderK / 100);
    const tenDigit = Math.floor((remainderK % 100) / 10);
    const hundredMarks = autoMilestoneMap[hundredDigit] || [];
    const tenMarks = autoMilestoneMap[tenDigit] || [];
    const valuesK = new Set();

    hundredMarks.forEach((hundredMark) => {
        valuesK.add(baseK + hundredMark * 100);
    });

    const tenHundredMarks = [...new Set([hundredDigit, ...hundredMarks])];
    tenHundredMarks.forEach((hundredMark) => {
        tenMarks.forEach((tenMark) => {
            valuesK.add(baseK + hundredMark * 100 + tenMark * 10);
        });
    });

    return [...valuesK]
        .filter((valueK) => valueK * 1000 >= total)
        .sort((a, b) => a - b)
        .slice(0, 16)
        .map((valueK) => valueK * 1000);
}

function renderAutoOptions() {
    autoGridEl.innerHTML = "";

    if (state.orderTotal <= 0) return;

    const values = getAutoCashValues(state.orderTotal);
    const groups = [...new Set(values.map((value) => Math.floor(value / 100000)))].sort((a, b) => a - b);
    const groupColumns = new Map(groups.map((group, index) => [group, index + 1]));
    const columnCounts = new Map();

    values.forEach((value) => {
        const returnValue = value - state.orderTotal;
        const groupIndex = Math.floor(value / 100000);
        const columnIndex = groupColumns.get(groupIndex);
        const rowIndex = (columnCounts.get(columnIndex) || 0) + 1;

        if (!columnIndex || columnIndex > 4 || rowIndex > 4) return;

        columnCounts.set(columnIndex, rowIndex);

        const option = document.createElement("div");
        option.className = "tile auto-option";
        option.style.gridColumn = columnIndex;
        option.style.gridRow = rowIndex;
        option.innerHTML = `
            <span class="auto-pair">
                <strong class="auto-value">${shortMoney(value)}</strong>
            </span>
            <span class="auto-pair">
                <strong class="auto-value auto-return">${shortMoney(Math.abs(returnValue))}</strong>
            </span>
        `;
        autoGridEl.appendChild(option);
    });
}

function renderManualTotals() {
    customerPaidEl.textContent = shortMoney(state.customerPaid);

    if (state.customerPaid < state.orderTotal) {
        manualChangeEl.textContent = "Thiếu";
        return;
    }

    manualChangeEl.textContent = shortMoney(state.customerPaid - state.orderTotal);
}

function renderCashGrid() {
    cashGridEl.innerHTML = "";

    const actions = document.createElement("div");
    actions.className = "cash-actions";

    const denominations = document.createElement("div");
    denominations.className = "cash-denominations";

    const createButton = (buttonData) => {
        const button = document.createElement("button");
        button.className = `cash-button${buttonData.group ? ` cash-group-${buttonData.group}` : ""}${buttonData.type === "clear" ? " is-danger" : ""}${buttonData.type === "undo" ? " is-undo" : ""}`;
        button.type = "button";
        button.dataset.action = buttonData.type;
        button.textContent = buttonData.label;

        if (buttonData.value) {
            button.dataset.value = buttonData.value;
        }

        return button;
    };

    [
        { type: "undo", label: "↩️" },
        { type: "clear", label: "🗑️" }
    ].forEach((buttonData) => {
        actions.appendChild(createButton(buttonData));
    });

    cashDenominations.forEach((value, index) => {
        const group = ["high", "mid", "low"][index % 3];
        denominations.appendChild(createButton({ type: "cash", value, group, label: shortMoney(value) }));
    });

    cashGridEl.append(actions, denominations);
}

function setCalcMode(mode) {
    state.calcMode = mode;
    calcTrackEl.classList.toggle("is-manual", mode === "manual");
    localStorage.setItem(calcModeStorageKey, mode);
}

function handleSwipe(startX, endX) {
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 38) return;

    if (deltaX < 0) {
        setCalcMode("manual");
    } else {
        setCalcMode("auto");
    }
}

productGridEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-index]");
    if (!button) return;

    const product = products[Number(button.dataset.index)];
    if (!product || product.type === "label") return;

    const productKey = getProductKey(product);
    const currentCount = state.productCounts.get(productKey) || 0;

    if (button.dataset.action === "minus") {
        if (currentCount === 0) return;
        const nextCount = currentCount - 1;
        if (nextCount === 0) {
            state.productCounts.delete(productKey);
        } else {
            state.productCounts.set(productKey, nextCount);
        }
        state.orderTotal = Math.max(0, state.orderTotal - product.price);
    } else {
        state.productCounts.set(productKey, currentCount + 1);
        state.orderTotal += product.price;
    }

    renderProducts();
    renderTotals();
    saveOrder();
});

cashGridEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "cash") {
        const value = Number(button.dataset.value);
        state.customerPaid += value;
        state.cashHistory.push(value);
    }

    if (button.dataset.action === "undo") {
        const lastValue = state.cashHistory.pop();
        if (lastValue) state.customerPaid = Math.max(0, state.customerPaid - lastValue);
    }

    if (button.dataset.action === "clear") {
        state.customerPaid = 0;
        state.cashHistory = [];
    }

    renderManualTotals();
});

document.getElementById("clearAll").addEventListener("click", () => {
    state.orderTotal = 0;
    state.productCounts.clear();
    state.customerPaid = 0;
    state.cashHistory = [];
    localStorage.removeItem(storageKey);
    renderProducts();
    renderTotals();
});

let swipeStartX = 0;

calcViewportEl.addEventListener("touchstart", (event) => {
    swipeStartX = event.changedTouches[0].clientX;
}, { passive: true });

calcViewportEl.addEventListener("touchend", (event) => {
    handleSwipe(swipeStartX, event.changedTouches[0].clientX);
}, { passive: true });

calcViewportEl.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    swipeStartX = event.clientX;
});

calcViewportEl.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") return;
    handleSwipe(swipeStartX, event.clientX);
});

loadOrder();
loadCalcMode();
renderCashGrid();
renderProducts();
renderTotals();
setCalcMode(state.calcMode);
