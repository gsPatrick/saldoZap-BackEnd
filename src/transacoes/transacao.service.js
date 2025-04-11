// src/transacoes/transacao.service.js
const Transacao = require('./transacao.model');
const sequelize = require('../config/database'); // Necessário para query bruta do balance
const { Sequelize } = require('sequelize'); // Necessário para Sequelize.Op e QueryTypes
const Usuario = require('../usuarios/usuario.model'); // Necessário para include em algumas consultas
const { nanoid } = require('nanoid'); // Para gerar código único

// --- Função Helper para Gerar Código Único de Transação ---
const generateUniqueTransactionCode = async () => {
    let code;
    let existing = true;
    while (existing) {
        // Gera um código com prefixo e 7 caracteres aleatórios
        code = `TRX-${nanoid(7)}`;
        // Verifica se já existe (paranoid: false se usar soft deletes)
        existing = await Transacao.findOne({ where: { codigo_unico: code }, paranoid: false });
    }
    return code;
};
// ---------------------------------------------------------


// --- Função Helper para Calcular Data de Início (Usada em listTransactions) ---
function calcularStartDate(periodoInput) {
    let startDate = null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (!periodoInput) {
        startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        console.warn("[API LOG] Período não fornecido para calcularStartDate, usando início do mês.");
        return startDate;
    }

    try {
        switch (periodoInput.toLowerCase()) {
            case 'mes_atual':
                startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                break;
            case 'hoje':
                startDate = hoje;
                break;
            case 'ontem':
                startDate = new Date(hoje);
                startDate.setDate(hoje.getDate() - 1);
                break;
            case 'semana_atual':
                startDate = new Date(hoje);
                const diaSemana = hoje.getDay(); // 0 = Domingo, 1 = Segunda, ...
                const diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1); // Ajusta para segunda-feira
                startDate.setDate(diff);
                break;
            case 'semana_passada':
                 startDate = new Date(hoje);
                 const diaSemanaPassada = hoje.getDay();
                 // Vai para a segunda da semana atual e subtrai 7 dias
                 const diffParaSegunda = hoje.getDate() - diaSemanaPassada + (diaSemanaPassada === 0 ? -6 : 1);
                 startDate.setDate(diffParaSegunda - 7);
                 break;
            // Adicionar mais casos como ano_atual, ultimos_X_dias se necessário
            default:
                // Tenta interpretar como YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(periodoInput)) {
                    // Usa UTC para evitar problemas de timezone ao criar a data apenas com ano, mês, dia
                     startDate = new Date(Date.UTC(
                        parseInt(periodoInput.substring(0, 4)),
                        parseInt(periodoInput.substring(5, 7)) - 1, // Mês é 0-indexado
                        parseInt(periodoInput.substring(8, 10))
                    ));
                    if (isNaN(startDate.getTime())) { // Verifica se a data resultante é válida
                         console.warn(`[API LOG] Data inválida fornecida em calcularStartDate: ${periodoInput}. Usando início do mês.`);
                         startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                    }
                } else {
                    console.warn(`[API LOG] Período não reconhecido em calcularStartDate: ${periodoInput}. Usando início do mês.`);
                    startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                }
                break;
        }

         // Verificação final de segurança
        if (!(startDate instanceof Date && !isNaN(startDate))) {
            console.error(`[API LOG] Data Inválida calculada para período "${periodoInput}". Usando início do mês.`);
            startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        }

    } catch(dateError){
         console.error(`[API LOG] Erro em calcularStartDate para período "${periodoInput}":`, dateError, "Usando início do mês.");
         startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }

    // console.log(`[API LOG] calcularStartDate para "${periodoInput}" resultou em: ${startDate?.toISOString()}`);
    return startDate;
}
// ---------------------------------------------------------------------------


