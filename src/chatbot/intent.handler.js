// src/chatbot/intent.handler.js

const actionHandler = require('./action.handler');
const responseFormatter = require('./response.formatter');
const aiService = require('./ai.service');

/**
 * Orquestra o processamento da mensagem do usuário, desde a determinação da intenção
 * até a execução da ação e formatação da resposta final.
 *
 * @param {string} userMessage - A mensagem original do usuário.
 *- O ID do usuário que enviou a mensagem.
 * @returns {Promise<{ finalResponse: string, suggestion: string }>}
 *          Um objeto contendo a mensagem final formatada para o usuário e
 *          a sugestão de resposta inicial da IA.
 */
const processIntent = async (userMessage, userId) => {
    // 1. Determinar a intenção do usuário usando o serviço de IA
    const intentData = await aiService.determineUserIntent(userMessage);
    const { intent, entities, response_suggestion } = intentData;

    let resultData; // Variável para armazenar o resultado da ação
    let finalResponse; // Variável para a mensagem final formatada

    console.log(`[Intent Handler] Roteando intenção: ${intent}`);

    // 2. Roteador (Switch Case) para chamar a ação apropriada
    switch (intent) {
        case 'CREATE_TRANSACTION':
            resultData = await actionHandler.handleCreateTransaction(userId, entities);
            finalResponse = responseFormatter.formatTransactionSuccess(resultData);
            break;

        case 'CREATE_ALERT':
            resultData = await actionHandler.handleCreateAlert(userId, entities);
            finalResponse = responseFormatter.formatAlertSuccess(resultData);
            break;

        case 'QUERY_BALANCE':
            resultData = await actionHandler.handleQueryBalance(userId);
            finalResponse = responseFormatter.formatBalance(resultData);
            break;

        case 'QUERY_TRANSACTIONS':
            const transactionType = entities.type || 'despesa';
            resultData = await actionHandler.handleQueryTransactions(userId, entities);
            // Passa a categoria da entidade para o formatador saber o título
            finalResponse = responseFormatter.formatTransactionList(resultData, transactionType, entities.category);
            break;

        case 'QUERY_ALERTS':
            resultData = await actionHandler.handleQueryAlerts(userId, entities);
            finalResponse = responseFormatter.formatAlertList(resultData);
            break;

        case 'CONFIRM_PAYMENT':
            resultData = await actionHandler.handleConfirmPayment(userId, entities);
            if (resultData && resultData.success) {
                finalResponse = responseFormatter.formatPaymentConfirmation(resultData.data);
            } else {
                // A IA pode não saber o código, então tratamos o erro aqui
                finalResponse = resultData.message || `Não foi possível confirmar o pagamento para ${entities.alert_code}. Verifique o código ou se o alerta já foi pago.`;
            }
            break;

        case 'DELETE_ITEM':
            resultData = await actionHandler.handleDeleteItem(userId, entities);
            if (resultData && resultData.id_transacao) { // Checa se é uma transação válida
                finalResponse = responseFormatter.formatDeletionSuccess(resultData, 'transação');
            } else if (resultData && resultData.id_alerta) { // Checa se é um alerta válido
                finalResponse = responseFormatter.formatDeletionSuccess(resultData, 'alerta');
            } else {
                finalResponse = responseFormatter.formatItemNotFound(entities.item_code);
            }
            break;

                    // <<< ADICIONADO: Caso para criar recorrências >>>
        case 'CREATE_RECURRENCE':
            resultData = await actionHandler.handleCreateRecurrence(userId, entities);
            finalResponse = responseFormatter.formatRecurrenceSuccess(resultData);
            break;

        case 'GENERAL_CONVERSATION':
            // Para conversas gerais, podemos ter respostas pré-definidas ou até chamar a IA novamente para gerar uma resposta conversacional
            // Por enquanto, vamos usar uma resposta padrão.
            if (entities.topic === "erro_ia") {
                finalResponse = "Desculpe, tive um problema para processar sua solicitação. Poderia tentar novamente com outras palavras?";
            } else {
                finalResponse = "Olá! Sou o Saldo Zap, seu assistente financeiro. Como posso te ajudar a controlar seus gastos hoje?";
            }
            break;

        default:
            console.warn(`[Intent Handler] Intenção não reconhecida: ${intent}`);
            finalResponse = "Desculpe, não entendi o que você quis dizer. Pode reformular, por favor?";
            break;
    }

    // 3. Retorna a resposta inicial sugerida pela IA e a resposta final formatada
    return {
        suggestion: response_suggestion,
        finalResponse: finalResponse,
    };
};

module.exports = {
    processIntent,
};