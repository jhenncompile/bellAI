"""Ejecutor de subprocesos con soporte para spinners de Rich y diagnóstico de comandos."""
import subprocess
import os
import sys
from typing import Tuple, List, Optional
from cli.console import console

def run_cmd(
    cmd: List[str] | str,
    cwd: Optional[str] = None,
    env: Optional[dict] = None,
    silent: bool = False,
    shell: bool = False,
) -> Tuple[bool, str]:
    """Ejecuta un comando en el sistema y devuelve (éxito, salida)."""
    current_env = os.environ.copy()
    if env:
        current_env.update(env)

    try:
        p = subprocess.Popen(
            cmd,
            cwd=cwd,
            env=current_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=shell,
            encoding="utf-8",
            errors="replace",
        )
        output_lines = []
        for line in p.stdout:
            output_lines.append(line)
            if not silent:
                console.print(f"[dim]{line.rstrip()}[/dim]")
        p.wait()
        full_out = "".join(output_lines)
        return p.returncode == 0, full_out
    except Exception as e:
        return False, str(e)
