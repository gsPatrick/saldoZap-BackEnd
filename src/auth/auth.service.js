    // src/auth/auth.service.js
    const Usuario = require('../usuarios/usuario.model');
    const { Op, fn, col, literal } = require('sequelize'); // <<< NECESSÁRIO para a função
    const axios = require('axios'); // <-- ADD THIS LINE
    const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
    require('dotenv').config(); // Load .env variables


    const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'; // Default expiration

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
    process.exit(1); // Exit if secret is missing
  }
  
  // --- Helper Functions ---
  const hashPassword = async (password) => {
    if (!password) return null; // Don't hash if no password provided
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  };
  
  const comparePassword = async (plainPassword, hashedPassword) => {
    if (!plainPassword || !hashedPassword) return false; // Cannot compare if one is missing
    return await bcrypt.compare(plainPassword, hashedPassword);
  };
  
  const generateToken = (user) => {
    const payload = {
      id: user.id_usuario,
      email: user.email,
      // Add any other non-sensitive info you might need in the token
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  };
  
  // --- Registration Service ---
  const registerUser = async (userData) => {
    const { nome, telefone, email, senha } = userData;
  
    // Basic validation
    if (!telefone) { // Assuming phone is mandatory
      throw new Error('Telefone é obrigatório.');
    }
  
    // Check for existing user (by phone OR email if email is provided and unique)
    const existingUser = await Usuario.findOne({
      where: {
        [Op.or]: [
          { telefone: telefone },
          // Only check email if it's provided
          ...(email ? [{ email: email }] : [])
        ]
      }
    });
  
    if (existingUser) {
      if (existingUser.telefone === telefone) {
          throw new Error('Telefone já cadastrado.');
      }
      if (email && existingUser.email === email) {
          throw new Error('Email já cadastrado.');
      }
      // Fallback (shouldn't normally happen with OR logic but good practice)
      throw new Error('Usuário já cadastrado.');
    }
  
    // Hash the password IF it was provided
    const hashedPassword = await hashPassword(senha);
  
    // Create the user
    try {
      const newUser = await Usuario.create({
        nome,
        telefone,
        email: email || null, // Store null if email not provided
        senha: hashedPassword, // Store hashed password or null
        // Set default trial period, plan, etc. if needed
        // trial_fim: ...
        // plano: 'Free'
      });
  
      // Don't return the password hash
      const userResponse = newUser.toJSON();
      delete userResponse.senha;
  
      return userResponse;
    } catch (error) {
      console.error("Erro ao criar usuário no banco:", error);
      // Check for specific Sequelize validation errors if necessary
      throw new Error('Erro ao registrar usuário. Tente novamente.');
    }
  };

  const loginUser = async (identifier, password) => {
    // Identifier can be email or phone
    if (!identifier || !password) {
      throw new Error('Email/Telefone e Senha são obrigatórios.');
    }
  
    // Find user by email or phone
    const user = await Usuario.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { telefone: identifier }
        ]
      }
    });
  
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }
  
    // IMPORTANT: Check if the user actually has a password set
    if (!user.senha) {
      throw new Error('Login por senha não habilitado para este usuário.'); // Or a more generic "Invalid credentials"
    }
  
    // Compare provided password with the stored hash
    const isMatch = await comparePassword(password, user.senha);
  
    if (!isMatch) {
      throw new Error('Credenciais inválidas.'); // Generic error for security
    }
  
    // Generate JWT
    const token = generateToken(user);
  
    // Prepare user data to return (exclude password)
    const userResponse = user.toJSON();
    delete userResponse.senha;
  
    return { user: userResponse, token };
  };

    const registerWebsiteUser = async (telefone, email) => {
        try {
            let usuario = await Usuario.findOne({ where: { telefone } });

            if (usuario) {
                // Usuário já existe, atualiza email e INICIA o trial
                usuario.email = email;
                usuario.trial_fim = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias de trial - **INICIA TRIAL AQUI**
                await usuario.save();
                return usuario;
            } else {
                // Usuário não existe, cria novo com telefone, email e INICIA o trial
                const novoUsuario = await Usuario.create({
                    telefone,
                    email,
                    trial_fim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias de trial - **INICIA TRIAL AQUI**
                });
                return novoUsuario;
            }
        } catch (error) {
            console.error("Erro ao registrar usuário via website:", error);
            throw error;
        }
    };

    const registerWhatsAppUser = async (telefone) => {
        try {
            let usuario = await Usuario.findOne({ where: { telefone } });

            if (usuario) {
                // Usuário já existe (pelo telefone), retorna usuário existente SEM INICIAR TRIAL
                return usuario;
            } else {
                // Usuário não existe, cria novo APENAS com telefone, SEM trial_fim INICIALMENTE
                const novoUsuario = await Usuario.create({
                    telefone,
                    trial_fim: null // **NÃO INICIA TRIAL AQUI - trial_fim como null**
                });
                return novoUsuario;
            }
        } catch (error) {
            console.error("Erro ao registrar usuário via WhatsApp:", error);
            throw error;
        }
    };

    const associateEmailWhatsAppUser = async (telefone, email) => {
        try {
            const usuario = await Usuario.findOne({ where: { telefone } });

            if (!usuario) {
                throw new Error("Usuário não encontrado para associar email.");
            }

            // ASSOCIA EMAIL E INICIA O TRIAL SE AINDA NÃO TIVER SIDO INICIADO
            usuario.email = email;
            if (!usuario.trial_fim) { // Verifica se trial_fim é nulo (se trial ainda não começou)
                usuario.trial_fim = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // INICIA TRIAL AO ASSOCIAR EMAIL
            }
            await usuario.save();
            return usuario;

        } catch (error) {
            console.error("Erro ao associar email via WhatsApp:", error);
            throw error;
        }
    };


    const getUserByPhone = async (telefone) => {
        try {
            const usuario = await Usuario.findOne({ where: { telefone } });
            if (usuario) {
                const trialEndDate = usuario.trial_fim ? new Date(usuario.trial_fim) : null;
                const today = new Date();
                let trialDaysRemaining = 0;
                let trialStatus = null;
                let isFreePlan = false;
                let isPaidPlan = false;
                let nextBillingDate = null;

                if (trialEndDate) {
                    isFreePlan = true;
                    trialDaysRemaining = Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24));
                    if (trialDaysRemaining < 0) {
                        trialDaysRemaining = 0;
                        trialStatus = "expired";
                    } else {
                        trialStatus = "active";
                    }
                }

                if (usuario.assinatura_ativa) {
                    isPaidPlan = true;
                }


                return {
                    numero: "registered",
                    email: usuario.email ? "registered" : "unregistered",
                    emailContent: usuario.email || null,
                    isFreePlan: isFreePlan,
                    trialDaysRemaining: trialDaysRemaining,
                    trialStatus: trialStatus,
                    isPaidPlan: isPaidPlan,
                    nextBillingDate: nextBillingDate,
                    primeiraMensagem: usuario.primeiraMensagem // <<< ADICIONADO AQUI
                };
            } else {
                return {
                    numero: "unregistered",
                    email: "unregistered",
                    emailContent: null,
                    isFreePlan: false,
                    trialDaysRemaining: 0,
                    trialStatus: null,
                    isPaidPlan: false,
                    nextBillingDate: null,
                    primeiraMensagem: null // <<< ADICIONADO AQUI (ou false, se preferir)
                };
            }
        } catch (error) {
            console.error("Erro ao buscar usuário por telefone:", error);
            throw error;
        }
    };

    const markFirstMessageSent = async (telefone) => {
        try {
            const usuario = await Usuario.findOne({ where: { telefone } });

            if (!usuario) {
                throw new Error("Usuário não encontrado para marcar primeira mensagem.");
            }

            // Verifica se precisa atualizar (evita escrita desnecessária no DB)
            if (usuario.primeiraMensagem === true) {
                usuario.primeiraMensagem = false;
                await usuario.save();
                console.log(`[AuthService] Campo 'primeiraMensagem' atualizado para false para o telefone ${telefone}.`);
                return usuario; // Retorna o usuário atualizado
            } else {
                console.log(`[AuthService] Campo 'primeiraMensagem' já estava false para o telefone ${telefone}. Nenhuma atualização necessária.`);
                return usuario; // Retorna o usuário como está
            }

        } catch (error) {
            console.error(`Erro ao marcar primeira mensagem para telefone ${telefone}:`, error);
            // Re-lança o erro para ser tratado na camada de rota
            if (error.message.includes("Usuário não encontrado")) {
                throw error;
            }
            throw new Error("Erro interno ao atualizar status da primeira mensagem.");
        }
    };

