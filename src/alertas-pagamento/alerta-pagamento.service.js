const AlertaPagamento = require('./alerta-pagamento.model');
const Sequelize = require('sequelize');

const createPaymentAlert = async (id_usuario, valor, data_vencimento, descricao, codigo_unico, status) => {
    try {
        const alertaPagamento = await AlertaPagamento.create({ id_usuario, valor, data_vencimento, descricao, codigo_unico, status });
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao criar alerta de pagamento:", error);
        throw error;
    }
};

const getPaymentAlertById = async (id_alerta) => {
    try {
        const alertaPagamento = await AlertaPagamento.findByPk(id_alerta);
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao obter alerta de pagamento:", error);
        throw error;
    }
};

const listPaymentAlerts = async (id_usuario) => {
    try {
        const alertasPagamento = await AlertaPagamento.findAll({
            where: { id_usuario }
        });
        return alertasPagamento;
    } catch (error) {
        console.error("Erro ao listar alertas de pagamento:", error);
        throw error;
    }
};

const updatePaymentAlert = async (id_alerta, updates) => {
    try {
        const alertaPagamento = await AlertaPagamento.findByPk(id_alerta);
        if (!alertaPagamento) {
            return null;
        }
        await alertaPagamento.update(updates);
        return alertaPagamento;
    } catch (error) {
        console.error("Erro ao atualizar alerta de pagamento:", error);
        throw error;
    }
};

const deletePaymentAlert = async (id_alerta) => {
    try {
        const alertaPagamentoDeletado = await AlertaPagamento.destroy({
            where: { id_alerta }
        });
        return alertaPagamentoDeletado > 0;
    } catch (error) {
        console.error("Erro ao deletar alerta de pagamento:", error);
        throw error;
    }
};

const getUpcomingPaymentAlerts = async (id_usuario, daysAhead = 7) => {
    try {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + daysAhead);

        const alertasPagamento = await AlertaPagamento.findAll({
            where: {
                id_usuario: id_usuario,
                data_vencimento: {
                    [Sequelize.Op.between]: [today, futureDate]
                },
                status: 'pendente' // Only get pending alerts
            },
            order: [['data_vencimento', 'ASC']] // Order by due date
        });
        return alertasPagamento;

    } catch (error) {
        console.error("Erro ao obter alertas de pagamento próximos:", error);
        throw error;
    }
};


module.exports = {
    createPaymentAlert,
    getPaymentAlertById,
    listPaymentAlerts,
    updatePaymentAlert,
    deletePaymentAlert,
    getUpcomingPaymentAlerts
};