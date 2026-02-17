import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";
import { $el } from "../../scripts/ui.js";

// ---------------------------------------------------------------------------
// CSS (injected once in init)
// ---------------------------------------------------------------------------

const CSS = `
/* Overlay mask */
.em-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Dialog container */
.em-dialog {
    background: #1a1a2e;
    border: 1px solid #444;
    border-radius: 12px;
    width: 720px;
    max-height: 85vh;
    overflow-y: auto;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

/* Header */
.em-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
    position: sticky;
    top: 0;
    background: #1a1a2e;
    z-index: 1;
}
.em-header-title {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}
.em-header-actions {
    display: flex;
    gap: 8px;
}
.em-header-btn {
    background: #333;
    border: 1px solid #555;
    color: #ccc;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 12px;
}
.em-header-btn:hover { background: #444; color: #fff; }

/* Tabs */
.em-tabs {
    display: flex;
    border-bottom: 1px solid #333;
    background: #1a1a2e;
    padding: 0 20px;
}
.em-tab {
    padding: 10px 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #888;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    user-select: none;
}
.em-tab:hover { color: #ccc; }
.em-tab.active { color: #4caf50; border-bottom-color: #4caf50; }
.em-tab-content { display: none; }
.em-tab-content.active { display: block; }

/* Sections */
.em-body { padding: 16px 20px; }
.em-section { margin-bottom: 20px; }
.em-section-title {
    font-weight: 600;
    font-size: 13px;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #333;
}

/* Key-value grid */
.em-kv-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 24px;
}
.em-kv-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
}
.em-kv-label { color: #888; }
.em-kv-value { color: #e0e0e0; font-family: "SF Mono", "Fira Code", monospace; font-size: 12px; }

/* GPU cards */
.em-gpu-card {
    background: #16213e;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 10px;
}
.em-gpu-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 8px;
    color: #fff;
}
.em-gpu-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    margin-bottom: 10px;
}
.em-vram-container { margin-bottom: 10px; }
.em-vram-label { font-size: 11px; color: #888; margin-bottom: 4px; }
.em-vram-bar {
    height: 8px;
    background: #333;
    border-radius: 4px;
    overflow: hidden;
}
.em-vram-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
}
.em-vram-fill.green { background: #4caf50; }
.em-vram-fill.yellow { background: #ff9800; }
.em-vram-fill.red { background: #f44336; }

/* Precision badges */
.em-precision-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
}
.em-precision-label { color: #888; font-size: 11px; margin-right: 4px; line-height: 22px; }
.em-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-family: "SF Mono", "Fira Code", monospace;
    font-weight: 500;
}
.em-badge-on { background: #1b5e20; color: #a5d6a7; }
.em-badge-off { background: #2a2a2a; color: #555; }

/* Node environment list */
.em-node-entry {
    padding: 10px 12px;
    border: 1px solid #333;
    border-radius: 6px;
    margin-bottom: 6px;
    background: #16213e;
}
.em-node-name { font-weight: 600; font-size: 13px; color: #fff; }
.em-node-detail {
    font-size: 11px;
    color: #888;
    margin-top: 4px;
    margin-left: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.em-check { color: #4caf50; }
.em-cross { color: #555; }
.em-node-sub {
    margin-left: 24px;
    margin-top: 4px;
    padding-left: 8px;
    border-left: 2px solid #333;
}

/* Collapse toggle */
.em-toggle {
    cursor: pointer;
    color: #6c8ebf;
    font-size: 12px;
    margin-top: 8px;
    user-select: none;
}
.em-toggle:hover { color: #8bb4e0; }

/* Loading / error states */
.em-loading {
    text-align: center;
    padding: 40px;
    color: #888;
}
.em-error {
    background: #3e1a1a;
    border: 1px solid #662222;
    border-radius: 8px;
    padding: 16px;
    color: #f88;
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 12px;
}

/* Cache environment entries */
.em-cache-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: 1px solid #333;
    border-radius: 6px;
    margin-bottom: 4px;
    background: #16213e;
}
.em-cache-name {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 12px;
    color: #e0e0e0;
}
.em-cache-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.em-cache-linked {
    font-size: 11px;
    color: #888;
}
.em-status-badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}
.em-status-active { background: #1b5e20; color: #a5d6a7; }
.em-status-stale { background: #4a3000; color: #ffb74d; }
.em-cache-path {
    font-size: 11px;
    color: #555;
    font-family: "SF Mono", "Fira Code", monospace;
    margin-bottom: 8px;
}

/* Config button */
.em-config-btn {
    background: #2a2a4a;
    border: 1px solid #555;
    color: #8bb4e0;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 10px;
    font-family: "SF Mono", "Fira Code", monospace;
    white-space: nowrap;
}
.em-config-btn:hover { background: #3a3a5a; color: #aad4ff; }

/* Worker entries */
.em-worker-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: 1px solid #333;
    border-radius: 6px;
    margin-bottom: 4px;
    background: #16213e;
}
.em-worker-name {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 12px;
    color: #e0e0e0;
}
.em-worker-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.em-worker-detail {
    font-size: 11px;
    color: #888;
    font-family: "SF Mono", "Fira Code", monospace;
}
.em-worker-alive { color: #4caf50; }
.em-worker-dead { color: #f44336; }
.em-no-workers {
    color: #888;
    padding: 8px 0;
    font-size: 12px;
}

/* Delete / Kill buttons */
.em-danger-btn {
    background: transparent;
    border: 1px solid #662222;
    color: #f44336;
    border-radius: 4px;
    width: 22px;
    height: 22px;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
}
.em-danger-btn:hover { background: #3e1a1a; color: #ff6659; border-color: #993333; }

/* Terminal button */
.em-terminal-btn {
    background: #1a2e1a;
    border: 1px solid #2d5a2d;
    color: #4caf50;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 10px;
    font-family: "SF Mono", "Fira Code", monospace;
    white-space: nowrap;
}
.em-terminal-btn:hover { background: #2a3e2a; color: #66bb6a; border-color: #4caf50; }

/* Full-screen terminal overlay */
.em-term-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: #000;
    z-index: 10002;
    display: flex;
    flex-direction: column;
}
.em-term-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: #1a1a2e;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
}
.em-term-title {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 12px;
    color: #4caf50;
}
.em-term-close {
    background: #333;
    border: 1px solid #555;
    color: #ccc;
    border-radius: 4px;
    padding: 2px 10px;
    cursor: pointer;
    font-size: 12px;
}
.em-term-close:hover { background: #444; color: #fff; }
.em-term-container {
    flex: 1;
    overflow: hidden;
}

/* Cuda-wheels tab */
.em-wheel-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.em-wheel-selector label {
    font-size: 12px;
    color: #888;
    white-space: nowrap;
}
.em-wheel-selector select {
    background: #16213e;
    border: 1px solid #444;
    color: #e0e0e0;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", monospace;
    min-width: 200px;
}
.em-wheel-info {
    font-size: 11px;
    color: #666;
    font-family: "SF Mono", "Fira Code", monospace;
}
.em-wheel-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: 1px solid #333;
    border-radius: 6px;
    margin-bottom: 4px;
    background: #16213e;
}
.em-wheel-name {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 13px;
    color: #e0e0e0;
    font-weight: 500;
}
.em-wheel-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.em-wheel-status {
    font-size: 10px;
    font-family: "SF Mono", "Fira Code", monospace;
    color: #555;
}
.em-install-btn {
    background: #1b5e20;
    border: 1px solid #2d7a32;
    color: #a5d6a7;
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
}
.em-install-btn:hover { background: #2e7d32; color: #c8e6c9; }
.em-install-btn:disabled {
    background: #2a2a2a;
    border-color: #444;
    color: #555;
    cursor: not-allowed;
}
.em-install-btn.installing {
    background: #4a3000;
    border-color: #7a5000;
    color: #ffb74d;
}
.em-wheel-unavail {
    font-size: 10px;
    color: #555;
    font-style: italic;
}

/* Confirm popup (reuses config overlay positioning) */
.em-confirm-popup {
    background: #1a1a2e;
    border: 1px solid #662222;
    border-radius: 10px;
    width: 420px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    text-align: center;
}
.em-confirm-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
}
.em-confirm-msg {
    font-size: 12px;
    color: #aaa;
    margin-bottom: 20px;
    word-break: break-all;
    font-family: "SF Mono", "Fira Code", monospace;
}
.em-confirm-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
}
.em-confirm-cancel {
    background: #333;
    border: 1px solid #555;
    color: #ccc;
    border-radius: 6px;
    padding: 6px 20px;
    cursor: pointer;
    font-size: 12px;
}
.em-confirm-cancel:hover { background: #444; color: #fff; }
.em-confirm-yes {
    background: #662222;
    border: 1px solid #993333;
    color: #ff8a80;
    border-radius: 6px;
    padding: 6px 20px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
}
.em-confirm-yes:hover { background: #882222; color: #ffab91; }

/* Config popup overlay */
.em-config-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
}
.em-config-popup {
    background: #0d1117;
    border: 1px solid #444;
    border-radius: 10px;
    width: 600px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}
.em-config-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #333;
}
.em-config-title {
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", monospace;
    color: #8bb4e0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.em-config-close {
    background: #333;
    border: 1px solid #555;
    color: #ccc;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 12px;
    flex-shrink: 0;
}
.em-config-close:hover { background: #444; color: #fff; }
.em-config-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
}
.em-config-code {
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #c9d1d9;
    white-space: pre;
    margin: 0;
    tab-size: 4;
}
`;

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

