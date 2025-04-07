const Transacao = require('./transacao.model');
const Sequelize = require('sequelize');

const createTransaction = async (id_usuario, tipo, valor, id_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas) => {
    try {
        const novaTransacao = await Transacao.create({
            id_usuario, tipo, valor, id_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas
        });
        return novaTransacao;
    } catch (error) {
        console.error("Erro ao criar transação:", error);
        throw error;
    }
};

const listTransactions = async (id_usuario, filtroPeriodo) => {
    const whereClause = { id_usuario };

    if (filtroPeriodo) {
        whereClause.data_transacao = { [Sequelize.Op.gte]: filtroPeriodo };
    }

    try {
        const transacoes = await Transacao.findAll({
            where: whereClause,
            include: [{ all: true }],
            order: [['data_transacao', 'DESC']] // Order by date, newest first for extract
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
            include: [{ all: true }]
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
        const [results] = await sequelize.query(`
            SELECT
                SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) - SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as balance
            FROM Transacoes
            WHERE id_usuario = :id_usuario
        `, {
            replacements: { id_usuario },
            type: Sequelize.QueryTypes.SELECT
        });
        return results && results.balance ? parseFloat(results.balance) : 0;
    } catch (error) {
        console.error("Erro ao obter saldo atual:", error);
        throw error;
    }
};

const getMonthlySummary = async (id_usuario, year, month) => {
    try {
        const startDate = new Date(year, month - 1, 1); // Month is 1-indexed in params, 0-indexed in Date
        const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endDate]
                }
            },
            include: [{ model: Categoria, as: 'categoria' }] // Include category for grouping
        });

        let summary = {
            totalIncome: 0,
            totalExpenses: 0,
            categorySummary: {}
        };

        transacoes.forEach(transacao => {
            if (transacao.tipo === 'receita') {
                summary.totalIncome += parseFloat(transacao.valor);
            } else {
                summary.totalExpenses += parseFloat(transacao.valor);
            }
            const categoryName = transacao.categoria ? transacao.categoria.nome_categoria : 'Sem Categoria'; // Handle no category case
            summary.categorySummary[categoryName] = (summary.categorySummary[categoryName] || 0) + parseFloat(transacao.valor);
        });

        return summary;
    } catch (error) {
        console.error("Erro ao obter resumo mensal:", error);
        throw error;
    }
};

const getDailySummary = async (id_usuario, year, month, day) => {
    try {
        const date = new Date(year, month - 1, day); // Month is 1-indexed in params, 0-indexed in Date
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startOfDay, endOfDay]
                }
            }
        });

        let dailySummary = {
            totalIncome: 0,
            totalExpenses: 0,
            transactions: transacoes // Optionally include transactions in daily summary
        };

        transacoes.forEach(transacao => {
            if (transacao.tipo === 'receita') {
                dailySummary.totalIncome += parseFloat(transacao.valor);
            } else {
                dailySummary.totalExpenses += parseFloat(transacao.valor);
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
        const firstDayOfYear = new Date(year, 0, 1); // January 1st of the year
        const dayOfYear = (week - 1) * 7 + 1; // Approximate day of year for the start of the week
        const startDate = new Date(year, 0, dayOfYear); // Start of the week (approximately)

        // Adjust startDate to be the actual start of the week (Monday)
        const dayOfWeek = startDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Sunday being 0
        startDate.setDate(startDate.getDate() - daysToSubtract);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6); // End of the week (Sunday)
        endDate.setHours(23, 59, 59, 999);


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
            startDate: startDate,
            endDate: endDate
        };

        transacoes.forEach(transacao => {
            if (transacao.tipo === 'receita') {
                weeklySummary.totalIncome += parseFloat(transacao.valor);
            } else {
                weeklySummary.totalExpenses += parseFloat(transacao.valor);
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
        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                tipo: 'despesa',
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endDate]
                }
            },
            include: [{ model: Categoria, as: 'categoria' }] // Include category for grouping
        });

        let categorySpending = {};

        transacoes.forEach(transacao => {
            const categoryName = transacao.categoria ? transacao.categoria.nome_categoria : 'Sem Categoria';
            categorySpending[categoryName] = (categorySpending[categoryName] || 0) + parseFloat(transacao.valor);
        });

        return categorySpending;

    } catch (error) {
        console.error("Erro ao obter gastos por categoria:", error);
        throw error;
    }
};


const getTransactionStatement = async (id_usuario, startDate, endDate) => {
    try {
        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: id_usuario,
                data_transacao: {
                    [Sequelize.Op.between]: [startDate, endDate]
                }
            },
            include: [{ model: Categoria, as: 'categoria' }],
            order: [['data_transacao', 'ASC']] // Order by date for statement
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