/**
 * Cria uma nova transação.
 * O codigo_unico é gerado automaticamente.
 * @param {object} dadosTransacao - Objeto contendo os dados da transação.
 * @param {number} dadosTransacao.id_usuario - ID do usuário.
 * @param {'despesa'|'receita'} dadosTransacao.tipo - Tipo da transação.
 * @param {number} dadosTransacao.valor - Valor da transação.
 * @param {string} dadosTransacao.data_transacao - Data da transação (YYYY-MM-DD).
 * @param {string} [dadosTransacao.nome_categoria] - Nome da categoria.
 * @param {string} [dadosTransacao.descricao] - Descrição.
 * @param {string} [dadosTransacao.comprovante_url] - URL do comprovante.
 * @param {number} [dadosTransacao.id_transacao_pai] - ID da transação pai (parcelas).
 * @param {number} [dadosTransacao.parcela_numero] - Número da parcela.
 * @param {number} [dadosTransacao.total_parcelas] - Total de parcelas.
 * @param {number} [dadosTransacao.id_recorrencia_origem] - ID da recorrência (opcional).
 * @param {string} [dadosTransacao.data_ocorrencia_recorrencia] - Data da ocorrência (opcional).
 * @param {number} [dadosTransacao.id_alerta_origem] - ID do alerta que originou (opcional).
 * @returns {Promise<Transacao>} A transação criada.
 */
const createTransaction = async (dadosTransacao) => {
    try {
        // Gera o código único ANTES de criar
        const codigo_unico_gerado = await generateUniqueTransactionCode();

        // Cria a transação usando os dados do objeto e o código gerado
        const novaTransacao = await Transacao.create({
            ...dadosTransacao, // Inclui todos os campos recebidos
            codigo_unico: codigo_unico_gerado, // Adiciona o código gerado
        });
        return novaTransacao;
    } catch (error) {
        console.error("Erro ao criar transação:", error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.error("Colisão de código único de transação detectada (raro).");
        }
        throw error; // Re-lança para a rota tratar
    }
};

/**
 * Lista transações com filtros opcionais de período e tipo.
 * @param {number} id_usuario - ID do usuário.
 * @param {string} [filtroPeriodo] - String normalizada ('hoje', 'mes_atual', 'YYYY-MM-DD') ou null.
 * @param {'despesa'|'receita'} [tipoFiltro] - Filtra por tipo se fornecido.
 * @param {object} [additionalFilters] - Outros filtros diretos (ex: { id_alerta_origem: 1 }).
 * @returns {Promise<Transacao[]>} Lista de transações.
 */
const listTransactions = async (id_usuario, filtroPeriodo = null, tipoFiltro = null, additionalFilters = {}) => {
    const whereClause = { id_usuario, ...additionalFilters }; // Começa com id_usuario e filtros adicionais

    if (filtroPeriodo) {
        // Verifica se é um objeto com startDate e endDate (vindo da IA)
        if (typeof filtroPeriodo === 'object' && filtroPeriodo.startDate && filtroPeriodo.endDate) {
            const startDate = new Date(Date.UTC(
                parseInt(filtroPeriodo.startDate.substring(0, 4)),
                parseInt(filtroPeriodo.startDate.substring(5, 7)) - 1,
                parseInt(filtroPeriodo.startDate.substring(8, 10))
             ));
            const endDate = new Date(Date.UTC(
                 parseInt(filtroPeriodo.endDate.substring(0, 4)),
                 parseInt(filtroPeriodo.endDate.substring(5, 7)) - 1,
                 parseInt(filtroPeriodo.endDate.substring(8, 10))
             ));
             // Garante que endDate inclua o dia inteiro
             endDate.setUTCHours(23, 59, 59, 999);

            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                whereClause.data_transacao = { [Sequelize.Op.between]: [startDate, endDate] };
            } else {
                 console.warn(`[API LOG] Datas inválidas no objeto periodo: ${JSON.stringify(filtroPeriodo)}`);
                 // Fallback para início do mês atual se as datas forem inválidas
                 whereClause.data_transacao = { [Sequelize.Op.gte]: calcularStartDate('mes_atual') };
            }

        } else if (typeof filtroPeriodo === 'string') {
             // Usa a função helper para strings normalizadas ('hoje', 'mes_atual', etc.)
            const startDateCalculada = calcularStartDate(filtroPeriodo);
            if (startDateCalculada instanceof Date && !isNaN(startDateCalculada)) {
                 // Para períodos como 'hoje', 'ontem', a data já é exata.
                 // Para 'mes_atual', 'semana_atual', etc., pegamos >= startDate.
                 // Se for 'semana_passada', precisamos calcular endDate também.
                 if (filtroPeriodo === 'semana_passada'){
                     const endDateCalculada = new Date(startDateCalculada);
                     endDateCalculada.setDate(startDateCalculada.getDate() + 6);
                     endDateCalculada.setHours(23,59,59,999);
                     whereClause.data_transacao = { [Sequelize.Op.between]: [startDateCalculada, endDateCalculada] };
                 } else if (['hoje', 'ontem'].includes(filtroPeriodo)) {
                     const endDateCalculada = new Date(startDateCalculada);
                     endDateCalculada.setHours(23,59,59,999);
                     whereClause.data_transacao = { [Sequelize.Op.between]: [startDateCalculada, endDateCalculada] };
                 }
                 else {
                     whereClause.data_transacao = { [Sequelize.Op.gte]: startDateCalculada };
                 }
            }
        }
    }

    // Adiciona o filtro de tipo SE ele for fornecido e válido
    if (tipoFiltro && ['receita', 'despesa'].includes(tipoFiltro)) {
        whereClause.tipo = tipoFiltro;
    }

    try {
        const transacoes = await Transacao.findAll({
            where: whereClause,
            // Include opcional para trazer dados do usuário ou alerta/recorrência
            // include: [{ model: Usuario, as: 'usuario' }],
            order: [['data_transacao', 'DESC'], ['id_transacao', 'DESC']] // Ordena por data e depois ID
        });
        return transacoes;
    } catch (error) {
        console.error("Erro ao listar transações:", error);
        throw error;
    }
};

