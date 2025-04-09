// src/transacoes/transacao.routes.js
const express = require('express');
const transacaoService = require('./transacao.service');

const router = express.Router();

// Rota POST modificada: id_categoria -> nome_categoria
router.post('/', async (req, res) => {
    // Destructuring modificado
    const { id_usuario, tipo, valor, nome_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas } = req.body;

    // Validação básica (adapte conforme necessário)
    if (!id_usuario || !tipo || !valor || !data_transacao) {
         return res.status(400).json({ error: "Missing required fields for transaction." });
    }
    // Se codigo_unico voltou a ser obrigatório no modelo, valide aqui também.

    try {
        // Chamada de serviço modificada
        const novaTransacao = await transacaoService.createTransaction(
            id_usuario, tipo, valor, nome_categoria, data_transacao, codigo_unico, descricao, comprovante_url, id_transacao_pai, parcela_numero, total_parcelas
        );
        res.status(201).json(novaTransacao);
    } catch (error) {
        // Evitar expor detalhes do erro interno, logar e retornar genérico
        console.error("Erro na rota POST /transacoes:", error);
        res.status(500).json({ error: "Internal server error creating transaction." });
    }
});

// Rota GET / com filtro por nome_categoria (ADICIONAL OPCIONAL)
router.get('/', async (req, res) => {
    // Adicionado nome_categoria ao destructuring dos query params
    const { id_usuario, periodo, nome_categoria } = req.query;

    if (!id_usuario) {
        return res.status(400).json({ error: "User ID (id_usuario) is required to list transactions." });
    }

    try {
        // Passa o nome_categoria para o serviço (você precisará adaptar o serviço listTransactions para usar isso)
        // Por enquanto, o serviço não usa nome_categoria no filtro principal.
        // Se quiser filtrar, precisará adicionar lógica em listTransactions.
        const transacoes = await transacaoService.listTransactions(id_usuario, periodo /*, nome_categoria */);
        res.json(transacoes);
    } catch (error) {
        console.error("Erro na rota GET /transacoes:", error);
        res.status(500).json({ error: "Internal server error listing transactions." });
    }
});

router.get('/:id_transacao', async (req, res) => {
    const { id_transacao } = req.params;

    // Validar se id_transacao é um número
     if (isNaN(parseInt(id_transacao))) {
        return res.status(400).json({ error: "Invalid transaction ID format." });
    }

    try {
        const transacao = await transacaoService.getTransactionById(parseInt(id_transacao));
        if (transacao) {
            res.json(transacao);
        } else {
            res.status(404).json({ message: "Transaction not found." });
        }
    } catch (error) {
        console.error(`Erro na rota GET /transacoes/${id_transacao}:`, error);
        res.status(500).json({ error: "Internal server error getting transaction." });
    }
});

// Rota PUT não precisa de mudança para categoria aqui, o service trata
router.put('/:id_transacao', async (req, res) => {
    const { id_transacao } = req.params;
    const updates = req.body;

     if (isNaN(parseInt(id_transacao))) {
        return res.status(400).json({ error: "Invalid transaction ID format." });
    }
    // Remover campos que não devem ser atualizados diretamente (ex: id_usuario, id_transacao)
    delete updates.id_usuario;
    delete updates.id_transacao;
    delete updates.id_categoria; // Garantir que o campo antigo não seja enviado

    try {
        const transacaoAtualizada = await transacaoService.updateTransaction(parseInt(id_transacao), updates);
        if (transacaoAtualizada) {
            res.json(transacaoAtualizada);
        } else {
            res.status(404).json({ message: "Transaction not found for update." });
        }
    } catch (error) {
        console.error(`Erro na rota PUT /transacoes/${id_transacao}:`, error);
        res.status(500).json({ error: "Internal server error updating transaction." });
    }
});

// Rota DELETE não precisa de mudança para categoria
router.delete('/:id_transacao', async (req, res) => {
    const { id_transacao } = req.params;

     if (isNaN(parseInt(id_transacao))) {
        return res.status(400).json({ error: "Invalid transaction ID format." });
    }

    try {
        const sucesso = await transacaoService.deleteTransaction(parseInt(id_transacao));
        if (sucesso) {
            // 204 No Content é padrão para DELETE bem-sucedido
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Transaction not found for deletion." });
        }
    } catch (error) {
        console.error(`Erro na rota DELETE /transacoes/${id_transacao}:`, error);
        res.status(500).json({ error: "Internal server error deleting transaction." });
    }
});

