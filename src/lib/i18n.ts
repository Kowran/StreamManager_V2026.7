export type Language = 'pt' | 'en' | 'es';

export interface Translation {
  // Auth
  loginTitle: string;
  signUpTitle: string;
  login: string;
  signUp: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  forgotPassword: string;
  backToLogin: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  signingIn: string;
  creatingAccount: string;
  logout: string;
  loggedAs: string;
  
  // Password validation
  passwordMinLength: string;
  passwordsDoNotMatch: string;
  passwordTooWeak: string;
  passwordStrong: string;
  passwordMedium: string;
  passwordWeak: string;
  passwordVeryWeak: string;
  passwordNeedsLowercase: string;
  passwordNeedsUppercase: string;
  passwordNeedsNumber: string;
  passwordNeedsSpecial: string;
  
  // Errors
  invalidEmail: string;
  emailAlreadyRegistered: string;
  incorrectCredentials: string;
  emailNotConfirmed: string;
  databaseError: string;
  passwordResetError: string;
  passwordUpdateError: string;
  
  // Password reset
  emailSent: string;
  checkEmailInstructions: string;
  nextSteps: string;
  checkEmailInbox: string;
  clickResetLink: string;
  createNewPassword: string;
  loginWithNewPassword: string;
  passwordResetDescription: string;
  enterEmailForReset: string;
  sendingEmail: string;
  sendResetEmail: string;
  securityInfo: string;
  resetLinkExpires: string;
  onlyValidEmail: string;
  checkSpamFolder: string;
  contactSupportIfNeeded: string;
  invalidResetLink: string;
  resetLinkExpiredOrInvalid: string;
  passwordResetSuccess: string;
  confirmNewPassword: string;
  updatingPassword: string;
  updatePassword: string;
  requirements: string;
  useMixedCharacters: string;
  avoidPersonalInfo: string;
  dontReusePasswords: string;
  usePasswordManager: string;
  
  // Dashboard
  dashboard: string;
  welcomeBack: string;
  quickActions: string;
  buyInStore: string;
  systemOnline: string;
  
  // Navigation
  accounts: string;
  clients: string;
  sellers: string;
  services: string;
  store: string;
  myCredits: string;
  myPurchases: string;
  
  // Common
  name: string;
  edit: string;
  delete: string;
  save: string;
  saving: string;
  cancel: string;
  add: string;
  search: string;
  actions: string;
  status: string;
  active: string;
  inactive: string;
  createdAt: string;
  updatedAt: string;
  noDataFound: string;
  confirmDelete: string;
  
  // Accounts
  newAccount: string;
  editAccount: string;
  service: string;
  seller: string;
  accountEmail: string;
  purchaseDate: string;
  expiryDate: string;
  totalProfiles: string;
  monthlyPrice: string;
  notes: string;
  expired: string;
  suspended: string;
  accountProfiles: string;
  
  // Profiles
  newProfile: string;
  editProfile: string;
  profileName: string;
  client: string;
  assignedDate: string;
  pricePaid: string;
  profilesUsed: string;
  of: string;
  
  // Services
  streamingServices: string;
  newService: string;
  editService: string;
  serviceName: string;
  serviceExample: string;
  logoUrl: string;
  logoDescription: string;
  logoPreview: string;
  errorLoadingImage: string;
  maxProfiles: string;
  errorSavingService: string;
  errorDeletingService: string;
  
  // Sellers
  newSeller: string;
  editSeller: string;
  phone: string;
  
  // Store
  noPurchasesFound: string;
  noStoreOrders: string;
  purchaseDetails: string;
  product: string;
  amountPaid: string;
  purchaseDate: string;
  accessCredentials: string;
  copyEmail: string;
  copyPassword: string;
  instructions: string;
  viewCredentials: string;
  delivered: string;
  importantInfo: string;
  keepCredentialsSafe: string;
  dontShareCredentials: string;
  contactWhatsApp: string;
  close: string;
  
  // Profile
  myProfile: string;
  profileDescription: string;
  profileNotFound: string;
  couldNotLoadProfile: string;
  editProfile: string;
  profileUpdated: string;
  basicInformation: string;
  accountStats: string;
  memberSince: string;
  lastLogin: string;
  totalLogins: string;
  accountDetails: string;
  userId: string;
  accountCreated: string;
  lastUpdate: string;
  quickActions: string;
  changePassword: string;
  notEditable: string;
  preferredLanguage: string;
  accountType: string;
  profilePhotoUrl: string;
  pasteImageUrl: string;
  accountSecurity: string;
  keepAccountSecure: string;
  securityTips: string;
  useUniquePassword: string;
  logoutSharedDevices: string;
  keepInfoUpdated: string;
  changePhoto: string;
  
  // Password change
  currentPassword: string;
  newPassword: string;
  passwordChangedSuccessfully: string;
  incorrectCurrentPassword: string;
  passwordMustBeStronger: string;
  passwordMustBeDifferent: string;
  changingPassword: string;
  
  // Access guard
  premiumAccessRequired: string;
  validFor30Days: string;
  accessExpired: string;
  dayRemaining: string;
  daysRemaining: string;
  
  // General
  language: string;
  never: string;

  // Login subtitle
  loginSubtitle: string;

  // Support System
  supportCenter: string;
  newTicket: string;
  createTicket: string;
  createFirstTicket: string;
  creating: string;
  problemCategory: string;
  relatedProduct: string;
  relatedOrder: string;
  selectProduct: string;
  selectOrder: string;
  subject: string;
  describeIssue: string;
  priority: string;
  lowPriority: string;
  mediumPriority: string;
  highPriority: string;
  urgentPriority: string;
  detailedDescription: string;
  totalTickets: string;
  openTickets: string;
  resolvedTickets: string;
  allStatuses: string;
  open: string;
  inProgress: string;
  waitingUser: string;
  resolved: string;
  closed: string;
  urgent: string;
  high: string;
  medium: string;
  low: string;
  noTicketsFound: string;
  noSupportTickets: string;
  adjustSearchFilters: string;
  originalDescription: string;
  ticketDetails: string;
  category: string;
  conversation: string;
  waitingSupport: string;
  noMessagesYet: string;
  ticketResolved: string;
  sendingMessageWillReopen: string;
  ourTeamResponds: string;
  reopenAndSend: string;
  sendMessage: string;
  needQuickHelp: string;
  contactWhatsAppDirect: string;
  talkOnWhatsApp: string;

