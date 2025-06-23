// src/webhooks/webhook.controller.js
const webhookService = require('./webhook.service');

const handleKirvanoEvent = async (req, res) => {
    const payload = req.body;
    console.log('[WebhookController] Recebido evento do Kirvano:', JSON.stringify(payload, null, 2));

    // Validação básica do payload
    if (!payload || !payload.event || !payload.customer) {
        console.error('[WebhookController] Payload inválido ou faltando campos essenciais.');
        return res.status(400).json({ error: 'Payload inválido.' });
    }

    try {
        await webhookService.processKirvanoEvent(payload);
        res.status(200).json({ message: 'Webhook processado com sucesso.' });
    } catch (error) {
        console.error('[WebhookController] Erro ao processar evento Kirvano:', error.message);
        // Determinar o status code baseado no tipo de erro, se possível
        if (error.message.includes('não encontrado') || error.message.includes('não pertence')) {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('inválido') || error.message.includes('obrigatórios')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Erro interno no servidor ao processar webhook.' });
    }
};

module.exports = {
    handleKirvanoEvent
};