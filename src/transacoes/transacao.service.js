// src/transacoes/transacao.service.js
const Transacao = require('./transacao.model');
const sequelize = require('../config/database'); // Necessário para query bruta do balance
const { Sequelize } = require('sequelize'); // Necessário para Sequelize.Op e QueryTypes
const Usuario = require('../usuarios/usuario.model'); // Necessário para include em algumas consultas futuras, se houver

// Assinatura modificada: id_categoria -> nome_categoria
const createTransaction = async (id_usuario, tipo, valor, nome_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas) => {
    try {
        // Objeto de criação modificado: id_categoria -> nome_categoria
        const novaTransacao = await Transacao.create({
            id_usuario, tipo, valor, nome_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas
        });
        return novaTransacao;
    } catch (error) {
        console.error("Erro ao criar transação:", error);
        throw error;
    }
};

const listTransactions = async (id_usuario, filtroPeriodo, tipoFiltro) => {
    const whereClause = { id_usuario };

    if (filtroPeriodo) {
        const startDateCalculada = calcularStartDate(filtroPeriodo); // Usando a função helper da resposta anterior
        if (startDateCalculada instanceof Date && !isNaN(startDateCalculada)) {
            whereClause.data_transacao = { [Sequelize.Op.gte]: startDateCalculada };
        }
    }

    // Adiciona o filtro de tipo SE ele for fornecido
    if (tipoFiltro && (tipoFiltro === 'receita' || tipoFiltro === 'despesa')) {
        whereClause.tipo = tipoFiltro;
    }

    try {
        const transacoes = await Transacao.findAll({
            where: whereClause, // whereClause agora pode incluir o tipo
            include: [{ model: Usuario, as: 'usuario' }],
            order: [['data_transacao', 'DESC']]
        });
        return transacoes;
    } catch (error) {
        console.error("Erro ao listar transações:", error);
        throw error;
    }
};

const getTransactionById = async (id_transacao) => {
    try {
        const transacao = await Transacao.findByPk(id_transacao, {
            // include: [{ all: true }] // REMOVIDO
            include: [{ model: Usuario, as: 'usuario' }] // Exemplo
        });
        return transacao;
    } catch (error) {
        console.error("Erro ao obter transacao:", error);
        throw error;
    }
};

const updateTransaction = async (id_transacao, updates) => {
    try {
        const transacao = await Transacao.findByPk(id_transacao);
        if (!transacao) {
            return null;
        }
        // Garante que não tentem atualizar id_categoria que não existe mais
        delete updates.id_categoria;
        await transacao.update(updates);
        return transacao;
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw error;
    }
};

const deleteTransaction = async (id_transacao) => {
    try {
        const transacaoDeletada = await Transacao.destroy({
            where: { id_transacao }
        });
        return transacaoDeletada > 0;
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        throw error;
    }
};

const getCurrentBalance = async (id_usuario) => {
    try {
        // A query bruta precisa usar o nome correto da tabela (transacoes)
        const [results] = await sequelize.query(`
            SELECT
                SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) - SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as balance
            FROM transacoes
            WHERE id_usuario = :id_usuario
        `, {
            replacements: { id_usuario },
            type: Sequelize.QueryTypes.SELECT
        });
        // Use parseFloat para garantir que é número
        return results && results.balance !== null ? parseFloat(results.balance) : 0;
    } catch (error) {
        console.error("Erro ao obter saldo atual:", error);
        throw error;
    }
};


