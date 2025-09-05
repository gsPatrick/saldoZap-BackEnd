// src/chatbot/response.formatter.js

// --- Funções Helper ---

/**
 * Formata um valor numérico para o padrão de moeda BRL (R$ 1.234,56).
 * @param {number | string} value - O valor a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
const formatCurrency = (value) => {
    const number = parseFloat(value);
    if (isNaN(number)) { return "Valor inválido"; }
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Formata uma data no formato 'YYYY-MM-DD' para 'DD/MM/YYYY'.
 * @param {string} dateString - A data no formato 'YYYY-MM-DD'.
 * @returns {string} A data formatada ou "Data inválida".
 */
const formatDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        return "Data inválida";
    }
    try {
        const [year, month, day] = dateString.split('-');
        const dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        if (isNaN(dateObj.getTime()) || dateObj.getUTCFullYear() !== parseInt(year) || dateObj.getUTCMonth() !== parseInt(month) - 1 || dateObj.getUTCDate() !== parseInt(day)) {
            return "Data inválida";
        }
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.error("Erro ao formatar data:", dateString, e);
        return "Data inválida";
    }
};

// --- Formatadores de Mensagens Principais ---

/**
 * Formata a mensagem de sucesso para uma transação recém-criada (despesa ou receita).
 * @param {object} txData - O objeto da transação vindo do transacao.service, que inclui saldoAposTransacao.
 * @returns {string} A mensagem formatada.
 */
const formatTransactionSuccess = (txData) => {
    const isExpense = txData.tipo === 'despesa';
    const title = isExpense ? '❌ *Despesa Registrada com Sucesso!*' : '✅ *Receita Registrada com Sucesso!*';
    const icon = isExpense ? '💸' : '💰';
    const saldoLabel = isExpense ? '💳 *Saldo Restante:*' : '💳 *Saldo Atual:*';
    const description = txData.descricao || "Sem descrição";
    const category = txData.nome_categoria || "Sem categoria";

    let message = `${title}\n\n`;
    message += `*${description}*\n`;
    message += `${icon} *Valor:* ${formatCurrency(txData.valor)}\n`;
    message += `📅 *Data:* ${formatDate(txData.data_transacao)}\n`;
    if (category !== "Sem categoria") {
        message += `🏷️ *Categoria:* _${category}_\n`;
    }
    message += `🧾 *Tipo:* ${txData.tipo}\n`;
    message += `${saldoLabel} ${formatCurrency(txData.saldoAposTransacao)}\n`;
    message += `📌 Código: ${txData.codigo_unico}\n\n`;
    message += `🛑 Se precisar excluir alguma transação digite: 'Excluir transação ${txData.codigo_unico}'`;

    return message;
};

/**
 * Formata a mensagem de sucesso para um alerta recém-criado.
 * @param {object} alertData - O objeto do alerta.
 * @returns {string} A mensagem formatada.
 */
const formatAlertSuccess = (alertData) => {
    const isExpense = alertData.tipo === 'despesa';
    const title = isExpense ? '🚨 *Alerta de Despesa Criado!*' : '✨ *Alerta de Receita Criado!*';
    const icon = isExpense ? '💸' : '💰';
    const description = alertData.descricao || "Sem descrição";
    const category = alertData.nome_categoria || "Sem categoria";

    let message = `${title}\n\n`;
    message += `*${description}*\n`;
    message += `${icon} *Valor:* ${formatCurrency(alertData.valor)}\n`;
    message += `📅 *Vencimento:* ${formatDate(alertData.data_vencimento)}\n`;
    message += `🚦 Status: ${alertData.status}\n`;
    if (category !== "Sem categoria") {
        message += `🏷️ *Categoria:* _${category}_\n`;
    }
    message += `🧾 *Tipo:* ${alertData.tipo}\n\n`;
    message += `📌 Código: ${alertData.codigo_unico}\n`;
    message += `🛑 Se precisar excluir algum alerta digite: 'Excluir alerta ${alertData.codigo_unico}'`;

    return message;
};

/**
 * Formata a mensagem de sucesso para uma recorrência recém-criada.
 * @param {object} recurrenceData - O objeto da recorrência.
 * @returns {string} A mensagem formatada.
 */
const formatRecurrenceSuccess = (recurrenceData) => {
    const isExpense = recurrenceData.tipo === 'despesa';
    const title = '🔄 *Recorrência de Despesa Criada!*';
    const icon = '💸';

    const description = recurrenceData.descricao || "Recorrência sem descrição";
    const category = recurrenceData.nome_categoria || "Sem categoria";
    const freq = recurrenceData.frequencia;
    const diaMes = recurrenceData.dia_mes;

    let message = `${title}\n\n`;
    message += `*${description}*\n`;
    message += `${icon} Valor: ${formatCurrency(recurrenceData.valor)}\n`;
    if (category !== "Sem categoria") {
        message += `🏷️ Categoria: _${category}_\n\n`;
    }
    message += `🗓️ *Detalhes da Recorrência:*\n`;
    message += `  - Frequência: Mensal\n`;
    message += `  - Dia do Mês: Todo dia ${diaMes}\n`;
    message += `  - Início: ${formatDate(recurrenceData.data_inicio)}\n`;
    message += `  - Fim: ${recurrenceData.data_fim_recorrencia ? formatDate(recurrenceData.data_fim_recorrencia) : '*Sem data de fim definida*'}`;

    return message;
};

/**
 * Formata uma lista de transações (despesas ou receitas).
 * @param {Array<object>} transactions - Um array de objetos de transação.
 * @param {string} type - 'despesa' ou 'receita'.
 * @param {string} [categoryFilter] - A categoria específica que foi filtrada.
 * @returns {string} A mensagem formatada com a lista.
 */
