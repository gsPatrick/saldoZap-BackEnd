const express = require('express');
const alertaPagamentoService = require('./alerta-pagamento.service');

const router = express.Router();

router.post('/', async (req, res) => {
    const { id_usuario, valor, data_vencimento, descricao, codigo_unico, status } = req.body;

    try {
        const alertaPagamento = await alertaPagamentoService.createPaymentAlert(id_usuario, valor, data_vencimento, descricao, codigo_unico, status);
        res.status(201).json(alertaPagamento);
    } catch (error) {
        console.error("Erro ao criar alerta de pagamento:", error);
        res.status(500).json({ error: "Internal server error creating payment alert." });
    }
});

router.get('/:id_alerta', async (req, res) => {
    const { id_alerta } = req.params;

    try {
        const alertaPagamento = await alertaPagamentoService.getPaymentAlertById(id_alerta);
        if (alertaPagamento) {
            res.json(alertaPagamento);
        } else {
            res.status(404).json({ message: "Payment alert not found." });
        }
    } catch (error) {
        console.error("Erro ao obter alerta de pagamento:", error);
        res.status(500).json({ error: "Internal server error getting payment alert." });
    }
});

router.get('/', async (req, res) => {
    const { id_usuario } = req.query;

    try {
        const alertasPagamento = await alertaPagamentoService.listPaymentAlerts(id_usuario);
        res.json(alertasPagamento);
    } catch (error) {
        console.error("Erro ao listar alertas de pagamento:", error);
        res.status(500).json({ error: "Internal server error listing payment alerts." });
    }
});

router.put('/:id_alerta', async (req, res) => {
    const { id_alerta } = req.params;
    const updates = req.body;

    try {
        const alertaPagamentoAtualizado = await alertaPagamentoService.updatePaymentAlert(id_alerta, updates);
        if (alertaPagamentoAtualizado) {
            res.json(alertaPagamentoAtualizado);
        } else {
            res.status(404).json({ message: "Payment alert not found for update." });
        }
    } catch (error) {
        console.error("Erro ao atualizar alerta de pagamento:", error);
        res.status(500).json({ error: "Internal server error updating payment alert." });
    }
});

router.delete('/:id_alerta', async (req, res) => {
    const { id_alerta } = req.params;

    try {
        const sucesso = await alertaPagamentoService.deletePaymentAlert(id_alerta);
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Payment alert not found for deletion." });
        }
    } catch (error) {
        console.error("Erro ao deletar alerta de pagamento:", error);
        res.status(500).json({ error: "Internal server error deleting payment alert." });
    }
});

router.get('/upcoming/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const upcomingAlerts = await alertaPagamentoService.getUpcomingPaymentAlerts(id_usuario);
        res.json(upcomingAlerts);
    } catch (error) {
        console.error("Erro ao obter alertas de pagamento próximos:", error);
        res.status(500).json({ error: "Internal server error getting upcoming payment alerts." });
    }
});


module.exports = router;