class EnvManagerDialog {
    static _instance = null;

    static getInstance() {
        if (!EnvManagerDialog._instance) {
            EnvManagerDialog._instance = new EnvManagerDialog();
        }
        return EnvManagerDialog._instance;
    }

    constructor() {
        this.overlay = null;
    }

    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    async show() {
        this.close();
        this._wheelTabLoaded = false;

        // Build loading state
        this.overlay = $el("div.em-overlay", {
            onclick: (e) => { if (e.target === this.overlay) this.close(); },
        }, [
            $el("div.em-dialog", [
                this._buildHeader(),
                $el("div.em-body", [$el("div.em-loading", {}, ["Loading environment info..."])]),
            ]),
        ]);
        document.body.appendChild(this.overlay);

        // Fetch data in parallel
        try {
            const [runtimeRes, envsRes, workersRes] = await Promise.all([
                api.fetchApi("/env-manager/runtime"),
                api.fetchApi("/env-manager/environments"),
                api.fetchApi("/env-manager/workers"),
            ]);

            const runtimeData = runtimeRes.ok ? await runtimeRes.json() : null;
            const runtimeError = !runtimeRes.ok ? await runtimeRes.json().catch(() => ({ error: "Failed to fetch" })) : null;
            const envsData = envsRes.ok ? await envsRes.json() : null;
            const workersData = workersRes.ok ? await workersRes.json() : null;

            // Replace loading state with tabs + content
            const dialog = this.overlay.querySelector(".em-dialog");
            const loadingBody = dialog.querySelector(".em-body");
            const built = this._buildBody(runtimeData, runtimeError, envsData, workersData);
            loadingBody.replaceWith(built);
        } catch (err) {
            const body = this.overlay.querySelector(".em-body");
            if (body) {
                body.innerHTML = "";
                body.appendChild($el("div.em-error", {}, [`Network error: ${err.message}`]));
            }
        }
    }

