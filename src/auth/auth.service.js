// src/auth/auth.service.js
const Usuario = require('../usuarios/usuario.model');

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
            const trialEndDate = usuario.trial_fim ? new Date(usuario.trial_fim) : null; // Handle null trial_fim
            const today = new Date();
            let trialDaysRemaining = 0;
            let trialStatus = null;
            let isFreePlan = false;
            let isPaidPlan = false;
            let nextBillingDate = null;

            if (trialEndDate) { // Só calcula trial se trial_fim existir
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
                nextBillingDate: nextBillingDate
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
                nextBillingDate: null
            };
        }
    } catch (error) {
        console.error("Erro ao buscar usuário por telefone:", error);
        throw error;
    }
};

const registerOrUpdateSubscription = async (nome, email, telefone, plano, duracaoPlano) => {
    console.log(`[Subscription] Iniciando registro/update para Tel: ${telefone}, Plano: ${plano}, Duração: ${duracaoPlano}`);
    try {
        let usuario = await Usuario.findOne({ where: { telefone } });
        let isNewUser = false;

        // Calcular data de expiração baseada na DURAÇÃO
        const hoje = new Date();
        let dataExpiracao = new Date();
        if (duracaoPlano === 'mensal') {
            dataExpiracao.setMonth(hoje.getMonth() + 1);
            console.log(`[Subscription] Data de expiração calculada (mensal): ${dataExpiracao.toISOString()}`);
        } else if (duracaoPlano === 'anual') {
            dataExpiracao.setFullYear(hoje.getFullYear() + 1);
            console.log(`[Subscription] Data de expiração calculada (anual): ${dataExpiracao.toISOString()}`);
        } else {
            console.error(`[Subscription] Duração de plano inválida: ${duracaoPlano}`);
            throw new Error(`Duração de plano inválida: ${duracaoPlano}. Use 'mensal' ou 'anual'.`);
        }

        // Objeto com os dados a serem atualizados/criados
        const userData = {
             nome: nome,
             email: email,
             telefone: telefone, // Necessário para create
             assinatura_ativa: true,
             assinatura_expira_em: dataExpiracao,
             plano: plano, // <<< SALVA O NOME DO PLANO
             trial_fim: null // Anula o trial
        };


        if (usuario) {
            // Usuário EXISTE: Atualiza
            console.log(`[Subscription] Usuário ${usuario.id_usuario} encontrado. Atualizando...`);
            // Remove telefone dos updates (não pode mudar a chave)
            delete userData.telefone;
            await usuario.update(userData); // Atualiza com os novos dados
            await usuario.reload(); // Recarrega para garantir dados atualizados
            console.log(`[Subscription] Usuário ${usuario.id_usuario} atualizado com sucesso.`);
        } else {
            // Usuário NÃO EXISTE: Cria
            console.log(`[Subscription] Usuário não encontrado para tel ${telefone}. Criando novo...`);
            isNewUser = true;
            usuario = await Usuario.create(userData); // Cria com todos os dados
            console.log(`[Subscription] Novo usuário ${usuario.id_usuario} criado com sucesso.`);
        }

        return { usuario, isNewUser };

    } catch (error) {
        console.error(`Erro ao registrar/atualizar assinatura para tel ${telefone}:`, error);
         if (error.name === 'SequelizeValidationError') {
             const messages = error.errors.map(e => e.message).join(', ');
             throw new Error(`Erro de validação ao salvar usuário: ${messages}`);
         } else if (error.name === 'SequelizeUniqueConstraintError') {
              const fields = error.fields ? Object.keys(error.fields).join(', ') : 'desconhecido';
              // Verificar qual campo causou a duplicidade (email ou telefone)
              let fieldName = fields.includes('email') ? 'email' : 'telefone';
              throw new Error(`Erro: Já existe um usuário com este ${fieldName}.`);
         }
        throw error; // Re-lança outros erros
    }
};

module.exports = {
    registerWebsiteUser,
    registerWhatsAppUser,
    associateEmailWhatsAppUser,
    getUserByPhone,
    registerOrUpdateSubscription
};