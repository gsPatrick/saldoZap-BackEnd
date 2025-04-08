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

module.exports = {
    registerWebsiteUser,
    registerWhatsAppUser,
    associateEmailWhatsAppUser,
    getUserByPhone 
};