  // Payment Errors
  binanceGeoBlockError: string;
  paymentCreationError: string;

  // Forum/Community
  communityForum: string;
  filterByCategory: string;
  allCategories: string;
  tutorials: string;
  news: string;
  updates: string;
  announcements: string;
  discussions: string;

  // Admin User Management
  userManagement: string;
  searchByEmailOrName: string;
  allRoles: string;
  allStatus: string;
  admin: string;
  banned: string;
  bannedUsers: string;
  activeUsers: string;
  admins: string;
  totalUsers: string;
  noUsersFound: string;
  tryAdjustingFilters: string;
  noUsersRegistered: string;
  noName: string;
  logins: string;
  banUser: string;
  unbanUser: string;
  makeAdmin: string;
  removeAdmin: string;
  makeCustomer: string;
  confirmRoleChange: string;
  confirmRoleChangeMessage: string;
  roleUpdated: string;
  cannotChangeOwnRole: string;

  // Triple-A Payment Gateway
  tripleAConfig: string;
  tripleAPayment: string;
  tripleANotConfigured: string;
}

export const languages = [
  { code: 'pt' as Language, name: 'Português', flag: '🇧🇷' },
  { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
  { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
];

const translations: Record<Language, Translation> = {
  pt: {
    // Auth
    loginTitle: 'Entrar na sua conta',
    signUpTitle: 'Criar nova conta',
    login: 'Entrar',
    signUp: 'Criar conta',
    email: 'Email',
    password: 'Senha',
    confirmPassword: 'Confirmar senha',
    fullName: 'Nome completo',
    forgotPassword: 'Esqueceu a senha?',
    backToLogin: 'Voltar ao login',
    alreadyHaveAccount: 'Já tem uma conta? Fazer login',
    dontHaveAccount: 'Não tem uma conta? Criar conta',
    signingIn: 'Entrando...',
    creatingAccount: 'Criando conta...',
    logout: 'Sair',
    loggedAs: 'Logado como',
    
    // Password validation
    passwordMinLength: 'A senha deve ter pelo menos 6 caracteres',
    passwordsDoNotMatch: 'As senhas não coincidem',
    passwordTooWeak: 'A senha é muito fraca',
    passwordStrong: 'Forte',
    passwordMedium: 'Média',
    passwordWeak: 'Fraca',
    passwordVeryWeak: 'Muito fraca',
    passwordNeedsLowercase: 'Pelo menos uma letra minúscula',
    passwordNeedsUppercase: 'Pelo menos uma letra maiúscula',
    passwordNeedsNumber: 'Pelo menos um número',
    passwordNeedsSpecial: 'Pelo menos um caractere especial',
    
    // Errors
    invalidEmail: 'Email inválido',
    emailAlreadyRegistered: 'Este email já está registrado',
    incorrectCredentials: 'Email ou senha incorretos',
    emailNotConfirmed: 'Email não confirmado',
    databaseError: 'Erro no banco de dados',
    passwordResetError: 'Erro ao enviar email de recuperação',
    passwordUpdateError: 'Erro ao atualizar senha',
    
    // Password reset
    emailSent: 'Email enviado!',
    checkEmailInstructions: 'Verifique sua caixa de entrada para instruções de recuperação',
    nextSteps: 'Próximos passos:',
    checkEmailInbox: 'Verifique sua caixa de entrada',
    clickResetLink: 'Clique no link de recuperação',
    createNewPassword: 'Criar nova senha',
    loginWithNewPassword: 'Faça login com a nova senha',
    passwordResetDescription: 'Digite seu email para receber instruções de recuperação',
    enterEmailForReset: 'Digite seu email para recuperação',
    sendingEmail: 'Enviando email...',
    sendResetEmail: 'Enviar email de recuperação',
    securityInfo: 'Informações de segurança',
    resetLinkExpires: 'O link expira em 1 hora',
    onlyValidEmail: 'Apenas emails válidos recebem o link',
    checkSpamFolder: 'Verifique a pasta de spam',
    contactSupportIfNeeded: 'Entre em contato se precisar de ajuda',
    invalidResetLink: 'Link de recuperação inválido',
    resetLinkExpiredOrInvalid: 'O link expirou ou é inválido. Solicite um novo.',
    passwordResetSuccess: 'Senha alterada com sucesso! Faça login com sua nova senha.',
    confirmNewPassword: 'Confirmar nova senha',
    updatingPassword: 'Atualizando senha...',
    updatePassword: 'Atualizar senha',
    requirements: 'Requisitos',
    useMixedCharacters: 'Use letras maiúsculas, minúsculas, números e símbolos',
    avoidPersonalInfo: 'Evite informações pessoais',
    dontReusePasswords: 'Não reutilize senhas de outras contas',
    usePasswordManager: 'Considere usar um gerenciador de senhas',
    
    // Dashboard
    dashboard: 'Dashboard',
    welcomeBack: 'Bem-vindo de volta ao seu painel de controle',
    quickActions: 'Ações Rápidas',
    buyInStore: 'Comprar na Loja',
    systemOnline: 'Sistema Online',
    
    // Navigation
    accounts: 'Contas',
    clients: 'Clientes',
    sellers: 'Vendedores',
    services: 'Serviços',
    store: 'Loja',
    myCredits: 'Meus Créditos',
    myPurchases: 'Minhas Compras',
    
    // Common
    name: 'Nome',
    edit: 'Editar',
    delete: 'Excluir',
    save: 'Salvar',
    saving: 'Salvando...',
    cancel: 'Cancelar',
    add: 'Adicionar',
    search: 'Buscar',
    actions: 'Ações',
    status: 'Status',
    active: 'Ativo',
    inactive: 'Inativo',
    createdAt: 'Criado em',
    updatedAt: 'Atualizado em',
    noDataFound: 'Nenhum dado encontrado',
    confirmDelete: 'Tem certeza que deseja excluir?',
    
    // Accounts
    newAccount: 'Nova Conta',
    editAccount: 'Editar Conta',
    service: 'Serviço',
    seller: 'Vendedor',
    accountEmail: 'Email da Conta',
    purchaseDate: 'Data de Compra',
    expiryDate: 'Data de Expiração',
    totalProfiles: 'Total de Perfis',
    monthlyPrice: 'Preço Mensal',
    notes: 'Observações',
    expired: 'Expirado',
    suspended: 'Suspenso',
    accountProfiles: 'Perfis da Conta',
    
    // Profiles
    newProfile: 'Novo Perfil',
    editProfile: 'Editar Perfil',
    profileName: 'Nome do Perfil',
    client: 'Cliente',
    assignedDate: 'Data de Atribuição',
    pricePaid: 'Preço Pago',
    profilesUsed: 'perfis utilizados',
    of: 'de',
    
    // Services
    streamingServices: 'Serviços de Streaming',
    newService: 'Novo Serviço',
    editService: 'Editar Serviço',
    serviceName: 'Nome do Serviço',
    serviceExample: 'Ex: Netflix, Disney+, etc.',
    logoUrl: 'URL do Logo',
    logoDescription: 'URL da imagem do logo (opcional)',
    logoPreview: 'Pré-visualização do Logo',
    errorLoadingImage: 'Erro ao carregar imagem',
    maxProfiles: 'Máximo de Perfis',
    errorSavingService: 'Erro ao salvar serviço',
    errorDeletingService: 'Erro ao excluir serviço',
    
    // Sellers
    newSeller: 'Novo Vendedor',
    editSeller: 'Editar Vendedor',
    phone: 'Telefone',
    
    // Store
    noPurchasesFound: 'Nenhuma compra encontrada',
    noStoreOrders: 'Você ainda não fez nenhuma compra na loja',
    purchaseDetails: 'Detalhes da Compra',
    product: 'Produto',
    amountPaid: 'Valor Pago',
    accessCredentials: 'Credenciais de Acesso',
    copyEmail: 'Copiar email',
    copyPassword: 'Copiar senha',
    instructions: 'Instruções',
    viewCredentials: 'Ver Credenciais',
    delivered: 'Entregue',
    importantInfo: 'Informações Importantes',
    keepCredentialsSafe: 'Mantenha suas credenciais seguras',
    dontShareCredentials: 'Não compartilhe suas credenciais',
    contactWhatsApp: 'Entre em contato via WhatsApp se precisar de ajuda',
    close: 'Fechar',
    
    // Profile
    myProfile: 'Meu Perfil',
    profileDescription: 'Gerencie suas informações pessoais e configurações',
    profileNotFound: 'Perfil não encontrado',
    couldNotLoadProfile: 'Não foi possível carregar o perfil',
    profileUpdated: 'Perfil atualizado com sucesso',
    basicInformation: 'Informações Básicas',
    accountStats: 'Estatísticas da Conta',
    memberSince: 'Membro desde',
    lastLogin: 'Último login',
    totalLogins: 'Total de logins',
    accountDetails: 'Detalhes da Conta',
    userId: 'ID do usuário',
    accountCreated: 'Conta criada',
    lastUpdate: 'Última atualização',
    changePassword: 'Alterar senha',
    notEditable: 'não editável',
    preferredLanguage: 'Idioma preferido',
    accountType: 'Tipo de conta',
    profilePhotoUrl: 'URL da foto de perfil',
    pasteImageUrl: 'Cole a URL de uma imagem',
    accountSecurity: 'Segurança da Conta',
    keepAccountSecure: 'Mantenha sua conta segura',
    securityTips: 'Dicas de segurança',
    useUniquePassword: 'Use uma senha única e forte',
    logoutSharedDevices: 'Faça logout em dispositivos compartilhados',
    keepInfoUpdated: 'Mantenha suas informações atualizadas',
    changePhoto: 'Alterar foto',
    
    // Password change
    currentPassword: 'Senha atual',
    newPassword: 'Nova senha',
    passwordChangedSuccessfully: 'Senha alterada com sucesso!',
    incorrectCurrentPassword: 'Senha atual incorreta',
    passwordMustBeStronger: 'A nova senha deve ser mais forte',
    passwordMustBeDifferent: 'A nova senha deve ser diferente da atual',
    changingPassword: 'Alterando senha...',
    
    // Access guard
    premiumAccessRequired: 'Acesso Premium Necessário',
    validFor30Days: 'Válido por 30 dias',
    accessExpired: 'Acesso expirado',
    dayRemaining: 'dia restante',
    daysRemaining: 'dias restantes',
    
    // General
    language: 'pt',
    never: 'Nunca',

    // Login subtitle
    loginSubtitle: 'Sistema completo de gerenciamento de streaming',

    // Support System
    supportCenter: 'Central de Suporte',
    newTicket: 'Novo Ticket',
    createTicket: 'Criar Ticket',
    createFirstTicket: 'Criar primeiro ticket',
    creating: 'Criando...',
    problemCategory: 'Categoria do Problema',
    relatedProduct: 'Produto Relacionado',
    relatedOrder: 'Pedido Relacionado',
    selectProduct: 'Selecione um produto',
    selectOrder: 'Selecione um pedido',
    subject: 'Assunto',
    describeIssue: 'Descreva seu problema brevemente',
    priority: 'Prioridade',
    lowPriority: 'Baixa',
    mediumPriority: 'Média',
    highPriority: 'Alta',
    urgentPriority: 'Urgente',
    detailedDescription: 'Descrição Detalhada',
    totalTickets: 'Total de Tickets',
    openTickets: 'Tickets Abertos',
    resolvedTickets: 'Tickets Resolvidos',
    allStatuses: 'Todos os Status',
    open: 'Aberto',
    inProgress: 'Em Andamento',
    waitingUser: 'Aguardando Usuário',
    resolved: 'Resolvido',
    closed: 'Fechado',
    urgent: 'Urgente',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
    noTicketsFound: 'Nenhum ticket encontrado',
    noSupportTickets: 'Nenhum ticket de suporte',
    adjustSearchFilters: 'Ajuste seus filtros de busca',
    originalDescription: 'Descrição Original',
    ticketDetails: 'Detalhes do Ticket',
    category: 'Categoria',
    conversation: 'Conversa',
    waitingSupport: 'Aguardando resposta do suporte...',
    noMessagesYet: 'Nenhuma mensagem ainda',
    ticketResolved: 'Este ticket foi marcado como resolvido. Enviar uma nova mensagem irá reabrir o ticket.',
    sendingMessageWillReopen: 'Enviar uma mensagem irá reabrir o ticket',
    ourTeamResponds: 'Nossa equipe responde em até 24 horas',
    reopenAndSend: 'Reabrir e Enviar',
    sendMessage: 'Enviar Mensagem',
    needQuickHelp: 'Precisa de ajuda rápida?',
    contactWhatsAppDirect: 'Entre em contato diretamente via WhatsApp para suporte imediato',
    talkOnWhatsApp: 'Falar no WhatsApp',

    // Payment Errors
    binanceGeoBlockError: 'Devido ao geobloqueio da Binance, você precisa usar VPN no Brasil para efetuar o pagamento, ou utilize o método de recarga Cryptomus como alternativa.',
    paymentCreationError: 'Erro ao criar pagamento. Tente novamente.',

    // Forum/Community
    communityForum: 'Fórum da Comunidade',
    filterByCategory: 'Filtrar por categoria',
    allCategories: 'Todas',
    tutorials: 'Tutoriais',
    news: 'Novidades',
    updates: 'Atualizações',
    announcements: 'Avisos',
    discussions: 'Discussões',

    // Admin User Management
    userManagement: 'Gerenciamento de Usuários',
    searchByEmailOrName: 'Buscar por email ou nome...',
    allRoles: 'Todos os papéis',
    allStatus: 'Todos os status',
    admin: 'Administrador',
    banned: 'Banido',
    bannedUsers: 'Usuários Banidos',
    activeUsers: 'Usuários Ativos',
    admins: 'Administradores',
    totalUsers: 'Total de Usuários',
    noUsersFound: 'Nenhum usuário encontrado',
    tryAdjustingFilters: 'Tente ajustar seus filtros de busca',
    noUsersRegistered: 'Nenhum usuário registrado ainda',
    noName: 'Sem nome',
    logins: 'logins',
    banUser: 'Banir usuário',
    unbanUser: 'Desbanir usuário',
    makeAdmin: 'Tornar Admin',
    removeAdmin: 'Remover Admin',
    makeCustomer: 'Tornar Cliente',
    confirmRoleChange: 'Confirmar alteração de papel',
    confirmRoleChangeMessage: 'Tem certeza que deseja alterar o papel deste usuário para',
    roleUpdated: 'Papel atualizado com sucesso',
    cannotChangeOwnRole: 'Você não pode alterar seu próprio papel',

    // Triple-A Payment Gateway
    tripleAConfig: 'Configurações Triple-A',
    tripleAPayment: 'Pagamento Triple-A',
    tripleANotConfigured: 'Triple-A não está configurado. Contate o administrador.'
  },
  
  en: {
    // Auth
    loginTitle: 'Sign in to your account',
    signUpTitle: 'Create new account',
    login: 'Sign In',
    signUp: 'Sign Up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    fullName: 'Full name',
    forgotPassword: 'Forgot password?',
    backToLogin: 'Back to login',
    alreadyHaveAccount: 'Already have an account? Sign in',
    dontHaveAccount: 'Don\'t have an account? Sign up',
    signingIn: 'Signing in...',
    creatingAccount: 'Creating account...',
    logout: 'Sign Out',
    loggedAs: 'Logged in as',
    
    // Password validation
    passwordMinLength: 'Password must be at least 6 characters',
    passwordsDoNotMatch: 'Passwords do not match',
    passwordTooWeak: 'Password is too weak',
    passwordStrong: 'Strong',
    passwordMedium: 'Medium',
    passwordWeak: 'Weak',
    passwordVeryWeak: 'Very weak',
    passwordNeedsLowercase: 'At least one lowercase letter',
    passwordNeedsUppercase: 'At least one uppercase letter',
    passwordNeedsNumber: 'At least one number',
    passwordNeedsSpecial: 'At least one special character',
    
    // Errors
    invalidEmail: 'Invalid email',
    emailAlreadyRegistered: 'This email is already registered',
    incorrectCredentials: 'Incorrect email or password',
    emailNotConfirmed: 'Email not confirmed',
    databaseError: 'Database error',
    passwordResetError: 'Error sending recovery email',
    passwordUpdateError: 'Error updating password',
    
    // Password reset
    emailSent: 'Email sent!',
    checkEmailInstructions: 'Check your inbox for recovery instructions',
    nextSteps: 'Next steps:',
    checkEmailInbox: 'Check your email inbox',
    clickResetLink: 'Click the recovery link',
    createNewPassword: 'Create new password',
    loginWithNewPassword: 'Login with new password',
    passwordResetDescription: 'Enter your email to receive recovery instructions',
    enterEmailForReset: 'Enter your email for recovery',
    sendingEmail: 'Sending email...',
    sendResetEmail: 'Send recovery email',
    securityInfo: 'Security information',
    resetLinkExpires: 'Link expires in 1 hour',
    onlyValidEmail: 'Only valid emails receive the link',
    checkSpamFolder: 'Check spam folder',
    contactSupportIfNeeded: 'Contact support if needed',
    invalidResetLink: 'Invalid recovery link',
    resetLinkExpiredOrInvalid: 'The link has expired or is invalid. Request a new one.',
    passwordResetSuccess: 'Password changed successfully! Login with your new password.',
    confirmNewPassword: 'Confirm new password',
    updatingPassword: 'Updating password...',
    updatePassword: 'Update password',
    requirements: 'Requirements',
    useMixedCharacters: 'Use uppercase, lowercase, numbers and symbols',
    avoidPersonalInfo: 'Avoid personal information',
    dontReusePasswords: 'Don\'t reuse passwords from other accounts',
    usePasswordManager: 'Consider using a password manager',
    
    // Dashboard
    dashboard: 'Dashboard',
    welcomeBack: 'Welcome back to your control panel',
    quickActions: 'Quick Actions',
    buyInStore: 'Buy in Store',
    systemOnline: 'System Online',
    
    // Navigation
    accounts: 'Accounts',
    clients: 'Clients',
    sellers: 'Sellers',
    services: 'Services',
    store: 'Store',
    myCredits: 'My Credits',
    myPurchases: 'My Purchases',
    
    // Common
    name: 'Name',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    add: 'Add',
    search: 'Search',
    actions: 'Actions',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
    noDataFound: 'No data found',
    confirmDelete: 'Are you sure you want to delete?',
    
    // Accounts
    newAccount: 'New Account',
    editAccount: 'Edit Account',
    service: 'Service',
    seller: 'Seller',
    accountEmail: 'Account Email',
    purchaseDate: 'Purchase Date',
    expiryDate: 'Expiry Date',
    totalProfiles: 'Total Profiles',
    monthlyPrice: 'Monthly Price',
    notes: 'Notes',
    expired: 'Expired',
    suspended: 'Suspended',
    accountProfiles: 'Account Profiles',
    
    // Profiles
    newProfile: 'New Profile',
    editProfile: 'Edit Profile',
    profileName: 'Profile Name',
    client: 'Client',
    assignedDate: 'Assigned Date',
    pricePaid: 'Price Paid',
    profilesUsed: 'profiles used',
    of: 'of',
    
    // Services
    streamingServices:  'Streaming Services',
    newService: 'New Service',
    editService: 'Edit Service',
    serviceName: 'Service Name',
    serviceExample: 'Ex: Netflix, Disney+, etc.',
    logoUrl: 'Logo URL',
    logoDescription: 'Logo image URL (optional)',
    logoPreview: 'Logo Preview',
    errorLoadingImage: 'Error loading image',
    maxProfiles: 'Max Profiles',
    errorSavingService: 'Error saving service',
    errorDeletingService: 'Error deleting service',
    
    // Sellers
    newSeller: 'New Seller',
    editSeller: 'Edit Seller',
    phone: 'Phone',
    
    // Store
    noPurchasesFound: 'No purchases found',
    noStoreOrders: 'You haven\'t made any store purchases yet',
    purchaseDetails: 'Purchase Details',
    product: 'Product',
    amountPaid: 'Amount Paid',
    accessCredentials: 'Access Credentials',
    copyEmail: 'Copy email',
    copyPassword: 'Copy password',
    instructions: 'Instructions',
    viewCredentials: 'View Credentials',
    delivered: 'Delivered',
    importantInfo: 'Important Information',
    keepCredentialsSafe: 'Keep your credentials safe',
    dontShareCredentials: 'Don\'t share your credentials',
    contactWhatsApp: 'Contact via WhatsApp if you need help',
    close: 'Close',
    
    // Profile
    myProfile: 'My Profile',
    profileDescription: 'Manage your personal information and settings',
    profileNotFound: 'Profile not found',
    couldNotLoadProfile: 'Could not load profile',
    profileUpdated: 'Profile updated successfully',
    basicInformation: 'Basic Information',
    accountStats: 'Account Statistics',
    memberSince: 'Member since',
    lastLogin: 'Last login',
    totalLogins: 'Total logins',
    accountDetails: 'Account Details',
    userId: 'User ID',
    accountCreated: 'Account created',
    lastUpdate: 'Last update',
    changePassword: 'Change password',
    notEditable: 'not editable',
    preferredLanguage: 'Preferred language',
    accountType: 'Account type',
    profilePhotoUrl: 'Profile photo URL',
    pasteImageUrl: 'Paste an image URL',
    accountSecurity: 'Account Security',
    keepAccountSecure: 'Keep your account secure',
    securityTips: 'Security tips',
    useUniquePassword: 'Use a unique and strong password',
    logoutSharedDevices: 'Logout from shared devices',
    keepInfoUpdated: 'Keep your information updated',
    changePhoto: 'Change photo',
    
    // Password change
    currentPassword: 'Current password',
    newPassword: 'New password',
    passwordChangedSuccessfully: 'Password changed successfully!',
    incorrectCurrentPassword: 'Incorrect current password',
    passwordMustBeStronger: 'New password must be stronger',
    passwordMustBeDifferent: 'New password must be different from current',
    changingPassword: 'Changing password...',
    
    // Access guard
    premiumAccessRequired: 'Premium Access Required',
    validFor30Days: 'Valid for 30 days',
    accessExpired: 'Access expired',
    dayRemaining: 'day remaining',
    daysRemaining: 'days remaining',
    
    // General
    language: 'en',
    never: 'Never',

    // Login subtitle
    loginSubtitle: 'Complete streaming management system',

    // Support System
    supportCenter: 'Support Center',
    newTicket: 'New Ticket',
    createTicket: 'Create Ticket',
    createFirstTicket: 'Create first ticket',
    creating: 'Creating...',
    problemCategory: 'Problem Category',
    relatedProduct: 'Related Product',
    relatedOrder: 'Related Order',
    selectProduct: 'Select a product',
    selectOrder: 'Select an order',
    subject: 'Subject',
    describeIssue: 'Describe your problem briefly',
    priority: 'Priority',
    lowPriority: 'Low',
    mediumPriority: 'Medium',
    highPriority: 'High',
    urgentPriority: 'Urgent',
    detailedDescription: 'Detailed Description',
    totalTickets: 'Total Tickets',
    openTickets: 'Open Tickets',
    resolvedTickets: 'Resolved Tickets',
    allStatuses: 'All Statuses',
    open: 'Open',
    inProgress: 'In Progress',
    waitingUser: 'Waiting User',
    resolved: 'Resolved',
    closed: 'Closed',
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    noTicketsFound: 'No tickets found',
    noSupportTickets: 'No support tickets',
    adjustSearchFilters: 'Adjust your search filters',
    originalDescription: 'Original Description',
    ticketDetails: 'Ticket Details',
    category: 'Category',
    conversation: 'Conversation',
    waitingSupport: 'Waiting for support response...',
    noMessagesYet: 'No messages yet',
    ticketResolved: 'This ticket has been marked as resolved. Sending a new message will reopen the ticket.',
    sendingMessageWillReopen: 'Sending a message will reopen the ticket',
    ourTeamResponds: 'Our team responds within 24 hours',
    reopenAndSend: 'Reopen and Send',
    sendMessage: 'Send Message',
    needQuickHelp: 'Need quick help?',
    contactWhatsAppDirect: 'Contact directly via WhatsApp for immediate support',
    talkOnWhatsApp: 'Talk on WhatsApp',

    // Payment Errors
    binanceGeoBlockError: 'Due to Binance geo-blocking, you need to use a VPN in Brazil to make the payment, or use the Cryptomus recharge method as an alternative.',
    paymentCreationError: 'Error creating payment. Please try again.',

    // Forum/Community
    communityForum: 'Community Forum',
    filterByCategory: 'Filter by category',
    allCategories: 'All',
    tutorials: 'Tutorials',
    news: 'News',
    updates: 'Updates',
    announcements: 'Announcements',
    discussions: 'Discussions',

    // Admin User Management
    userManagement: 'User Management',
    searchByEmailOrName: 'Search by email or name...',
    allRoles: 'All Roles',
    allStatus: 'All Status',
    admin: 'Admin',
    banned: 'Banned',
    bannedUsers: 'Banned Users',
    activeUsers: 'Active Users',
    admins: 'Admins',
    totalUsers: 'Total Users',
    noUsersFound: 'No users found',
    tryAdjustingFilters: 'Try adjusting your search filters',
    noUsersRegistered: 'No users registered yet',
    noName: 'No name',
    logins: 'logins',
    banUser: 'Ban user',
    unbanUser: 'Unban user',
    makeAdmin: 'Make Admin',
    removeAdmin: 'Remove Admin',
    makeCustomer: 'Make Customer',
    confirmRoleChange: 'Confirm role change',
    confirmRoleChangeMessage: 'Are you sure you want to change this user\'s role to',
    roleUpdated: 'Role updated successfully',
    cannotChangeOwnRole: 'You cannot change your own role',

    // Triple-A Payment Gateway
    tripleAConfig: 'Triple-A Settings',
    tripleAPayment: 'Triple-A Payment',
    tripleANotConfigured: 'Triple-A is not configured. Contact the administrator.'
  },
  
  es: {
    // Auth
    loginTitle: 'Iniciar sesión en tu cuenta',
    signUpTitle: 'Crear nueva cuenta',
    login: 'Iniciar Sesión',
    signUp: 'Registrarse',
    email: 'Email',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    fullName: 'Nombre completo',
    forgotPassword: '¿Olvidaste la contraseña?',
    backToLogin: 'Volver al login',
    alreadyHaveAccount: '¿Ya tienes una cuenta? Iniciar sesión',
    dontHaveAccount: '¿No tienes una cuenta? Registrarse',
    signingIn: 'Iniciando sesión...',
    creatingAccount: 'Creando cuenta...',
    logout: 'Cerrar Sesión',
    loggedAs: 'Conectado como',
    
    // Password validation
    passwordMinLength: 'La contraseña debe tener al menos 6 caracteres',
    passwordsDoNotMatch: 'Las contraseñas no coinciden',
    passwordTooWeak: 'La contraseña es muy débil',
    passwordStrong: 'Fuerte',
    passwordMedium: 'Media',
    passwordWeak: 'Débil',
    passwordVeryWeak: 'Muy débil',
    passwordNeedsLowercase: 'Al menos una letra minúscula',
    passwordNeedsUppercase: 'Al menos una letra mayúscula',
    passwordNeedsNumber: 'Al menos un número',
    passwordNeedsSpecial: 'Al menos un carácter especial',
    
    // Errors
    invalidEmail: 'Email inválido',
    emailAlreadyRegistered: 'Este email ya está registrado',
    incorrectCredentials: 'Email o contraseña incorrectos',
    emailNotConfirmed: 'Email no confirmado',
    databaseError: 'Error en la base de datos',
    passwordResetError: 'Error al enviar email de recuperación',
    passwordUpdateError: 'Error al actualizar contraseña',
    
    // Password reset
    emailSent: '¡Email enviado!',
    checkEmailInstructions: 'Revisa tu bandeja de entrada para instrucciones de recuperación',
    nextSteps: 'Próximos pasos:',
    checkEmailInbox: 'Revisa tu bandeja de entrada',
    clickResetLink: 'Haz clic en el enlace de recuperación',
    createNewPassword: 'Crear nueva contraseña',
    loginWithNewPassword: 'Inicia sesión con la nueva contraseña',
    passwordResetDescription: 'Ingresa tu email para recibir instrucciones de recuperación',
    enterEmailForReset: 'Ingresa tu email para recuperación',
    sendingEmail: 'Enviando email...',
    sendResetEmail: 'Enviar email de recuperación',
    securityInfo: 'Información de seguridad',
    resetLinkExpires: 'El enlace expira en 1 hora',
    onlyValidEmail: 'Solo emails válidos reciben el enlace',
    checkSpamFolder: 'Revisa la carpeta de spam',
    contactSupportIfNeeded: 'Contacta soporte si necesitas ayuda',
    invalidResetLink: 'Enlace de recuperación inválido',
    resetLinkExpiredOrInvalid: 'El enlace ha expirado o es inválido. Solicita uno nuevo.',
    passwordResetSuccess: '¡Contraseña cambiada exitosamente! Inicia sesión con tu nueva contraseña.',
    confirmNewPassword: 'Confirmar nueva contraseña',
    updatingPassword: 'Actualizando contraseña...',
    updatePassword: 'Actualizar contraseña',
    requirements: 'Requisitos',
    useMixedCharacters: 'Usa mayúsculas, minúsculas, números y símbolos',
    avoidPersonalInfo: 'Evita información personal',
    dontReusePasswords: 'No reutilices contraseñas de otras cuentas',
    usePasswordManager: 'Considera usar un gestor de contraseñas',
    
    // Dashboard
    dashboard: 'Panel',
    welcomeBack: 'Bienvenido de vuelta a tu panel de control',
    quickActions: 'Acciones Rápidas',
    buyInStore: 'Comprar en Tienda',
    systemOnline: 'Sistema En Línea',
    
    // Navigation
    accounts: 'Cuentas',
    clients: 'Clientes',
    sellers: 'Vendedores',
    services: 'Servicios',
    store: 'Tienda',
    myCredits: 'Mis Créditos',
    myPurchases: 'Mis Compras',
    
    // Common
    name: 'Nombre',
    edit: 'Editar',
    delete: 'Eliminar',
    save: 'Guardar',
    saving: 'Guardando...',
    cancel: 'Cancelar',
    add: 'Agregar',
    search: 'Buscar',
    actions: 'Acciones',
    status: 'Estado',
    active: 'Activo',
    inactive: 'Inactivo',
    createdAt: 'Creado en',
    updatedAt: 'Actualizado en',
    noDataFound: 'No se encontraron datos',
    confirmDelete: '¿Estás seguro de que quieres eliminar?',
    
    // Accounts
    newAccount: 'Nueva Cuenta',
    editAccount: 'Editar Cuenta',
    service: 'Servicio',
    seller: 'Vendedor',
    accountEmail: 'Email de la Cuenta',
    purchaseDate: 'Fecha de Compra',
    expiryDate: 'Fecha de Expiración',
    totalProfiles: 'Total de Perfiles',
    monthlyPrice: 'Precio Mensual',
    notes: 'Notas',
    expired: 'Expirado',
    suspended: 'Suspendido',
    accountProfiles: 'Perfiles de Cuenta',
    
    // Profiles
    newProfile: 'Nuevo Perfil',
    editProfile: 'Editar Perfil',
    profileName: 'Nombre del Perfil',
    client: 'Cliente',
    assignedDate: 'Fecha de Asignación',
    pricePaid: 'Precio Pagado',
    profilesUsed: 'perfiles utilizados',
    of: 'de',
    
    // Services
    streamingServices: 'Servicios de Streaming',
    newService: 'Nuevo Servicio',
    editService: 'Editar Servicio',
    serviceName: 'Nombre del Servicio',
    serviceExample: 'Ej: Netflix, Disney+, etc.',
    logoUrl: 'URL del Logo',
    logoDescription: 'URL de la imagen del logo (opcional)',
    logoPreview: 'Vista Previa del Logo',
    errorLoadingImage: 'Error al cargar imagen',
    maxProfiles: 'Máximo de Perfiles',
    errorSavingService: 'Error al guardar servicio',
    errorDeletingService: 'Error al eliminar servicio',
    
    // Sellers
    newSeller: 'Nuevo Vendedor',
    editSeller: 'Editar Vendedor',
    phone: 'Teléfono',
    
    // Store
    noPurchasesFound: 'No se encontraron compras',
    noStoreOrders: 'Aún no has hecho ninguna compra en la tienda',
    purchaseDetails: 'Detalles de la Compra',
    product: 'Producto',
    amountPaid: 'Monto Pagado',
    accessCredentials: 'Credenciales de Acceso',
    copyEmail: 'Copiar email',
    copyPassword: 'Copiar contraseña',
    instructions: 'Instrucciones',
    viewCredentials: 'Ver Credenciales',
    delivered: 'Entregado',
    importantInfo: 'Información Importante',
    keepCredentialsSafe: 'Mantén tus credenciales seguras',
    dontShareCredentials: 'No compartas tus credenciales',
    contactWhatsApp: 'Contacta vía WhatsApp si necesitas ayuda',
    close: 'Cerrar',
    
    // Profile
    myProfile: 'Mi Perfil',
    profileDescription: 'Gestiona tu información personal y configuraciones',
    profileNotFound: 'Perfil no encontrado',
    couldNotLoadProfile: 'No se pudo cargar el perfil',
    profileUpdated: 'Perfil actualizado exitosamente',
    basicInformation: 'Información Básica',
    accountStats: 'Estadísticas de la Cuenta',
    memberSince: 'Miembro desde',
    lastLogin: 'Último inicio de sesión',
    totalLogins: 'Total de inicios de sesión',
    accountDetails: 'Detalles de la Cuenta',
    userId: 'ID de usuario',
    accountCreated: 'Cuenta creada',
    lastUpdate: 'Última actualización',
    changePassword: 'Cambiar contraseña',
    notEditable: 'no editable',
    preferredLanguage: 'Idioma preferido',
    accountType: 'Tipo de cuenta',
    profilePhotoUrl: 'URL de foto de perfil',
    pasteImageUrl: 'Pega una URL de imagen',
    accountSecurity: 'Seguridad de la Cuenta',
    keepAccountSecure: 'Mantén tu cuenta segura',
    securityTips: 'Consejos de seguridad',
    useUniquePassword: 'Usa una contraseña única y fuerte',
    logoutSharedDevices: 'Cierra sesión en dispositivos compartidos',
    keepInfoUpdated: 'Mantén tu información actualizada',
    changePhoto: 'Cambiar foto',
    
    // Password change
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    passwordChangedSuccessfully: '¡Contraseña cambiada exitosamente!',
    incorrectCurrentPassword: 'Contraseña actual incorrecta',
    passwordMustBeStronger: 'La nueva contraseña debe ser más fuerte',
    passwordMustBeDifferent: 'La nueva contraseña debe ser diferente de la actual',
    changingPassword: 'Cambiando contraseña...',
    
    // Access guard
    premiumAccessRequired: 'Acceso Premium Requerido',
    validFor30Days: 'Válido por 30 días',
    accessExpired: 'Acceso expirado',
    dayRemaining: 'día restante',
    daysRemaining: 'días restantes',
    
    // General
    language: 'es',
    never: 'Nunca',

    // Login subtitle
    loginSubtitle: 'Sistema completo de gestión de streaming',

    // Support System
    supportCenter: 'Centro de Soporte',
    newTicket: 'Nuevo Ticket',
    createTicket: 'Crear Ticket',
    createFirstTicket: 'Crear primer ticket',
    creating: 'Creando...',
    problemCategory: 'Categoría del Problema',
    relatedProduct: 'Producto Relacionado',
    relatedOrder: 'Pedido Relacionado',
    selectProduct: 'Seleccionar un producto',
    selectOrder: 'Seleccionar un pedido',
    subject: 'Asunto',
    describeIssue: 'Describe tu problema brevemente',
    priority: 'Prioridad',
    lowPriority: 'Baja',
    mediumPriority: 'Media',
    highPriority: 'Alta',
    urgentPriority: 'Urgente',
    detailedDescription: 'Descripción Detallada',
    totalTickets: 'Total de Tickets',
    openTickets: 'Tickets Abiertos',
    resolvedTickets: 'Tickets Resueltos',
    allStatuses: 'Todos los Estados',
    open: 'Abierto',
    inProgress: 'En Progreso',
    waitingUser: 'Esperando Usuario',
    resolved: 'Resuelto',
    closed: 'Cerrado',
    urgent: 'Urgente',
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
    noTicketsFound: 'No se encontraron tickets',
    noSupportTickets: 'Sin tickets de soporte',
    adjustSearchFilters: 'Ajusta tus filtros de búsqueda',
    originalDescription: 'Descripción Original',
    ticketDetails: 'Detalles del Ticket',
    category: 'Categoría',
    conversation: 'Conversación',
    waitingSupport: 'Esperando respuesta del soporte...',
    noMessagesYet: 'Sin mensajes todavía',
    ticketResolved: 'Este ticket ha sido marcado como resuelto. Enviar un nuevo mensaje reabrirá el ticket.',
    sendingMessageWillReopen: 'Enviar un mensaje reabrirá el ticket',
    ourTeamResponds: 'Nuestro equipo responde en 24 horas',
    reopenAndSend: 'Reabrir y Enviar',
    sendMessage: 'Enviar Mensaje',
    needQuickHelp: '¿Necesitas ayuda rápida?',
    contactWhatsAppDirect: 'Contacta directamente vía WhatsApp para soporte inmediato',
    talkOnWhatsApp: 'Hablar en WhatsApp',

    // Payment Errors
    binanceGeoBlockError: 'Debido al geobloqueo de Binance, necesitas usar VPN en Brasil para efectuar el pago, o utiliza el método de recarga Cryptomus como alternativa.',
    paymentCreationError: 'Error al crear el pago. Inténtalo de nuevo.',

    // Forum/Community
    communityForum: 'Foro de la Comunidad',
    filterByCategory: 'Filtrar por categoría',
    allCategories: 'Todas',
    tutorials: 'Tutoriales',
    news: 'Novedades',
    updates: 'Actualizaciones',
    announcements: 'Avisos',
    discussions: 'Discusiones',

    // Admin User Management
    userManagement: 'Gestión de Usuarios',
    searchByEmailOrName: 'Buscar por email o nombre...',
    allRoles: 'Todos los roles',
    allStatus: 'Todos los estados',
    admin: 'Administrador',
    banned: 'Bloqueado',
    bannedUsers: 'Usuarios Bloqueados',
    activeUsers: 'Usuarios Activos',
    admins: 'Administradores',
    totalUsers: 'Total de Usuarios',
    noUsersFound: 'No se encontraron usuarios',
    tryAdjustingFilters: 'Intenta ajustar tus filtros de búsqueda',
    noUsersRegistered: 'Aún no hay usuarios registrados',
    noName: 'Sin nombre',
    logins: 'inicios de sesión',
    banUser: 'Bloquear usuario',
    unbanUser: 'Desbloquear usuario',
    makeAdmin: 'Hacer Admin',
    removeAdmin: 'Quitar Admin',
    makeCustomer: 'Hacer Cliente',
    confirmRoleChange: 'Confirmar cambio de rol',
    confirmRoleChangeMessage: '¿Estás seguro de que quieres cambiar el rol de este usuario a',
    roleUpdated: 'Rol actualizado exitosamente',
    cannotChangeOwnRole: 'No puedes cambiar tu propio rol',

    // Triple-A Payment Gateway
    tripleAConfig: 'Configuración Triple-A',
    tripleAPayment: 'Pago Triple-A',
    tripleANotConfigured: 'Triple-A no está configurado. Contacta al administrador.'
  }
};

export function getTranslation(language: Language): Translation {
  return translations[language] || translations.pt;
}