    _buildHeader() {
        return $el("div.em-header", [
            $el("div.em-header-title", {}, [
                $el("span", {}, ["\u2699\uFE0F"]),
                $el("span", {}, ["Environment Manager"]),
            ]),
            $el("div.em-header-actions", [
                $el("button.em-header-btn", {
                    onclick: () => this.show(),
                    title: "Refresh",
                }, ["\u21BB Refresh"]),
                $el("button.em-header-btn", {
                    onclick: () => this.close(),
                    title: "Close",
                }, ["\u2715"]),
            ]),
        ]);
    }

    _buildBody(runtimeData, runtimeError, envsData, workersData) {
        // Tab 1: Env Management content
        const envSections = [];
        if (runtimeError) {
            envSections.push(this._buildSection("Main Environment", [
                $el("div.em-error", {}, [runtimeError.error || "Failed to detect environment"]),
            ]));
        } else if (runtimeData) {
            envSections.push(this._buildRuntimeSection(runtimeData));
            envSections.push(this._buildGpuSection(runtimeData));
        }
        if (envsData) {
            envSections.push(this._buildEnvsSection(envsData));
        }
        if (envsData && envsData.cache_envs && envsData.cache_envs.length > 0) {
            envSections.push(this._buildCacheSection(envsData));
        }
        if (workersData) {
            envSections.push(this._buildWorkersSection(workersData));
        }

        const tab1Content = $el("div.em-tab-content.active", { dataset: { tab: "env" } }, envSections);

        // Tab 2: Install from Wheel (loads lazily)
        const tab2Content = $el("div.em-tab-content", { dataset: { tab: "wheel" } }, [
            $el("div.em-loading", {}, ["Select an environment to load available wheels..."]),
        ]);

        // Tab bar
        const tabs = [
            { id: "env", label: "Env Management" },
            { id: "wheel", label: "Install from Wheel" },
        ];
        const tabEls = tabs.map((t) => {
            const el = $el("div.em-tab", {
                className: `em-tab ${t.id === "env" ? "active" : ""}`,
                onclick: () => {
                    tabEls.forEach((te) => te.classList.remove("active"));
                    el.classList.add("active");
                    [tab1Content, tab2Content].forEach((c) => {
                        c.classList.toggle("active", c.dataset.tab === t.id);
                    });
                    // Lazy-load wheel tab on first click
                    if (t.id === "wheel" && !this._wheelTabLoaded) {
                        this._wheelTabLoaded = true;
                        this._loadWheelTab(tab2Content, envsData);
                    }
                },
            }, [t.label]);
            return el;
        });
        const tabBar = $el("div.em-tabs", tabEls);

        return $el("div", [
            tabBar,
            $el("div.em-body", [tab1Content, tab2Content]),
        ]);
    }

