const express = require('express');
const transacaoService = require('./transacao.service');

const router = express.Router();

router.post('/', async (req, res) => {
    const { id_usuario, tipo, valor, id_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas } = req.body;

    try {
        const novaTransacao = await transacaoService.createTransaction(id_usuario, tipo, valor, id_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas);
        res.status(201).json(novaTransacao);
    } catch (error) {
        console.error("Erro ao criar transação:", error);
        res.status(500).json({ error: "Internal server error creating transaction." });
    }
});

router.get('/', async (req, res) => {
    const { id_usuario, periodo } = req.query;

    if (!id_usuario) {
        return res.status(400).json({ error: "User ID is required to list transactions." });
    }

    try {
        const transacoes = await transacaoService.listTransactions(id_usuario, periodo);
        res.json(transacoes);
    } catch (error) {
        console.error("Erro ao listar transações:", error);
        res.status(500).json({ error: "Internal server error listing transactions." });
    }
});

router.get('/:id_transacao', async (req, res) => {
    const { id_transacao } = req.params;

    try {
        const transacao = await transacaoService.getTransactionById(id_transacao);
        if (transacao) {
            res.json(transacao);
        } else {
            res.status(404).json({ message: "Transaction not found." });
        }
    } catch (error) {
        console.error("Erro ao obter transacao:", error);
        res.status(500).json({ error: "Internal server error getting transaction." });
    }
});

router.put('/:id_transacao', async (req, res) => {
    const { id_transacao } = req.params;
    const updates = req.body;

    try {
        const transacaoAtualizada = await transacaoService.updateTransaction(id_transacao, updates);
        if (transacaoAtualizada) {
            res.json(transacaoAtualizada);
        } else {
            res.status(404).json({ message: "Transaction not found for update." });
        }
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        res.status(500).json({ error: "Internal server error updating transaction." });
    }
});

router.delete('/:id_transacao', async (req, res) => {
    const { id_transacao } = req.params;

    try {
        const sucesso = await transacaoService.deleteTransaction(id_transacao);
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Transaction not found for deletion." });
        }
    } catch (error) {
        console.error("Erro ao deletar transação:", error);
        res.status(500).json({ error: "Internal server error deleting transaction." });
    }
});

router.get('/balance/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const balance = await transacaoService.getCurrentBalance(id_usuario);
        res.json({ balance });
    } catch (error) {
        console.error("Erro ao obter saldo:", error);
        res.status(500).json({ error: "Internal server error getting balance." });
    }
});

router.get('/monthly-summary/:id_usuario/:year/:month', async (req, res) => {
    const { id_usuario, year, month } = req.params;

    try {
        const summary = await transacaoService.getMonthlySummary(id_usuario, parseInt(year), parseInt(month));
        res.json(summary);
    } catch (error) {
        console.error("Erro ao obter resumo mensal:", error);
        res.status(500).json({ error: "Internal server error getting monthly summary." });
    }
});

router.get('/daily-summary/:id_usuario/:year/:month/:day', async (req, res) => {
    const { id_usuario, year, month, day } = req.params;

    try {
        const summary = await transacaoService.getDailySummary(id_usuario, parseInt(year), parseInt(month), parseInt(day));
        res.json(summary);
    } catch (error) {
        console.error("Erro ao obter resumo diário:", error);
        res.status(500).json({ error: "Internal server error getting daily summary." });
    }
});

router.get('/weekly-summary/:id_usuario/:year/:week', async (req, res) => {
    const { id_usuario, year, week } = req.params;

    try {
        const summary = await transacaoService.getWeeklySummary(id_usuario, parseInt(year), parseInt(week));
        res.json(summary);
    } catch (error) {
        console.error("Erro ao obter resumo semanal:", error);
        res.status(500).json({ error: "Internal server error getting weekly summary." });
    }
});

router.get('/spending-by-category/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
    const { startDate, endDate } = req.query; // Get date range from query params

    try {
        const spending = await transacaoService.getSpendingByCategory(id_usuario, startDate, endDate ? new Date(endDate) : new Date()); // Default endDate to now
        res.json(spending);
    } catch (error) {
        console.error("Erro ao obter gastos por categoria:", error);
        res.status(500).json({ error: "Internal server error getting spending by category." });
    }
});

router.get('/statement/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
    const { startDate, endDate } = req.query; // Get date range from query params

    try {
        const statement = await transacaoService.getTransactionStatement(id_usuario, startDate, endDate ? new Date(endDate) : new Date()); // Default endDate to now
        res.json(statement);
    } catch (error) {
        console.error("Erro ao obter extrato de transações:", error);
        res.status(500).json({ error: "Internal server error getting transaction statement." });
    }
});


module.exports = router;