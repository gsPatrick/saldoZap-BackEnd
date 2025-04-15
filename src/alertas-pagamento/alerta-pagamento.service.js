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
    // Garante que id_usuario seja número
    const userIdNum = parseInt(id_usuario, 10);
    if(isNaN(userIdNum)) {
        console.error("[deletePaymentAlertByCode] ID de usuário inválido:", id_usuario);
        return null;
    }
    if (!codigo_unico) {
         console.error("[deletePaymentAlertByCode] Código único não fornecido.");
         return null;
    }

    let alertToDelete; // Variável para guardar o alerta encontrado

    try {
        // Passo 1: Encontrar o alerta
        alertToDelete = await AlertaPagamento.findOne({
            where: {
                codigo_unico: codigo_unico,
                id_usuario: userIdNum
            },
            // Opcional: selecionar atributos específicos
            // attributes: ['id_alerta', 'valor', 'tipo', 'data_vencimento', 'descricao', 'codigo_unico', 'status']
        });

        // Se não encontrou, retorna null
        if (!alertToDelete) {
            console.log(`[deletePaymentAlertByCode] Alerta ${codigo_unico} não encontrado para usuário ${userIdNum}.`);
            return null;
        }

        // Passo 2: Armazenar detalhes
        const deletedDetails = alertToDelete.get({ plain: true });

        // Passo 3: Deletar o alerta encontrado
        // IMPORTANTE: Verifique se você realmente quer deletar alertas pagos/cancelados por esta rota.
        // Se quiser deletar APENAS os pendentes, adicione 'status: 'pendente'' na cláusula where do findOne.
        // Se o findOne já encontrou (independente do status), o destroy aqui vai deletar.
        await alertToDelete.destroy();
        console.log(`[deletePaymentAlertByCode] Alerta ${codigo_unico} (ID: ${deletedDetails.id_alerta}) deletado com sucesso.`);

        // Passo 4: Retornar os detalhes armazenados
        return deletedDetails;

    } catch (error) {
        console.error(`Erro ao tentar deletar alerta por código ${codigo_unico} para usuário ${userIdNum}:`, error);
        throw error; // Re-lança o erro
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
    // Inicializa a variável da transação fora do try para garantir acesso no catch
    let t;
    console.log(`[updateStatusByCode] Iniciando para ${codigo_unico}, user ${id_usuario}, status ${novoStatus}`); // Log inicial

    try {
        // Inicia transação do DB usando a instância do Sequelize associada ao Model
        t = await AlertaPagamento.sequelize.transaction();
        console.log(`[updateStatusByCode] Transação DB iniciada (ID: ${t.id || 'N/A'})`);

        // Busca o alerta dentro da transação e aplica um lock para evitar condição de corrida
        console.log('[updateStatusByCode] Buscando alerta com lock...');
        const alerta = await AlertaPagamento.findOne({
            where: { codigo_unico: codigo_unico, id_usuario: id_usuario },
            transaction: t, // Garante que a busca use a transação
            lock: t.LOCK.UPDATE // Adiciona lock pessimista (FOR UPDATE no SQL)
        });

        // Verifica se o alerta foi encontrado
        if (!alerta) {
            await t.rollback(); // Desfaz a transação antes de retornar
            console.log('[updateStatusByCode] Alerta não encontrado.');
            return { success: false, status: 404, message: "Alerta não encontrado." };
        }
        console.log(`[updateStatusByCode] Alerta encontrado: ID ${alerta.id_alerta}, Status Atual ${alerta.status}`);

        // Validar transições de status permitidas
        if (novoStatus === 'pago' && alerta.status !== 'pendente') {
             await t.rollback();
             console.log(`[updateStatusByCode] Tentativa inválida: Alerta já está com status '${alerta.status}'.`);
             return { success: false, status: 400, message: `Alerta já está com status '${alerta.status}'. Não pode ser pago novamente.` };
        }
        if (novoStatus === 'cancelado' && alerta.status === 'pago') {
             await t.rollback();
             console.log('[updateStatusByCode] Tentativa inválida: Não é possível cancelar um alerta já pago.');
             return { success: false, status: 400, message: "Não é possível cancelar um alerta já pago." };
        }
        // Se o status já for o desejado, não faz nada, apenas comita para liberar o lock
        if (alerta.status === novoStatus) {
            await t.commit();
            console.log('[updateStatusByCode] Alerta já estava neste status. Nenhuma alteração necessária.');
            return { success: true, status: 200, data: alerta, message: "Alerta já estava neste status." };
        }

        // --- LÓGICA PARA CRIAR TRANSAÇÃO FINANCEIRA AO MARCAR ALERTA COMO 'PAGO' ---
        if (novoStatus === 'pago' && alerta.status === 'pendente') {
            console.log("[updateStatusByCode] Status 'pago' detectado. Preparando para criar transação...");
            // Usa a data atual para a transação financeira
            const dataTransacao = new Date().toISOString().split('T')[0];
            // Prepara os dados para a nova transação baseados no alerta
            const dadosTransacao = {
                id_usuario: alerta.id_usuario,
                tipo: alerta.tipo, // 'despesa' ou 'receita'
                valor: alerta.valor,
                nome_categoria: alerta.nome_categoria, // Copia a categoria
                data_transacao: dataTransacao, // Data de hoje
                descricao: alerta.descricao || `Pagamento/Recebimento ref. Alerta ${alerta.codigo_unico}`, // Usa descrição do alerta ou gera uma padrão
                id_alerta_origem: alerta.id_alerta // Vínculo importante entre alerta e transação
                // Outros campos podem ser adicionados se necessário (ex: id_recorrencia_origem)
            };

            console.log("[updateStatusByCode] Chamando transacaoService.createTransaction... Dados:", JSON.stringify(dadosTransacao));

            // Chama createTransaction PASSANDO A TRANSAÇÃO 't' como opção
            // <<<< ESTA É A LINHA CORRIGIDA >>>>
            const transacaoCriada = await transacaoService.createTransaction(dadosTransacao, { transaction: t });

            // Verifica se a criação da transação financeira foi bem-sucedida DENTRO da transação 't'
            if (!transacaoCriada || !transacaoCriada.id_transacao) {
                // Se a criação da transação falhar, DESFAZ TUDO (rollback)
                await t.rollback();
                console.error(`[updateStatusByCode] Falha ao criar transação financeira para alerta ${alerta.codigo_unico}. Rollback executado. Dados:`, dadosTransacao);
                // Lança um erro mais específico para indicar a falha na criação da transação
                throw new Error("Falha ao criar a transação correspondente. A operação foi desfeita.");
            }
            // Log de sucesso da criação da transação financeira
            console.log(`[updateStatusByCode] Transação ${transacaoCriada.id_transacao} criada com sucesso para o alerta ${alerta.codigo_unico}`);
        }
        // --- FIM DA LÓGICA DE CRIAÇÃO DA TRANSAÇÃO FINANCEIRA ---

        // Atualiza o status do alerta (ainda dentro da transação 't')
        console.log(`[updateStatusByCode] Atualizando status do alerta ${alerta.id_alerta} para ${novoStatus}...`);
        alerta.status = novoStatus;
        // Salva a alteração do status do alerta USANDO a transação 't'
        await alerta.save({ transaction: t });
        console.log(`[updateStatusByCode] Status do alerta ${alerta.id_alerta} atualizado com sucesso para ${novoStatus}.`);

        // Se chegou até aqui sem erros (criação da transação e save do alerta),
        // confirma TODAS as operações no banco de dados.
        await t.commit();
        console.log(`[updateStatusByCode] Transação DB comitada com sucesso para alerta ${codigo_unico}.`);

        // Retorna sucesso com o alerta atualizado
        return { success: true, status: 200, data: alerta };

    } catch (error) {
        // Se QUALQUER erro ocorreu durante o bloco try (find, createTransaction, save),
        // tenta desfazer a transação.
        if (t) { // Garante que a transação foi iniciada antes de tentar rollback
             console.error(`[updateStatusByCode] Erro detectado na operação. Tentando rollback da transação DB...`);
             try {
                 await t.rollback();
                 console.log(`[updateStatusByCode] Rollback da transação DB concluído devido a erro.`);
             } catch (rollbackError) {
                 // Erro crítico se o rollback falhar!
                 console.error(`[updateStatusByCode] ERRO CRÍTICO ao tentar fazer rollback da transação após erro inicial:`, rollbackError);
                 // Logar isso é muito importante, pois o DB pode estar em estado inconsistente.
             }
        } else {
            // O erro ocorreu antes mesmo da transação ser iniciada
            console.error(`[updateStatusByCode] Erro antes ou durante a inicialização da transação:`, error);
        }

        // Loga o erro completo que causou o rollback/falha
        console.error(`[updateStatusByCode] Erro completo ao atualizar status do alerta ${codigo_unico} para ${novoStatus}:`, error);

        // Extrai uma mensagem de erro mais limpa, se possível
        const errorMessage = error.original?.message || error.message || "Erro interno ao processar a atualização do status do alerta.";

        // Re-lança o erro para que a rota que chamou esta função possa retornar um erro 500
        // É importante relançar para sinalizar que a operação falhou.
        throw new Error("Falha ao atualizar o status do alerta: " + errorMessage);
    }
}; // Fim da função updateStatusByCode


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