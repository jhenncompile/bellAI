"""Plantillas de configuración NGINX para BellAI en VPS / AWS Linux."""

def generar_nginx_dominio(dominio: str, web_root: str = "/var/www/bellia-frontend") -> str:
    """Configuración NGINX para despliegue con dominio propio."""
    return f"""# Configuración BellAI para dominio: {dominio}
server {{
    listen 80;
    server_name {dominio} www.{dominio};

    # Frontend SPA (React 19 + Vite buildeado)
    root {web_root};
    index index.html;

    # Compresión gzip para máxima velocidad
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Tamaño máximo de fotos y modelos 3D
    client_max_body_size 100M;

    # Frontend Routing
    location / {{
        try_files $uri $uri/ /index.html;
    }}

    # Proxy hacia el Backend NestJS (puerto 8000)
    location /api/ {{
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;

        # Soporte para WebSockets y Server-Sent Events (Asistente BellAI)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Cabeceras estándar de cliente
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Tiempos de espera ampliados para tareas asíncronas de IA y escaneo de avatar
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;
    }}

    # Archivos multimedia subidos (fotos protegidas y recursos)
    location /uploads/ {{
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
    }}

    # Swagger / Documentación técnica
    location /api/docs {{
        proxy_pass http://127.0.0.1:8000/api/docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }}
}}
"""


def generar_nginx_ip(ip_publica: str, web_root: str = "/var/www/bellia-frontend") -> str:
    """Configuración NGINX para despliegue directo por IP pública sin dominio."""
    return f"""# Configuración BellAI para acceso directo por IP: {ip_publica}
server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root {web_root};
    index index.html;

    client_max_body_size 100M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {{
        try_files $uri $uri/ /index.html;
    }}

    location /api/ {{
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }}

    location /uploads/ {{
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }}
}}
"""