    _buildSection(title, children) {
        return $el("div.em-section", [
            $el("div.em-section-title", {}, [title]),
            ...children,
        ]);
    }

    _buildRuntimeSection(data) {
        const rt = data.runtime;
        const gpuEnv = data.gpu_environment;

        const kvPairs = [
            ["Python", rt.python_version || rt.py_version || "—"],
            ["PyTorch", rt.torch_version || "not installed"],
            ["CUDA", rt.cuda_version || "CPU only"],
            ["OS", `${rt.os} (${rt.platform})`],
            ["comfy-env", data.comfy_env_version || "—"],
            ["Detection", gpuEnv.detection_method || "—"],
        ];

        const grid = $el("div.em-kv-grid",
            kvPairs.map(([label, value]) =>
                $el("div.em-kv-row", [
                    $el("span.em-kv-label", {}, [label]),
                    $el("span.em-kv-value", {}, [value]),
                ])
            )
        );

        return this._buildSection("Main Environment", [grid]);
    }

    _buildGpuSection(data) {
        const gpus = data.gpu_environment.gpus;
        if (!gpus || gpus.length === 0) {
            return this._buildSection("GPU", [
                $el("div", { style: { color: "#888", padding: "8px 0" } }, ["No GPU detected"]),
            ]);
        }

        const cards = gpus.map((gpu) => this._buildGpuCard(gpu));
        return this._buildSection(`GPU${gpus.length > 1 ? "s" : ""}`, cards);
    }

    _buildGpuCard(gpu) {
        const cc = gpu.compute_capability;
        const smStr = `sm_${cc[0]}${cc[1]}`;

        // VRAM
        const totalGb = (gpu.vram_total_mb / 1024).toFixed(1);
        const freeGb = (gpu.vram_free_mb / 1024).toFixed(1);
        const usedGb = ((gpu.vram_total_mb - gpu.vram_free_mb) / 1024).toFixed(1);
        const usedPct = gpu.vram_total_mb > 0 ? ((gpu.vram_total_mb - gpu.vram_free_mb) / gpu.vram_total_mb * 100) : 0;
        const barColor = usedPct > 90 ? "red" : usedPct > 70 ? "yellow" : "green";

        // Precision badges
        const ps = gpu.precision_support || {};
        const badges = [
            ["fp16", ps.fp16],
            ["bf16", ps.bf16],
            ["tf32", ps.tf32],
            ["fp8", ps.fp8_e4m3],
            ["int8 TC", ps.int8_tensor_core],
        ];

        return $el("div.em-gpu-card", [
            $el("div.em-gpu-name", {}, [`GPU ${gpu.index}: ${gpu.name}`]),
            $el("div.em-gpu-details", [
                $el("div.em-kv-row", [
                    $el("span.em-kv-label", {}, ["Architecture"]),
                    $el("span.em-kv-value", {}, [`${gpu.architecture} (${smStr})`]),
                ]),
                $el("div.em-kv-row", [
                    $el("span.em-kv-label", {}, ["Driver"]),
                    $el("span.em-kv-value", {}, [gpu.driver_version || "—"]),
                ]),
            ]),
            // VRAM bar
            $el("div.em-vram-container", [
                $el("div.em-vram-label", {}, [
                    `VRAM: ${usedGb} / ${totalGb} GB used (${freeGb} GB free)`,
                ]),
                $el("div.em-vram-bar", [
                    $el("div", {
                        className: `em-vram-fill ${barColor}`,
                        style: { width: `${usedPct}%` },
                    }),
                ]),
            ]),
            // Precision
            $el("div.em-precision-row", [
                $el("span.em-precision-label", {}, ["Precision:"]),
                ...badges.map(([name, supported]) =>
                    $el("span", {
                        className: `em-badge ${supported ? "em-badge-on" : "em-badge-off"}`,
                    }, [name])
                ),
            ]),
        ]);
    }

