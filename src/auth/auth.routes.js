// src/auth/auth.routes.js
const express = require('express');
const authService = require('./auth.service');
const authenticateApiKey = require('../middleware/authenticateApiKey'); // <<< 1. IMPORTAR (se já não estiver)
const Usuario = require('../usuarios/usuario.model'); // Adjust path

const router = express.Router();

router.post('/website-register', async (req, res) => {
    const { telefone, email } = req.body;

    if (!telefone || !email) {
        return res.status(400).json({ error: "Phone and email are required for website registration." });
    }

    try {
        const usuario = await authService.registerWebsiteUser(telefone, email);
        res.status(201).json(usuario);
    } catch (error) {
        console.error("Error processing website registration:", error);
        res.status(500).json({ error: "Internal server error during website user registration." });
    }
});

router.post('/whatsapp-register', async (req, res) => {
    const { telefone } = req.body;

    if (!telefone) {
        return res.status(400).json({ error: "Phone is required for WhatsApp registration." });
    }

    try {
        const usuario = await authService.registerWhatsAppUser(telefone);
        res.status(201).json(usuario);
    } catch (error) {
        console.error("Error processing WhatsApp registration:", error);
        res.status(500).json({ error: "Internal server error during WhatsApp user registration." });
    }
});

router.post('/whatsapp-associate-email', async (req, res) => {
    const { telefone, email } = req.body;

    if (!telefone || !email) {
        return res.status(400).json({ error: "Phone and email are required to associate email." });
    }

    try {
        const usuario = await authService.associateEmailWhatsAppUser(telefone, email);
        res.json(usuario);
    } catch (error) {
        console.error("Error processing WhatsApp email association:", error);
        if (error.message === "Usuário não encontrado para associar email.") {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: "Internal server error during WhatsApp email association." });
    }
});

router.get('/user-by-phone/:telefone', async (req, res) => {
    const { telefone } = req.params;

    if (!telefone) {
        return res.status(400).json({ error: "Phone number is required." });
    }

    try {
        const userStatus = await authService.getUserByPhone(telefone);
        res.status(200).json(userStatus); // Always return 200 OK
    } catch (error) {
        console.error("Error getting user by phone:", error);
        res.status(500).json({ error: "Internal server error getting user by phone." });
    }
});

router.post('/subscription', authenticateApiKey, async (req, res) => {
    // Pega os campos do corpo, incluindo 'plano' e 'duracaoPlano'
    const { nome, email, telefone, plano, duracaoPlano } = req.body;

    // Validação dos campos recebidos
    if (!nome || !email || !telefone || !plano || !duracaoPlano) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes: nome, email, telefone, plano, duracaoPlano." });
    }
    // Valida a duração para cálculo da expiração
    if (!['mensal', 'anual'].includes(duracaoPlano.toLowerCase())) {
         return res.status(400).json({ error: "Valor inválido para duracaoPlano. Use 'mensal' ou 'anual'." });
    }
    // Adicione mais validações (formato email, etc.)

    try {
        // Chama o serviço com os novos parâmetros
        const result = await authService.registerOrUpdateSubscription(
            nome,
            email,
            telefone,
            plano, // Nome do plano (ex: "Premium Anual")
            duracaoPlano.toLowerCase() // 'mensal' ou 'anual' para cálculo
        );
        res.status(result.isNewUser ? 201 : 200).json(result.usuario);
    } catch (error) {
        console.error("Erro na rota POST /subscription:", error);
        if (error.message.includes('validação') || error.message.includes('Já existe')) {
             res.status(400).json({ error: error.message });
        } else {
             res.status(500).json({ error: "Erro interno ao processar a assinatura." });
        }
    }
});

router.get('/stats', async (req, res) => {
    console.log('[Rota GET /dashboard/stats] Requisição recebida.'); // Log da rota
    try {
        const stats = await authService.getDashboardStats();
        res.status(200).json(stats); // Retorna 200 OK com as estatísticas
    } catch (error) {
        console.error('[Rota GET /dashboard/stats] Erro:', error);
        // Retorna a mensagem de erro do service ou uma genérica
        res.status(500).json({ error: error.message || 'Erro interno ao buscar estatísticas.' });
    }
});

router.patch('/mark-first-message/:telefone', async (req, res) => {
    const { telefone } = req.params;

    if (!telefone) {
        return res.status(400).json({ error: "Número de telefone é obrigatório na URL." });
    }

    try {
        // Chama o serviço para atualizar o campo 'primeiraMensagem' para false
        const usuarioAtualizado = await authService.markFirstMessageSent(telefone);

        // Responde com sucesso (pode incluir o usuário atualizado se desejar)
        res.status(200).json({
            message: `Status 'primeiraMensagem' atualizado para false para o telefone ${telefone}.`,
            // usuario: usuarioAtualizado // Descomente se quiser retornar o usuário completo
        });
    } catch (error) {
        console.error(`Erro na rota PATCH /user/:telefone/mark-first-message:`, error);
        if (error.message.includes("Usuário não encontrado")) {
            // Se o usuário não foi encontrado pelo serviço
            return res.status(404).json({ error: error.message });
        }
        // Outros erros (ex: falha no banco de dados)
        res.status(500).json({ error: "Erro interno ao atualizar status da primeira mensagem." });
    }
});

