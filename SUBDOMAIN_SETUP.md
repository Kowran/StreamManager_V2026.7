# Configuração de Subdomínios - StreamManager

Este guia explica como configurar subdomínios para separar a landing page e o painel de login.

## Estrutura de Subdomínios

O sistema suporta três subdomínios principais:

1. **`home.seudominio.com`** - Landing page pública
2. **`login.seudominio.com`** - Painel de login/dashboard
3. **`www.seudominio.com`** ou **`seudominio.com`** - Domínio principal (redireciona para home)

## Configuração DNS

Configure os seguintes registros DNS no seu provedor de domínio:

### Registros A (para IP fixo)
```
Tipo: A
Nome: home
Valor: SEU_IP_DO_SERVIDOR
TTL: 3600

Tipo: A
Nome: login
Valor: SEU_IP_DO_SERVIDOR
TTL: 3600

Tipo: A
Nome: @
Valor: SEU_IP_DO_SERVIDOR
TTL: 3600

Tipo: A
Nome: www
Valor: SEU_IP_DO_SERVIDOR
TTL: 3600
```

### Ou Registros CNAME (para apontar para outro domínio)
```
Tipo: CNAME
Nome: home
Valor: seudominio.com
TTL: 3600

Tipo: CNAME
Nome: login
Valor: seudominio.com
TTL: 3600

Tipo: CNAME
Nome: www
Valor: seudominio.com
TTL: 3600
```

## Configuração do Servidor Web

### Nginx

Crie um arquivo de configuração em `/etc/nginx/sites-available/streammanager`:

```nginx
# Landing Page (home)
server {
    listen 80;
    listen [::]:80;
    server_name home.seudominio.com;

    root /var/www/streammanager/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Painel de Login
server {
    listen 80;
    listen [::]:80;
    server_name login.seudominio.com painel.seudominio.com panel.seudominio.com dashboard.seudominio.com;

    root /var/www/streammanager/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Domínio principal (redireciona para home)
server {
    listen 80;
    listen [::]:80;
    server_name seudominio.com www.seudominio.com;

    return 301 http://home.seudominio.com$request_uri;
}
```

Ative a configuração:
```bash
sudo ln -s /etc/nginx/sites-available/streammanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Apache

Crie um arquivo de configuração em `/etc/apache2/sites-available/streammanager.conf`:

```apache
# Landing Page (home)
<VirtualHost *:80>
    ServerName home.seudominio.com
    DocumentRoot /var/www/streammanager/dist

    <Directory /var/www/streammanager/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ index.html [L]
    </Directory>

    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
</VirtualHost>

# Painel de Login
<VirtualHost *:80>
    ServerName login.seudominio.com
    ServerAlias painel.seudominio.com panel.seudominio.com dashboard.seudominio.com
    DocumentRoot /var/www/streammanager/dist

    <Directory /var/www/streammanager/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ index.html [L]
    </Directory>

    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
</VirtualHost>

# Domínio principal (redireciona para home)
<VirtualHost *:80>
    ServerName seudominio.com
    ServerAlias www.seudominio.com
    Redirect 301 / http://home.seudominio.com/
</VirtualHost>
```

Ative a configuração:
```bash
sudo a2ensite streammanager
sudo a2enmod rewrite headers
sudo systemctl reload apache2
```

## Configuração SSL (HTTPS)

### Usando Certbot (Let's Encrypt)

```bash
# Para Nginx
sudo certbot --nginx -d seudominio.com -d www.seudominio.com -d home.seudominio.com -d login.seudominio.com

# Para Apache
sudo certbot --apache -d seudominio.com -d www.seudominio.com -d home.seudominio.com -d login.seudominio.com
```

## Teste Local

Para testar localmente, adicione as seguintes entradas ao arquivo `/etc/hosts` (Linux/Mac) ou `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1 home.localhost
127.0.0.1 login.localhost
127.0.0.1 localhost
```

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

Acesse:
- Landing page: `http://localhost:5173`
- Painel de login: `http://localhost:5173` (a detecção de subdomínio funciona automaticamente em localhost)

## Como Funciona

O sistema detecta automaticamente o subdomínio através do JavaScript:

1. **Landing Page** (`home.*`): Exibe a página inicial com informações sobre o serviço
2. **Painel de Login** (`login.*`, `painel.*`, `panel.*`, `dashboard.*`): Exibe diretamente o formulário de login
3. **Domínio Principal**: Por padrão, exibe a landing page

### Fluxo de Navegação

- Quando o usuário clica em "Entrar" na landing page do subdomínio `home.*`, é redirecionado para `login.*`
- Quando o usuário clica em "Voltar" no painel de login, é redirecionado para `home.*`
- Em localhost, a navegação funciona através de hash routing

## Serviço SMM na Landing Page

A landing page agora inclui uma seção dedicada aos serviços de SMM (Social Media Marketing) com as seguintes plataformas:

- Instagram
- Facebook
- Twitter/X
- YouTube
- WhatsApp
- Kick
- TikTok
- LinkedIn

Cada rede social é apresentada com seu ícone característico e descrição dos serviços disponíveis.

## Suporte

Em caso de dúvidas, consulte a documentação do seu provedor de DNS ou servidor web.
