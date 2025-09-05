// src/chatbot/response.formatter.js

// --- Funções Helper ---

/**
 * Formata um valor numérico para o padrão de moeda BRL (R$ 1.234,56).
 * @param {number | string} value - O valor a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
const formatCurrency = (value) => {
    const number = parseFloat(value) || 0;
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Formata uma data no formato 'YYYY-MM-DD' para 'DD/MM/YYYY'.
 * @param {string} dateString - A data no formato 'YYYY-MM-DD'.
 * @returns {string} A data formatada.
 */
const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return 'Data inválida';
    }
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};


// --- Formatadores de Mensagens Principais ---

/**
 * Formata a mensagem de sucesso para uma transação recém-criada.
 * @param {object} txData - O objeto da transação vindo do transacao.service.
 * @returns {string} A mensagem formatada.
 */
const formatTransactionSuccess = (txData) => {
    const isExpense = txData.tipo === 'despesa';
    const title = isExpense ? '💸 *Despesa Registrada com Sucesso!*' : '✅ *Receita Registrada com Sucesso!*';
    const icon = isExpense ? '💸' : '💰';
    const description = txData.descricao || 'Sem descrição';
    const category = txData.nome_categoria ? `🏷️ Cat: _${txData.nome_categoria}_` : '';

    return `
${title}

*${description}*
${icon} Valor: ${formatCurrency(txData.valor)}
📅 Data: ${formatDate(txData.data_transacao)}
${category}
🧾 Tipo: ${txData.tipo}
📌 Código: ${txData.codigo_unico}
    `.trim();
};

/**
 * Formata a mensagem de sucesso para um alerta recém-criado.
 * @param {object} alertData - O objeto do alerta vindo do alerta-pagamento.service.
 * @returns {string} A mensagem formatada.
 */
const formatAlertSuccess = (alertData) => {
    const isExpense = alertData.tipo === 'despesa';
    const title = isExpense ? '🚨 *Alerta de Despesa Criado!*' : '✨ *Alerta de Receita Criado!*';
    const icon = isExpense ? '💸' : '💰';
    const description = alertData.descricao || 'Sem descrição';

    return `
${title}

*${description}*
${icon} *Valor:* ${formatCurrency(alertData.valor)}
📅 *Vencimento:* ${formatDate(alertData.data_vencimento)}
🚦 Status: pendente
🧾 *Tipo:* ${alertData.tipo}

📌 Código: ${alertData.codigo_unico}
🛑 Se precisar excluir algum alerta digite: 'Excluir alerta ${alertData.codigo_unico}'
    `.trim();
};

/**
 * Formata a mensagem de consulta de saldo.
 * @param {number} balance - O valor do saldo.
 * @returns {string} A mensagem formatada.
 */
const formatBalance = (balance) => {
    return `💰 Seu saldo atual é: *${formatCurrency(balance)}*`;
};

/**
 * Formata uma lista de transações (despesas ou receitas).
 * @param {Array<object>} transactions - Um array de objetos de transação.
 * @param {string} type - 'despesa' ou 'receita'.
 * @returns {string} A mensagem formatada com a lista.
 */
const formatTransactionList = (transactions, type) => {
    if (!transactions || transactions.length === 0) {
        return `Nenhuma ${type === 'despesa' ? 'despesa' : 'receita'} encontrada para o período solicitado.`;
    }

    const isExpense = type === 'despesa';
    const title = isExpense ? '💸 *Lista de Despesas Recentes*' : '💰 *Lista de Receitas Recentes*';
    const totalLabel = isExpense ? 'Total Gasto' : 'Total Recebido';
    const totalIcon = isExpense ? '📊' : '📈';

    let totalValue = 0;
    const items = transactions.map(tx => {
        totalValue += parseFloat(tx.valor);
        const description = tx.descricao || 'Sem descrição';
        const category = tx.nome_categoria ? `🏷️ Cat: _${tx.nome_categoria}_` : '';
        return `
*${description}*
💸 Valor: ${formatCurrency(tx.valor)}
📅 Data: ${formatDate(tx.data_transacao)}
${category}
📌 Código: ${tx.codigo_unico}
        `.trim();
    }).join('\n\n--------------------\n\n');

    return `
${title}

${items}

--------------------
${totalIcon} *${totalLabel}:* ${formatCurrency(totalValue)}
    `.trim();
};

/**
 * Formata uma lista de alertas de pagamento/recebimento.
 * @param {Array<object>} alerts - Um array de objetos de alerta.
 * @returns {string} A mensagem formatada com a lista.
 */
const formatAlertList = (alerts) => {
    if (!alerts || alerts.length === 0) {
        return 'Você não possui nenhuma pendência futura registrada.';
    }

    const title = '📋 *Suas Próximas Pendências*';

    const items = alerts.map(alert => {
        const description = alert.descricao || 'Sem descrição';
        const category = alert.nome_categoria ? `🏷️ Cat: _${alert.nome_categoria}_` : '';
        return `
*${description}*
📅 Venc: ${formatDate(alert.data_vencimento)}
💸 Valor: ${formatCurrency(alert.valor)}
${category}
📌 Código: ${alert.codigo_unico}
📍 Status: ${alert.status}
🧾 Tipo: ${alert.tipo}
        `.trim();
    }).join('\n--------------------\n');

    return `${title}\n\n${items}`;
};

