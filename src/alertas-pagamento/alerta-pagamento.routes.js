    // src/alertas-pagamento/alerta-pagamento.routes.js
    const express = require('express');
    const alertaPagamentoService = require('./alerta-pagamento.service');
    // Assumindo que você tem um middleware de autenticação que popula req.user
    // Se não tiver, a lógica de id_usuario precisará ser adaptada.
    // const authMiddleware = require('../middleware/auth'); // Exemplo

    const router = express.Router();

    // Exemplo: Aplicar middleware de autenticação a todas as rotas (opcional)
    // router.use(authMiddleware);

    // Rota para CRIAR um novo alerta
    router.post('/', async (req, res) => {
        // Pegar o ID do usuário (do corpo da requisição ou do usuário autenticado)
        // Se usar autenticação: const id_usuario = req.user?.id_usuario;
        // Se vier no corpo: const { id_usuario, ... } = req.body;
        // É mais seguro pegar do usuário autenticado.

        // Vamos assumir que os dados vêm do corpo, mas idealmente viriam validados
        const dadosAlerta = { ...req.body };

        // Validação básica (adapte conforme sua necessidade)
        if (!dadosAlerta.id_usuario || !dadosAlerta.valor || !dadosAlerta.data_vencimento || !dadosAlerta.tipo) {
            return res.status(400).json({ error: "Missing required fields for payment alert (id_usuario, valor, data_vencimento, tipo)." });
        }
        // Outras validações (formato da data, tipo válido, etc.) podem ser adicionadas

        try {
            const alertaPagamento = await alertaPagamentoService.createPaymentAlert(dadosAlerta);
            res.status(201).json(alertaPagamento);
        } catch (error) {
            console.error("Erro na rota POST /alertas-pagamento:", error);
            res.status(500).json({ error: "Internal server error creating payment alert." });
        }
    });

    // Rota para LISTAR alertas com filtros (MODIFICADA)
    router.get('/', async (req, res) => {
        // Extrai TODOS os parâmetros da query string
        const queryParams = { ...req.query };
        console.log("Query Params Recebidos na Rota:", queryParams); // <<< ADICIONE ESTE LOG

        let filters = {}; // Objeto para guardar filtros processados

        // 1. Processar id_usuario (Obrigatório?)
        // Pegar do usuário autenticado é mais seguro:
        // const id_usuario_auth = req.user?.id_usuario;
        // if (!id_usuario_auth) return res.status(401).json({ error: "Authentication required." });
        // filters.id_usuario = id_usuario_auth;

        // OU pegar da query (menos seguro, permite ver dados de outros?)
        if (queryParams.id_usuario) {
            const idUsuarioNum = parseInt(queryParams.id_usuario, 10);
            if (isNaN(idUsuarioNum)) {
                return res.status(400).json({ error: "Invalid id_usuario format." });
            }
            filters.id_usuario = idUsuarioNum;
            delete queryParams.id_usuario; // Remove do objeto original
        } else {
            // Decida se id_usuario é obrigatório na query
            return res.status(400).json({ error: "Missing required id_usuario query parameter." });
        }

        // 2. Processar outros filtros diretos (status, tipo, id_recorrencia_pai, etc.)
        if (queryParams.status) {
            filters.status = queryParams.status;
            delete queryParams.status;
        }
        if (queryParams.tipo && ['despesa', 'receita'].includes(queryParams.tipo)) {
            filters.tipo = queryParams.tipo;
            delete queryParams.tipo;
        }
        if (queryParams.id_recorrencia_pai) {
            const idRecPaiNum = parseInt(queryParams.id_recorrencia_pai, 10);
            if (!isNaN(idRecPaiNum)) {
                filters.id_recorrencia_pai = idRecPaiNum;
            }
            delete queryParams.id_recorrencia_pai;
        }
        // Adicione outros filtros diretos que você queira suportar

        // 3. Passar os filtros especiais (com colchetes) e os restantes
        // O serviço `listPaymentAlerts` agora tratará os filtros como 'data_vencimento[gte]'
        filters = { ...filters, ...queryParams }; // Adiciona os parâmetros restantes (incluindo os de data)

        try {
            const alertasPagamento = await alertaPagamentoService.listPaymentAlerts(filters);
            res.json(alertasPagamento);
        } catch (error) {
            console.error("Erro na rota GET /alertas-pagamento:", error);
            res.status(500).json({ error: "Internal server error listing payment alerts." });
        }
    });

    // Rota para BUSCAR um alerta específico pelo ID
    router.get('/:id_alerta', async (req, res) => {
        const { id_alerta } = req.params;
        const idUsuarioLogado = req.user?.id_usuario; // Obtenha o ID do usuário autenticado

        if (isNaN(parseInt(id_alerta))) {
            return res.status(400).json({ message: "Invalid alert ID format." });
        }

        // Segurança: Adicionar validação de usuário aqui se necessário
        // if (!idUsuarioLogado) return res.status(401).json({ error: "Authentication required." });

        try {
            const alertaPagamento = await alertaPagamentoService.getPaymentAlertById(parseInt(id_alerta));
            if (alertaPagamento) {
                // Segurança extra: Verificar se alertaPagamento.id_usuario === idUsuarioLogado
                // if (alertaPagamento.id_usuario !== idUsuarioLogado) {
                //     return res.status(403).json({ message: "Forbidden." });
                // }
                res.json(alertaPagamento);
            } else {
                res.status(404).json({ message: "Payment alert not found." });
            }
        } catch (error) {
            console.error(`Erro na rota GET /alertas-pagamento/${id_alerta}:`, error);
            res.status(500).json({ error: "Internal server error getting payment alert." });
        }
    });

    // Rota para ATUALIZAR um alerta (exceto status)
    router.put('/:id_alerta', async (req, res) => {
        const { id_alerta } = req.params;
        const updates = req.body;
        const idUsuarioLogado = req.user?.id_usuario; // Obtenha o ID do usuário autenticado

        if (isNaN(parseInt(id_alerta))) {
            return res.status(400).json({ message: "Invalid alert ID format." });
        }
        // Segurança: Adicionar validação de usuário aqui se necessário
        // if (!idUsuarioLogado) return res.status(401).json({ error: "Authentication required." });

        // Remover campos não atualizáveis
        delete updates.id_usuario;
        delete updates.id_recorrencia_pai;
        delete updates.codigo_unico;
        delete updates.id_alerta;
        // Talvez impedir atualização de status aqui e forçar uso da rota /status
        // delete updates.status;


        try {
            // Validação extra no service para garantir que o usuário logado é o dono seria ideal
            const alertaPagamentoAtualizado = await alertaPagamentoService.updatePaymentAlert(parseInt(id_alerta), updates /*, idUsuarioLogado */);
            if (alertaPagamentoAtualizado) {
                res.json(alertaPagamentoAtualizado);
            } else {
                res.status(404).json({ message: "Payment alert not found for update." });
            }
        } catch (error) {
            console.error(`Erro na rota PUT /alertas-pagamento/${id_alerta}:`, error);
            res.status(500).json({ error: "Internal server error updating payment alert." });
        }
    });

    // Rota para ATUALIZAR O STATUS de um alerta pelo CÓDIGO ÚNICO
    router.put('/by-code/:codigo_unico/status', async (req, res) => {
        const { codigo_unico } = req.params;
        const { status } = req.body; // Espera { "status": "pago" | "cancelado" | "pendente" }
        const id_usuario = req.user?.id_usuario; // Obtenha o ID do usuário autenticado

        if (!id_usuario) {
            return res.status(401).json({ error: "User authentication required." });
        }
        if (!codigo_unico || !status || !['pago', 'cancelado', 'pendente'].includes(status)) {
            return res.status(400).json({ error: "Missing or invalid codigo_unico or status." });
        }

        try {
            // O service updateStatusByCode já valida o usuário
            const result = await alertaPagamentoService.updateStatusByCode(codigo_unico, id_usuario, status);

            if (result.success) {
                res.status(result.status).json(result.data || { message: result.message }); // 200 OK
            } else {
                res.status(result.status).json({ message: result.message }); // 404 ou 400
            }
        } catch (error) {
            // Captura erros lançados pelo service (provavelmente 500 interno)
            console.error(`Erro na rota PUT /alertas-pagamento/by-code/${codigo_unico}/status:`, error);
            res.status(500).json({ error: error.message || "Internal server error updating alert status." });
        }
    });

    // Rota para DELETAR um alerta pelo CÓDIGO ÚNICO
    router.delete('/by-code/:codigo_unico', async (req, res) => {
        const { codigo_unico } = req.params;
        const id_usuario = req.user?.id_usuario; // Obtenha o ID do usuário autenticado

        if (!id_usuario) {
            return res.status(401).json({ error: "User authentication required." });
        }
        if (!codigo_unico) {
            return res.status(400).json({ error: "Missing codigo_unico parameter." });
        }

        try {
            // Service já valida o usuário
            const sucesso = await alertaPagamentoService.deletePaymentAlertByCode(codigo_unico, id_usuario);
            if (sucesso) {
                res.status(204).send(); // Sucesso, sem conteúdo
            } else {
                res.status(404).json({ message: "Payment alert with this code not found for this user." });
            }
        } catch (error) {
            console.error(`Erro na rota DELETE /alertas-pagamento/by-code/${codigo_unico}:`, error);
            res.status(500).json({ error: "Internal server error deleting payment alert by code." });
        }
    });

    // Rota para DELETAR um alerta pelo ID (Manter se usada internamente/admin)
    router.delete('/:id_alerta', async (req, res) => {
        const { id_alerta } = req.params;
        const idUsuarioLogado = req.user?.id_usuario; // Obtenha o ID do usuário autenticado

        if (isNaN(parseInt(id_alerta))) {
            return res.status(400).json({ message: "Invalid alert ID format." });
        }
        // Segurança: Adicionar validação de usuário aqui se necessário
        // if (!idUsuarioLogado) return res.status(401).json({ error: "Authentication required." });
        // Antes de deletar, buscar e verificar se pertence ao usuário logado seria mais seguro

        try {
            const sucesso = await alertaPagamentoService.deletePaymentAlert(parseInt(id_alerta));
            if (sucesso) {
                res.status(204).send();
            } else {
                res.status(404).json({ message: "Payment alert not found for deletion." });
            }
        } catch (error) {
            console.error(`Erro na rota DELETE /alertas-pagamento/${id_alerta}:`, error);
            res.status(500).json({ error: "Internal server error deleting payment alert." });
        }
    });

    // Rota para buscar alertas PRÓXIMOS do vencimento
    router.get('/upcoming/:id_usuario', async (req, res) => {
        const { id_usuario } = req.params;
        const idUsuarioLogado = req.user?.id_usuario; // Obtenha o ID do usuário autenticado
        const daysAhead = parseInt(req.query.days || 7); // Pega ?days= da query ou usa 7

        if (isNaN(parseInt(id_usuario))) {
            return res.status(400).json({ message: "Invalid user ID format." });
        }
        if (isNaN(daysAhead) || daysAhead <= 0) {
            return res.status(400).json({ message: "Invalid 'days' parameter." });
        }

        // Segurança: Verificar se o id_usuario do parâmetro é o mesmo do usuário logado
        // if (!idUsuarioLogado || parseInt(id_usuario) !== idUsuarioLogado) {
        //     return res.status(403).json({ message: "Forbidden." });
        // }

        try {
            const upcomingAlerts = await alertaPagamentoService.getUpcomingPaymentAlerts(parseInt(id_usuario), daysAhead);
            res.json(upcomingAlerts);
        } catch (error) {
            console.error(`Erro na rota GET /alertas-pagamento/upcoming/${id_usuario}:`, error);
            res.status(500).json({ error: "Internal server error getting upcoming payment alerts." });
        }
    });


    module.exports = router;