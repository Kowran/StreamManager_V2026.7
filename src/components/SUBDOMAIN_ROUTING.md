# Sistema de Roteamento por Subdomínios

## Visão Geral

O StreamManager implementa um sistema inteligente de roteamento baseado em subdomínios que separa a landing page pública do painel de login/administração.

## Subdomínios Suportados

### 1. Landing Page (Home)
- **Subdomínios**: `home.*`, `www.*`
- **Funcionalidade**: Exibe a página inicial com informações sobre o serviço
- **Recursos**:
  - Apresentação dos serviços de streaming
  - **Seção SMM completa com 8 redes sociais**:
    - Instagram
    - Facebook
    - Twitter/X
    - YouTube
    - WhatsApp
    - Kick
    - TikTok
    - LinkedIn
  - Recursos do sistema
  - Estatísticas
  - Call-to-action para criar conta

### 2. Painel de Login
- **Subdomínios**: `login.*`, `painel.*`, `panel.*`, `dashboard.*`
- **Funcionalidade**: Acesso direto ao formulário de login
- **Recursos**:
  - Login de usuários
  - Recuperação de senha
  - Registro de novos usuários
  - Acesso ao dashboard após autenticação

### 3. Localhost (Desenvolvimento)
- **URL**: `localhost:5173` ou `127.0.0.1:5173`
- **Funcionalidade**: Funciona como landing page por padrão
- **Navegação**: Usa hash routing para alternar entre landing e login

## Implementação Técnica

### Detecção de Subdomínio

```typescript
function detectSubdomain() {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  if (parts.length > 2 || hostname.includes('localhost')) {
    const sub = parts[0];
    if (sub === 'login' || sub === 'painel' || sub === 'panel' || sub === 'dashboard') {
      setSubdomain('login');
      setShowLanding(false);
    } else if (sub === 'home' || sub === 'www' || hostname.includes('localhost')) {
      setSubdomain('home');
      setShowLanding(true);
    }
  }
}
```

### Redirecionamento Automático

#### Da Landing para Login
Quando o usuário clica em "Entrar" na landing page:
```typescript
// Em produção
window.location.href = `${protocol}//login.${mainDomain}`;

// Exemplo: https://home.seudominio.com → https://login.seudominio.com
```

#### Do Login para Landing
Quando o usuário clica em "Voltar" no painel de login:
```typescript
// Em produção
window.location.href = `${protocol}//home.${mainDomain}`;

// Exemplo: https://login.seudominio.com → https://home.seudominio.com
```

## Título Dinâmico da Página

O sistema ajusta automaticamente o título da página baseado no subdomínio:

```javascript
// Landing Page (home.*)
document.title = 'StreamManager - Streaming & SMM Services';

// Painel de Login (login.*)
document.title = 'Login - StreamManager';

