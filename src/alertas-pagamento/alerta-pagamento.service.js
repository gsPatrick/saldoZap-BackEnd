// src/alertas-pagamento/alerta-pagamento.service.js
const AlertaPagamento = require('./alerta-pagamento.model');
const transacaoService = require('../transacoes/transacao.service'); // Importar TransactionService
const { Sequelize } = require('sequelize'); // Para Op, se necessário
const { nanoid } = require('nanoid'); // Para gerar código único

// --- Função Helper para Gerar Código Único de Alerta ---
const generateUniqueAlertCode = async () => {
    let code;
    let existing = true;
    while (existing) {
        // Gera um código com prefixo e 7 caracteres aleatórios
        code = `ALT-${nanoid(7)}`;
        existing = await AlertaPagamento.findOne({ where: { codigo_unico: code }, paranoid: false }); // paranoid: false se usar soft delete
    }
    return code;
};
// ---------------------------------------------------------

/**
 * Cria um novo alerta de pagamento.
 * O codigo_unico é gerado automaticamente.
 * @param {object} dadosAlerta - Objeto contendo os dados do alerta.
 * @param {number} dadosAlerta.id_usuario - ID do usuário.
 * @param {number} dadosAlerta.valor - Valor do alerta.
 * @param {string} dadosAlerta.data_vencimento - Data de vencimento (YYYY-MM-DD).
 * @param {string} dadosAlerta.tipo - 'despesa' ou 'receita'.
 * @param {string} [dadosAlerta.descricao] - Descrição opcional.
 * @param {string} [dadosAlerta.status='pendente'] - Status inicial.
 * @param {number} [dadosAlerta.id_recorrencia_pai] - ID da recorrência pai (opcional).
 * @param {string} [dadosAlerta.nome_categoria] - Nome da categoria (opcional).
 * @returns {Promise<AlertaPagamento>} O alerta criado.
 */
const createPaymentAlert = async (dadosAlerta) => {
    try {
        // Gera o código único ANTES de criar (garantido pelo hook, mas pode gerar aqui também se preferir)
        // const codigo_unico_gerado = await generateUniqueAlertCode(); // O hook beforeValidate já faz isso

        // Garante um status padrão se não for fornecido
        const statusFinal = dadosAlerta.status || 'pendente';

        const alertaPagamento = await AlertaPagamento.create({
            ...dadosAlerta, // Inclui id_usuario, valor, data_vencimento, tipo, etc.
            status: statusFinal,
            // codigo_unico: codigo_unico_gerado // O hook beforeValidate cuida disso
        });
        // Recarrega para garantir que o código único gerado pelo hook esteja presente
        await alertaPagamento.reload();
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao criar alerta de pagamento:", error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.error("Colisão de código único de alerta detectada (raro).");
        }
        throw error; // Re-lança o erro para ser tratado pela rota
    }
};

/**
 * Busca um alerta de pagamento pelo seu ID (PK).
 * @param {number} id_alerta - ID do alerta.
 * @returns {Promise<AlertaPagamento|null>} O alerta encontrado ou null.
 */
const getPaymentAlertById = async (id_alerta) => {
    try {
        const alertaPagamento = await AlertaPagamento.findByPk(id_alerta);
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao obter alerta de pagamento por ID:", error);
        throw error;
    }
};

/**
 * Lista alertas de pagamento com base em filtros.
 * @param {object} filters - Objeto de filtros (ex: { id_usuario: 1, status: 'pendente' }).
 * @returns {Promise<AlertaPagamento[]>} Lista de alertas encontrados.
 */
const listPaymentAlerts = async (filters = {}) => {
    try {
        // Adicionar filtros comuns como data_vencimento range se necessário
        const whereClause = { ...filters };

        // Exemplo de como adicionar filtro de data range se viesse nos filters
        if (filters.data_vencimento_inicio && filters.data_vencimento_fim) {
             whereClause.data_vencimento = {
                 [Sequelize.Op.between]: [filters.data_vencimento_inicio, filters.data_vencimento_fim]
             };
             delete filters.data_vencimento_inicio; // Remover do where principal
             delete filters.data_vencimento_fim;
        } else if (filters.data_vencimento_gte) {
             whereClause.data_vencimento = { [Sequelize.Op.gte]: filters.data_vencimento_gte };
             delete filters.data_vencimento_gte;
        } else if (filters.data_vencimento_lte) {
            whereClause.data_vencimento = { [Sequelize.Op.lte]: filters.data_vencimento_lte };
            delete filters.data_vencimento_lte;
        }


        const alertasPagamento = await AlertaPagamento.findAll({
            where: whereClause,
            order: [['data_vencimento', 'ASC']] // Ordenar por vencimento
        });
        return alertasPagamento;
    } catch (error) {
        console.error("Erro ao listar alertas de pagamento:", error);
        throw error;
    }
};

