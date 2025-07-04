// src/usuarios/usuario.routes.js
const express = require('express');
const usuarioService = require('./usuario.service');

const router = express.Router();

router.post('/', async (req, res) => {
    const { nome, telefone, email, trial_fim, assinatura_ativa } = req.body;

    try {
        const usuario = await usuarioService.createUser(nome, telefone, email, trial_fim, assinatura_ativa);
        res.status(201).json(usuario);
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        res.status(500).json({ error: "Internal server error creating user." });
    }
});


router.get('/allUsers', async (req, res) => { // <<< Aplicar Middleware
    console.log('[Rota GET /usuarios] Requisição recebida. Query:', req.query);
    try {
        // Extrai parâmetros de paginação e filtro da query string
        const options = {
            page: req.query.page,   // Ex: ?page=2
            limit: req.query.limit,  // Ex: ?limit=20
            search: req.query.search,// Ex: ?search=joao
            plan: req.query.plan    // Ex: ?plan=Premium
        };

        // Chama o serviço para listar usuários com as opções
        const result = await usuarioService.listUsers(options);

        // Calcula informações de paginação para a resposta
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 50; // Usar mesmo default/max do service
        if (limit > 200) limit = 200;
        if (limit <= 0) limit = 50;

        res.status(200).json({
            users: result.rows, // Lista de usuários da página atual
            total: result.count, // Contagem total de usuários (para paginação no frontend)
            currentPage: page,
            totalPages: Math.ceil(result.count / limit) // Calcula o total de páginas
        });

    } catch (error) {
        console.error("Erro na rota GET /usuarios:", error);
        res.status(500).json({ error: error.message || "Erro interno ao listar usuários." });
    }
});


router.get('/', async (req, res) => {
    const { telefone } = req.query; // Pega o parâmetro 'telefone' da URL (?telefone=...)

    // Se o parâmetro 'telefone' foi fornecido, busca por ele
    if (telefone) {
        try {
            const usuario = await usuarioService.getUserByPhone(telefone);
            if (usuario) {
                // Retorna o usuário encontrado (dentro de um array, como N8N pode esperar)
                res.json([usuario]);
            } else {
                // Retorna um array vazio se não encontrar, para N8N não falhar
                res.json([]);
            }
        } catch (error) {
            console.error("Erro na rota GET /usuarios por telefone:", error);
            res.status(500).json({ error: "Internal server error getting user by phone." });
        }
    } else {
        // Opcional: Se nenhum filtro for passado, você pode:
        // 1. Listar todos os usuários (precisaria criar a função no service)
        // 2. Retornar um erro 400 Bad Request pedindo um filtro
        // 3. Retornar um array vazio
        // Exemplo: Retornando erro 400
        res.status(400).json({ error: "User search requires a filter (e.g., ?telefone=...)." });
    }
});

router.get('/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const usuario = await usuarioService.getUserById(id_usuario);
        if (usuario) {
            res.json(usuario);
        } else {
            res.status(404).json({ message: "User not found." });
        }
    } catch (error) {
        console.error("Erro ao obter usuário:", error);
        res.status(500).json({ error: "Internal server error getting user." });
    }
});

router.put('/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
    const updates = req.body;

    try {
        const usuarioAtualizado = await usuarioService.updateUser(id_usuario, updates);
        if (usuarioAtualizado) {
            res.json(usuarioAtualizado);
        } else {
            res.status(404).json({ message: "User not found for update." });
        }
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        res.status(500).json({ error: "Internal server error updating user." });
    }
});

router.delete('/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const sucesso = await usuarioService.deleteUser(id_usuario);
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "User not found for deletion." });
        }
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        res.status(500).json({ error: "Internal server error deleting user." });
    }
});

module.exports = router;