// src/transacoes/transacao.routes.js
const express = require('express');
const transacaoService = require('./transacao.service');
const authenticateApiKey = require('../middleware/authenticateApiKey'); // <<< 1. IMPORTAR (se já não estiver)


const router = express.Router();

// Rota POST modificada: id_categoria -> nome_categoria
router.post('/', /* authenticateApiKey, */ async (req, res) => {

    // <<< PASSO 1: Pegar TODO o corpo da requisição >>>
    const dadosRecebidos = { ...req.body };

    // <<< PASSO 2: Validação dos campos OBRIGATÓRIOS dentro do objeto >>>
    if (!dadosRecebidos.id_usuario || !dadosRecebidos.tipo || dadosRecebidos.valor === undefined || !dadosRecebidos.data_transacao) {
         return res.status(400).json({ error: "Missing required fields for transaction (id_usuario, tipo, valor, data_transacao)." });
    }
    // Adicionar mais validações se necessário (tipo válido, formato data, etc.)

    try {
        // <<< PASSO 3: Chamar o service PASSANDO O OBJETO COMPLETO >>>
        const novaTransacao = await transacaoService.createTransaction(dadosRecebidos);

        // A resposta já contém o código gerado pelo service
        res.status(201).json(novaTransacao);
    } catch (error) {
        // <<< PASSO 4: Tratamento de erro >>>
        console.error("Erro na rota POST /transacoes:", error);
        // Retorna a mensagem específica do erro lançado pelo service
        res.status(500).json({ error: error.message || "Internal server error creating transaction." });
    }
});

// Rota GET / com filtro por nome_categoria (ADICIONAL OPCIONAL)
router.get('/', async (req, res) => {
    // Pega todos os parâmetros esperados da query
    const { id_usuario, startDate, endDate, tipo, nome_categoria } = req.query; // <<< Lê startDate/endDate

    // Validação Obrigatória: id_usuario
    if (!id_usuario) {
        return res.status(400).json({ error: "User ID (id_usuario) is required." });
    }
    const idUsuarioNum = parseInt(id_usuario, 10);
    if (isNaN(idUsuarioNum)) {
        return res.status(400).json({ error: "Invalid id_usuario format." });
    }

    // <<< Monta o objeto periodo APENAS se startDate e endDate forem válidos >>>
    let filtroPeriodo = null;
    if (startDate && endDate && /\d{4}-\d{2}-\d{2}/.test(startDate) && /\d{4}-\d{2}-\d{2}/.test(endDate)) {
        filtroPeriodo = { startDate, endDate }; // Passa como objeto se ambos existirem e forem válidos
        console.log(`[Rota GET /transacoes] Filtro de período por startDate/endDate:`, filtroPeriodo);
    } else if (req.query.periodo) { // Fallback para o parâmetro 'periodo' se startDate/endDate não vierem
        filtroPeriodo = req.query.periodo;
         console.log(`[Rota GET /transacoes] Filtro de período por string: ${filtroPeriodo}`);
    }


    // Monta filtros adicionais
    const additionalFilters = {};
    if (nome_categoria !== undefined) {
        additionalFilters.nome_categoria = nome_categoria;
        console.log(`[Rota GET /transacoes] Filtro nome_categoria recebido: ${nome_categoria}`);
    }

    try {
        // Chama o serviço passando os parâmetros corretos
        const transacoes = await transacaoService.listTransactions(
            idUsuarioNum,
            filtroPeriodo, // Passa o objeto {startDate, endDate} ou a string 'periodo' ou null
            tipo,          // Passa o tipo como recebido
            additionalFilters // Passa o objeto com nome_categoria
        );
        res.json(transacoes);
    } catch (error) {
        console.error("Erro na rota GET /transacoes:", error);
        res.status(500).json({ error: error.message || "Internal server error listing transactions." });
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


router.delete('/by-code/:codigo_unico', authenticateApiKey, async (req, res) => {
    const { codigo_unico } = req.params;
    const id_usuario_query = req.query.id_usuario;

    if (!id_usuario_query || isNaN(parseInt(id_usuario_query, 10))) {
         return res.status(400).json({ error: "Missing or invalid id_usuario in query string." });
    }
    const id_usuario = parseInt(id_usuario_query, 10);

    if (!codigo_unico) {
        return res.status(400).json({ error: "Missing codigo_unico parameter." });
    }

    try {
        // Chama o serviço modificado, que agora retorna detalhes ou null
        const deletedDetails = await transacaoService.deleteTransactionByCode(codigo_unico, id_usuario);

        if (deletedDetails) {
            // <<< ALTERAÇÃO: Retorna 200 OK com os detalhes >>>
            res.status(200).json({
                message: "Transação excluída com sucesso.",
                details: deletedDetails // Envia os detalhes do item excluído
            });
            // <<< FIM DA ALTERAÇÃO >>>
        } else {
            // Mantém 404 se o serviço retornou null (não encontrado)
            res.status(404).json({ message: "Transaction with this code not found for this user." });
        }
    } catch (error) {
        console.error(`Erro na rota DELETE /transacoes/by-code/${codigo_unico}:`, error);
        res.status(500).json({ error: "Internal server error deleting transaction by code." });
    }
});


module.exports = router;