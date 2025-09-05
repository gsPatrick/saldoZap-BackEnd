// src/chatbot/chatbot.controller.js

const intentHandler = require('./intent.handler');
const zapiService = require('../services/zapi/zapi.service');
const authService = require('../auth/auth.service'); // Usamos o authService para registrar/encontrar usuários

/**
 * Lida com as mensagens recebidas do webhook da Z-API.
 */
const handleIncomingMessage = async (req, res) => {
    const payload = req.body;
    console.log('[Chatbot Controller] Webhook da Z-API recebido:', JSON.stringify(payload, null, 2));

    // Extrai as informações mais importantes do payload
    const { phone, message, isGroup } = payload;

    // 1. Ignorar mensagens de grupo para evitar responder a todos
    if (isGroup) {
        console.log('[Chatbot Controller] Mensagem de grupo ignorada.');
        return res.status(200).json({ message: 'Group message ignored.' });
    }

    // 2. Validar se temos as informações mínimas para prosseguir
    if (!phone || !message) {
        console.warn('[Chatbot Controller] Payload inválido (sem telefone ou mensagem).');
        return res.status(400).json({ error: 'Invalid payload.' });
    }

    try {
        // 3. Encontrar ou criar o usuário com base no número de telefone.
        // A função `registerWhatsAppUser` já faz essa verificação "findOrCreate".
        const usuario = await authService.registerWhatsAppUser(phone);
        if (!usuario || !usuario.id_usuario) {
            throw new Error(`Falha ao obter ou criar usuário para o telefone ${phone}`);
        }
        console.log(`[Chatbot Controller] Usuário ID: ${usuario.id_usuario} interagindo.`);

        // 4. Chamar o orquestrador principal para processar a intenção
        const { suggestion, finalResponse } = await intentHandler.processIntent(message, usuario.id_usuario);

        // 5. Enviar as respostas de volta para o usuário via Z-API
        
        // Envia a sugestão inicial para dar feedback rápido (não esperamos a conclusão)
        if (suggestion) {
            zapiService.sendWhatsAppMessage(phone, suggestion).catch(err => {
                console.error('[Chatbot Controller] Erro ao enviar sugestão de resposta:', err);
            });
        }

        // Aguarda um pequeno delay para parecer mais natural antes de enviar a resposta final
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        // Envia a resposta final e principal
        await zapiService.sendWhatsAppMessage(phone, finalResponse, { delayTyping: 5 }); // Simula uma digitação mais longa para a resposta final

        // 6. Responder ao webhook da Z-API com status 200 OK para confirmar o recebimento
        res.status(200).json({ success: true, message: 'Message processed.' });

    } catch (error) {
        console.error('[Chatbot Controller] Erro grave ao processar a mensagem:', error);
        // Tenta notificar o usuário sobre o erro, se possível
        try {
            await zapiService.sendWhatsAppMessage(phone, 'Ops! 😥 Tive um problema interno para processar sua solicitação. Minha equipe já foi notificada. Por favor, tente novamente em alguns instantes.');
        } catch (sendError) {
            console.error('[Chatbot Controller] Falha ao enviar mensagem de erro para o usuário:', sendError);
        }

        // Responde ao webhook com um erro
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = {
    handleIncomingMessage,
};