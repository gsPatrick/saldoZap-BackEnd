// src/webhooks/webhook.service.js
const authService = require('../auth/auth.service'); // Seu serviço de autenticação/usuário
const Usuario = require('../usuarios/usuario.model'); // Para buscar usuário por telefone
const usuarioService = require('../usuarios/usuario.service'); // <<< ADICIONAR ESTA LINHA

/**
 * Formata o número de telefone removendo o DDI '55' e caracteres não numéricos.
 * Ex: "5511987654321" -> "11987654321"
 *     "(11) 98765-4321" -> "11987654321"
 */
function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    let cleaned = phoneNumber.replace(/\D/g, ''); // Remove não dígitos
    if (cleaned.startsWith('55') && (cleaned.length === 13 || cleaned.length === 12)) { // 55 + DDD (2) + 9 ou 8 dígitos
        cleaned = cleaned.substring(2);
    }
    return cleaned;
}

const processKirvanoEvent = async (payload) => {
    const event = payload.event;
    const customer = payload.customer;
    const planDetails = payload.plan;
    const type = payload.type;

    const nome = customer.name;
    const email = customer.email;
    const telefoneKirvano = customer.phone_number;
    const telefoneFormatado = formatPhoneNumber(telefoneKirvano);

    if (!telefoneFormatado) {
        console.error('[WebhookService] Telefone do cliente ausente ou inválido no payload:', telefoneKirvano);
        throw new Error('Telefone do cliente ausente ou inválido.');
    }

    console.log(`[WebhookService] Processando evento: ${event} para cliente: ${nome}, Telefone: ${telefoneFormatado}, Email: ${email}`);

    switch (event) {
        case 'SALE_APPROVED':
            if (type === 'RECURRING' && planDetails) {
                console.log('[WebhookService] Evento SALE_APPROVED (Assinatura) recebido.');
                const planoNome = planDetails.name;
                const frequenciaCobranca = planDetails.charge_frequency;

                let duracaoPlano;
                if (frequenciaCobranca === 'ANNUALLY') {
                    duracaoPlano = 'anual';
                } else if (frequenciaCobranca === 'MONTHLY') {
                    duracaoPlano = 'mensal';
                } else {
                    console.warn(`[WebhookService] Frequência de cobrança desconhecida: ${frequenciaCobranca}. Usando 'mensal' como padrão.`);
                    duracaoPlano = 'mensal';
                }

                try {
                    const result = await authService.registerOrUpdateSubscription(
                        nome,
                        email,
                        telefoneFormatado,
                        planoNome,
                        duracaoPlano
                    );
                    console.log(`[WebhookService] Assinatura ${result.isNewUser ? 'criada' : 'atualizada'} para usuário ${result.usuario.id_usuario}.`);
                } catch (error) {
                    console.error('[WebhookService] Erro ao registrar/atualizar assinatura via Kirvano SALE_APPROVED:', error);
                    throw error;
                }
            } else if (type === 'ONE_TIME') {
                console.log('[WebhookService] Evento SALE_APPROVED (Compra Única) recebido. Nenhuma ação de assinatura definida.');
            } else {
                console.warn('[WebhookService] Evento SALE_APPROVED recebido, mas tipo não é RECURRING ou detalhes do plano ausentes.');
            }
            break;

        case 'SALE_REFUNDED':
        case 'SALE_CHARGEBACK':
        case 'SUBSCRIPTION_CANCELED':
            console.log(`[WebhookService] Evento ${event} recebido. Desativando assinatura.`);
            try {
                const usuario = await Usuario.findOne({ where: { telefone: telefoneFormatado } });
                if (usuario) {
                    // Desativa a assinatura
                    // <<< ALTERAÇÃO AQUI >>>
                    await usuarioService.updateUser(usuario.id_usuario, {
                        assinatura_ativa: false,
                        plano: `${usuario.plano || 'Plano'} (${event})`
                    });
                    console.log(`[WebhookService] Assinatura desativada para usuário ${usuario.id_usuario} devido a ${event}.`);
                } else {
                    console.warn(`[WebhookService] Usuário com telefone ${telefoneFormatado} não encontrado para evento ${event}.`);
                }
            } catch (error) {
                console.error(`[WebhookService] Erro ao processar evento ${event} para telefone ${telefoneFormatado}:`, error);
                throw error;
            }
            break;

        default:
            console.log(`[WebhookService] Evento Kirvano '${event}' recebido, mas não há ação definida para ele.`);
    }
};

module.exports = {
    processKirvanoEvent
};