/**
 * Atualiza um alerta de pagamento existente (exceto status 'pago').
 * Use updateStatusByCode para mudar o status, especialmente para 'pago'.
 * @param {number} id_alerta - ID do alerta.
 * @param {object} updates - Campos a serem atualizados.
 * @returns {Promise<AlertaPagamento|null>} O alerta atualizado ou null.
 */
const updatePaymentAlert = async (id_alerta, updates) => {
    try {
        const alertaPagamento = await AlertaPagamento.findByPk(id_alerta);
        if (!alertaPagamento) {
            return null; // Não encontrado
        }

        // Impedir atualização direta para 'pago' ou de alertas já pagos/cancelados? (Opcional)
        // if (updates.status === 'pago' || ['pago', 'cancelado'].includes(alertaPagamento.status)) {
        //     console.warn(`Tentativa de atualização inválida para alerta ${id_alerta} com status ${alertaPagamento.status}`);
        //     // Poderia retornar um erro ou simplesmente ignorar a atualização de status
        //     delete updates.status;
        // }

        // Não permitir alterar campos críticos como id_usuario, id_recorrencia_pai, codigo_unico
        delete updates.id_usuario;
        delete updates.id_recorrencia_pai;
        delete updates.codigo_unico;
        delete updates.id_alerta;


        await alertaPagamento.update(updates);
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao atualizar alerta de pagamento:", error);
        throw error;
    }
};

/**
 * Deleta um alerta de pagamento pelo seu ID (PK).
 * @param {number} id_alerta - ID do alerta.
 * @returns {Promise<boolean>} True se deletado, false caso contrário.
 */
const deletePaymentAlert = async (id_alerta) => {
    try {
        const alertaPagamentoDeletadoCount = await AlertaPagamento.destroy({
            where: { id_alerta }
        });
        return alertaPagamentoDeletadoCount > 0;
    } catch (error) {
        console.error("Erro ao deletar alerta de pagamento por ID:", error);
        throw error;
    }
};

/**
 * Deleta um alerta de pagamento pelo seu código único e ID do usuário.
 * @param {string} codigo_unico - Código único do alerta.
 * @param {number} id_usuario - ID do usuário proprietário.
 * @returns {Promise<boolean>} True se deletado, false caso contrário.
 */
const deletePaymentAlertByCode = async (codigo_unico, id_usuario) => {
    try {
        const alertaDeletadoCount = await AlertaPagamento.destroy({
            where: {
                codigo_unico: codigo_unico,
                id_usuario: id_usuario // Garante que só o dono delete
            }
        });
        return alertaDeletadoCount > 0;
    } catch (error) {
        console.error("Erro ao deletar alerta de pagamento por código:", error);
        throw error;
    }
};


/**
 * Busca alertas de pagamento pendentes e próximos do vencimento.
 * @param {number} id_usuario - ID do usuário.
 * @param {number} [daysAhead=7] - Número de dias à frente para buscar.
 * @returns {Promise<AlertaPagamento[]>} Lista de alertas próximos.
 */
const getUpcomingPaymentAlerts = async (id_usuario, daysAhead = 7) => {
    try {
        const today = new Date();
        // Zera a hora para pegar desde o início do dia
        today.setHours(0, 0, 0, 0);

        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + daysAhead);
        // Define o fim do dia para incluir alertas que vencem no último dia
        futureDate.setHours(23, 59, 59, 999);

        const alertasPagamento = await AlertaPagamento.findAll({
            where: {
                id_usuario: id_usuario,
                data_vencimento: {
                    [Sequelize.Op.between]: [today, futureDate]
                },
                status: 'pendente' // Apenas pendentes
            },
            order: [['data_vencimento', 'ASC']] // Ordenar por data de vencimento
        });
        return alertasPagamento;

    } catch (error) {
        console.error("Erro ao obter alertas de pagamento próximos:", error);
        throw error;
    }
};

/**
 * Atualiza o status de um alerta pelo código único e ID do usuário.
 * Se o novo status for 'pago' e o status atual for 'pendente',
 * cria a transação correspondente.
 * @param {string} codigo_unico - Código único do alerta.
 * @param {number} id_usuario - ID do usuário proprietário.
 * @param {'pendente' | 'pago' | 'cancelado'} novoStatus - O novo status desejado.
 * @returns {Promise<{success: boolean, status: number, message?: string, data?: AlertaPagamento}>} Resultado da operação.
 */
