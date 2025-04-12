// src/alertas-pagamento/alerta-pagamento.service.js
const AlertaPagamento = require('./alerta-pagamento.model');
const transacaoService = require('../transacoes/transacao.service'); // Importar TransactionService
const { nanoid } = require('nanoid'); // Para gerar código único
const { Op } = require('sequelize');

// --- Função Helper para Gerar Código Único de Alerta ---
// (Esta função não é mais necessária se o hook beforeValidate no modelo funciona)
/*
const generateUniqueAlertCode = async () => {
    let code;
    let existing = true;
    while (existing) {
        code = `ALT-${nanoid(7)}`;
        existing = await AlertaPagamento.findOne({ where: { codigo_unico: code }, paranoid: false });
    }
    return code;
};
*/
// ---------------------------------------------------------

/**
 * Cria um novo alerta de pagamento.
 * O codigo_unico é gerado automaticamente via hook do modelo.
 * @param {object} dadosAlerta - Objeto contendo os dados do alerta.
 * @returns {Promise<AlertaPagamento>} O alerta criado.
 */
const createPaymentAlert = async (dadosAlerta) => {
    try {
        // Garante um status padrão se não for fornecido
        const statusFinal = dadosAlerta.status || 'pendente';

        const alertaPagamento = await AlertaPagamento.create({
            ...dadosAlerta, // Inclui id_usuario, valor, data_vencimento, tipo, etc.
            status: statusFinal,
            // codigo_unico será gerado pelo hook beforeValidate
        });
        // Recarrega para garantir que o código único gerado pelo hook esteja presente
        // (Opcional, create já retorna o objeto completo geralmente)
        // await alertaPagamento.reload();
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao criar alerta de pagamento:", error);
        if (error.name === 'SequelizeUniqueConstraintError' && error.fields?.codigo_unico) {
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
        // Usar findByPk é otimizado para busca por chave primária
        const alertaPagamento = await AlertaPagamento.findByPk(id_alerta);
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao obter alerta de pagamento por ID:", error);
        throw error;
    }
};

/**
 * Lista alertas de pagamento com base em filtros complexos da query string.
 * @param {object} queryParams - Objeto contendo os parâmetros da query (req.query).
 * @returns {Promise<AlertaPagamento[]>} Lista de alertas encontrados.
 */
const listPaymentAlerts = async (queryParams = {}) => {
    console.log("[listPaymentAlerts] Query Params Recebidos:", queryParams); // Log inicial

    try {
        const whereClause = {}; // Começa vazio

        // Processa filtros diretos primeiro
        if (queryParams.id_usuario) {
            // Converte para número para garantir tipo correto na query
            const numValue = parseInt(queryParams.id_usuario, 10);
            if (!isNaN(numValue)) {
                whereClause.id_usuario = numValue;
            } else {
                console.warn(`[listPaymentAlerts] id_usuario inválido recebido: ${queryParams.id_usuario}`);
                // Pode ser útil lançar um erro aqui ou retornar array vazio dependendo da regra de negócio
                // throw new Error("ID de usuário inválido.");
            }
        }
        if (queryParams.status) {
            // Validação opcional do status (ex: ['pendente', 'pago', 'cancelado'])
            if (['pendente', 'pago', 'cancelado'].includes(queryParams.status)) {
                whereClause.status = queryParams.status;
            } else {
                 console.warn(`[listPaymentAlerts] status inválido recebido: ${queryParams.status}`);
            }
        }
        if (queryParams.tipo && ['despesa', 'receita'].includes(queryParams.tipo)) {
            whereClause.tipo = queryParams.tipo;
        }
        if (queryParams.id_recorrencia_pai) {
            const numValue = parseInt(queryParams.id_recorrencia_pai, 10);
            if (!isNaN(numValue)) {
                whereClause.id_recorrencia_pai = numValue;
            } else {
                 console.warn(`[listPaymentAlerts] id_recorrencia_pai inválido recebido: ${queryParams.id_recorrencia_pai}`);
            }
        }
        // Adicione outros filtros diretos aqui se necessário (ex: nome_categoria)
        // if (queryParams.nome_categoria) {
        //     whereClause.nome_categoria = queryParams.nome_categoria;
        // }

        console.log("[listPaymentAlerts] Where Clause após filtros diretos:", JSON.stringify(whereClause));

        // --- INÍCIO DA SEÇÃO CORRIGIDA ---

        // Processa filtros de data separadamente
        const dateFilters = {}; // Objeto para montar as condições de data
        let hasDateFilter = false; // Flag para indicar se algum filtro de data foi adicionado

        // Processa data_vencimento[gte] (maior ou igual a)
        if (queryParams['data_vencimento[gte]']) {
            const gteDate = queryParams['data_vencimento[gte]'];
            console.log("[listPaymentAlerts] Processando data_vencimento[gte]:", gteDate);
            // Validação básica do formato YYYY-MM-DD (pode ser mais robusta)
            if (/\d{4}-\d{2}-\d{2}/.test(gteDate)) {
                dateFilters[Op.gte] = gteDate;
                hasDateFilter = true; // Marca que temos um filtro de data
            } else {
                 console.warn(`[listPaymentAlerts] Valor inválido ou formato incorreto para data_vencimento[gte]: ${gteDate}`);
            }
        }

        // Processa data_vencimento[lte] (menor ou igual a)
        if (queryParams['data_vencimento[lte]']) {
            const lteDate = queryParams['data_vencimento[lte]'];
            console.log("[listPaymentAlerts] Processando data_vencimento[lte]:", lteDate);
             // Validação básica do formato YYYY-MM-DD
             if (/\d{4}-\d{2}-\d{2}/.test(lteDate)) {
                dateFilters[Op.lte] = lteDate;
                hasDateFilter = true; // Marca que temos um filtro de data
             } else {
                 console.warn(`[listPaymentAlerts] Valor inválido ou formato incorreto para data_vencimento[lte]: ${lteDate}`);
             }
        }

        // Adiciona o filtro de data à cláusula WHERE apenas se houver condições válidas
        if (hasDateFilter) { // <<<< USA A FLAG CORRETA AGORA
             console.log("[listPaymentAlerts] Adicionando dateFilters à whereClause.data_vencimento");
             // Não precisa usar spread operator aqui, pode atribuir diretamente
             whereClause.data_vencimento = dateFilters;
        } else {
            console.log("[listPaymentAlerts] Nenhum filtro de data válido encontrado para adicionar.");
        }

        // --- FIM DA SEÇÃO CORRIGIDA ---

        // Log Final ANTES do findAll para depuração
        // Usar JSON.stringify com replacer para tentar mostrar os Symbols (pode não funcionar em todos os consoles)
        const replacer = (key, value) => {
             if (typeof value === 'symbol') {
                return value.toString(); // Converte Symbol para string (ex: "Symbol(gte)")
            }
            return value;
        };
        console.log("Cláusula WHERE final para findAll em listPaymentAlerts:", JSON.stringify(whereClause, replacer, 2));

        const alertasPagamento = await AlertaPagamento.findAll({
            where: whereClause,
            order: [['data_vencimento', 'ASC']] // Ordena por data de vencimento
            // Adicione 'include' se precisar carregar dados relacionados (ex: categoria, usuário)
            // include: [{ model: Categoria, as: 'categoria' }]
        });

        console.log(`[listPaymentAlerts] Encontrados ${alertasPagamento.length} alertas.`); // Log do resultado
        return alertasPagamento;

    } catch (error) {
        console.error("Erro Sequelize em listPaymentAlerts:", error);
        // Log adicional para SQL gerado, se disponível no erro (ajuda a depurar)
        if (error.parent && error.parent.sql) {
             console.error("SQL Gerado (aproximado):", error.parent.sql);
        } else if (error.sql) {
            console.error("SQL Gerado:", error.sql);
        }
        throw error; // Re-lança o erro para ser tratado pela camada superior (rota)
    }
};

/**
 * Atualiza um alerta de pagamento existente (exceto status 'pago').
 * @param {number} id_alerta - ID do alerta.
 * @param {object} updates - Campos a serem atualizados (já filtrados pela rota).
 * @param {number} [id_usuario_logado] - ID do usuário logado (para validação opcional).
 * @returns {Promise<AlertaPagamento|null>} O alerta atualizado ou null.
 */
const updatePaymentAlert = async (id_alerta, updates, id_usuario_logado = null) => {
    try {
        const alertaPagamento = await AlertaPagamento.findByPk(id_alerta);
        if (!alertaPagamento) {
            return null; // Não encontrado
        }

        // Segurança Opcional: Validar se pertence ao usuário logado
        if (id_usuario_logado && alertaPagamento.id_usuario !== id_usuario_logado) {
            console.warn(`Tentativa de atualizar alerta ${id_alerta} por usuário não autorizado (${id_usuario_logado})`);
            return null; // Ou lançar um erro de permissão
        }

        await alertaPagamento.update(updates);
        return alertaPagamento; // Retorna o objeto atualizado
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
        today.setHours(0, 0, 0, 0); // Zera hora para início do dia

        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + daysAhead);
        futureDate.setHours(23, 59, 59, 999); // Define fim do último dia

        const alertasPagamento = await AlertaPagamento.findAll({
            where: {
                id_usuario: id_usuario,
                data_vencimento: {
                    [Op.between]: [today.toISOString().split('T')[0], futureDate.toISOString().split('T')[0]] // Usar Op.between
                },
                status: 'pendente' // Apenas pendentes
            },
            order: [['data_vencimento', 'ASC']]
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
 * cria a transação correspondente usando uma transação DB.
 * @param {string} codigo_unico - Código único do alerta.
 * @param {number} id_usuario - ID do usuário proprietário.
 * @param {'pendente' | 'pago' | 'cancelado'} novoStatus - O novo status desejado.
 * @returns {Promise<{success: boolean, status: number, message?: string, data?: AlertaPagamento}>} Resultado da operação.
 */

const updateStatusByCode = async (codigo_unico, id_usuario, novoStatus) => {
    console.log(`[updateStatusByCode] Iniciando para ${codigo_unico}, user ${id_usuario}, status ${novoStatus}`);
    // Inicia transação do DB usando o sequelize da instância do Model
    const t = await AlertaPagamento.sequelize.transaction();
    console.log(`[updateStatusByCode] Transação DB iniciada (ID: ${t.id || 'N/A'})`); // Log ID da transação se disponível

    try {
        console.log(`[updateStatusByCode] Buscando alerta com lock...`);
        const alerta = await AlertaPagamento.findOne({
            where: { codigo_unico: codigo_unico, id_usuario: id_usuario },
            transaction: t, // <<< Usa a transação
            lock: t.LOCK.UPDATE // <<< Adiciona lock de escrita na linha
        });
        console.log(`[updateStatusByCode] Alerta encontrado: ${alerta ? `ID ${alerta.id_alerta}, Status Atual ${alerta.status}` : 'Nenhum'}`);

        if (!alerta) {
            console.log(`[updateStatusByCode] Alerta não encontrado. Rollback.`);
            await t.rollback();
            return { success: false, status: 404, message: "Alerta não encontrado." };
        }

        // Validar transições de status
        if (novoStatus === 'pago' && alerta.status !== 'pendente') {
             console.log(`[updateStatusByCode] Tentativa inválida de pagar alerta com status ${alerta.status}. Rollback.`);
             await t.rollback();
             return { success: false, status: 400, message: `Alerta já está com status '${alerta.status}'.` };
        }
        if (novoStatus === 'cancelado' && alerta.status === 'pago') {
             console.log(`[updateStatusByCode] Tentativa inválida de cancelar alerta já pago. Rollback.`);
             await t.rollback();
             return { success: false, status: 400, message: "Não é possível cancelar um alerta já pago." };
        }
        // Idempotência: Se já está no status desejado, considera sucesso sem fazer nada.
        if (alerta.status === novoStatus) {
            console.log(`[updateStatusByCode] Alerta já está no status ${novoStatus}. Commit.`);
            await t.commit(); // Commit para liberar o lock e a transação
            return { success: true, status: 200, data: alerta, message: "Alerta já estava neste status." };
        }

        // --- LÓGICA PARA CRIAR TRANSAÇÃO AO PAGAR ---
        if (novoStatus === 'pago' && alerta.status === 'pendente') {
            console.log(`[updateStatusByCode] Status 'pago' detectado. Preparando para criar transação...`);
            const dataTransacao = new Date().toISOString().split('T')[0]; // Data de hoje
            const dadosTransacao = {
                id_usuario: alerta.id_usuario,
                tipo: alerta.tipo,
                valor: alerta.valor,
                nome_categoria: alerta.nome_categoria,
                data_transacao: dataTransacao,
                descricao: alerta.descricao || `Pagamento/Recebimento ref. Alerta ${alerta.codigo_unico}`,
                id_alerta_origem: alerta.id_alerta // Vínculo importante
                // codigo_unico da transação será gerado pelo createTransaction
            };

            console.log(`[updateStatusByCode] Chamando transacaoService.createTransaction... Dados:`, JSON.stringify(dadosTransacao));

            // >>> IMPORTANTE: Idealmente, createTransaction deveria aceitar a transação 't' <<<
            // Se o seu transacaoService.createTransaction foi ajustado para aceitar options:
            // const transacaoCriada = await transacaoService.createTransaction(dadosTransacao, { transaction: t });
            // Se não foi ajustado, a criação da transação ocorrerá fora da transação 't',
            // o que é menos seguro (pode salvar o alerta e falhar a transação, ou vice-versa).
            // Vamos assumir por enquanto que ele NÃO aceita a transação 't' para manter compatibilidade.
            const transacaoCriada = await transacaoService.createTransaction(dadosTransacao);

            console.log(`[updateStatusByCode] transacaoService.createTransaction retornou: ${transacaoCriada ? `ID ${transacaoCriada.id_transacao}` : 'Falha'}`);

            if (!transacaoCriada || !transacaoCriada.id_transacao) {
                // Se a criação da transação FALHAR, fazemos rollback da transação 't'
                // (que até agora só continha o lock e a busca do alerta)
                await t.rollback();
                console.error(`Falha ao criar transação correspondente para alerta ${alerta.codigo_unico}.`);
                // Lança um erro para ser pego pelo catch principal
                throw new Error("Falha ao criar a transação correspondente.");
            }
            console.log(`[updateStatusByCode] Transação ${transacaoCriada.id_transacao} criada com sucesso (fora da transação principal por enquanto).`);
        }
        // --- FIM DA LÓGICA DE CRIAÇÃO ---

        console.log(`[updateStatusByCode] Atualizando status do alerta ${alerta.id_alerta} para ${novoStatus} na transação...`);
        alerta.status = novoStatus;
        await alerta.save({ transaction: t }); // <<< Salva a mudança do status do alerta DENTRO da transação 't'
        console.log(`[updateStatusByCode] Alerta salvo na transação. Fazendo commit...`);

        // Confirma a transação no DB (salva a mudança de status do alerta)
        await t.commit();
        console.log(`[updateStatusByCode] Commit da transação ${t.id || 'N/A'} realizado com sucesso.`);

        return { success: true, status: 200, data: alerta };

    } catch (error) {
        // Se qualquer erro ocorreu (na busca, na criação da transação, ou no save/commit do alerta)
        console.error(`[updateStatusByCode] Erro no bloco try/catch: ${error.message}`);
        console.log(`[updateStatusByCode] Fazendo rollback da transação ${t.id || 'N/A'}...`);
        // Garante rollback em caso de erro
        // await t.rollback(); // Rollback já deve ter sido chamado ou será implícito se commit falhar
        try { // Tenta rollback explicitamente, mas pode falhar se já foi feito
             if (!t.finished) { // Verifica se a transação já foi finalizada
                 await t.rollback();
                 console.log(`[updateStatusByCode] Rollback explícito realizado.`);
             }
        } catch (rollbackError) {
             console.error(`[updateStatusByCode] Erro durante o rollback explícito:`, rollbackError);
        }

        console.error(`Erro completo ao atualizar status do alerta ${codigo_unico} para ${novoStatus}:`, error);
        // Propaga o erro para a rota tratar como 500
        const errorMessage = error.original?.message || error.message || "Erro interno ao processar a atualização do status do alerta.";
        throw new Error(errorMessage); // Lança o erro para a rota
    }
};

/**
 * Deleta todos os alertas de pagamento PENDENTES associados a uma recorrência pai.
 * @param {number} id_recorrencia_pai - ID da recorrência pai.
 * @param {number} id_usuario - ID do usuário proprietário.
 * @param {object} [options] - Opções adicionais (ex: { transaction: t }).
 * @returns {Promise<number>} O número de alertas deletados.
 */
const deletePendingAlertsByRecurrence = async (id_recorrencia_pai, id_usuario, options = {}) => {
    if (!id_recorrencia_pai || !id_usuario) {
        console.warn("[deletePendingAlertsByRecurrence] ID da recorrência ou usuário ausente.");
        return 0;
    }

    try {
        const deletedCount = await AlertaPagamento.destroy({
            where: {
                id_recorrencia_pai: id_recorrencia_pai,
                id_usuario: id_usuario,
                status: 'pendente' // <<< SÓ DELETA OS PENDENTES
            },
            transaction: options.transaction // Passa a transação se fornecida
        });
        console.log(`[INFO] Deletados ${deletedCount} alertas pendentes para recorrência ${id_recorrencia_pai} do usuário ${id_usuario}`);
        return deletedCount;
    } catch (error) {
        console.error(`Erro ao deletar alertas pendentes para recorrência ${id_recorrencia_pai}:`, error);
        // Se estiver dentro de uma transação maior, relançar o erro é crucial
        if (options.transaction) {
             throw error;
        }
        return 0; // Retorna 0 se não estiver em transação e ocorrer erro
    }
};


module.exports = {
    createPaymentAlert,
    getPaymentAlertById,
    listPaymentAlerts,
    updatePaymentAlert,
    deletePaymentAlert,
    deletePaymentAlertByCode,
    getUpcomingPaymentAlerts,
    updateStatusByCode,
    deletePendingAlertsByRecurrence
};