// src/recorrencias/recorrencia.routes.js
const express = require('express');
const recorrenciaService = require('./recorrencia.service');

const router = express.Router();

router.post('/', async (req, res) => {
    const { id_usuario, tipo, valor, id_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo, data_fim_recorrencia, descricao } = req.body;

    try {
        const recorrencia = await recorrenciaService.createRecurrence(id_usuario, tipo, valor, id_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo, data_fim_recorrencia, descricao);
        res.status(201).json(recorrencia);
    } catch (error) {
        console.error("Erro ao criar recorrência:", error);
        res.status(500).json({ error: "Internal server error creating recurrence." });
    }
});

router.get('/:id_recorrencia', async (req, res) => {
    const { id_recorrencia } = req.params;

    try {
        const recorrencia = await recorrenciaService.getRecurrenceById(id_recorrencia);
        if (recorrencia) {
            res.json(recorrencia);
        } else {
            res.status(404).json({ message: "Recurrence not found." });
        }
    } catch (error) {
        console.error("Erro ao obter recorrência:", error);
        res.status(500).json({ error: "Internal server error getting recurrence." });
    }
});

router.get('/', async (req, res) => {
    const { id_usuario } = req.query;

    try {
        const recorrencias = await recorrenciaService.listRecurrences(id_usuario);
        res.json(recorrencias);
    } catch (error) {
        console.error("Erro ao listar recorrências:", error);
        res.status(500).json({ error: "Internal server error listing recurrences." });
    }
});


router.put('/:id_recorrencia', async (req, res) => {
    const { id_recorrencia } = req.params;
    const updates = req.body;

    try {
        const recorrenciaAtualizada = await recorrenciaService.updateRecurrence(id_recorrencia, updates);
        if (recorrenciaAtualizada) {
            res.json(recorrenciaAtualizada);
        } else {
            res.status(404).json({ message: "Recurrence not found for update." });
        }
    } catch (error) {
        console.error("Erro ao atualizar recorrência:", error);
        res.status(500).json({ error: "Internal server error updating recurrence." });
    }
});

router.delete('/:id_recorrencia', async (req, res) => {
    const { id_recorrencia } = req.params;

    try {
        const sucesso = await recorrenciaService.deleteRecurrence(id_recorrencia);
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Recurrence not found for deletion." });
        }
    } catch (error) {
        console.error("Erro ao deletar recorrência:", error);
        res.status(500).json({ error: "Internal server error deleting recurrence." });
    }
});


module.exports = router;