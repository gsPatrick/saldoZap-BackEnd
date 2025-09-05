// src/chatbot/action.handler.js

// Importa todos os serviços de negócio necessários
const transacaoService = require('../transacoes/transacao.service');
const alertaPagamentoService = require('../alertas-pagamento/alerta-pagamento.service');
const recorrenciaService = require('../recorrencias/recorrencia.service');
// Adicione outros serviços conforme necessário (ex: usuarioService)

/**
 * Lida com a criação de uma transação (despesa ou receita).
 * @param {number} userId - O ID do usuário.
 * @param {object} entities - As entidades extraídas pela IA.
 * @returns {Promise<object>} O resultado da criação da transação.
 */
const handleCreateTransaction = async (userId, entities) => {
    console.log('[Action Handler] Executando: handleCreateTransaction');
    const transactionData = {
        id_usuario: userId,
        tipo: entities.type,
        valor: entities.value,
        descricao: entities.description,
        nome_categoria: entities.category, // A IA pode sugerir uma categoria
        data_transacao: entities.date || new Date().toISOString().split('T')[0], // Usa a data de hoje se não especificada
    };
    return await transacaoService.createTransaction(transactionData);
};

/**
 * Lida com a criação de um alerta de pagamento.
 * @param {number} userId - O ID do usuário.
 * @param {object} entities - As entidades extraídas pela IA.
 * @returns {Promise<object>} O resultado da criação do alerta.
 */
const handleCreateAlert = async (userId, entities) => {
    console.log('[Action Handler] Executando: handleCreateAlert');
    const alertData = {
        id_usuario: userId,
        tipo: entities.type,
        valor: entities.value,
        descricao: entities.description,
        data_vencimento: entities.due_date,
    };
    return await alertaPagamentoService.createPaymentAlert(alertData);
};

/**
 * Lida com a consulta de transações.
 * @param {number} userId - O ID do usuário.
 * @param {object} entities - As entidades extraídas pela IA.
 * @returns {Promise<Array<object>>} Uma lista de transações.
 */
const handleQueryTransactions = async (userId, entities) => {
    console.log('[Action Handler] Executando: handleQueryTransactions');
    const tipo = entities.type === 'ambos' ? null : entities.type;
    const periodo = entities.period || 'mes_atual'; // Padrão para o mês atual
    const filtrosAdicionais = {};
    if (entities.category) {
        filtrosAdicionais.nome_categoria = entities.category;
    }
    return await transacaoService.listTransactions(userId, periodo, tipo, filtrosAdicionais);
};

/**
 * Lida com a consulta de alertas.
 * @param {number} userId - O ID do usuário.
 * @param {object} entities - As entidades extraídas pela IA.
 * @returns {Promise<Array<object>>} Uma lista de alertas.
 */
const handleQueryAlerts = async (userId, entities) => {
    console.log('[Action Handler] Executando: handleQueryAlerts');
    // A IA nos dará um período relativo. Precisamos traduzir isso para datas.
    // Exemplo simples: se entities.period for "este mês", calculamos as datas aqui.
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    const queryParams = {
        id_usuario: userId,
        'data_vencimento[gte]': inicioMes,
        'data_vencimento[lte]': fimMes,
        status: 'pendente', // Geralmente queremos ver apenas os pendentes
    };
    if (entities.type && entities.type !== 'ambos') {
        queryParams.tipo = entities.type;
    }

    return await alertaPagamentoService.listPaymentAlerts(queryParams);
};

/**
 * Lida com a consulta de saldo.
 * @param {number} userId - O ID do usuário.
 * @returns {Promise<number>} O saldo atual do usuário.
 */
const handleQueryBalance = async (userId) => {
    console.log('[Action Handler] Executando: handleQueryBalance');
    return await transacaoService.getCurrentBalance(userId);
};

/**
 * Lida com a confirmação de pagamento de um alerta.
 * @param {number} userId - O ID do usuário.
 * @param {object} entities - As entidades extraídas pela IA.
 * @returns {Promise<object>} O resultado da atualização do status do alerta.
 */
const handleConfirmPayment = async (userId, entities) => {
    console.log('[Action Handler] Executando: handleConfirmPayment');
    const { alert_code } = entities;
    // O service updateStatusByCode já retorna um objeto com { success, status, data, message }
    return await alertaPagamentoService.updateStatusByCode(alert_code, userId, 'pago');
};

/**
 * Lida com a exclusão de um item (transação ou alerta).
 * @param {number} userId - O ID do usuário.
 * @param {object} entities - As entidades extraídas pela IA.
 * @returns {Promise<object>} Os detalhes do item excluído.
 */
const handleDeleteItem = async (userId, entities) => {
    console.log('[Action Handler] Executando: handleDeleteItem');
    const { item_code } = entities;

    // Determina se é um alerta ou transação pelo prefixo
    if (item_code.startsWith('ALT-')) {
        const deletedAlert = await alertaPagamentoService.deletePaymentAlertByCode(item_code, userId);
        return { ...deletedAlert, itemType: 'alerta' };
    } else if (item_code.startsWith('TRX-')) {
        const deletedTransaction = await transacaoService.deleteTransactionByCode(item_code, userId);
        return { ...deletedTransaction, itemType: 'transação' };
    } else {
        return null; // Código não reconhecido
    }
};

// Adicione aqui o handleCreateRecurrence se necessário

module.exports = {
    handleCreateTransaction,
    handleCreateAlert,
    handleQueryTransactions,
    handleQueryAlerts,
    handleQueryBalance,
    handleConfirmPayment,
    handleDeleteItem,
};