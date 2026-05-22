(function () {
    const configKeys = {
        firebaseConfig: "fastFoodFirebaseConfig",
        nodePath: "fastFoodFirebaseNodePath"
    };

    // Pre-filled fallback default using the config you shared
    const defaultFirebaseConfig = {
        apiKey: "AIzaSyAqhQosLuAYZ5UHyvtyhWD-Z-gqz9hmRBE",
        authDomain: "appstinhtiennhanh.firebaseapp.com",
        projectId: "appstinhtiennhanh",
        storageBucket: "appstinhtiennhanh.firebasestorage.app",
        messagingSenderId: "254951485113",
        appId: "1:254951485113:web:1ea6511548ff3938c13568",
        measurementId: "G-066SNSCHC3",
        databaseURL: "https://appstinhtiennhanh-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    let firebaseApp = null;
    let dbRef = null;
    let debounceTimeout = null;
    let isWriting = false;
    let writePending = false;
    let idleCheckInterval = null;
    let lastInteractionTime = 0;
    let localDataPendingUpdate = null;

    // Elements
    let settingsBtn, configInput, pathInput, statusDot, statusText, saveBtn, menuStatusDot;

    function getFirebaseConfigStr() {
        return localStorage.getItem(configKeys.firebaseConfig) || "";
    }

    function saveFirebaseConfig(configStr, nodePath) {
        localStorage.setItem(configKeys.firebaseConfig, configStr.trim());
        localStorage.setItem(configKeys.nodePath, nodePath.trim() || "shopData");
    }

    function parseFirebaseConfig(inputStr) {
        if (!inputStr) return null;
        try {
            return JSON.parse(inputStr);
        } catch (e) {
            const config = {};
            const keys = ["apiKey", "authDomain", "databaseURL", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"];
            
            let matchedAny = false;
            keys.forEach(key => {
                const regex = new RegExp(`[\\s"']${key}[\\s"']?:\\s*["']([^"']+)["']`);
                const match = inputStr.match(regex);
                if (match && match[1]) {
                    config[key] = match[1];
                    matchedAny = true;
                }
            });
            
            if (matchedAny && config.apiKey && config.projectId) {
                return config;
            }
            return null;
        }
    }

    function updateStatusUI(type, text) {
        if (statusDot) {
            statusDot.className = "status-dot " + type;
        }
        if (menuStatusDot) {
            menuStatusDot.className = "status-dot menu-status-dot " + type;
        }
        if (statusText) {
            statusText.textContent = text;
        }
    }

    function getLocalDataState() {
        const state = {
            orders: {},
            paid: {},
            history: [],
            calcMode: "auto"
        };
        const tableIds = ["11", "10", "9", "8", "7", "4", "3", "2", "1", "0"];
        tableIds.forEach(id => {
            const orderKey = `fastFoodCalculatorOrder:${id}`;
            const paidKey = `fastFoodCalculatorPaid:${id}`;
            const orderVal = localStorage.getItem(orderKey);
            const paidVal = localStorage.getItem(paidKey);
            if (orderVal) {
                try {
                    state.orders[id] = JSON.parse(orderVal);
                } catch(e) {}
            }
            if (paidVal) {
                state.paid[id] = paidVal;
            }
        });

        const historyVal = localStorage.getItem("fastFoodCalculatorHistory");
        if (historyVal) {
            try {
                state.history = JSON.parse(historyVal);
            } catch(e) {}
        }

        const modeVal = localStorage.getItem("fastFoodCalculatorMode");
        if (modeVal) {
            state.calcMode = modeVal;
        }
        return state;
    }

    function setLocalDataState(state) {
        if (!state) return;
        const tableIds = ["11", "10", "9", "8", "7", "4", "3", "2", "1", "0"];
        tableIds.forEach(id => {
            localStorage.removeItem(`fastFoodCalculatorOrder:${id}`);
            localStorage.removeItem(`fastFoodCalculatorPaid:${id}`);
        });

        if (state.orders) {
            Object.entries(state.orders).forEach(([id, val]) => {
                localStorage.setItem(`fastFoodCalculatorOrder:${id}`, JSON.stringify(val));
            });
        }
        if (state.paid) {
            Object.entries(state.paid).forEach(([id, val]) => {
                localStorage.setItem(`fastFoodCalculatorPaid:${id}`, val);
            });
        }
        if (state.history) {
            localStorage.setItem("fastFoodCalculatorHistory", JSON.stringify(state.history));
        } else {
            localStorage.removeItem("fastFoodCalculatorHistory");
        }
        if (state.calcMode) {
            localStorage.setItem("fastFoodCalculatorMode", state.calcMode);
        }
    }

    function refreshAllViews() {
        if (typeof window.renderTables === "function") {
            window.renderTables();
        }
        if (window.TinhTienHistory) {
            if (typeof window.TinhTienHistory.renderHistory === "function") {
                window.TinhTienHistory.renderHistory();
            }
        }
        if (window.TinhTienStats) {
            if (typeof window.TinhTienStats.renderStats === "function") {
                window.TinhTienStats.renderStats();
            }
        }
        // Force update of order view totals if it is currently displayed
        if (typeof window.TinhTienOrder === "object" && typeof window.TinhTienOrder.initOrder === "function") {
            // Re-read storage for active table if open
            const activeTable = window.TinhTienOrder.getActiveTable ? window.TinhTienOrder.getActiveTable() : null;
            if (activeTable) {
                window.TinhTienOrder.setActiveTable(activeTable);
            }
        }
    }

    function applyFirebaseData(data) {
        localDataPendingUpdate = null;
        const localData = getLocalDataState();
        
        // Compare states to avoid unnecessary redraws
        if (JSON.stringify(localData) === JSON.stringify(data)) {
            updateStatusUI("synced", "Đồng bộ thành công!");
            return;
        }
        
        setLocalDataState(data);
        updateStatusUI("synced", "Đồng bộ thành công!");
        refreshAllViews();
    }

    function handleFirebaseUpdate(snapshot) {
        const data = snapshot.val();
        if (!data) {
            // Database is empty, push local state to initialize it
            updateStatusUI("synced", "Đã kết nối (Firebase trống)");
            const localData = getLocalDataState();
            if (localData && (Object.keys(localData.orders || {}).length > 0 || (localData.history && localData.history.length > 0))) {
                pushToFirebase();
            }
            return;
        }

        if (debounceTimeout || isWriting) {
            return;
        }

        // Delay updating if user is ordering or actively interacting
        if (isOrderViewActive() || (Date.now() - lastInteractionTime < 8000)) {
            localDataPendingUpdate = data;
            updateStatusUI("synced", "Đồng bộ sẵn sàng (Chờ rảnh)");
            return;
        }

        applyFirebaseData(data);
    }

    async function initFirebase() {
        if (dbRef) {
            dbRef.off();
            dbRef = null;
        }

        let configStr = getFirebaseConfigStr();
        const nodePath = localStorage.getItem(configKeys.nodePath) || "shopData";

        let config = null;
        if (configStr) {
            config = parseFirebaseConfig(configStr);
        } else {
            // Use defaults if first load
            config = defaultFirebaseConfig;
            configStr = JSON.stringify(defaultFirebaseConfig, null, 2);
            localStorage.setItem(configKeys.firebaseConfig, configStr);
        }

        if (configInput && !configInput.value) {
            configInput.value = configStr;
        }

        if (!config || !config.apiKey || !config.projectId) {
            updateStatusUI("", "Chưa cấu hình đồng bộ Firebase");
            return;
        }

        // Default to Singapore database region if databaseURL is missing
        if (!config.databaseURL) {
            config.databaseURL = `https://${config.projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
        }

        try {
            if (typeof firebase === "undefined") {
                throw new Error("Không thể tải thư viện Firebase. Kiểm tra kết nối mạng.");
            }
            
            if (firebase.apps.length === 0) {
                firebaseApp = firebase.initializeApp(config);
            } else {
                firebaseApp = firebase.app();
            }

            updateStatusUI("syncing", "Đang kết nối Firebase...");
            dbRef = firebase.database().ref(nodePath);
            dbRef.on("value", handleFirebaseUpdate, (error) => {
                console.error("Firebase connection error:", error);
                updateStatusUI("error", `Lỗi kết nối: ${error.message}`);
            });
        } catch (e) {
            console.error("Firebase initialization failed:", e);
            updateStatusUI("error", `Lỗi khởi tạo: ${e.message}`);
        }
    }

    async function pullFromFirebase() {
        if (!dbRef) return getLocalDataState();
        try {
            const snapshot = await dbRef.once("value");
            const data = snapshot.val();
            if (data) {
                applyFirebaseData(data);
                return data;
            }
        } catch (e) {
            console.error("Firebase manual pull failed:", e);
        }
        return getLocalDataState();
    }

    async function pushToFirebase() {
        if (!dbRef) return;
        if (isWriting) {
            writePending = true;
            return;
        }
        isWriting = true;
        writePending = false;

        updateStatusUI("syncing", "Đang tự động lưu...");
        const localData = getLocalDataState();
        try {
            await dbRef.set(localData);
            updateStatusUI("synced", "Đã lưu lên đám mây!");
        } catch (e) {
            console.error("Firebase push failed:", e);
            updateStatusUI("error", `Lỗi lưu dữ liệu: ${e.message}`);
        } finally {
            isWriting = false;
            if (writePending) {
                pushToFirebase();
            }
        }
    }

    async function flushPendingPush() {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
            debounceTimeout = null;
            await pushToFirebase();
        }
    }

    function isOrderViewActive() {
        const orderView = document.getElementById("orderView");
        return orderView && !orderView.classList.contains("is-hidden");
    }

    function recordInteraction() {
        lastInteractionTime = Date.now();
    }

    function startIdleCheck() {
        stopIdleCheck();
        idleCheckInterval = setInterval(() => {
            // Apply pending update if user is idle and not on order screen
            if (localDataPendingUpdate && !isOrderViewActive() && (Date.now() - lastInteractionTime >= 8000)) {
                applyFirebaseData(localDataPendingUpdate);
            }
        }, 2000);
    }

    function stopIdleCheck() {
        if (idleCheckInterval) {
            clearInterval(idleCheckInterval);
            idleCheckInterval = null;
        }
    }

    function syncToCloud() {
        updateStatusUI("syncing", "Có thay đổi mới, chuẩn bị lưu...");
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            debounceTimeout = null;
            pushToFirebase();
        }, 1500);
    }

    function initUI() {
        settingsBtn = document.getElementById("settingsBtn");
        configInput = document.getElementById("fbConfig");
        pathInput = document.getElementById("fbPath");
        statusDot = document.querySelector(".settings-status .status-dot");
        statusText = document.querySelector(".status-text");
        menuStatusDot = document.querySelector(".menu-status-dot");
        saveBtn = document.getElementById("settingsSaveBtn");

        // Load config into inputs
        const configStr = getFirebaseConfigStr();
        if (configInput) {
            configInput.value = configStr || JSON.stringify(defaultFirebaseConfig, null, 2);
        }
        if (pathInput) {
            pathInput.value = localStorage.getItem(configKeys.nodePath) || "shopData";
        }

        if (settingsBtn) {
            settingsBtn.addEventListener("click", () => {
                if (typeof window.showView === "function") {
                    window.showView("settingsView");
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                const configVal = configInput.value;
                const pathVal = pathInput.value;
                
                const parsed = parseFirebaseConfig(configVal);
                if (!parsed) {
                    alert("Cấu hình Firebase không hợp lệ! Vui lòng kiểm tra lại định dạng.");
                    return;
                }

                saveFirebaseConfig(configVal, pathVal);
                updateStatusUI("syncing", "Đang kết nối lại Firebase...");
                await initFirebase();
                alert("Đã lưu cấu hình Firebase thành công!");
            });
        }
    }

    // Export interface under TinhTienGitHub to maintain backwards compatibility with existing order/table scripts
    window.TinhTienGitHub = {
        syncToCloud,
        pullFromGitHub: pullFromFirebase,
        startPolling: startIdleCheck,
        stopPolling: stopIdleCheck
    };

    function init() {
        initUI();
        initFirebase().then(() => {
            if (document.visibilityState === "visible") {
                startIdleCheck();
            }
        });

        document.addEventListener("pointerdown", recordInteraction, { passive: true });
        document.addEventListener("keydown", recordInteraction, { passive: true });
        document.addEventListener("scroll", recordInteraction, { capture: true, passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            stopIdleCheck();
            flushPendingPush();
        } else if (document.visibilityState === "visible") {
            if (!debounceTimeout && !isWriting && !isOrderViewActive()) {
                pullFromFirebase().then(() => {
                    startIdleCheck();
                });
            } else {
                startIdleCheck();
            }
        }
    });

    window.addEventListener("pagehide", () => {
        stopIdleCheck();
        flushPendingPush();
    });

    window.addEventListener("beforeunload", (event) => {
        if (debounceTimeout !== null || isWriting) {
            event.preventDefault();
            event.returnValue = "Dữ liệu đang được đồng bộ lên đám mây. Bạn có chắc chắn muốn rời đi?";
            return event.returnValue;
        }
    });
})();
