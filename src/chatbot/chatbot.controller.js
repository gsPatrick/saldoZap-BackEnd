// src/chatbot/chatbot.controller.js

const intentHandler = require('./intent.handler');
const zapiService = require('../services/zapi/zapi.service');
const authService = require('../auth/auth.service');
const responseFormatter = require('./response.formatter'); // <<< ADICIONADO

// <<< ADICIONADO: Helper para validar e-mail >>>
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const handleIncomingMessage = async (req, res) => {
    const payload = req.body;
    console.log('[Chatbot Controller] Webhook da Z-API recebido:', JSON.stringify(payload, null, 2));

    const { phone, message, isGroup } = payload;

    if (isGroup) {
        console.log('[Chatbot Controller] Mensagem de grupo ignorada.');
        return res.status(200).json({ message: 'Group message ignored.' });
    }

    if (!phone || !message) {
        console.warn('[Chatbot Controller] Payload inválido (sem telefone ou mensagem).');
        return res.status(400).json({ error: 'Invalid payload.' });
    }

    try {
        const usuario = await authService.registerWhatsAppUser(phone);
        if (!usuario || !usuario.id_usuario) {
            throw new Error(`Falha ao obter ou criar usuário para o telefone ${phone}`);
        }
        console.log(`[Chatbot Controller] Usuário ID: ${usuario.id_usuario} interagindo.`);

        // --- <<< INÍCIO DA LÓGICA DE ONBOARDING >>> ---
        if (!usuario.email) {
            console.log(`[Chatbot Controller] Usuário ${usuario.id_usuario} sem e-mail. Iniciando fluxo de onboarding.`);

            // Verifica se a mensagem atual é um e-mail
            if (isValidEmail(message)) {
                // Se for um e-mail, associa à conta
                await authService.associateEmailWhatsAppUser(phone, message);
                const welcomeMessage = responseFormatter.formatOnboardingWelcome();
                await zapiService.sendWhatsAppMessage(phone, welcomeMessage);
            } else {
                // Se não for um e-mail, pede o e-mail
                const emailRequestMessage = responseFormatter.formatOnboardingEmailRequest();
                await zapiService.sendWhatsAppMessage(phone, emailRequestMessage);
            }
            // Interrompe o fluxo aqui, pois a interação foi apenas para o onboarding
            return res.status(200).json({ success: true, message: 'Onboarding flow processed.' });
        }
        // --- <<< FIM DA LÓGICA DE ONBOARDING >>> ---


        // Se o usuário já tem e-mail, segue o fluxo normal
        const { suggestion, finalResponse } = await intentHandler.processIntent(message, usuario.id_usuario);

        if (suggestion) {
            zapiService.sendWhatsAppMessage(phone, suggestion).catch(err => {
                console.error('[Chatbot Controller] Erro ao enviar sugestão de resposta:', err);
            });
        }

        await new Promise(resolve => setTimeout(resolve, 1500)); 

        await zapiService.sendWhatsAppMessage(phone, finalResponse, { delayTyping: 5 });

        res.status(200).json({ success: true, message: 'Message processed.' });

    } catch (error) {
        console.error('[Chatbot Controller] Erro grave ao processar a mensagem:', error);
        try {
            await zapiService.sendWhatsAppMessage(phone, 'Ops! 😥 Tive um problema interno para processar sua solicitação. Minha equipe já foi notificada. Por favor, tente novamente em alguns instantes.');
        } catch (sendError) {
            console.error('[Chatbot Controller] Falha ao enviar mensagem de erro para o usuário:', sendError);
        }
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = {
    handleIncomingMessage,
};