/**
 * Busca uma transação pelo seu ID (PK).
 * @param {number} id_transacao - ID da transação.
 * @returns {Promise<Transacao|null>} A transação encontrada ou null.
 */
const getTransactionById = async (id_transacao) => {
    try {
        const transacao = await Transacao.findByPk(id_transacao, {
            // Include opcional
            // include: [{ model: Usuario, as: 'usuario' }]
        });
        return transacao;
    } catch (error) {
        console.error("Erro ao obter transação por ID:", error);
        throw error;
    }
};

/**
 * Atualiza uma transação existente.
 * @param {number} id_transacao - ID da transação.
 * @param {object} updates - Campos a serem atualizados.
 * @returns {Promise<Transacao|null>} A transação atualizada ou null.
 */
const updateTransaction = async (id_transacao, updates) => {
    try {
        const transacao = await Transacao.findByPk(id_transacao);
        if (!transacao) {
            return null; // Não encontrada
        }

        // Remover campos que não devem ser atualizados diretamente pela rota PUT padrão
        delete updates.id_usuario;
        delete updates.id_transacao;
        delete updates.codigo_unico; // Código único não deve ser alterado
        delete updates.id_alerta_origem; // Vínculo com alerta não deve ser alterado por aqui
        delete updates.id_recorrencia_origem; // Vínculo com recorrência não deve ser alterado

        await transacao.update(updates);
        return transacao;
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw error;
    }
};

/**
 * Deleta uma transação pelo seu ID (PK).
 * @param {number} id_transacao - ID da transação.
 * @returns {Promise<boolean>} True se deletado, false caso contrário.
 */
const deleteTransaction = async (id_transacao) => {
    try {
        const transacaoDeletadaCount = await Transacao.destroy({
            where: { id_transacao }
        });
        return transacaoDeletadaCount > 0;
    } catch (error) {
        console.error("Erro ao excluir transação por ID:", error);
        throw error;
    }
};

/**
 * Deleta uma transação pelo seu código único e ID do usuário.
 * @param {string} codigo_unico - Código único da transação.
 * @param {number} id_usuario - ID do usuário proprietário.
 * @returns {Promise<boolean>} True se deletado, false caso contrário.
 */
const deleteTransactionByCode = async (codigo_unico, id_usuario) => {
    try {
        const transacaoDeletadaCount = await Transacao.destroy({
            where: {
                codigo_unico: codigo_unico,
                id_usuario: id_usuario // Garante que só o dono delete
            }
        });
        return transacaoDeletadaCount > 0;
    } catch (error) {
        console.error("Erro ao excluir transação por código:", error);
        throw error;
    }
};

/**
 * Calcula o saldo atual do usuário.
 * @param {number} id_usuario - ID do usuário.
 * @returns {Promise<number>} O saldo atual.
 */
const getCurrentBalance = async (id_usuario) => {
    try {
        // Usando agregações do Sequelize para performance
        const receitas = await Transacao.sum('valor', { where: { id_usuario: id_usuario, tipo: 'receita' } });
        const despesas = await Transacao.sum('valor', { where: { id_usuario: id_usuario, tipo: 'despesa' } });

        // Sequelize sum retorna null se não houver registros, então tratamos como 0
        const totalReceitas = receitas || 0;
        const totalDespesas = despesas || 0;

        const balance = parseFloat(totalReceitas) - parseFloat(totalDespesas);

        // Retorna com 2 casas decimais
        return parseFloat(balance.toFixed(2));

    } catch (error) {
        console.error("Erro ao obter saldo atual:", error);
        throw error;
    }
};