const registerOrUpdateSubscription = async (nome, email, telefone, plano, duracaoPlano) => {
    console.log(`[Subscription] Iniciando registro/update para Tel: ${telefone}, Plano: ${plano}`);

    try {
        // Encontra o usuário APENAS pelo telefone
        let usuario = await Usuario.findOne({ where: { telefone } });
        let isNewUser = false;

        // Calcular data de expiração, comum para ambos os cenários
        const hoje = new Date();
        let dataExpiracao = new Date();
        if (duracaoPlano === 'mensal') {
            dataExpiracao.setMonth(hoje.getMonth() + 1);
        } else if (duracaoPlano === 'anual') {
            dataExpiracao.setFullYear(hoje.getFullYear() + 1);
        } else {
            throw new Error(`Duração de plano inválida: ${duracaoPlano}.`);
        }

        if (usuario) {
            // ----- USUÁRIO JÁ EXISTE: ATUALIZA SOMENTE O PLANO -----
            isNewUser = false;
            console.log(`[Subscription] Usuário ${usuario.id_usuario} encontrado. Atualizando APENAS dados da assinatura...`);

            // <<< MUDANÇA PRINCIPAL: Objeto de atualização contém APENAS dados da assinatura >>>
            const subscriptionUpdateData = {
                assinatura_ativa: true,
                assinatura_expira_em: dataExpiracao,
                plano: plano,
                trial_fim: null // Anula o trial ao ativar uma assinatura
            };

            // Atualiza o usuário com o objeto restrito
            await usuario.update(subscriptionUpdateData);
            
        } else {
            // ----- USUÁRIO NÃO EXISTE: CRIA COM TODOS OS DADOS -----
            isNewUser = true;
            console.log(`[Subscription] Usuário não encontrado para tel ${telefone}. Criando novo...`);

            // <<< MUDANÇA PRINCIPAL: Objeto de criação contém TODOS os dados da requisição >>>
            const newUser_Data = {
                nome: nome,
                email: email,
                telefone: telefone, // Telefone é necessário para criar
                assinatura_ativa: true,
                assinatura_expira_em: dataExpiracao,
                plano: plano,
                trial_fim: null
            };

            // <<< MUDANÇA: Remoção da verificação de email duplicado >>>
            usuario = await Usuario.create(newUser_Data);
            console.log(`[Subscription] Novo usuário ${usuario.id_usuario} criado com sucesso.`);
        }
        
        // Recarrega o estado do usuário do banco para garantir que temos os dados mais recentes
        await usuario.reload();

        // Remove a senha do objeto de retorno por segurança
        const userResponse = usuario.toJSON();
        delete userResponse.senha;

        return { usuario: userResponse, isNewUser };

    } catch (error) {
        console.error(`Erro ao registrar/atualizar assinatura para tel ${telefone}:`, error);
        if (error.name === 'SequelizeValidationError') {
            const messages = error.errors.map(e => e.message).join(', ');
            throw new Error(`Erro de validação: ${messages}`);
        }
        // O erro de constraint agora só pode vir do telefone, se houver
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error(`Erro: Já existe um usuário com este telefone.`);
        }
        throw error; // Re-lança outros erros (como o de duração inválida)
    }
};

    const getDashboardStats = async () => {
        console.log("[DashboardService] Buscando estatísticas...");
        try {
            const hoje = new Date();

            // --- Contagens de Usuários ---

            // Contagem Total
            const totalUsuarios = await Usuario.count();
            console.log(`[DashboardService] Total de usuários: ${totalUsuarios}`);

            // Contagem de Assinantes Ativos (assinatura_ativa = true E não expirada)
            const totalAssinantesAtivos = await Usuario.count({
                where: {
                    assinatura_ativa: true,
                    assinatura_expira_em: {
                        [Op.or]: [
                            { [Op.eq]: null }, // Assinatura nunca expira (vitalícia?)
                            { [Op.gte]: hoje }  // Assinatura ainda válida hoje
                        ]
                    }
                }
            });
            console.log(`[DashboardService] Total de assinantes ativos: ${totalAssinantesAtivos}`);

            // Contagem de Usuários em Trial Ativo
            const totalTrialAtivo = await Usuario.count({
                where: {
                    // Não pode ter assinatura ativa PAGA ao mesmo tempo que trial
                    [Op.or]: [
                        { assinatura_ativa: false },
                        { assinatura_ativa: null } // Considera nulo como falso
                    ],
                    trial_fim: {
                        [Op.gte]: hoje // Trial termina hoje ou no futuro
                    }
                }
            });
            console.log(`[DashboardService] Total de usuários em trial ativo: ${totalTrialAtivo}`);

            // Contagem de Usuários Free (Nem trial ativo, nem assinatura ativa)
            const totalFree = await Usuario.count({
                where: {
                    [Op.or]: [
                        { assinatura_ativa: false },
                        { assinatura_ativa: null }
                    ],
                    [Op.or]: [
                        { trial_fim: { [Op.eq]: null } }, // Nunca teve trial
                        { trial_fim: { [Op.lt]: hoje } }   // Trial expirou
                    ]
                }
            });
            console.log(`[DashboardService] Total de usuários free (sem trial/assinatura ativa): ${totalFree}`);


            // Contagem de Usuários por Plano (APENAS entre os assinantes ativos)
            const contagemPorPlano = await Usuario.findAll({
                attributes: [
                    // Se 'plano' pode ser nulo, usa COALESCE para agrupar como 'Desconhecido'
                    [fn('COALESCE', col('plano'), 'Desconhecido'), 'planoNome'],
                    [fn('COUNT', col('id_usuario')), 'count'] // Conta usuários
                ],
                where: {
                    // Filtra apenas os que consideramos assinantes ativos
                    assinatura_ativa: true,
                    assinatura_expira_em: {
                        [Op.or]: [
                            { [Op.eq]: null },
                            { [Op.gte]: hoje }
                        ]
                    }
                },
                group: [literal('"planoNome"')] // Agrupa pelo alias definido acima
                // Raw true para facilitar acesso aos dados
                // raw: true // Descomente se preferir objetos simples
            });

            // Formata o resultado da contagem por plano
            const usuariosPorPlanoFormatado = contagemPorPlano.map(item => {
                // Se usou raw:true, acesse item.planoNome e item.count
                // Se não usou raw:true, acesse item.get('planoNome') e item.get('count')
                const planoData = item.get ? item.get() : item; // Pega o objeto de dados
                return {
                    plano: planoData.planoNome,
                    count: parseInt(planoData.count, 10) // Garante que count seja número
                }
            });
            console.log("[DashboardService] Contagem por plano:", usuariosPorPlanoFormatado);


            // --- Cálculo de Lucro (Exemplo SIMPLIFICADO - NÃO RECOMENDADO PARA PRODUÇÃO) ---
            // Idealmente, isso viria de outra fonte (gateway de pagamento, tabela de pagamentos)
            let lucroEstimadoPremium = 0;
            let lucroEstimadoBasic = 0;
            usuariosPorPlanoFormatado.forEach(p => {
                if (p.plano.toLowerCase().includes('premium')) { // Verifica se nome contém 'premium'
                    lucroEstimadoPremium += p.count * 29.90; // Valor Fixo Exemplo
                } else if (p.plano.toLowerCase().includes('basic')) { // Verifica se nome contém 'basic'
                    lucroEstimadoBasic += p.count * 9.90; // Valor Fixo Exemplo
                }
                // Adicionar lógica para outros planos
            });
            const lucroEstimadoTotal = lucroEstimadoPremium + lucroEstimadoBasic;
            // -------------------------------------------------------------------------

            // Monta o objeto de resposta final
            const stats = {
                totalUsuarios: totalUsuarios || 0,
                usuariosAssinantesAtivos: totalAssinantesAtivos || 0, // Renomeado para clareza
                usuariosTrial: totalTrialAtivo || 0,
                usuariosFree: totalFree || 0,
                usuariosPorPlano: usuariosPorPlanoFormatado || [],
                // --- Retornando lucro estimado ---
                lucroEstimado: {
                    premium: parseFloat(lucroEstimadoPremium.toFixed(2)),
                    basic: parseFloat(lucroEstimadoBasic.toFixed(2)),
                    total: parseFloat(lucroEstimadoTotal.toFixed(2))
                }
                // ---------------------------------
            };

            console.log("[DashboardService] Estatísticas finais:", stats);
            return stats;

        } catch (error) {
            console.error("[DashboardService] Erro ao buscar estatísticas:", error);
            throw new Error("Erro ao buscar estatísticas do dashboard."); // Lança erro genérico
        }
    };

    const sendBulkWhatsAppMessage = async (userIds, message) => {
        console.log(`[BulkSend] Iniciando envio para ${userIds.length} usuários.`);
        if (!userIds || userIds.length === 0 || !message) {
            throw new Error("Lista de IDs de usuários e mensagem são obrigatórios.");
        }
    
        let successCount = 0;
        let failedCount = 0;
        const errors = [];
    
        // 1. Buscar os telefones dos usuários selecionados no banco de dados
        const users = await Usuario.findAll({
            where: {
                id_usuario: {
                    [Op.in]: userIds // Busca todos os usuários cujos IDs estão na lista
                }
            },
            attributes: ['id_usuario', 'telefone'], // Pega apenas ID e telefone
            raw: true // Retorna objetos simples
        });
    
        console.log(`[BulkSend] Encontrados ${users.length} usuários no banco para os IDs fornecidos.`);
    
        // Cria um mapa para acesso rápido telefone por ID
        const phoneMap = users.reduce((map, user) => {
            if (user.telefone) { // Adiciona apenas se tiver telefone
                 // Garante formato E.164 básico (prefixo 55, remove não dígitos) - AJUSTE SE NECESSÁRIO
                const cleanedPhone = '55' + user.telefone.replace(/\D/g, '').replace(/^55/, ''); // Adiciona 55 e limpa
                map[user.id_usuario] = cleanedPhone;
            }
            return map;
        }, {});
    
        // 2. Iterar sobre os IDs *originais* para manter a ordem e reportar falhas
        for (const userId of userIds) {
            const phone = phoneMap[userId];
    
            if (!phone) {
                console.warn(`[BulkSend] Telefone não encontrado para usuário ID: ${userId}. Pulando.`);
                failedCount++;
                errors.push({ userId, phone: 'Não encontrado', error: 'Telefone não cadastrado ou inválido.' });
                continue; // Pula para o próximo ID
            }
    
            console.log(`[BulkSend] Tentando enviar para ID: ${userId}, Telefone: ${phone}`);
    
            try {
                // Adiciona um pequeno delay para evitar rate limiting (ajuste conforme necessário)
                await new Promise(resolve => setTimeout(resolve, 300)); // 300ms de delay
    
                // Monta o corpo da requisição para a Z-API
                const body = {
                    phone: phone,
                    message: message,
                };
    
                // Monta os headers
                const headers = {
                    'Content-Type': 'application/json',
                    'Client-Token': 'Fb60f69a4625b40b9a67f7083974da62cS',
                };
    
                // Faz a chamada POST para a Z-API usando Axios
                const response = await axios.post('https://api.z-api.io/instances/3DF5DE88F3E4A06538B632C54B267657/token/33C4D90A5B63208868D1CAAC/send-text', body, { headers });
    
                // Verifica a resposta da Z-API (ajuste conforme a resposta real da Z-API)
                if (response.status === 200 || response.status === 201) {
                    console.log(`[BulkSend] Sucesso para ID: ${userId}, Telefone: ${phone}. Resposta Z-API:`, response.data?.id || response.status); // Loga ID da mensagem se disponível
                    successCount++;
                } else {
                    // Se a Z-API retornar um status de erro, mas não lançar exceção
                    console.warn(`[BulkSend] Falha (Status Z-API ${response.status}) para ID: ${userId}, Telefone: ${phone}. Resposta:`, response.data);
                    failedCount++;
                    errors.push({ userId, phone, error: `Z-API Status ${response.status}: ${JSON.stringify(response.data)}` });
                }
    
            } catch (error) {
                // Captura erros de rede ou erros lançados pela Z-API (ex: 4xx, 5xx)
                failedCount++;
                let errorMessage = 'Erro desconhecido';
                if (axios.isAxiosError(error)) {
                    errorMessage = `Erro Axios ${error.response?.status || 'sem status'}: ${JSON.stringify(error.response?.data) || error.message}`;
                } else if (error instanceof Error) {
                    errorMessage = error.message;
                }
                console.error(`[BulkSend] Erro ao enviar para ID: ${userId}, Telefone: ${phone}. Erro: ${errorMessage}`);
                errors.push({ userId, phone, error: errorMessage });
                // Continua para o próximo usuário mesmo se um falhar
            }
        }
    
        console.log(`[BulkSend] Envio concluído. Sucesso: ${successCount}, Falhas: ${failedCount}`);
        return { successCount, failedCount, errors };
    };



    module.exports = {
        registerWebsiteUser,
        registerWhatsAppUser,
        associateEmailWhatsAppUser,
        getUserByPhone,
        registerOrUpdateSubscription,
        getDashboardStats,
        markFirstMessageSent,
        sendBulkWhatsAppMessage,
        registerUser,
        loginUser,
    };