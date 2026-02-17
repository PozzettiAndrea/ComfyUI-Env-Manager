"""Backend API routes for ComfyUI-Env-Manager."""

import logging
import os
from pathlib import Path

from aiohttp import web
from server import PromptServer

log = logging.getLogger("ComfyUI-Env-Manager")

routes = PromptServer.instance.routes

VERSION = "0.1.0"


# ---------------------------------------------------------------------------
# Lazy import helpers
# ---------------------------------------------------------------------------

def _get_comfy_env():
    """Import comfy_env at call time so startup doesn't fail if missing."""
    try:
        import comfy_env
        return comfy_env
    except ImportError:
        return None


def _compute_precision_support(cc):
    """Derive precision support from a compute capability (major, minor) tuple."""
    major, minor = cc
    return {
        "fp16": True,
        "fp16_full_speed": major > 5 or (major == 5 and minor >= 3),
        "bf16": major >= 8,
        "tf32": major >= 8,
        "fp8_e4m3": major > 8 or (major == 8 and minor >= 9),
        "fp8_e5m2": major > 8 or (major == 8 and minor >= 9),
        "int8_tensor_core": major > 7 or (major == 7 and minor >= 5),
    }


# ---------------------------------------------------------------------------
# Route 1: Runtime environment + GPU info
# ---------------------------------------------------------------------------

@routes.get("/env-manager/runtime")
async def get_runtime(request):
    ce = _get_comfy_env()
    if ce is None:
        return web.json_response(
            {"error": "comfy_env not installed. Install with: pip install comfy-env"},
            status=503,
        )

    try:
        runtime = ce.RuntimeEnv.detect()
        cuda_env = ce.detect_cuda_environment()
    except Exception as exc:
        log.exception("Failed to detect environment")
        return web.json_response({"error": str(exc)}, status=500)

    gpus_data = []
    for gpu in cuda_env.gpus:
        gpus_data.append({
            "index": gpu.index,
            "name": gpu.name,
            "compute_capability": list(gpu.compute_capability),
            "architecture": gpu.architecture,
            "vram_total_mb": gpu.vram_total_mb,
            "vram_free_mb": gpu.vram_free_mb,
            "uuid": gpu.uuid,
            "pci_bus_id": gpu.pci_bus_id,
            "driver_version": gpu.driver_version,
            "precision_support": _compute_precision_support(gpu.compute_capability),
        })

    return web.json_response({
        "runtime": runtime.as_dict(),
        "gpu_environment": {
            "gpus": gpus_data,
            "driver_version": cuda_env.driver_version,
            "cuda_runtime_version": cuda_env.cuda_runtime_version,
            "recommended_cuda": cuda_env.recommended_cuda,
            "detection_method": cuda_env.detection_method,
        },
        "comfy_env_version": ce.__version__,
    })


# ---------------------------------------------------------------------------
# Route 2: Discovered environments + node cross-reference
# ---------------------------------------------------------------------------

@routes.get("/env-manager/environments")
async def get_environments(request):
    import nodes as comfy_nodes

    ce = _get_comfy_env()
    node_envs = []

    for module_name, module_dir in comfy_nodes.LOADED_MODULE_DIRS.items():
        node_dir = Path(module_dir)
        entry = {
            "node_name": module_name,
            "node_dir": str(node_dir),
            "has_config": False,
            "config_type": None,
            "config_path": None,
            "has_env": False,
            "env_dir": None,
            "isolated_dirs": [],
        }

        # Check for root-level config
        root_cfg = node_dir / "comfy-env-root.toml"
        iso_cfg = node_dir / "comfy-env.toml"
        if root_cfg.exists():
            entry["has_config"] = True
            entry["config_type"] = "root"
            entry["config_path"] = str(root_cfg)
        elif iso_cfg.exists():
            entry["has_config"] = True
            entry["config_type"] = "isolated"
            entry["config_path"] = str(iso_cfg)

        # Check for _env_* directory at root level
        try:
            for item in node_dir.iterdir():
                if item.name.startswith("_env_") and item.is_dir():
                    entry["has_env"] = True
                    entry["env_dir"] = str(item)
                    break
        except OSError:
            pass

        # Scan for sub-isolation configs
        try:
            for cf in node_dir.rglob("comfy-env.toml"):
                if cf.parent == node_dir:
                    continue
                sub_entry = {
                    "subdir": str(cf.parent.relative_to(node_dir)),
                    "config_path": str(cf),
                    "has_env": False,
                    "env_dir": None,
                }
                try:
                    for sub_item in cf.parent.iterdir():
                        if sub_item.name.startswith("_env_") and sub_item.is_dir():
                            sub_entry["has_env"] = True
                            sub_entry["env_dir"] = str(sub_item)
                            break
                except OSError:
                    pass
                entry["isolated_dirs"].append(sub_entry)
        except OSError:
            pass

        node_envs.append(entry)

    # Sort: nodes with configs first, then alphabetically
    node_envs.sort(key=lambda e: (not e["has_config"], e["node_name"].lower()))

    # Central cache directory
    cache_dir = str(ce.CACHE_DIR) if ce else str(Path.home() / ".comfy-envs")
    cache_envs = []
    cache_path = Path(cache_dir)
    if cache_path.exists():
        try:
            for item in sorted(cache_path.iterdir()):
                if item.is_dir():
                    cache_envs.append({"name": item.name, "path": str(item)})
        except OSError:
            pass

    return web.json_response({
        "node_environments": node_envs,
        "cache_dir": cache_dir,
        "cache_envs": cache_envs,
    })


# ---------------------------------------------------------------------------
# Route 3: Version
# ---------------------------------------------------------------------------

@routes.get("/env-manager/version")
async def get_version(request):
    return web.Response(text=VERSION)


log.info(f"ComfyUI-Env-Manager v{VERSION} routes registered")
