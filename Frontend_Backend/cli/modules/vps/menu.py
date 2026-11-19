"""Menú de configuración del VPS / AWS Linux (Swap, Firewall, SSL Certbot, Recursos)."""
import os
import subprocess
from cli.console import console, print_header
from rich.prompt import Prompt
from rich.table import Table
from cli.utils.process_runner import run_cmd


def configurar_swap():
    console.print("\n[bold cyan]Configurando Memoria SWAP en Linux...[/bold cyan]")
    ok, out = run_cmd(["swapon", "--show"], silent=True)
    if out.strip():
        console.print(f"[yellow]Ya existe memoria SWAP configurada:[/yellow]\n{out.strip()}")
        recrear = Prompt.ask("¿Deseas redimensionar a 4GB de todas formas? (s/n)", choices=["s", "n"], default="n")
        if recrear != "s":
            return

    size_gb = Prompt.ask("Tamaño de SWAP en GB (recomendado: 4)", default="4")
    console.print(f"[cyan]Creando archivo /swapfile de {size_gb}GB...[/cyan]")
    run_cmd(["swapoff", "/swapfile"], silent=True)
    run_cmd(["fallocate", "-l", f"{size_gb}G", "/swapfile"])
    run_cmd(["chmod", "600", "/swapfile"])
    run_cmd(["mkswap", "/swapfile"])
    run_cmd(["swapon", "/swapfile"])

    # Añadir a /etc/fstab si no está
    try:
        with open("/etc/fstab", "r") as f:
            fstab = f.read()
        if "/swapfile" not in fstab:
            with open("/etc/fstab", "a") as f:
                f.write("\n/swapfile swap swap defaults 0 0\n")
            console.print("[green]✔ Entrada agregada a /etc/fstab para persistencia tras reinicio.[/green]")
    except Exception:
        pass

    console.print(f"[bold green]✔ SWAP de {size_gb}GB configurada y activa.[/bold green]")


def configurar_firewall():
    console.print("\n[bold cyan]Configurando Firewall UFW (Seguridad del VPS)...[/bold cyan]")
    console.print("[dim]Reglas: SSH (22/tcp), HTTP (80/tcp), HTTPS (443/tcp)[/dim]")
    run_cmd(["ufw", "allow", "22/tcp"])
    run_cmd(["ufw", "allow", "80/tcp"])
    run_cmd(["ufw", "allow", "443/tcp"])
    run_cmd(["ufw", "--force", "enable"])
    ok, out = run_cmd(["ufw", "status", "verbose"])
    console.print(f"[bold green]✔ Firewall UFW activo con puertos 22, 80 y 443 permitidos.[/bold green]")


def instalar_ssl():
    console.print("\n[bold cyan]Instalando Certificado SSL Let's Encrypt con Certbot...[/bold cyan]")
    dominio = Prompt.ask("Ingresa el dominio principal (debe apuntar al IP de este VPS)")
    email = Prompt.ask("Ingresa tu email para alertas de renovación de Let's Encrypt")

    cmd = [
        "certbot",
        "--nginx",
        "-d", dominio,
        "-d", f"www.{dominio}",
        "--non-interactive",
        "--agree-tos",
        "-m", email,
        "--redirect",
    ]
    console.print(f"[cyan]Ejecutando certbot para {dominio}...[/cyan]")
    ok, out = run_cmd(cmd)
    if ok:
        console.print(f"[bold green]✔ Certificado SSL instalado exitosamente para https://{dominio}[/bold green]")
        run_cmd(["systemctl", "reload", "nginx"], silent=True)
    else:
        console.print(f"[bold red]Error al obtener certificado SSL:[/bold red] {out[:400]}")


def ver_metricas():
    tabla = Table(title="Métricas de Recursos del Servidor", show_header=True, header_style="bold magenta")
    tabla.add_column("Recurso", style="cyan")
    tabla.add_column("Uso / Detalle", style="white")

    # RAM y SWAP con free -h
    ok_m, mem_out = run_cmd(["free", "-h"], silent=True)
    if ok_m and mem_out.strip():
        lines = mem_out.strip().splitlines()
        if len(lines) >= 2:
            tabla.add_row("Memoria RAM", lines[1])
        if len(lines) >= 3:
            tabla.add_row("Memoria SWAP", lines[2])

    # Disco con df -h /
    ok_d, df_out = run_cmd(["df", "-h", "/"], silent=True)
    if ok_d and df_out.strip():
        lines = df_out.strip().splitlines()
        if len(lines) >= 2:
            tabla.add_row("Disco Raíz (/)", lines[1])

    # CPU Uptime y Carga
    ok_u, up_out = run_cmd(["uptime"], silent=True)
    if ok_u:
        tabla.add_row("Carga / Uptime", up_out.strip())

    console.print(tabla)


def menu_vps():
    while True:
        print_header("MANAGER > CONFIGURACIÓN VPS / AWS LINUX")
        console.print("[1] Configurar Memoria SWAP (Previene Out-Of-Memory)")
        console.print("[2] Configurar Firewall UFW (SSH 22, HTTP 80, HTTPS 443)")
        console.print("[3] Certificado SSL Automático (Let's Encrypt / Certbot)")
        console.print("[4] Inspeccionar Recursos del Servidor (CPU, RAM, Disco)")
        console.print("[0] Volver al Menú Principal")

        op = Prompt.ask("\nSelecciona una opción", choices=["1", "2", "3", "4", "0"], default="1")

        if op == "1":
            configurar_swap()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "2":
            configurar_firewall()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "3":
            instalar_ssl()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "4":
            ver_metricas()
            Prompt.ask("\nPresiona Enter para continuar")
        elif op == "0":
            break
