const express = require('express');
const alertaPagamentoService = require('./alerta-pagamento.service');

const router = express.Router();

router.post('/', async (req, res) => {
    // REMOVER codigo_unico do destructuring
    const { id_usuario, valor, data_vencimento, descricao, /* REMOVIDO codigo_unico,*/ status } = req.body;

     // Adicione validações se necessário (valor, data_vencimento)
    if (!id_usuario || !valor || !data_vencimento) {
         return res.status(400).json({ error: "Missing required fields for payment alert." });
    }

    try {
        // Chamada de serviço SEM passar codigo_unico
        const alertaPagamento = await alertaPagamentoService.createPaymentAlert(
            id_usuario, valor, data_vencimento, descricao, /* REMOVIDO */ status
        );
        // A resposta já contém o código gerado
        res.status(201).json(alertaPagamento); 
    } catch (error) {
        console.error("Erro ao criar alerta de pagamento:", error);
        res.status(500).json({ error: "Internal server error creating payment alert." });
    }
});

router.put('/by-code/:codigo_unico/status', async (req, res) => {
    const { codigo_unico } = req.params;
    const { status } = req.body; // Espera { "status": "pago" } ou { "status": "cancelado" }
    const id_usuario = req.user?.id_usuario; // <<< Obtenha o ID do usuário autenticado

    if (!id_usuario) {
        return res.status(401).json({ error: "User authentication required." });
    }
    if (!codigo_unico || !status || !['pago', 'cancelado', 'pendente'].includes(status)) {
         return res.status(400).json({ error: "Missing or invalid codigo_unico or status." });
    }

    try {
        const result = await alertaPagamentoService.updateStatusByCode(codigo_unico, id_usuario, status);

        if (result.success) {
            res.status(result.status).json(result.data); // 200 OK com o alerta atualizado
        } else {
            res.status(result.status).json({ message: result.message }); // 404 ou 400
        }
    } catch (error) {
         console.error(`Erro na rota PUT /alertas-pagamento/by-code/${codigo_unico}/status:`, error);
         res.status(500).json({ error: "Internal server error updating alert status." });
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


// Nova rota para deletar por codigo_unico
router.delete('/by-code/:codigo_unico', async (req, res) => {
    const { codigo_unico } = req.params;
    // ASSUMINDO req.user.id_usuario - Adapte!
    const id_usuario = req.user?.id_usuario; 

     if (!id_usuario) {
         return res.status(401).json({ error: "User authentication required." });
    }
     if (!codigo_unico) {
        return res.status(400).json({ error: "Missing codigo_unico parameter." });
    }

    try {
         // Passa id_usuario para o service
        const sucesso = await alertaPagamentoService.deletePaymentAlertByCode(codigo_unico, id_usuario);
        if (sucesso) {
            res.status(204).send(); // Sucesso
        } else {
            // IMPORTANTE: Retorna 404
            res.status(404).json({ message: "Payment alert with this code not found for this user." });
        }
    } catch (error) {
        console.error(`Erro na rota DELETE /alertas-pagamento/by-code/${codigo_unico}:`, error);
        res.status(500).json({ error: "Internal server error deleting payment alert by code." });
    }
});

module.exports = router;