const updateStatusByCode = async (codigo_unico, id_usuario, novoStatus) => {
    const t = await AlertaPagamento.sequelize.transaction(); // Inicia transação do DB

    try {
        // Busca o alerta dentro da transação para garantir bloqueio
        const alerta = await AlertaPagamento.findOne({
            where: { codigo_unico: codigo_unico, id_usuario: id_usuario },
            transaction: t // <<< Adiciona lock na linha
        });

        if (!alerta) {
            await t.rollback(); // Libera a transação
            return { success: false, status: 404, message: "Alerta não encontrado." };
        }

        // Validar transições de status
        if (novoStatus === 'pago' && alerta.status !== 'pendente') {
             await t.rollback();
             return { success: false, status: 400, message: `Alerta já está com status '${alerta.status}'.` };
        }
        if (novoStatus === 'cancelado' && alerta.status === 'pago') {
             await t.rollback();
             return { success: false, status: 400, message: "Não é possível cancelar um alerta já pago." };
        }
        // Se já estiver no status desejado, não faz nada (sucesso idempotente)
        if (alerta.status === novoStatus) {
            await t.commit(); // Confirma a transação (embora nada tenha mudado)
            return { success: true, status: 200, data: alerta, message: "Alerta já estava neste status." };
        }


        // --- LÓGICA PARA CRIAR TRANSAÇÃO AO PAGAR ---
        if (novoStatus === 'pago' && alerta.status === 'pendente') {
            // Obter data atual no formato YYYY-MM-DD
            const dataTransacao = new Date().toISOString().split('T')[0];

            // Prepara os dados para a transação
            const dadosTransacao = {
                id_usuario: alerta.id_usuario,
                tipo: alerta.tipo,
                valor: alerta.valor,
                nome_categoria: alerta.nome_categoria, // Usar a categoria do alerta
                data_transacao: dataTransacao, // Data do pagamento = hoje
                descricao: alerta.descricao || `Pagamento/Recebimento ref. Alerta ${alerta.codigo_unico}`,
                id_alerta_origem: alerta.id_alerta // <<< VINCULA A TRANSAÇÃO AO ALERTA
                // Outros campos como comprovante_url, id_transacao_pai, parcelas são null/default
            };

            // Cria a transação DENTRO da mesma transação do DB
            const transacaoCriada = await transacaoService.createTransaction(dadosTransacao/*, { transaction: t } */); // << Passar a transaction se createTransaction suportar


            if (!transacaoCriada || !transacaoCriada.id_transacao) {
                 // Se falhar, desfaz tudo
                await t.rollback();
                throw new Error("Falha ao criar a transação correspondente.");
            }
        }
        // --- FIM DA LÓGICA DE CRIAÇÃO ---

        // Atualiza o status do alerta (ainda dentro da transação)
        alerta.status = novoStatus;
        await alerta.save({ transaction: t }); // <<< Salva dentro da transação

        // Se tudo deu certo, confirma a transação no DB
        await t.commit();

        return { success: true, status: 200, data: alerta };

    } catch (error) {
        // Se qualquer erro ocorreu (incluindo na criação da transação), desfaz tudo
        await t.rollback();
        console.error(`Erro ao atualizar status do alerta ${codigo_unico} para ${novoStatus}:`, error);
        // Retorna um erro 500 genérico para a rota tratar
        // Lançar o erro aqui garante que a rota retorne 500
        throw new Error("Erro interno ao processar a atualização do status do alerta.");
    }
};

/**
 * Deleta todos os alertas de pagamento PENDENTES associados a uma recorrência pai.
 * @param {number} id_recorrencia_pai - ID da recorrência pai.
 * @param {number} id_usuario - ID do usuário proprietário.
 * @returns {Promise<number>} O número de alertas deletados.
 */
const deletePendingAlertsByRecurrence = async (id_recorrencia_pai, id_usuario) => {
    if (!id_recorrencia_pai || !id_usuario) {
        console.warn("[deletePendingAlertsByRecurrence] ID da recorrência ou usuário ausente.");
        return 0; // Segurança
    }

    try {
        const deletedCount = await AlertaPagamento.destroy({
            where: {
                id_recorrencia_pai: id_recorrencia_pai,
                id_usuario: id_usuario,
                status: 'pendente' // <<< SÓ DELETA OS PENDENTES
            }
        });
        console.log(`[INFO] Deletados ${deletedCount} alertas pendentes para recorrência ${id_recorrencia_pai} do usuário ${id_usuario}`);
        return deletedCount;
    } catch (error) {
        console.error(`Erro ao deletar alertas pendentes para recorrência ${id_recorrencia_pai}:`, error);
        // Não lançar erro aqui pode ser melhor para não quebrar a deleção da recorrência pai
        return 0; // Retorna 0 em caso de erro para não travar o processo pai
    }
};


module.exports = {
    createPaymentAlert,
    getPaymentAlertById,
    listPaymentAlerts,
    updatePaymentAlert, // Manter a antiga se usada em outro lugar
    deletePaymentAlert,
    deletePaymentAlertByCode,
    getUpcomingPaymentAlerts,
    updateStatusByCode, // Exportar nova função de status
    deletePendingAlertsByRecurrence // Exportar função de limpeza
};