const getMonthlySummary = async (id_usuario, year, month) => {
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1); // Próximo mês, dia 1 (Op.lt é exclusivo)
        endDate.setMilliseconds(endDate.getMilliseconds() -1); // Último ms do mês

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.gte]: startDate,
                    [Sequelize.Op.lte]: endDate // Usar lte com a data/hora exata do fim do mês
                }
            }
            // REMOVIDO include de Categoria
        });

        let summary = {
            totalIncome: 0,
            totalExpenses: 0,
            categorySummary: {} // Continuará a agrupar pelo nome
        };

        transacoes.forEach(transacao => {
            // Garantir que valor seja número
            const valorNum = parseFloat(transacao.valor) || 0;

            if (transacao.tipo === 'receita') {
                summary.totalIncome += valorNum;
            } else {
                summary.totalExpenses += valorNum;
            }
            // Usar o campo nome_categoria diretamente
            const categoryName = transacao.nome_categoria || 'Sem Categoria';
            summary.categorySummary[categoryName] = (summary.categorySummary[categoryName] || 0) + valorNum;
        });

        return summary;
    } catch (error) {
        console.error("Erro ao obter resumo mensal:", error);
        throw error;
    }
};

const getDailySummary = async (id_usuario, year, month, day) => {
    try {
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startOfDay, endOfDay]
                }
            }
            // Não precisa de include aqui
        });

        let dailySummary = {
            totalIncome: 0,
            totalExpenses: 0,
            transactions: transacoes
        };

        transacoes.forEach(transacao => {
            const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') {
                dailySummary.totalIncome += valorNum;
            } else {
                dailySummary.totalExpenses += valorNum;
            }
        });

        return dailySummary;

    } catch (error) {
        console.error("Erro ao obter resumo diário:", error);
        throw error;
    }
};

const getWeeklySummary = async (id_usuario, year, week) => {
    try {
        // Lógica para calcular start e end date da semana (mantida)
        const firstDayOfYear = new Date(year, 0, 1);
        const dayOfYear = (week - 1) * 7 + 1;
        const startDate = new Date(year, 0, dayOfYear);
        const dayOfWeek = startDate.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToSubtract);
        startDate.setHours(0,0,0,0); // Garante início do dia

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999); // Garante fim do dia


        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endDate]
                }
            }
        });

        let weeklySummary = {
            totalIncome: 0,
            totalExpenses: 0,
            startDate: startDate.toISOString().split('T')[0], // Formatar data
            endDate: endDate.toISOString().split('T')[0]   // Formatar data
        };

        transacoes.forEach(transacao => {
             const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') {
                weeklySummary.totalIncome += valorNum;
            } else {
                weeklySummary.totalExpenses += valorNum;
            }
        });
        return weeklySummary;

    } catch (error) {
        console.error("Erro ao obter resumo semanal:", error);
        throw error;
    }
};

const getSpendingByCategory = async (id_usuario, startDate, endDate) => {
    try {
        // Garante que endDate inclua o dia inteiro
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                tipo: 'despesa',
                data_transacao: {
                    // Usar gte e lte para clareza com datas
                    [Sequelize.Op.gte]: startDate,
                    [Sequelize.Op.lte]: endOfDayEndDate
                }
            }
            // REMOVIDO include de Categoria
        });

        let categorySpending = {};

        transacoes.forEach(transacao => {
            // Usar nome_categoria diretamente
            const categoryName = transacao.nome_categoria || 'Sem Categoria';
            const valorNum = parseFloat(transacao.valor) || 0;
            categorySpending[categoryName] = (categorySpending[categoryName] || 0) + valorNum;
        });

        // Formatar para array de objetos se preferir {nome: 'Cat', total: 100}
        const formattedSpending = Object.entries(categorySpending).map(([nome, total]) => ({ nome, total }));

        return formattedSpending; // Retorna array formatado

    } catch (error) {
        console.error("Erro ao obter gastos por categoria:", error);
        throw error;
    }
};


const getTransactionStatement = async (id_usuario, startDate, endDate) => {
    try {
         // Garante que endDate inclua o dia inteiro
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.gte]: startDate,
                    [Sequelize.Op.lte]: endOfDayEndDate
                }
            },
            // REMOVIDO include de Categoria
            order: [['data_transacao', 'ASC']] // Mantém ordenação
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
    getCurrentBalance,
    getMonthlySummary,
    getDailySummary,
    getWeeklySummary,
    getSpendingByCategory,
    getTransactionStatement
};