/**
 * Formata uma mensagem de sucesso para a exclusão de um item.
 * @param {object} deletedItem - O objeto do item que foi deletado.
 * @param {'transação' | 'alerta'} itemType - O tipo de item.
 * @returns {string} A mensagem de confirmação.
 */
const formatDeletionSuccess = (deletedItem, itemType) => {
    const description = deletedItem.descricao || `Item de código ${deletedItem.codigo_unico}`;
    return `✅ A ${itemType} "${description}" no valor de ${formatCurrency(deletedItem.valor)} foi excluída com sucesso!`;
};

/**
 * Formata uma mensagem de item não encontrado para exclusão ou pagamento.
 * @param {string} itemCode - O código do item não encontrado.
 * @returns {string} A mensagem de erro.
 */
const formatItemNotFound = (itemCode) => {
    return `😕 Não encontrei nenhum item com o código *${itemCode}*. Verifique se o código está correto e tente novamente.`;
};

/**
 * Formata a confirmação de pagamento de um alerta.
 * @param {object} alertData - O objeto do alerta que foi pago.
 * @returns {string} A mensagem de confirmação.
 */
const formatPaymentConfirmation = (alertData) => {
    const description = alertData.descricao || 'Alerta';
    return `
✅ *Alerta Confirmado como Pago!*

*${description}*
💸 Valor: ${formatCurrency(alertData.valor)}
📅 Vencimento Original: ${formatDate(alertData.data_vencimento)}
🟢 Status: *Confirmado como Pago*
📌 Código do Alerta: ${alertData.codigo_unico}
    `.trim();
};


// <<< ADICIONADO: Formatador para sucesso de Recorrência >>>
/**
 * Formata a mensagem de sucesso para uma recorrência recém-criada.
 * @param {object} recurrenceData - O objeto da recorrência.
 * @returns {string} A mensagem formatada.
 */
const formatRecurrenceSuccess = (recurrenceData) => {
    const isExpense = recurrenceData.tipo === 'despesa';
    const title = isExpense ? '🔄 *Recorrência de Despesa Criada!*' : '🔄 *Recorrência de Receita Criada!*';
    const icon = isExpense ? '💸' : '💰';
    const description = recurrenceData.descricao || 'Recorrência';

    let frequencyDetails = '';
    switch (recurrenceData.frequencia) {
        case 'mensal':
            frequencyDetails = `Todo dia ${recurrenceData.dia_mes}`;
            break;
        case 'semanal':
            frequencyDetails = `Toda ${recurrenceData.dia_semana}`;
            break;
        case 'anual':
            frequencyDetails = `Anualmente`;
            break;
        default:
            frequencyDetails = recurrenceData.frequencia;
    }

    return `
${title}

*${description}*
${icon} Valor: ${formatCurrency(recurrenceData.valor)}
🏷️ Cat: _${recurrenceData.nome_categoria || 'Não definida'}_

🗓️ *Detalhes da Recorrência:*
  - Frequência: ${frequencyDetails}
  - Início: ${formatDate(recurrenceData.data_inicio)}
  - Fim: ${recurrenceData.data_fim_recorrencia ? formatDate(recurrenceData.data_fim_recorrencia) : 'Contínuo'}
    `.trim();
};

// <<< ADICIONADO: Formatadores para Onboarding >>>
/**
 * Formata a mensagem pedindo o e-mail para um novo usuário.
 * @returns {string} A mensagem formatada.
 */
const formatOnboardingEmailRequest = () => {
    return `
👋 Olá! Seja bem-vindo(a) ao Saldo Zap!

Notei que este é seu primeiro acesso. Para começar a usar todos os recursos, por favor, me informe o seu melhor e-mail.
    `.trim();
};

/**
 * Formata a mensagem de boas-vindas completa após o e-mail ser associado.
 * @returns {string} A mensagem de tutorial.
 */
const formatOnboardingWelcome = () => {
    return `
✅ E-mail associado com sucesso!

Eu sou o Saldo Zap, seu assistente financeiro direto no WhatsApp. Comigo, você pode registrar seus ganhos e gastos de forma rápida e simples, direto na conversa.

*Como funciona:*
✍️ Para registrar algo, basta me dizer o que aconteceu.
*Ex:* "Gastei 25 reais com lanche hoje"
*Ex:* "Recebi 1200 do freela"

⏰ Crie lembretes para não esquecer suas contas.
*Ex:* "Me lembre de pagar a conta de luz de R$ 150 amanhã"

🔄 Crie transações recorrentes.
*Ex:* "Assinatura da Netflix, 55 reais todo mês"

*O que você gostaria de fazer agora?*
    `.trim();
};


module.exports = {
    formatTransactionSuccess,
    formatAlertSuccess,
    formatBalance,
    formatTransactionList,
    formatAlertList,
    formatDeletionSuccess,
    formatItemNotFound,
    formatPaymentConfirmation,
        formatRecurrenceSuccess,      // <<< ADICIONADO
    formatOnboardingEmailRequest, // <<< ADICIONADO
    formatOnboardingWelcome,      // <<< ADICIONADO
};