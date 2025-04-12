// src/alertas-pagamento/alerta-pagamento.routes.js
const express = require('express');
const alertaPagamentoService = require('./alerta-pagamento.service');
const authenticateApiKey = require('../middleware/authenticateApiKey'); // Importar o middleware

const router = express.Router();

// --- ROTAS PÚBLICAS (ou com outra autenticação, se houver) ---

// Rota para CRIAR um novo alerta
// Se esta rota precisar de autenticação, adicione authenticateApiKey aqui também
// e garanta que id_usuario venha de uma fonte confiável (body validado ou token).
router.post('/', async (req, res) => {
    const dadosAlerta = { ...req.body };

    // Validação básica
    if (!dadosAlerta.id_usuario || !dadosAlerta.valor || !dadosAlerta.data_vencimento || !dadosAlerta.tipo) {
        return res.status(400).json({ error: "Missing required fields for payment alert (id_usuario, valor, data_vencimento, tipo)." });
    }
    // Converta id_usuario para número, se necessário
    dadosAlerta.id_usuario = parseInt(dadosAlerta.id_usuario, 10);
     if (isNaN(dadosAlerta.id_usuario)) {
         return res.status(400).json({ error: "Invalid id_usuario format in body." });
     }


    try {
        const alertaPagamento = await alertaPagamentoService.createPaymentAlert(dadosAlerta);
        res.status(201).json(alertaPagamento);
    } catch (error) {
        console.error("Erro na rota POST /alertas-pagamento:", error);
        // Retornar erro específico se possível (ex: erro de validação)
        res.status(500).json({ error: error.message || "Internal server error creating payment alert." });
    }
});

// Rota para LISTAR alertas com filtros
router.get('/', async (req, res) => {
    const queryParams = { ...req.query };
    console.log("Query Params Recebidos na Rota:", queryParams);

    let filters = {};

    if (queryParams.id_usuario) {
        const idUsuarioNum = parseInt(queryParams.id_usuario, 10);
        if (isNaN(idUsuarioNum)) {
            return res.status(400).json({ error: "Invalid id_usuario format." });
        }
        filters.id_usuario = idUsuarioNum;
        // Não deletar outros queryParams, passar todos para o service
    } else {
        return res.status(400).json({ error: "Missing required id_usuario query parameter." });
    }

    // Passa todos os parâmetros recebidos (incluindo os com colchetes) para o service
    const finalFilters = { ...queryParams, id_usuario: filters.id_usuario };
    console.log("Filtros Finais Passados para o Service:", finalFilters);

    try {
        const alertasPagamento = await alertaPagamentoService.listPaymentAlerts(finalFilters);
        res.json(alertasPagamento);
    } catch (error) {
        console.error("Erro na rota GET /alertas-pagamento:", error);
        res.status(500).json({ error: "Internal server error listing payment alerts." });
    }
});

// Rota para BUSCAR um alerta específico pelo ID
// Geralmente GETs são públicos ou usam autenticação baseada em sessão/token do *usuário final*
// Não estamos protegendo com API Key aqui, mas poderia ser feito se necessário.
router.get('/:id_alerta', async (req, res) => {
    const { id_alerta } = req.params;

    if (isNaN(parseInt(id_alerta))) {
        return res.status(400).json({ message: "Invalid alert ID format." });
    }

    try {
        const alertaPagamento = await alertaPagamentoService.getPaymentAlertById(parseInt(id_alerta));
        if (alertaPagamento) {
            // Poderia adicionar checagem se o usuário logado (se houver) pode ver este alerta
            res.json(alertaPagamento);
        } else {
            res.status(404).json({ message: "Payment alert not found." });
        }
    } catch (error) {
        console.error(`Erro na rota GET /alertas-pagamento/${id_alerta}:`, error);
        res.status(500).json({ error: "Internal server error getting payment alert." });
    }
});

// Rota para buscar alertas PRÓXIMOS do vencimento
// Também geralmente pública ou com autenticação do usuário final.
router.get('/upcoming/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
    const daysAhead = parseInt(req.query.days || 7);

    if (isNaN(parseInt(id_usuario))) {
        return res.status(400).json({ message: "Invalid user ID format." });
    }
    if (isNaN(daysAhead) || daysAhead <= 0) {
         return res.status(400).json({ message: "Invalid 'days' parameter." });
     }

    try {
        // A validação de que o usuário X só pode ver seus próprios alertas
        // deve estar idealmente aqui ou no service.
        const upcomingAlerts = await alertaPagamentoService.getUpcomingPaymentAlerts(parseInt(id_usuario), daysAhead);
        res.json(upcomingAlerts);
    } catch (error) {
        console.error(`Erro na rota GET /alertas-pagamento/upcoming/${id_usuario}:`, error);
        res.status(500).json({ error: "Internal server error getting upcoming payment alerts." });
    }
});


// --- ROTAS PROTEGIDAS COM API KEY (PUT e DELETE) ---

