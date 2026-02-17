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
            const [runtimeRes, envsRes] = await Promise.all([
                api.fetchApi("/env-manager/runtime"),
                api.fetchApi("/env-manager/environments"),
            ]);

            const runtimeData = runtimeRes.ok ? await runtimeRes.json() : null;
            const runtimeError = !runtimeRes.ok ? await runtimeRes.json().catch(() => ({ error: "Failed to fetch" })) : null;
            const envsData = envsRes.ok ? await envsRes.json() : null;

            // Replace body
            const dialog = this.overlay.querySelector(".em-dialog");
            const body = dialog.querySelector(".em-body");
            body.replaceWith(this._buildBody(runtimeData, runtimeError, envsData));
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

    _buildBody(runtimeData, runtimeError, envsData) {
        const sections = [];

        // Section 1: Main Environment
        if (runtimeError) {
            sections.push(this._buildSection("Main Environment", [
                $el("div.em-error", {}, [runtimeError.error || "Failed to detect environment"]),
            ]));
        } else if (runtimeData) {
            sections.push(this._buildRuntimeSection(runtimeData));
            sections.push(this._buildGpuSection(runtimeData));
        }

        // Section 3: Node Environments
        if (envsData) {
            sections.push(this._buildEnvsSection(envsData));
        }

        return $el("div.em-body", sections);
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

        // Cache info
        if (data.cache_envs && data.cache_envs.length > 0) {
            children.push($el("div", {
                style: { marginTop: "12px", fontSize: "11px", color: "#666" },
            }, [`Cache: ${data.cache_dir} (${data.cache_envs.length} environment${data.cache_envs.length !== 1 ? "s" : ""})`]));
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