    _buildEnvsSection(data) {
        const envs = data.node_environments || [];
        if (envs.length === 0) {
            return this._buildSection("Node Environments", [
                $el("div", { style: { color: "#888", padding: "8px 0" } }, ["No custom nodes loaded"]),
            ]);
        }

        // Split into nodes with configs and nodes without
        const withConfig = envs.filter((e) => e.has_config);
        const withoutConfig = envs.filter((e) => !e.has_config);

        const children = [];

        // Nodes with comfy-env configs
        withConfig.forEach((env) => children.push(this._buildNodeEntry(env)));

        // Collapsible "Other nodes" section
        if (withoutConfig.length > 0) {
            const otherContainer = $el("div", { style: { display: "none" } },
                withoutConfig.map((env) => this._buildNodeEntry(env))
            );

            const toggle = $el("div.em-toggle", {
                onclick: () => {
                    const visible = otherContainer.style.display !== "none";
                    otherContainer.style.display = visible ? "none" : "block";
                    toggle.textContent = visible
                        ? `\u25B6 Other nodes (${withoutConfig.length})`
                        : `\u25BC Other nodes (${withoutConfig.length})`;
                },
            }, [`\u25B6 Other nodes (${withoutConfig.length})`]);

            children.push(toggle);
            children.push(otherContainer);
        }

        return this._buildSection("Node Environments", children);
    }

    _buildNodeEntry(env) {
        const checkOrCross = (ok) => $el("span", {
            className: ok ? "em-check" : "em-cross",
        }, [ok ? "\u2713" : "\u2717"]);

        const details = [];

        // Config status
        if (env.has_config) {
            details.push($el("div.em-node-detail", [
                checkOrCross(true),
                $el("span", {}, [`Config: ${env.config_type} (${env.config_path ? env.config_path.split("/").pop() : ""})`]),
            ]));
        } else {
            details.push($el("div.em-node-detail", [
                checkOrCross(false),
                $el("span", {}, ["No comfy-env config"]),
            ]));
        }

        // Env status
        if (env.has_config) {
            details.push($el("div.em-node-detail", [
                checkOrCross(env.has_env),
                $el("span", {}, [env.has_env
                    ? `Env: ${env.env_dir ? env.env_dir.split("/").pop() : "installed"}`
                    : "Env: not installed (run comfy-env install)"
                ]),
            ]));
        }

        // Sub-isolation dirs
        if (env.isolated_dirs && env.isolated_dirs.length > 0) {
            env.isolated_dirs.forEach((sub) => {
                details.push($el("div.em-node-sub", [
                    $el("div.em-node-detail", [
                        checkOrCross(sub.has_env),
                        $el("span", {}, [`${sub.subdir} ${sub.has_env ? "(" + sub.env_dir.split("/").pop() + ")" : "(not installed)"}`]),
                    ]),
                ]));
            });
        }

        return $el("div.em-node-entry", [
            $el("div.em-node-name", {}, [env.node_name]),
            ...details,
        ]);
    }

