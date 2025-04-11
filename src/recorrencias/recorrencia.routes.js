// src/recorrencias/recorrencia.routes.js
const express = require('express');
const recorrenciaService = require('./recorrencia.service');

const router = express.Router();

// Rota POST modificada: id_categoria -> nome_categoria
router.post('/', async (req, res) => {
    // Destructuring modificado
    const { id_usuario, tipo, valor, nome_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo, data_fim_recorrencia, descricao } = req.body;

    // Validação básica
    if (!id_usuario || !tipo || !valor || !data_inicio || !frequencia) {
         return res.status(400).json({ error: "Missing required fields for recurrence." });
    }

    try {
        // Chamada de serviço modificada
        const recorrencia = await recorrenciaService.createRecurrence(
            id_usuario, tipo, valor, nome_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo, data_fim_recorrencia, descricao
        );
        res.status(201).json(recorrencia);
    } catch (error) {
        console.error("Erro na rota POST /recorrencias:", error);
        res.status(500).json({ error: "Internal server error creating recurrence." });
    }
});

router.get('/:id_recorrencia', async (req, res) => {
    const { id_recorrencia } = req.params;
     if (isNaN(parseInt(id_recorrencia))) return res.status(400).json({ error: "Invalid recurrence ID format." });

    try {
        const recorrencia = await recorrenciaService.getRecurrenceById(parseInt(id_recorrencia));
        if (recorrencia) {
            res.json(recorrencia);
        } else {
            res.status(404).json({ message: "Recurrence not found." });
        }
    } catch (error) {
        console.error(`Erro na rota GET /recorrencias/${id_recorrencia}:`, error);
        res.status(500).json({ error: "Internal server error getting recurrence." });
    }
});

router.get('/', async (req, res) => {
    const { id_usuario } = req.query;
     if (!id_usuario || isNaN(parseInt(id_usuario))) return res.status(400).json({ error: "User ID (id_usuario) is required." });

    try {
        const recorrencias = await recorrenciaService.listRecurrences(parseInt(id_usuario));
        res.json(recorrencias);
    } catch (error) {
        console.error("Erro na rota GET /recorrencias:", error);
        res.status(500).json({ error: "Internal server error listing recurrences." });
    }
});

router.delete('/:id_recorrencia', async (req, res) => {
    const { id_recorrencia } = req.params;
    const id_usuario = req.user?.id_usuario; // <<< Obtenha o ID do usuário

    if (isNaN(parseInt(id_recorrencia))) return res.status(400).json({ error: "Invalid recurrence ID format." });
    if (!id_usuario) {
        return res.status(401).json({ error: "User authentication required." });
    }

    try {
        // Passa o id_usuario para o service
        const sucesso = await recorrenciaService.deleteRecurrence(parseInt(id_recorrencia), id_usuario);
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Recurrence not found for deletion or does not belong to user." });
        }
    } catch (error) {
        console.error(`Erro na rota DELETE /recorrencias/${id_recorrencia}:`, error);
        res.status(500).json({ error: "Internal server error deleting recurrence." });
    }
});

// Rota PUT modificada para não aceitar id_categoria
router.put('/:id_recorrencia', async (req, res) => {
    const { id_recorrencia } = req.params;
    const updates = req.body;
     if (isNaN(parseInt(id_recorrencia))) return res.status(400).json({ error: "Invalid recurrence ID format." });

    // Remover campos não atualizáveis e o antigo id_categoria
    delete updates.id_usuario;
    delete updates.id_recorrencia;
    delete updates.id_categoria; // Garante que não seja enviado

    try {
        const recorrenciaAtualizada = await recorrenciaService.updateRecurrence(parseInt(id_recorrencia), updates);
        if (recorrenciaAtualizada) {
            res.json(recorrenciaAtualizada);
        } else {
            res.status(404).json({ message: "Recurrence not found for update." });
        }
    } catch (error) {
        console.error(`Erro na rota PUT /recorrencias/${id_recorrencia}:`, error);
        res.status(500).json({ error: "Internal server error updating recurrence." });
    }
});

router.delete('/:id_recorrencia', async (req, res) => {
    const { id_recorrencia } = req.params;
     if (isNaN(parseInt(id_recorrencia))) return res.status(400).json({ error: "Invalid recurrence ID format." });

    try {
        const sucesso = await recorrenciaService.deleteRecurrence(parseInt(id_recorrencia));
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Recurrence not found for deletion." });
        }
    } catch (error) {
        console.error(`Erro na rota DELETE /recorrencias/${id_recorrencia}:`, error);
        res.status(500).json({ error: "Internal server error deleting recurrence." });
    }
});

module.exports = router;