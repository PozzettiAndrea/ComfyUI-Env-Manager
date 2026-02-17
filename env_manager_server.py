"""Backend API routes for ComfyUI-Env-Manager."""

import json
import logging
import os
import shutil
import subprocess
import tempfile
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
        if "/custom_nodes/" not in module_dir and "\\custom_nodes\\" not in module_dir:
            continue
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

    # Collect all active env names -> {node description, config_path}
    active_envs = {}  # env_name -> {"linked_to": str, "config_path": str|None}
    for entry in node_envs:
        if entry["env_dir"]:
            env_name = Path(entry["env_dir"]).name
            active_envs[env_name] = {
                "linked_to": entry["node_name"],
                "config_path": entry.get("config_path"),
            }
        for sub in entry.get("isolated_dirs", []):
            if sub.get("env_dir"):
                env_name = Path(sub["env_dir"]).name
                active_envs[env_name] = {
                    "linked_to": f"{entry['node_name']}/{sub['subdir']}",
                    "config_path": sub.get("config_path"),
                }

    # Central build directory (where pixi envs are actually built)
    # install.py uses ~/.ce/ on Linux, C:/ce on Windows
    import sys as _sys
    if _sys.platform == "win32":
        cache_dir = str(Path("C:/ce"))
    else:
        cache_dir = str(Path.home() / ".ce")
    cache_envs = []
    cache_path = Path(cache_dir)
    if cache_path.exists():
        try:
            for item in sorted(cache_path.iterdir()):
                if item.is_dir():
                    info = active_envs.get(item.name)
                    entry = {
                        "name": item.name,
                        "path": str(item),
                        "active": info is not None,
                        "linked_to": info["linked_to"] if info else None,
                        "config_path": info["config_path"] if info else None,
                        "cached_config_content": None,
                        "original_node": None,
                    }
                    # Read cached metadata for unused envs (or as supplemental info)
                    meta_file = item / ".comfy-env-meta.json"
                    if meta_file.exists():
                        try:
                            meta = json.loads(meta_file.read_text(encoding="utf-8"))
                            entry["original_node"] = meta.get("node_name")
                            if not info:  # unused env — include cached config
                                entry["cached_config_content"] = meta.get("config_content")
                        except Exception:
                            pass
                    cache_envs.append(entry)
        except OSError:
            pass

    return web.json_response({
        "node_environments": node_envs,
        "cache_dir": cache_dir,
        "cache_envs": cache_envs,
    })


# ---------------------------------------------------------------------------
# Route 3: Read a config file
# ---------------------------------------------------------------------------

@routes.get("/env-manager/config")
async def get_config(request):
    """Read a comfy-env config or pixi.toml file. Only allows .toml files."""
    file_path = request.rel_url.query.get("path", "")
    if not file_path:
        return web.json_response({"error": "missing 'path' parameter"}, status=400)

    p = Path(file_path)
    # Safety: only allow .toml files
    if p.suffix != ".toml":
        return web.json_response({"error": "only .toml files allowed"}, status=403)
    if not p.exists():
        return web.json_response({"error": "file not found"}, status=404)

    try:
        content = p.read_text(encoding="utf-8")
    except Exception as exc:
        return web.json_response({"error": str(exc)}, status=500)

    return web.json_response({"path": str(p), "content": content})


# ---------------------------------------------------------------------------
# Route 4: Delete a cached environment
# ---------------------------------------------------------------------------

def _get_cache_dir():
    """Return the comfy-env build cache directory."""
    import sys as _sys
    if _sys.platform == "win32":
        return Path("C:/ce")
    return Path.home() / ".ce"