    _buildCacheSection(data) {
        const cacheEnvs = data.cache_envs || [];
        const children = [];

        // Cache dir path
        children.push($el("div.em-cache-path", {}, [data.cache_dir]));

        // List each cached env
        cacheEnvs.forEach((env) => {
            const rightParts = [];
            // Show linked node or original node (from metadata)
            const nodeLabel = env.linked_to || env.original_node;
            if (nodeLabel) {
                rightParts.push($el("span.em-cache-linked", {}, [nodeLabel]));
            }
            // "config" button — active envs fetch live file, unused envs show cached content
            if (env.config_path) {
                rightParts.push($el("button.em-config-btn", {
                    onclick: (e) => { e.stopPropagation(); this._showConfig(env.config_path); },
                }, ["config"]));
            } else if (env.cached_config_content) {
                rightParts.push($el("button.em-config-btn", {
                    onclick: (e) => { e.stopPropagation(); this._showCachedConfig(env.name, env.cached_config_content); },
                }, ["config"]));
            }
            rightParts.push($el("button.em-terminal-btn", {
                onclick: (e) => { e.stopPropagation(); this._openTerminal(env.path, env.name); },
                title: "Open terminal in this environment",
            }, [">_ terminal"]));
            rightParts.push($el("span", {
                className: `em-status-badge ${env.active ? "em-status-active" : "em-status-stale"}`,
            }, [env.active ? "active" : "unused"]));
            rightParts.push($el("button.em-danger-btn", {
                onclick: (e) => { e.stopPropagation(); this._deleteEnv(env.path, env.name); },
                title: "Delete environment",
            }, ["\u2715"]));

            children.push($el("div.em-cache-entry", [
                $el("span.em-cache-name", {}, [env.name]),
                $el("div.em-cache-right", rightParts),
            ]));
        });

        const activeCount = cacheEnvs.filter((e) => e.active).length;
        const staleCount = cacheEnvs.length - activeCount;
        const title = `Cached Environments (${activeCount} active, ${staleCount} stale)`;

        return this._buildSection(title, children);
    }

    _buildWorkersSection(data) {
        const workers = data.workers || [];
        const aliveCount = workers.filter((w) => w.alive).length;
        const title = `Subprocess Workers (${aliveCount} active)`;

        if (workers.length === 0) {
            return this._buildSection(title, [
                $el("div.em-no-workers", {}, ["No subprocess workers running"]),
            ]);
        }

        const children = workers.map((w) => {
            const rightParts = [];
            if (w.pid) {
                rightParts.push($el("span.em-worker-detail", {}, [`PID ${w.pid}`]));
            }
            rightParts.push($el("span", {
                className: w.alive ? "em-worker-alive" : "em-worker-dead",
                style: { fontSize: "11px", fontWeight: "600" },
            }, [w.alive ? "alive" : "dead"]));
            rightParts.push($el("button.em-danger-btn", {
                onclick: (e) => { e.stopPropagation(); this._killWorker(w.env_dir, w.name); },
                title: "Kill worker",
            }, ["\u2715"]));

            return $el("div.em-worker-entry", [
                $el("div", { style: { display: "flex", flexDirection: "column", gap: "2px" } }, [
                    $el("span.em-worker-name", {}, [w.name]),
                    $el("span.em-worker-detail", {}, [w.env_dir]),
                ]),
                $el("div.em-worker-right", rightParts),
            ]);
        });

        return this._buildSection(title, children);
    }