/**
 * Gera um resumo financeiro para um mês/ano específico.
 * @param {number} id_usuario - ID do usuário.
 * @param {number} year - Ano.
 * @param {number} month - Mês (1-12).
 * @returns {Promise<object>} Objeto com totalIncome, totalExpenses e categorySummary.
 */
const getMonthlySummary = async (id_usuario, year, month) => {
    try {
        // Cria datas UTC para evitar problemas de timezone
        const startDate = new Date(Date.UTC(year, month - 1, 1)); // Primeiro dia do mês
        const endDate = new Date(Date.UTC(year, month, 1)); // Primeiro dia do próximo mês
        endDate.setUTCMilliseconds(endDate.getUTCMilliseconds() - 1); // Último milissegundo do mês

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endDate]
                }
            },
            attributes: ['tipo', 'valor', 'nome_categoria'] // Pega só o necessário
        });

        let summary = {
            totalIncome: 0,
            totalExpenses: 0,
            categorySummary: {} // Agrupa pelo nome da categoria
        };

        transacoes.forEach(transacao => {
            const valorNum = parseFloat(transacao.valor) || 0; // Garante que é número

            if (transacao.tipo === 'receita') {
                summary.totalIncome += valorNum;
            } else { // Despesa
                summary.totalExpenses += valorNum;
                // Agrupa despesas por categoria
                const categoryName = transacao.nome_categoria || 'Sem Categoria';
                summary.categorySummary[categoryName] = (summary.categorySummary[categoryName] || 0) + valorNum;
            }
        });

        // Arredonda os totais
        summary.totalIncome = parseFloat(summary.totalIncome.toFixed(2));
        summary.totalExpenses = parseFloat(summary.totalExpenses.toFixed(2));
        // Arredonda os totais das categorias
        for (const category in summary.categorySummary) {
            summary.categorySummary[category] = parseFloat(summary.categorySummary[category].toFixed(2));
        }


        return summary;
    } catch (error) {
        console.error("Erro ao obter resumo mensal:", error);
        throw error;
    }
};

/**
 * Gera um resumo financeiro para um dia específico.
 * @param {number} id_usuario - ID do usuário.
 * @param {number} year - Ano.
 * @param {number} month - Mês (1-12).
 * @param {number} day - Dia.
 * @returns {Promise<object>} Objeto com totalIncome, totalExpenses e lista de transações do dia.
 */
const getDailySummary = async (id_usuario, year, month, day) => {
    try {
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startOfDay, endOfDay]
                }
            },
            order: [['id_transacao', 'ASC']] // Ou pela hora se tivesse timestamp
        });

        let dailySummary = {
            totalIncome: 0,
            totalExpenses: 0,
            transactions: transacoes // Retorna as transações do dia
        };

        transacoes.forEach(transacao => {
            const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') {
                dailySummary.totalIncome += valorNum;
            } else {
                dailySummary.totalExpenses += valorNum;
            }
        });

        dailySummary.totalIncome = parseFloat(dailySummary.totalIncome.toFixed(2));
        dailySummary.totalExpenses = parseFloat(dailySummary.totalExpenses.toFixed(2));

        return dailySummary;

    } catch (error) {
        console.error("Erro ao obter resumo diário:", error);
        throw error;
    }
};

/**
 * Gera um resumo financeiro para uma semana específica do ano.
 * Assume semana começando na Segunda-feira.
 * @param {number} id_usuario - ID do usuário.
 * @param {number} year - Ano.
 * @param {number} week - Número da semana no ano (ISO 8601 week number seria ideal, mas vamos simplificar).
 * @returns {Promise<object>} Objeto com totalIncome, totalExpenses, startDate e endDate da semana.
 */
