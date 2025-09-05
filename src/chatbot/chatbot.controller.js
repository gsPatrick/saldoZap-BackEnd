// src/chatbot/chatbot.controller.js

const intentHandler = require('./intent.handler');
const zapiService = require('../services/zapi/zapi.service');
const authService = require('../auth/auth.service');
const responseFormatter = require('./response.formatter');

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const handleIncomingMessage = async (req, res) => {
    const payload = req.body;
    console.log('[Chatbot Controller] Webhook da Z-API recebido:', JSON.stringify(payload, null, 2));

    // --- <<< INÍCIO DA CORREÇÃO >>> ---

    // Extrai as informações dos locais corretos no payload da Z-API.
    // Usamos encadeamento opcional (?.) para evitar erros se 'text' não existir.
    const phone = payload.phone;
    const message = payload.text?.message; // Pega a mensagem de dentro do objeto 'text'
    const isGroup = payload.isGroup;

    // Adiciona uma verificação para ignorar callbacks que não são mensagens de texto (ex: status de entrega)
    if (payload.type !== 'ReceivedCallback' || !message) {
        console.log(`[Chatbot Controller] Callback do tipo '${payload.type}' ou sem texto. Ignorando.`);
        return res.status(200).json({ message: 'Callback ignored (not a text message).' });
    }

    // --- <<< FIM DA CORREÇÃO >>> ---


    // 1. Ignorar mensagens de grupo para evitar responder a todos
    if (isGroup) {
        console.log('[Chatbot Controller] Mensagem de grupo ignorada.');
        return res.status(200).json({ message: 'Group message ignored.' });
    }

    // 2. Validar se temos as informações mínimas para prosseguir (agora deve funcionar)
    if (!phone || !message) {
        console.warn('[Chatbot Controller] Payload inválido (sem telefone ou mensagem).');
        return res.status(400).json({ error: 'Invalid payload.' });
    }

    try {
        // O restante do código a partir daqui já está correto e não precisa de alterações.
        // Ele continuará a lógica de onboarding, processamento de intenção, etc.

        const usuario = await authService.registerWhatsAppUser(phone);
        if (!usuario || !usuario.id_usuario) {
            throw new Error(`Falha ao obter ou criar usuário para o telefone ${phone}`);
        }
        console.log(`[Chatbot Controller] Usuário ID: ${usuario.id_usuario} interagindo.`);

        // --- LÓGICA DE ONBOARDING ---
        if (!usuario.email) {
            console.log(`[Chatbot Controller] Usuário ${usuario.id_usuario} sem e-mail. Iniciando fluxo de onboarding.`);

            if (isValidEmail(message)) {
                await authService.associateEmailWhatsAppUser(phone, message);
                const welcomeMessage = responseFormatter.formatOnboardingWelcome();
                await zapiService.sendWhatsAppMessage(phone, welcomeMessage);
            } else {
                const emailRequestMessage = responseFormatter.formatOnboardingEmailRequest();
                await zapiService.sendWhatsAppMessage(phone, emailRequestMessage);
            }
            return res.status(200).json({ success: true, message: 'Onboarding flow processed.' });
        }
        // --- FIM DA LÓGICA DE ONBOARDING ---

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