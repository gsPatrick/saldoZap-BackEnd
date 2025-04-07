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