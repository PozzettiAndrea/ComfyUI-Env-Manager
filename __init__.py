"""ComfyUI-Env-Manager - Environment visibility panel for comfy-env."""

import os
import sys

sys.path.append(os.path.dirname(__file__))
import env_manager_server  # noqa: F401  — registers API routes on import

NODE_CLASS_MAPPINGS = {}
WEB_DIRECTORY = "js"
__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