// Rotas de resumo e extrato não precisam de mudança aqui, service foi ajustado
router.get('/balance/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
     if (isNaN(parseInt(id_usuario))) return res.status(400).json({ error: "Invalid user ID format." });
    try {
        const balance = await transacaoService.getCurrentBalance(parseInt(id_usuario));
        // Retorna um objeto JSON consistente
        res.json({ balance: balance });
    } catch (error) {
        console.error("Erro ao obter saldo:", error);
        res.status(500).json({ error: "Internal server error getting balance." });
    }
});

router.get('/monthly-summary/:id_usuario/:year/:month', async (req, res) => {
    const { id_usuario, year, month } = req.params;
     if (isNaN(parseInt(id_usuario)) || isNaN(parseInt(year)) || isNaN(parseInt(month))) return res.status(400).json({ error: "Invalid ID or date format." });
    try {
        const summary = await transacaoService.getMonthlySummary(parseInt(id_usuario), parseInt(year), parseInt(month));
        res.json(summary);
    } catch (error) {
        console.error("Erro ao obter resumo mensal:", error);
        res.status(500).json({ error: "Internal server error getting monthly summary." });
    }
});

router.get('/daily-summary/:id_usuario/:year/:month/:day', async (req, res) => {
    const { id_usuario, year, month, day } = req.params;
     if (isNaN(parseInt(id_usuario)) || isNaN(parseInt(year)) || isNaN(parseInt(month)) || isNaN(parseInt(day))) return res.status(400).json({ error: "Invalid ID or date format." });
    try {
        const summary = await transacaoService.getDailySummary(parseInt(id_usuario), parseInt(year), parseInt(month), parseInt(day));
        res.json(summary);
    } catch (error) {
        console.error("Erro ao obter resumo diário:", error);
        res.status(500).json({ error: "Internal server error getting daily summary." });
    }
});

router.get('/weekly-summary/:id_usuario/:year/:week', async (req, res) => {
    const { id_usuario, year, week } = req.params;
     if (isNaN(parseInt(id_usuario)) || isNaN(parseInt(year)) || isNaN(parseInt(week))) return res.status(400).json({ error: "Invalid ID or date format." });
    try {
        const summary = await transacaoService.getWeeklySummary(parseInt(id_usuario), parseInt(year), parseInt(week));
        res.json(summary);
    } catch (error) {
        console.error("Erro ao obter resumo semanal:", error);
        res.status(500).json({ error: "Internal server error getting weekly summary." });
    }
});

router.get('/spending-by-category/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
    const { startDate, endDate } = req.query;
     if (isNaN(parseInt(id_usuario))) return res.status(400).json({ error: "Invalid user ID format." });
     // Validar datas se necessário
     const parsedStartDate = startDate ? new Date(startDate) : new Date(0); // Default start date if needed
     const parsedEndDate = endDate ? new Date(endDate) : new Date(); // Default endDate to now

     if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format for startDate or endDate." });
     }

    try {
        const spending = await transacaoService.getSpendingByCategory(parseInt(id_usuario), parsedStartDate, parsedEndDate);
        res.json(spending);
    } catch (error) {
        console.error("Erro ao obter gastos por categoria:", error);
        res.status(500).json({ error: "Internal server error getting spending by category." });
    }
});

router.get('/statement/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
    const { startDate, endDate } = req.query;
     if (isNaN(parseInt(id_usuario))) return res.status(400).json({ error: "Invalid user ID format." });
     // Validar datas
     const parsedStartDate = startDate ? new Date(startDate) : new Date(0);
     const parsedEndDate = endDate ? new Date(endDate) : new Date();

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format for startDate or endDate." });
     }

    try {
        const statement = await transacaoService.getTransactionStatement(parseInt(id_usuario), parsedStartDate, parsedEndDate);
        res.json(statement);
    } catch (error) {
        console.error("Erro ao obter extrato de transações:", error);
        res.status(500).json({ error: "Internal server error getting transaction statement." });
    }
});


module.exports = router;