    _confirm(title, message) {
        return new Promise((resolve) => {
            const overlay = $el("div.em-config-overlay", {
                onclick: (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } },
            }, [
                $el("div.em-confirm-popup", [
                    $el("div.em-confirm-title", {}, [title]),
                    $el("div.em-confirm-msg", {}, [message]),
                    $el("div.em-confirm-actions", [
                        $el("button.em-confirm-cancel", {
                            onclick: () => { overlay.remove(); resolve(false); },
                        }, ["Cancel"]),
                        $el("button.em-confirm-yes", {
                            onclick: () => { overlay.remove(); resolve(true); },
                        }, ["Yes, do it"]),
                    ]),
                ]),
            ]);
            document.body.appendChild(overlay);
        });
    }

    async _deleteEnv(envPath, envName) {
        const confirmed = await this._confirm(
            "Delete environment?",
            `This will permanently delete ${envName} and remove any symlinks pointing to it.`,
        );
        if (!confirmed) return;

        try {
            const res = await api.fetchApi("/env-manager/cache-env", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: envPath }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to delete");
                return;
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
            return;
        }
        // Refresh the dialog
        this.show();
    }

    async _killWorker(envDir, workerName) {
        const confirmed = await this._confirm(
            "Kill worker?",
            `This will terminate the subprocess worker: ${workerName}`,
        );
        if (!confirmed) return;

        try {
            const res = await api.fetchApi("/env-manager/workers/kill", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ env_dir: envDir }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to kill worker");
                return;
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
            return;
        }
        // Refresh the dialog
        this.show();
    }

    async _openTerminal(envPath, envName, cmd) {
        // Load xterm.js from CDN if not already loaded
        if (!window.Terminal) {
            try {
                // CSS
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css";
                document.head.appendChild(link);
                // JS
                await new Promise((resolve, reject) => {
                    const s = document.createElement("script");
                    s.src = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js";
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
                await new Promise((resolve, reject) => {
                    const s = document.createElement("script");
                    s.src = "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js";
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            } catch (err) {
                alert("Failed to load xterm.js: " + err.message);
                return;
            }
        }

        // Build WebSocket URL
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        let wsUrl = `${proto}//${location.host}/env-manager/terminal-ws?path=${encodeURIComponent(envPath)}`;
        if (cmd) {
            wsUrl += `&cmd=${encodeURIComponent(cmd)}`;
        }

        // Create full-screen terminal overlay
        const termContainer = $el("div.em-term-container");
        const overlay = $el("div.em-term-overlay", [
            $el("div.em-term-header", [
                $el("span.em-term-title", {}, [envName]),
                $el("button.em-term-close", {
                    onclick: () => cleanup(),
                }, ["\u2715 Close"]),
            ]),
            termContainer,
        ]);
        document.body.appendChild(overlay);

        // Initialize xterm
        const term = new window.Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace',
            theme: {
                background: "#0d1117",
                foreground: "#c9d1d9",
                cursor: "#4caf50",
                selectionBackground: "#264f78",
            },
        });
        const fitAddon = new window.FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(termContainer);
        fitAddon.fit();

        // Connect WebSocket
        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            // Send initial size
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        };

        ws.onmessage = (ev) => {
            if (ev.data instanceof ArrayBuffer) {
                term.write(new Uint8Array(ev.data));
            } else {
                term.write(ev.data);
            }
        };

        ws.onclose = () => {
            term.write("\r\n\x1b[90m[session ended]\x1b[0m\r\n");
        };

        ws.onerror = () => {
            term.write("\r\n\x1b[31m[connection error]\x1b[0m\r\n");
        };

        // Send terminal input to ws
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(new TextEncoder().encode(data));
            }
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
            }
        });
        resizeObserver.observe(termContainer);

        const cleanup = () => {
            resizeObserver.disconnect();
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            term.dispose();
            overlay.remove();
        };
    }

    async _loadWheelTab(container, envsData) {
        // Build env options: main + cached envs
        const envOptions = [{ value: "main", label: "Main Environment (ComfyUI)" }];
        if (envsData && envsData.cache_envs) {
            for (const env of envsData.cache_envs) {
                const label = env.original_node || env.linked_to || env.name;
                envOptions.push({ value: env.path, label: `${label} (${env.name})` });
            }
        }

        const select = $el("select", {},
            envOptions.map((o) => $el("option", { value: o.value }, [o.label]))
        );
        const infoSpan = $el("span.em-wheel-info");
        const pkgContainer = $el("div");

        const loadPackages = async (envValue) => {
            pkgContainer.innerHTML = "";
            pkgContainer.appendChild($el("div.em-loading", {}, ["Resolving wheels..."]));
            infoSpan.textContent = "";

            try {
                const res = await api.fetchApi(
                    `/env-manager/cuda-wheels?env=${encodeURIComponent(envValue)}`
                );
                if (!res.ok) {
                    const text = await res.text();
                    let errMsg;
                    try { errMsg = JSON.parse(text).error; } catch { errMsg = `Server error (${res.status})`; }
                    pkgContainer.innerHTML = "";
                    pkgContainer.appendChild($el("div.em-error", {}, [errMsg]));
                    return;
                }
                const data = await res.json();

                infoSpan.textContent = `CUDA ${data.cuda_version} / PyTorch ${data.torch_version} / Python ${data.python_version}`;
                pkgContainer.innerHTML = "";
                this._buildWheelPackages(pkgContainer, data.packages, envValue);
            } catch (err) {
                pkgContainer.innerHTML = "";
                pkgContainer.appendChild($el("div.em-error", {}, [`Error: ${err.message}`]));
            }
        };

        select.onchange = () => loadPackages(select.value);

        container.innerHTML = "";
        container.appendChild(
            this._buildSection("Install CUDA Wheels", [
                $el("div.em-wheel-selector", [
                    $el("label", {}, ["Environment:"]),
                    select,
                    infoSpan,
                ]),
                pkgContainer,
            ])
        );

        // Auto-load for default (main)
        loadPackages("main");
    }

    _buildWheelPackages(container, packages, envValue) {
        if (!packages || packages.length === 0) {
            container.appendChild(
                $el("div", { style: { color: "#888", padding: "8px 0" } },
                    ["No packages found in cuda-wheels index"])
            );
            return;
        }

        for (const pkg of packages) {
            const rightParts = [];

            if (pkg.installed_version) {
                rightParts.push($el("span.em-wheel-status", {
                    style: { color: "#4caf50" },
                }, [`v${pkg.installed_version}`]));
            }

            if (pkg.available) {
                const label = pkg.installed_version ? "reinstall" : "install";
                const installBtn = $el("button.em-install-btn", {
                    onclick: () => {
                        const pipCmd = `pip install --no-index --no-deps "${pkg.wheel_url}"`;
                        this._openTerminal(
                            envValue,
                            `Installing ${pkg.name}`,
                            pipCmd,
                        );
                    },
                }, [label]);
                rightParts.push(installBtn);
            } else {
                if (!pkg.installed_version) {
                    rightParts.push($el("span.em-wheel-unavail", {}, ["no matching wheel"]));
                }
            }

            container.appendChild($el("div.em-wheel-entry", [
                $el("span.em-wheel-name", {}, [pkg.name]),
                $el("div.em-wheel-right", rightParts),
            ]));
        }
    }

    _showCachedConfig(envName, content) {
        const overlay = $el("div.em-config-overlay", {
            onclick: (e) => { if (e.target === overlay) overlay.remove(); },
        }, [
            $el("div.em-config-popup", [
                $el("div.em-config-header", [
                    $el("span.em-config-title", {}, [`${envName} (cached config)`]),
                    $el("button.em-config-close", {
                        onclick: () => overlay.remove(),
                    }, ["\u2715"]),
                ]),
                $el("div.em-config-body", [
                    $el("pre.em-config-code", {}, [content]),
                ]),
            ]),
        ]);
        document.body.appendChild(overlay);
    }

    async _showConfig(filePath) {
        try {
            const res = await api.fetchApi(`/env-manager/config?path=${encodeURIComponent(filePath)}`);
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to load config");
                return;
            }

            const fileName = filePath.split("/").pop();
            const overlay = $el("div.em-config-overlay", {
                onclick: (e) => { if (e.target === overlay) overlay.remove(); },
            }, [
                $el("div.em-config-popup", [
                    $el("div.em-config-header", [
                        $el("span.em-config-title", {}, [filePath]),
                        $el("button.em-config-close", {
                            onclick: () => overlay.remove(),
                        }, ["\u2715"]),
                    ]),
                    $el("div.em-config-body", [
                        $el("pre.em-config-code", {}, [data.content]),
                    ]),
                ]),
            ]);
            document.body.appendChild(overlay);
        } catch (err) {
            alert(`Error loading config: ${err.message}`);
        }
    }
}