// Rota para ATUALIZAR um alerta (exceto status) pelo ID
router.put('/:id_alerta', authenticateApiKey, async (req, res) => { // <<< MIDDLEWARE APLICADO
    const { id_alerta } = req.params;
    const updates = { ...req.body }; // Copia o corpo da requisição

    // N8N precisa enviar o ID do usuário no corpo para validação
    const id_usuario_requisitante = parseInt(updates.id_usuario, 10); // Pegar de um campo esperado como 'id_usuario'
    if (!id_usuario_requisitante || isNaN(id_usuario_requisitante)) {
        return res.status(400).json({ error: "Missing or invalid id_usuario in request body for validation." });
    }
    delete updates.id_usuario; // Remove do objeto a ser passado para 'update'

    if (isNaN(parseInt(id_alerta))) {
        return res.status(400).json({ message: "Invalid alert ID format." });
    }

    // Remover outros campos não atualizáveis
    delete updates.id_recorrencia_pai;
    delete updates.codigo_unico;
    delete updates.id_alerta;
    delete updates.status; // Forçar uso da rota /status para mudar status


    try {
        // Passa o id_usuario requisitante para validação opcional no service
        const alertaPagamentoAtualizado = await alertaPagamentoService.updatePaymentAlert(parseInt(id_alerta), updates, id_usuario_requisitante);
        if (alertaPagamentoAtualizado) {
            res.json(alertaPagamentoAtualizado);
        } else {
            // Pode ser não encontrado OU não autorizado pelo service
            res.status(404).json({ message: "Payment alert not found or update forbidden." });
        }
    } catch (error) {
        console.error(`Erro na rota PUT /alertas-pagamento/${id_alerta}:`, error);
        res.status(500).json({ error: "Internal server error updating payment alert." });
    }
});

// Rota para ATUALIZAR O STATUS de um alerta pelo CÓDIGO ÚNICO
router.put('/by-code/:codigo_unico/status', authenticateApiKey, async (req, res) => { // <<< MIDDLEWARE APLICADO
    const { codigo_unico } = req.params;
    // Pega status E id_usuario do corpo da requisição
    const { status, id_usuario } = req.body;

    // Validações
    if (!id_usuario || isNaN(parseInt(id_usuario, 10))) { // Valida se id_usuario existe e é numérico
        return res.status(400).json({ error: "Missing or invalid id_usuario in request body." });
    }
     if (!codigo_unico || !status || !['pago', 'cancelado', 'pendente'].includes(status)) {
         return res.status(400).json({ error: "Missing or invalid codigo_unico or status." });
     }

    try {
        // Passa o id_usuario do body para o service para validação de propriedade
        const result = await alertaPagamentoService.updateStatusByCode(codigo_unico, parseInt(id_usuario, 10), status);
        if (result.success) {
            res.status(result.status).json(result.data || { message: result.message }); // 200 OK
        } else {
            res.status(result.status).json({ message: result.message }); // 404 ou 400
        }
    } catch (error) {
        console.error(`Erro na rota PUT /alertas-pagamento/by-code/${codigo_unico}/status:`, error);
        res.status(500).json({ error: error.message || "Internal server error updating alert status." });
    }
});

// Rota para DELETAR um alerta pelo CÓDIGO ÚNICO
router.delete('/by-code/:codigo_unico', authenticateApiKey, async (req, res) => { // <<< MIDDLEWARE APLICADO
    const { codigo_unico } = req.params;
    // Pega id_usuario da QUERY STRING (mais comum para DELETE sem corpo)
    const id_usuario = req.query.id_usuario;

    if (!id_usuario || isNaN(parseInt(id_usuario, 10))) { // Valida se id_usuario existe e é numérico
        return res.status(400).json({ error: "Missing or invalid id_usuario in query string." });
    }
    if (!codigo_unico) {
        return res.status(400).json({ error: "Missing codigo_unico parameter." });
    }

    try {
        // Passa o id_usuario da query para o service validar propriedade
        const sucesso = await alertaPagamentoService.deletePaymentAlertByCode(codigo_unico, parseInt(id_usuario, 10));
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Payment alert with this code not found for this user." });
        }
    } catch (error) {
        console.error(`Erro na rota DELETE /alertas-pagamento/by-code/${codigo_unico}:`, error);
        res.status(500).json({ error: "Internal server error deleting payment alert by code." });
    }
});

// Rota para DELETAR um alerta pelo ID
router.delete('/:id_alerta', authenticateApiKey, async (req, res) => { // <<< MIDDLEWARE APLICADO
    const { id_alerta } = req.params;
     // Opcional: Pegar id_usuario da query para dupla checagem no service
     const id_usuario_requisitante = req.query.id_usuario ? parseInt(req.query.id_usuario, 10) : null;

    if (isNaN(parseInt(id_alerta))) {
        return res.status(400).json({ message: "Invalid alert ID format." });
    }

    try {
        // Idealmente, o service deveria buscar o alerta, verificar se pertence
        // ao id_usuario_requisitante (se fornecido), e então deletar.
        // Versão atual do service só deleta por ID.
        // Para segurança, precisaríamos ajustar o service ou fazer a busca aqui:
        /*
        const alerta = await alertaPagamentoService.getPaymentAlertById(parseInt(id_alerta));
        if (!alerta) return res.status(404).json({ message: "Payment alert not found." });
        if (id_usuario_requisitante && alerta.id_usuario !== id_usuario_requisitante) {
             return res.status(403).json({ message: "Forbidden." });
        }
        const sucesso = await alertaPagamentoService.deletePaymentAlert(parseInt(id_alerta));
        */
       // Usando a versão atual do service (menos segura sem validação de usuário):
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


module.exports = router;