const getWeeklySummary = async (id_usuario, year, week) => {
    try {
        // Calcula o início da semana (Segunda-feira)
        // Cria a data do primeiro dia do ano
        const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
        // Calcula quantos dias adicionar para chegar à semana desejada (considerando semana 1 pode começar antes)
        // Adiciona (week - 1) * 7 dias ao primeiro dia do ano
        const dateInWeek = new Date(firstDayOfYear.getTime());
        dateInWeek.setUTCDate(firstDayOfYear.getUTCDate() + (week - 1) * 7);

        // Ajusta para a Segunda-feira daquela semana
        const dayOfWeek = dateInWeek.getUTCDay(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado
        const diffToMonday = dateInWeek.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuste para segunda
        const startDate = new Date(dateInWeek.setUTCDate(diffToMonday));
        startDate.setUTCHours(0,0,0,0); // Garante início do dia

        // Calcula o fim da semana (Domingo)
        const endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 6); // Adiciona 6 dias
        endDate.setUTCHours(23, 59, 59, 999); // Garante fim do dia


        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endDate]
                }
            },
             attributes: ['tipo', 'valor']
        });

        let weeklySummary = {
            totalIncome: 0,
            totalExpenses: 0,
            startDate: startDate.toISOString().split('T')[0], // Formata YYYY-MM-DD
            endDate: endDate.toISOString().split('T')[0]     // Formata YYYY-MM-DD
        };

        transacoes.forEach(transacao => {
             const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') {
                weeklySummary.totalIncome += valorNum;
            } else {
                weeklySummary.totalExpenses += valorNum;
            }
        });

        weeklySummary.totalIncome = parseFloat(weeklySummary.totalIncome.toFixed(2));
        weeklySummary.totalExpenses = parseFloat(weeklySummary.totalExpenses.toFixed(2));

        return weeklySummary;

    } catch (error) {
        console.error("Erro ao obter resumo semanal:", error);
        throw error;
    }
};

/**
 * Obtém o total de gastos agrupados por categoria para um período.
 * @param {number} id_usuario - ID do usuário.
 * @param {Date} startDate - Data de início do período.
 * @param {Date} endDate - Data de fim do período.
 * @returns {Promise<Array<{nome: string, total: number}>>} Array com nome da categoria e total gasto.
 */
const getSpendingByCategory = async (id_usuario, startDate, endDate) => {
    try {
        // Garante que endDate inclua o dia inteiro
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999); // Use setHours ou setUTCHours dependendo da consistência

        const results = await Transacao.findAll({
            attributes: [
                // Se nome_categoria pode ser nulo, use COALESCE
                [sequelize.fn('COALESCE', sequelize.col('nome_categoria'), 'Sem Categoria'), 'categoria'],
                [sequelize.fn('SUM', sequelize.col('valor')), 'total']
            ],
            where: {
                id_usuario: id_usuario,
                tipo: 'despesa', // Apenas despesas
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endOfDayEndDate]
                }
            },
            group: [sequelize.fn('COALESCE', sequelize.col('nome_categoria'), 'Sem Categoria')], // Agrupa por nome_categoria
            order: [[sequelize.fn('SUM', sequelize.col('valor')), 'DESC']], // Ordena por maior gasto
            raw: true // Retorna resultados brutos (objetos simples)
        });

        // Formata a saída para { nome: 'NomeCategoria', total: 123.45 }
        const formattedSpending = results.map(item => ({
             nome: item.categoria,
             total: parseFloat(parseFloat(item.total).toFixed(2)) // Garante número e 2 casas decimais
        }));

        return formattedSpending;

    } catch (error) {
        console.error("Erro ao obter gastos por categoria:", error);
        throw error;
    }
};


/**
 * Obtém o extrato de transações para um período.
 * @param {number} id_usuario - ID do usuário.
 * @param {Date} startDate - Data de início do período.
 * @param {Date} endDate - Data de fim do período.
 * @returns {Promise<Transacao[]>} Lista de transações ordenadas por data.
 */
const getTransactionStatement = async (id_usuario, startDate, endDate) => {
    try {
         // Garante que endDate inclua o dia inteiro
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999); // Use setHours ou setUTCHours

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endOfDayEndDate]
                }
            },
            // Include opcional para mais detalhes no extrato
            // include: [{ model: AlertaPagamento, as: 'alertaOrigem', attributes: ['codigo_unico'] }],
            order: [['data_transacao', 'ASC'], ['id_transacao', 'ASC']] // Ordena por data e ID
        });
        return transacoes;

    } catch (error) {
        console.error("Erro ao obter extrato de transações:", error);
        throw error;
    }
};


module.exports = {
    createTransaction,
    listTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
    deleteTransactionByCode,
    getCurrentBalance,
    getMonthlySummary,
    getDailySummary,
    getWeeklySummary,
    getSpendingByCategory,
    getTransactionStatement
    // Não exportar generateUniqueTransactionCode e calcularStartDate, são helpers internos
};