router.post('/send-bulk-message',  async (req, res) => {
    const { userIds, message } = req.body; // Espera um array de IDs e a mensagem

    console.log('[Rota POST /send-bulk-message] Requisição recebida. IDs:', userIds?.length, 'Mensagem:', message ? 'Sim' : 'Não');

    // Validação básica da entrada
    if (!Array.isArray(userIds) || userIds.length === 0 || !message || typeof message !== 'string' || message.trim() === '') {
        console.warn('[Rota POST /send-bulk-message] Requisição inválida. Dados:', req.body);
        return res.status(400).json({ error: "É necessário fornecer um array 'userIds' não vazio e uma 'message' válida." });
    }

    try {
        // Chama o serviço para enviar as mensagens
        const result = await authService.sendBulkWhatsAppMessage(userIds, message);

        console.log('[Rota POST /send-bulk-message] Resultado do envio:', result);

        // Responde com o resumo do envio
        res.status(200).json({
            message: `Processo de envio concluído. ${result.successCount} enviada(s) com sucesso, ${result.failedCount} falha(s).`,
            details: {
                successCount: result.successCount,
                failedCount: result.failedCount,
                errors: result.errors // Lista detalhada de erros (opcional, pode ser grande)
            }
        });

    } catch (error) {
        console.error('[Rota POST /send-bulk-message] Erro no serviço:', error);
        // Retorna erro genérico ou a mensagem do serviço se disponível
        res.status(500).json({ error: error.message || "Erro interno ao processar o envio em massa." });
    }
});

router.post('/register', async (req, res) => {
    try {
      // Add more robust validation here if needed (e.g., using Joi or express-validator)
      const { nome, telefone, email, senha } = req.body;
  
      if (!telefone) { // Basic check, service layer does more thorough check
        return res.status(400).json({ error: 'Telefone é obrigatório.' });
      }
       // You might want to add password complexity rules here
  
      const newUser = await authService.registerUser({ nome, telefone, email, senha });
      console.log(`[Rota POST /register] Usuário ${newUser.id_usuario} registrado com sucesso.`);
      res.status(201).json({ message: 'Usuário registrado com sucesso!', user: newUser }); // Return user data (without pass)
  
    } catch (error) {
      console.error("[Rota POST /register] Erro:", error.message);
      // Send specific status codes based on error type
      if (error.message.includes('já cadastrado')) {
        return res.status(409).json({ error: error.message }); // 409 Conflict
      }
      if (error.message.includes('obrigatório')) {
         return res.status(400).json({ error: error.message }); // 400 Bad Request
      }
      res.status(500).json({ error: 'Falha ao registrar usuário.' });
    }
  });
  
  // --- Login Route ---
  router.post('/login', async (req, res) => {
    try {
      const { identifier, senha } = req.body; // identifier can be email or phone
  
      if (!identifier || !senha) {
        return res.status(400).json({ error: 'Email/Telefone e Senha são obrigatórios.' });
      }
  
      const result = await authService.loginUser(identifier, senha);
      console.log(`[Rota POST /login] Usuário ${result.user.id_usuario} logado com sucesso.`);
      // Return user info and the token
      res.status(200).json({
          message: 'Login bem-sucedido!',
          user: result.user, // User data (without password hash)
          token: result.token // The JWT
      });
  
    } catch (error) {
      console.error("[Rota POST /login] Erro:", error.message);
       if (error.message.includes('não encontrado') || error.message.includes('inválidas') || error.message.includes('não habilitado')) {
         return res.status(401).json({ error: 'Credenciais inválidas.' }); // 401 Unauthorized
       }
       if (error.message.includes('obrigatórios')) {
          return res.status(400).json({ error: error.message }); // 400 Bad Request
       }
      res.status(500).json({ error: 'Falha ao fazer login.' });
    }
  });
  
router.post('/dev', async (req, res) => {
    const { telefone, plano, duracaoPlano } = req.body;

    // 1. Validação dos campos
    if (!telefone || !plano || !duracaoPlano) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes: telefone, plano, duracaoPlano." });
    }
    if (!['mensal', 'anual'].includes(duracaoPlano.toLowerCase())) {
         return res.status(400).json({ error: "Valor inválido para duracaoPlano. Use 'mensal' ou 'anual'." });
    }

    try {
        // 2. Chama o novo serviço
        const usuarioAtualizado = await authService.devReactivateSubscription(
            telefone,
            plano,
            duracaoPlano.toLowerCase()
        );

        // 3. Responde com sucesso
        res.status(200).json({
            message: `Plano para o telefone ${telefone} foi reativado com sucesso.`,
            usuario: usuarioAtualizado
        });

    } catch (error) {
        console.error("Erro na rota POST /dev/reactivate-subscription:", error);
        // 4. Tratamento de erros específicos
        if (error.message.includes("não encontrado")) {
             res.status(404).json({ error: error.message }); // 404 Not Found
        } else if (error.message.includes('inválida')) {
            res.status(400).json({ error: error.message }); // 400 Bad Request
        }
        else {
             res.status(500).json({ error: "Erro interno ao reativar a assinatura." });
        }
    }
});


module.exports = router;