// Padrão
document.title = 'StreamManager - Streaming Accounts Management System';
```

## Seção SMM na Landing Page

A landing page agora inclui uma seção dedicada ao **Painel SMM** (Social Media Marketing) com as seguintes características:

### Redes Sociais Disponíveis

1. **Instagram**
   - Seguidores, curtidas, visualizações
   - Cor: Rosa/Roxo (`from-pink-500 to-purple-600`)

2. **Facebook**
   - Curtidas, seguidores, compartilhamentos
   - Cor: Azul (`from-blue-600 to-blue-700`)

3. **Twitter/X**
   - Seguidores, retweets, curtidas
   - Cor: Azul claro (`from-sky-400 to-blue-500`)

4. **YouTube**
   - Inscritos, visualizações, curtidas
   - Cor: Vermelho (`from-red-600 to-red-700`)

5. **WhatsApp**
   - Membros de grupo, visualizações de status
   - Cor: Verde (`from-green-500 to-green-600`)

6. **Kick**
   - Seguidores, visualizações, engajamento
   - Cor: Verde esmeralda (`from-emerald-500 to-teal-600`)

7. **TikTok**
   - Seguidores, curtidas, visualizações
   - Cor: Preto (`from-gray-900 to-gray-800`)

8. **LinkedIn**
   - Conexões, curtidas, compartilhamentos
   - Cor: Azul escuro (`from-blue-700 to-blue-800`)

### Interatividade

Cada card de rede social possui:
- Ícone animado (aumenta ao passar o mouse)
- Gradiente colorido característico da rede
- Descrição dos serviços
- Link "Ver serviços" que redireciona para o painel
- Efeito hover com elevação e animação

### Design Responsivo

A seção SMM se adapta a diferentes tamanhos de tela:
- **Mobile**: 1 coluna
- **Tablet** (sm): 2 colunas
- **Desktop** (lg): 4 colunas

## Benefícios da Arquitetura

### Separação de Responsabilidades
- **Landing Page**: Foco em marketing e apresentação
- **Painel de Login**: Foco em autenticação e segurança

### SEO e Performance
- Landing page otimizada para motores de busca
- Painel de login separado para melhor cache e segurança

### Segurança
- Possibilidade de aplicar regras de firewall diferentes para cada subdomínio
- Rate limiting independente
- Certificados SSL dedicados

### Experiência do Usuário
- URLs claras e intuitivas
- Navegação simplificada
- Branding consistente

## Configuração de Produção

### Pré-requisitos
1. Domínio próprio registrado
2. Servidor web configurado (Nginx ou Apache)
3. DNS configurado com registros A ou CNAME

### Passos de Implementação

1. **Construir o projeto**
   ```bash
   npm run build
   ```

2. **Fazer upload da pasta `dist` para o servidor**
   ```bash
   scp -r dist/* usuario@servidor:/var/www/streammanager/
   ```

3. **Configurar o servidor web**
   - Nginx: `/etc/nginx/sites-available/streammanager`
   - Apache: `/etc/apache2/sites-available/streammanager.conf`

4. **Configurar DNS**
   - Adicionar registros A ou CNAME para `home`, `login`, e `www`

5. **Configurar SSL**
   ```bash
   sudo certbot --nginx -d home.seudominio.com -d login.seudominio.com
   ```

6. **Testar**
   - Acessar `https://home.seudominio.com`
   - Acessar `https://login.seudominio.com`

## Desenvolvimento Local

Durante o desenvolvimento, o sistema funciona perfeitamente em localhost:

```bash
npm run dev
```

Acesse:
- Landing page: `http://localhost:5173`
- Login (via botão "Entrar"): permanece em localhost com hash routing

## Fallback e Compatibilidade

Se os subdomínios não estiverem configurados (ex: acesso via IP direto), o sistema:
1. Exibe a landing page por padrão
2. Permite navegação via botão "Entrar"
3. Mantém funcionalidade completa

## Manutenção

### Adicionar Novo Subdomínio

1. Adicionar lógica de detecção em `App.tsx`:
   ```typescript
   if (sub === 'novo-subdomain') {
     setSubdomain('novo-subdomain');
   }
   ```

2. Atualizar configuração do servidor web

3. Adicionar registro DNS

### Modificar Comportamento

Editar a função `detectSubdomain()` em `/src/App.tsx`:
```typescript
function detectSubdomain() {
  // Sua lógica personalizada aqui
}
```

## Troubleshooting

### Subdomínio não funciona
- Verificar registros DNS (pode levar até 48h para propagar)
- Verificar configuração do servidor web
- Verificar logs do servidor: `/var/log/nginx/error.log`

### Redirecionamento não funciona
- Verificar se o JavaScript está carregando corretamente
- Abrir console do navegador para verificar erros
- Verificar se o domínio principal está correto

### SSL não funciona
- Renovar certificados: `sudo certbot renew`
- Verificar portas 80 e 443 abertas no firewall
- Verificar configuração de redirect HTTP→HTTPS

## Conclusão

O sistema de subdomínios do StreamManager oferece uma arquitetura moderna, segura e escalável, separando claramente a experiência de marketing (landing page) da experiência de aplicação (painel de login), enquanto mantém uma experiência unificada para o usuário.

A adição da seção SMM com suporte para WhatsApp, Kick e outras 6 redes sociais principais torna a landing page muito mais completa e atraente para potenciais clientes interessados em serviços de marketing de redes sociais.