// ---------------------------------------------------------------------------
// Extension registration
// ---------------------------------------------------------------------------

app.registerExtension({
    name: "Comfy.EnvManager",

    init() {
        $el("style", {
            textContent: CSS,
            parent: document.head,
        });
    },

    async setup() {
        // New-style top bar button (ComfyUI 1.2.49+)
        try {
            const { ComfyButtonGroup } = await import(
                "../../scripts/ui/components/buttonGroup.js"
            );
            const { ComfyButton } = await import(
                "../../scripts/ui/components/button.js"
            );

            const envButton = new ComfyButton({
                icon: "chip",
                action: () => EnvManagerDialog.getInstance().show(),
                tooltip: "Environment Manager",
                content: "Env",
                classList: "comfyui-button comfyui-menu-mobile-collapse primary",
            });

            const group = new ComfyButtonGroup(envButton.element);
            app.menu?.settingsGroup.element.before(group.element);
        } catch (e) {
            // Legacy fallback for older ComfyUI
            try {
                const menu = document.querySelector(".comfy-menu");
                if (menu) {
                    const btn = document.createElement("button");
                    btn.textContent = "Env";
                    btn.title = "Environment Manager";
                    btn.onclick = () => EnvManagerDialog.getInstance().show();
                    menu.append(btn);
                }
            } catch (e2) {
                console.warn("[Env-Manager] Could not add menu button:", e2);
            }
        }
    },
});