def _fast_rmtree(path: Path) -> None:
    """Delete a directory tree using the fastest platform-native method."""
    if os.name == "nt":
        # robocopy /MIR with empty dir is vastly faster than shutil.rmtree on NTFS
        with tempfile.TemporaryDirectory() as empty:
            subprocess.run(
                ["robocopy", empty, str(path), "/MIR",
                 "/NJH", "/NJS", "/NP", "/NFL", "/NDL"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        path.rmdir()
    else:
        subprocess.run(["rm", "-rf", str(path)], check=True)


@routes.delete("/env-manager/cache-env")
async def delete_cache_env(request):
    """Delete a cached environment directory from ~/.ce/."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)

    env_path_str = body.get("path", "")
    if not env_path_str:
        return web.json_response({"error": "missing 'path'"}, status=400)

    env_path = Path(env_path_str).resolve()
    cache_dir = _get_cache_dir().resolve()

    # Safety: must be a direct child of the cache dir
    if env_path.parent != cache_dir:
        return web.json_response({"error": "path is not inside cache directory"}, status=403)
    if not env_path.exists():
        return web.json_response({"error": "directory not found"}, status=404)
    if not env_path.is_dir():
        return web.json_response({"error": "not a directory"}, status=400)

    # Remove dangling symlinks in custom_nodes that point into this env
    removed_symlinks = []
    try:
        import nodes as comfy_nodes
        for _name, module_dir in comfy_nodes.LOADED_MODULE_DIRS.items():
            node_dir = Path(module_dir)
            try:
                for item in node_dir.iterdir():
                    if item.is_symlink() and item.name.startswith("_env_"):
                        link_target = item.resolve()
                        if str(link_target).startswith(str(env_path)):
                            item.unlink()
                            removed_symlinks.append(str(item))
                # Also check subdirs for sub-isolation symlinks
                for sub_item in node_dir.rglob("_env_*"):
                    if sub_item.is_symlink():
                        link_target = sub_item.resolve()
                        if str(link_target).startswith(str(env_path)):
                            sub_item.unlink()
                            removed_symlinks.append(str(sub_item))
            except OSError:
                pass
    except Exception:
        pass

    try:
        _fast_rmtree(env_path)
    except Exception as exc:
        log.exception("Failed to delete cached env")
        return web.json_response({"error": str(exc)}, status=500)

    log.info(f"Deleted cached env: {env_path}")
    if removed_symlinks:
        log.info(f"Removed symlinks: {removed_symlinks}")

    return web.json_response({
        "deleted": str(env_path),
        "removed_symlinks": removed_symlinks,
    })


# ---------------------------------------------------------------------------
# Route 5: Kill a subprocess worker
# ---------------------------------------------------------------------------

@routes.post("/env-manager/workers/kill")
async def kill_worker(request):
    """Kill a subprocess worker by its env_dir key."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)

    env_dir = body.get("env_dir", "")
    if not env_dir:
        return web.json_response({"error": "missing 'env_dir'"}, status=400)

    try:
        from comfy_env.isolation.wrap import _remove_worker
    except ImportError:
        return web.json_response({"error": "comfy_env.isolation not available"}, status=503)

    try:
        _remove_worker(env_dir)
    except Exception as exc:
        log.exception("Failed to kill worker")
        return web.json_response({"error": str(exc)}, status=500)

    log.info(f"Killed worker for env: {env_dir}")
    return web.json_response({"killed": env_dir})


# ---------------------------------------------------------------------------
# Route 6: Active subprocess workers
# ---------------------------------------------------------------------------

@routes.get("/env-manager/workers")
async def get_workers(request):
    """Return info about currently active subprocess workers from comfy-env."""
    try:
        from comfy_env.isolation.wrap import _WORKER_POOL, _POOL_LOCK
    except ImportError:
        return web.json_response({"workers": [], "error": "comfy_env.isolation not available"})

    workers = []
    with _POOL_LOCK:
        for env_key, (worker, generation) in _WORKER_POOL.items():
            alive = False
            pid = None
            try:
                alive = worker.is_alive()
                if worker._process is not None:
                    pid = worker._process.pid
            except Exception:
                pass
            workers.append({
                "env_dir": env_key,
                "name": getattr(worker, "name", "unknown"),
                "python": str(getattr(worker, "python", "")),
                "alive": alive,
                "pid": pid,
                "generation": generation,
            })

    return web.json_response({"workers": workers})


# ---------------------------------------------------------------------------
# Route 7: In-browser terminal via WebSocket + pty
# ---------------------------------------------------------------------------

@routes.get("/env-manager/terminal-ws")
async def terminal_websocket(request):
    """WebSocket endpoint that spawns a pty shell with a pixi env activated."""
    import asyncio
    import fcntl
    import pty
    import signal
    import struct
    import termios
    import aiohttp

    env_path_str = request.rel_url.query.get("path", "")
    if not env_path_str:
        return web.json_response({"error": "missing 'path'"}, status=400)

    initial_cmd = request.rel_url.query.get("cmd", "")

    is_main = env_path_str == "main"
    if not is_main:
        env_path = Path(env_path_str).resolve()
        cache_dir = _get_cache_dir().resolve()
        if env_path.parent != cache_dir:
            return web.json_response({"error": "path not inside cache dir"}, status=403)
        manifest = env_path / "pixi.toml"
        if not manifest.exists():
            return web.json_response({"error": "pixi.toml not found"}, status=404)

    ws = web.WebSocketResponse()
    await ws.prepare(request)

    # Create pty
    master_fd, slave_fd = pty.openpty()

    # Build rcfile
    rc = tempfile.NamedTemporaryFile(
        mode="w", suffix=".sh", delete=False, prefix="ce_term_"
    )
    rc.write(f'[ -f ~/.bashrc ] && source ~/.bashrc\n')
    if not is_main:
        pixi = shutil.which("pixi") or "pixi"
        rc.write(f'eval "$({pixi} shell-hook --manifest-path {manifest})"\n')
        rc.write(f'cd {env_path}\n')
    if initial_cmd:
        rc.write(f'{initial_cmd}\n')
    rc_path = rc.name
    rc.close()

    proc = subprocess.Popen(
        ["bash", "--rcfile", rc_path, "-i"],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True,
        preexec_fn=os.setsid,
    )
    os.close(slave_fd)

    # Make master fd non-blocking for asyncio
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    loop = asyncio.get_event_loop()
    output_queue = asyncio.Queue()

    def _on_pty_readable():
        try:
            data = os.read(master_fd, 32768)
            if data:
                output_queue.put_nowait(data)
        except OSError:
            pass

    loop.add_reader(master_fd, _on_pty_readable)

    async def _forward_output():
        try:
            while True:
                data = await output_queue.get()
                await ws.send_bytes(data)
        except (ConnectionResetError, asyncio.CancelledError):
            pass

    output_task = asyncio.create_task(_forward_output())

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.BINARY:
                # Terminal input
                try:
                    os.write(master_fd, msg.data)
                except OSError:
                    break
            elif msg.type == aiohttp.WSMsgType.TEXT:
                # Control messages (resize)
                try:
                    ctrl = json.loads(msg.data)
                    if ctrl.get("type") == "resize":
                        winsize = struct.pack(
                            "HHHH", ctrl["rows"], ctrl["cols"], 0, 0
                        )
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                except (json.JSONDecodeError, KeyError, OSError):
                    pass
            elif msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR):
                break
    finally:
        output_task.cancel()
        loop.remove_reader(master_fd)
        os.close(master_fd)
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass
        proc.wait()
        try:
            os.unlink(rc_path)
        except OSError:
            pass

    return ws


# ---------------------------------------------------------------------------
# Route 8: List cuda-wheels packages with resolved URLs for an env
# ---------------------------------------------------------------------------

def _detect_env_versions(env_path: Path) -> dict:
    """Extract Python, CUDA, and torch versions from a pixi env's pixi.toml."""
    import re
    result = {"python": None, "cuda": None, "torch": None}
    pixi_toml = env_path / "pixi.toml"
    if not pixi_toml.exists():
        return result
    try:
        content = pixi_toml.read_text(encoding="utf-8")
        m = re.search(r'python\s*=\s*"(\d+\.\d+)', content)
        if m:
            result["python"] = m.group(1)
        m = re.search(r'torch\s*=\s*"==?(\d+\.\d+)', content)
        if m:
            result["torch"] = m.group(1)
        # CUDA from pytorch whl URL: cu128 -> 12.8
        m = re.search(r'pytorch\.org/whl/cu(\d+)', content)
        if m:
            raw = m.group(1)  # e.g. "128"
            result["cuda"] = f"{raw[:-1]}.{raw[-1]}"  # "128" -> "12.8"
        elif re.search(r'cuda\s*=\s*"(\d+)', content):
            # Fallback: cuda = "12" -> 12.8 (best guess)
            pass
    except Exception:
        pass
    return result


def _normalize_pkg(name: str) -> str:
    """Normalize package name for comparison (PEP 503)."""
    import re
    return re.sub(r"[-_.]+", "-", name).lower()


@routes.get("/env-manager/cuda-wheels")
async def get_cuda_wheels(request):
    """List all cuda-wheels packages and resolve wheel URLs for the selected env."""
    import asyncio
    import sys as _sys
    import urllib.request

    ce = _get_comfy_env()
    if ce is None:
        return web.json_response({"error": "comfy_env not installed"}, status=503)

    env_param = request.rel_url.query.get("env", "main")

    from comfy_env.packages.cuda_wheels import (
        CUDA_WHEELS_INDEX, CUDA_TORCH_MAP, get_wheel_url,
    )
    try:
        from comfy_env.packages.cuda_wheels import _platform_tags
    except ImportError:
        from comfy_env.packages.cuda_wheels import _platform_tag
        _platform_tags = lambda: [_platform_tag()] if _platform_tag() else []

    # Detect system CUDA (recommended_cuda, not runtime — matches what wheels target)
    try:
        cuda_env = ce.detect_cuda_environment()
        system_cuda = cuda_env.recommended_cuda or cuda_env.cuda_runtime_version or "12.8"
    except Exception:
        system_cuda = "12.8"

    if env_param == "main":
        python_version = f"{_sys.version_info.major}.{_sys.version_info.minor}"
        cuda_version = system_cuda
        torch_version = CUDA_TORCH_MAP.get(
            ".".join(cuda_version.split(".")[:2]), "2.8"
        )
    else:
        # Per-env versions from pixi.toml (has exact cuda/torch/python)
        env_versions = _detect_env_versions(Path(env_param))
        python_version = env_versions["python"] or "3.12"
        cuda_version = env_versions["cuda"] or system_cuda
        torch_version = env_versions["torch"] or CUDA_TORCH_MAP.get(
            ".".join(cuda_version.split(".")[:2]), "2.8"
        )

    # Build map of already-installed packages in the target env
    installed_pkgs = {}  # normalized_name -> version
    if env_param == "main":
        import importlib.metadata as _im
        for dist in _im.distributions():
            installed_pkgs[_normalize_pkg(dist.metadata["Name"])] = dist.metadata["Version"]
    else:
        # Scan pixi env site-packages for .dist-info dirs
        import glob as _glob
        sp_pattern = str(Path(env_param) / "env" / "lib" / "python*" / "site-packages" / "*.dist-info")
        for di in _glob.glob(sp_pattern):
            di_name = Path(di).name  # e.g. "flash_attn-2.8.3+cu128torch2.8.dist-info"
            parts = di_name.rsplit(".dist-info", 1)[0].rsplit("-", 1)
            if len(parts) == 2:
                installed_pkgs[_normalize_pkg(parts[0])] = parts[1]

    # Fetch the root index to get all package names
    packages = []
    try:
        def _fetch_index():
            with urllib.request.urlopen(CUDA_WHEELS_INDEX, timeout=10) as resp:
                html = resp.read().decode("utf-8")
            import re
            return re.findall(r'href="([^"]+)/"', html)
        pkg_dirs = await asyncio.to_thread(_fetch_index)
    except Exception as exc:
        return web.json_response({"error": f"Failed to fetch index: {exc}"}, status=502)

    # Resolve each package in parallel
    async def _resolve_one(pkg_name):
        try:
            url = await asyncio.to_thread(
                get_wheel_url, pkg_name, torch_version, cuda_version, python_version
            )
        except Exception:
            url = None
        norm = _normalize_pkg(pkg_name)
        return {
            "name": pkg_name,
            "wheel_url": url,
            "available": url is not None,
            "installed_version": installed_pkgs.get(norm),
        }

    results = await asyncio.gather(*[_resolve_one(p) for p in pkg_dirs])
    # Sort: available first, then alphabetical
    results.sort(key=lambda r: (not r["available"], r["name"]))

    return web.json_response({
        "packages": results,
        "env": env_param,
        "cuda_version": cuda_version,
        "torch_version": torch_version,
        "python_version": python_version,
        "platform_tags": _platform_tags(),
    })


# ---------------------------------------------------------------------------
# Route 9: Install a wheel into an env
# ---------------------------------------------------------------------------

@routes.post("/env-manager/install-wheel")
async def install_wheel(request):
    """Install a cuda-wheel into the selected environment."""
    import asyncio
    import sys as _sys

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)

    wheel_url = body.get("wheel_url", "")
    package = body.get("package", "")
    env_param = body.get("env", "main")

    if not wheel_url:
        return web.json_response({"error": "missing 'wheel_url'"}, status=400)

    # Safety: only allow URLs from cuda-wheels index
    from comfy_env.packages.cuda_wheels import CUDA_WHEELS_INDEX
    if not wheel_url.startswith(CUDA_WHEELS_INDEX):
        return web.json_response({"error": "URL not from cuda-wheels index"}, status=403)

    # Find pip/uv
    uv_path = shutil.which("uv") or shutil.which("pip")
    if not uv_path:
        return web.json_response({"error": "neither uv nor pip found"}, status=500)
    use_uv = "uv" in Path(uv_path).name

    if env_param == "main":
        # Install into the running Python's env
        if use_uv:
            cmd = [uv_path, "pip", "install", "--no-deps", wheel_url]
        else:
            cmd = [uv_path, "install", "--no-deps", wheel_url]
    else:
        # Install into a pixi env's Python
        env_path = Path(env_param).resolve()
        python_path = env_path / "env" / "bin" / "python"
        if not python_path.exists():
            # Windows fallback
            python_path = env_path / "env" / "python.exe"
        if not python_path.exists():
            return web.json_response({"error": "Python not found in env"}, status=404)

        if use_uv:
            cmd = [uv_path, "pip", "install", "--python", str(python_path),
                   "--no-deps", wheel_url]
        else:
            cmd = [str(python_path), "-m", "pip", "install", "--no-deps", wheel_url]

    log.info(f"Installing {package} from {wheel_url} into {env_param}")

    try:
        def _run_install():
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300,
            )
            return result.returncode, result.stdout, result.stderr
        returncode, stdout, stderr = await asyncio.to_thread(_run_install)
    except Exception as exc:
        return web.json_response({"error": str(exc)}, status=500)

    if returncode != 0:
        return web.json_response({
            "error": "Installation failed",
            "stdout": stdout[-2000:] if stdout else "",
            "stderr": stderr[-2000:] if stderr else "",
        }, status=500)

    return web.json_response({
        "installed": package,
        "wheel_url": wheel_url,
        "env": env_param,
        "stdout": stdout[-1000:] if stdout else "",
    })


# ---------------------------------------------------------------------------
# Route 10: Version
# ---------------------------------------------------------------------------

@routes.get("/env-manager/version")
async def get_version(request):
    return web.Response(text=VERSION)


log.info(f"ComfyUI-Env-Manager v{VERSION} routes registered")
