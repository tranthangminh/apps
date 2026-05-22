(function () {
    const configKeys = {
        token: "fastFoodGitHubToken",
        repo: "fastFoodGitHubRepo",
        branch: "fastFoodGitHubBranch",
        path: "fastFoodGitHubPath"
    };

    let fileSha = null;
    let debounceTimeout = null;

    // Elements
    let settingsBtn, tokenInput, repoInput, branchInput, pathInput, statusDot, statusText, saveBtn;

    function getGitHubConfig() {
        return {
            token: localStorage.getItem(configKeys.token) || "",
            repo: localStorage.getItem(configKeys.repo) || "tranthangminh/apps",
            branch: localStorage.getItem(configKeys.branch) || "main",
            path: localStorage.getItem(configKeys.path) || "tinhtiennhanh/data.json"
        };
    }

    function saveGitHubConfig(token, repo, branch, path) {
        localStorage.setItem(configKeys.token, token.trim());
        localStorage.setItem(configKeys.repo, repo.trim());
        localStorage.setItem(configKeys.branch, branch.trim() || "main");
        localStorage.setItem(configKeys.path, path.trim() || "data.json");
    }

    function decodeBase64Utf8(str) {
        return decodeURIComponent(
            atob(str)
                .split("")
                .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
    }

    function encodeBase64Utf8(str) {
        return btoa(
            encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
                String.fromCharCode(parseInt(p1, 16))
            )
        );
    }

    function updateStatusUI(type, text) {
        if (!statusDot || !statusText) return;
        statusDot.className = "status-dot " + type;
        statusText.textContent = text;
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

    async function pullFromGitHub() {
        const config = getGitHubConfig();
        if (!config.token || !config.repo) {
            updateStatusUI("", "Chưa cấu hình đồng bộ GitHub");
            return null;
        }

        updateStatusUI("syncing", "Đang đồng bộ dữ liệu...");

        const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}?ref=${config.branch}`;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${config.token}`,
                    "Accept": "application/vnd.github+json"
                }
            });

            if (response.status === 404) {
                updateStatusUI("synced", "Đã kết nối (GitHub trống)");
                return null;
            }

            if (!response.ok) {
                throw new Error(`Mã lỗi HTTP: ${response.status}`);
            }

            const fileInfo = await response.json();
            fileSha = fileInfo.sha;

            const base64Content = fileInfo.content.replace(/\s/g, '');
            const jsonString = decodeBase64Utf8(base64Content);
            const data = JSON.parse(jsonString);

            setLocalDataState(data);
            updateStatusUI("synced", "Đồng bộ thành công!");
            refreshAllViews();
            return data;
        } catch (error) {
            console.error("Failed to pull from GitHub:", error);
            updateStatusUI("error", `Lỗi đồng bộ: ${error.message}`);
            return null;
        }
    }

    async function pushToGitHub() {
        const config = getGitHubConfig();
        if (!config.token || !config.repo) return;

        updateStatusUI("syncing", "Đang tự động lưu...");

        try {
            // Fetch latest SHA to prevent conflicts
            const getUrl = `https://api.github.com/repos/${config.repo}/contents/${config.path}?ref=${config.branch}`;
            const getResponse = await fetch(getUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${config.token}`,
                    "Accept": "application/vnd.github+json"
                }
            });

            if (getResponse.ok) {
                const fileInfo = await getResponse.json();
                fileSha = fileInfo.sha;
            }

            const localData = getLocalDataState();
            const jsonString = JSON.stringify(localData, null, 2);
            const base64Content = encodeBase64Utf8(jsonString);

            const payload = {
                message: "Tự động lưu dữ liệu TinhTienNhanh",
                content: base64Content,
                branch: config.branch
            };

            if (fileSha) {
                payload.sha = fileSha;
            }

            const putUrl = `https://api.github.com/repos/${config.repo}/contents/${config.path}`;
            const putResponse = await fetch(putUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${config.token}`,
                    "Content-Type": "application/json",
                    "Accept": "application/vnd.github+json"
                },
                body: JSON.stringify(payload)
            });

            if (!putResponse.ok) {
                throw new Error(`Mã lỗi HTTP: ${putResponse.status}`);
            }

            const putResult = await putResponse.json();
            fileSha = putResult.content.sha;

            updateStatusUI("synced", "Đã lưu lên đám mây!");
        } catch (error) {
            console.error("Failed to push to GitHub:", error);
            updateStatusUI("error", `Lỗi lưu dữ liệu: ${error.message}`);
        }
    }

    function syncToCloud() {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            pushToGitHub();
        }, 1500); // 1.5s debounce for snappiness
    }

    function initUI() {
        settingsBtn = document.getElementById("settingsBtn");
        tokenInput = document.getElementById("ghToken");
        repoInput = document.getElementById("ghRepo");
        branchInput = document.getElementById("ghBranch");
        pathInput = document.getElementById("ghPath");
        statusDot = document.querySelector(".status-dot");
        statusText = document.querySelector(".status-text");
        saveBtn = document.getElementById("settingsSaveBtn");

        // Load config into inputs
        const config = getGitHubConfig();
        if (tokenInput) tokenInput.value = config.token;
        if (repoInput) repoInput.value = config.repo;
        if (branchInput) branchInput.value = config.branch;
        if (pathInput) pathInput.value = config.path;

        // Toggle Active Tab Settings View
        if (settingsBtn) {
            settingsBtn.addEventListener("click", () => {
                if (typeof window.showView === "function") {
                    window.showView("settingsView");
                }
            });
        }

        // Save action
        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                saveGitHubConfig(
                    tokenInput.value,
                    repoInput.value,
                    branchInput.value,
                    pathInput.value
                );
                updateStatusUI("syncing", "Đang kiểm tra kết nối...");
                const data = await pullFromGitHub();
                if (data) {
                    alert("Kết nối & Đồng bộ dữ liệu thành công!");
                } else {
                    // If cloud was empty, let's push local data up to populate it
                    const config = getGitHubConfig();
                    if (config.token && config.repo) {
                        await pushToGitHub();
                        alert("Kết nối thành công! Đã tạo tệp dữ liệu mới trên GitHub.");
                    } else {
                        alert("Cấu hình trống hoặc lỗi kết nối. Vui lòng kiểm tra lại token/repo.");
                    }
                }
            });
        }
    }

    // Export interface
    window.TinhTienGitHub = {
        syncToCloud,
        pullFromGitHub
    };

    document.addEventListener("DOMContentLoaded", () => {
        initUI();
        pullFromGitHub();
    });
})();