const formatTransactionList = (transactions, type, categoryFilter = null) => {
    if (!transactions || transactions.length === 0) {
        return `Nenhuma ${type === 'despesa' ? 'despesa' : 'receita'}${categoryFilter ? ` para a categoria "${categoryFilter}"` : ''} encontrada.`;
    }

    const isExpense = type === 'despesa';
    const title = categoryFilter ? `💸 *Despesas: ${categoryFilter}*` : (isExpense ? '💸 *Lista de Despesas Recentes*' : '💰 *Lista de Receitas Recentes*');
    const totalLabel = categoryFilter ? `Total (${categoryFilter})` : (isExpense ? 'Total Gasto' : 'Total Recebido');
    const totalIcon = isExpense ? '📊' : '📈';

    let totalValue = 0;
    const items = transactions.map(tx => {
        totalValue += parseFloat(tx.valor);
        const description = tx.descricao || null;
        let itemString = '';

        if (description && description.toLowerCase() !== (tx.nome_categoria || '').toLowerCase()) {
            itemString += `📝 Desc: *${description}*\n`;
        }
        itemString += `📅 Data: ${formatDate(tx.data_transacao)}\n`;
        itemString += `💸 Valor: ${formatCurrency(tx.valor)}\n`;
        itemString += `📌 Código: ${tx.codigo_unico}`;

        return itemString;
    }).join('\n--------\n');

    let message = `${title}\n\n${items}\n\n--------------------\n`;
    message += `${totalIcon} *${totalLabel}:* ${formatCurrency(totalValue)}`;
    return message;
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

    const title = '📋 *Extrato Detalhado*';
    const items = alerts.map(alert => {
        const description = alert.descricao || "Sem descrição";
        const category = alert.nome_categoria || "Sem categoria";
        return `*${description}*\n` +
            `📅 Venc: ${formatDate(alert.data_vencimento)}\n` +
            `💸 Valor: ${formatCurrency(alert.valor)}\n` +
            `🏷️ Categoria: _${category}_\n` +
            `📍 Status: ${alert.status}\n` +
            `🧾 Tipo: ${alert.tipo}\n\n` +
            `📌 Código: ${alert.codigo_unico}`;
    }).join('\n\n');

    return `${title}\n\n${items}`;
};

/**
 * Formata uma mensagem de sucesso para a exclusão de um item.
 * @param {object} deletedItem - O objeto do item que foi deletado.
 * @returns {string} A mensagem de confirmação.
 */
const formatDeletionSuccess = (deletedItem) => {
    const isTransaction = deletedItem.itemType === 'transação';
    const isExpense = deletedItem.tipo === 'despesa';
    const itemTypeName = isTransaction ? (isExpense ? 'Despesa' : 'Receita') : (isExpense ? 'Alerta de Despesa' : 'Alerta de Receita');
    
    const title = `🗑️ *${itemTypeName} Excluído com Sucesso!*`;
    const icon = isExpense ? '💸' : '💰';
    const dateLabel = isTransaction ? 'Data' : 'Vencimento';
    const dateValue = isTransaction ? formatDate(deletedItem.data_transacao) : formatDate(deletedItem.data_vencimento);
    const description = deletedItem.descricao || "Item sem descrição";

    let message = `${title}\n\n_Detalhes do item removido:_\n`;
    message += `*${description}*\n`;
    message += `${icon} Valor: ${formatCurrency(deletedItem.valor)}\n`;
    message += `📅 ${dateLabel}: ${dateValue}`;

    return message;
};

// --- Funções que permanecem as mesmas ---
const formatBalance = (balance) => `💰 Seu saldo atual é: *${formatCurrency(balance)}*`;
const formatItemNotFound = (itemCode) => `😕 Não encontrei nenhum item com o código *${itemCode}*. Verifique se o código está correto e tente novamente.`;
const formatPaymentConfirmation = (alertData) => {
    const description = alertData.descricao || 'Alerta';
    return `✅ *Alerta Confirmado como Pago!*\n\n*${description}*\n💸 Valor: ${formatCurrency(alertData.valor)}\n📅 Vencimento Original: ${formatDate(alertData.data_vencimento)}\n🟢 Status: *Confirmado como Pago*\n📌 Código do Alerta: ${alertData.codigo_unico}`;
};
const formatOnboardingEmailRequest = () => `👋 Olá! Seja bem-vindo(a) ao Saldo Zap!\n\nNotei que este é seu primeiro acesso. Para começar a usar todos os recursos, por favor, me informe o seu melhor e-mail.`;
const formatOnboardingWelcome = () => `✅ E-mail associado com sucesso!\n\nEu sou o Saldo Zap, seu assistente financeiro direto no WhatsApp. Comigo, você pode registrar seus ganhos e gastos de forma rápida e simples, direto na conversa.\n\n*Como funciona:*\n✍️ Para registrar algo, basta me dizer o que aconteceu.\n*Ex:* "Gastei 25 reais com lanche hoje"\n*Ex:* "Recebi 1200 do freela"\n\n⏰ Crie lembretes para não esquecer suas contas.\n*Ex:* "Me lembre de pagar a conta de luz de R$ 150 amanhã"\n\n🔄 Crie transações recorrentes.\n*Ex:* "Assinatura da Netflix, 55 reais todo mês"\n\n*O que você gostaria de fazer agora?*`;

module.exports = {
    formatTransactionSuccess,
    formatAlertSuccess,
    formatRecurrenceSuccess,
    formatBalance,
    formatTransactionList,
    formatAlertList,
    formatDeletionSuccess,
    formatItemNotFound,
    formatPaymentConfirmation,
    formatOnboardingEmailRequest,
    formatOnboardingWelcome,
};