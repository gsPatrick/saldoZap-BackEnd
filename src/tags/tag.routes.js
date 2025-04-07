// src/tags/tag.routes.js
const express = require('express');
const tagService = require('./tag.service');

const router = express.Router();

router.post('/', async (req, res) => {
    const { nome_tag } = req.body;

    try {
        const tag = await tagService.createTag(nome_tag);
        res.status(201).json(tag);
    } catch (error) {
        console.error("Erro ao criar tag:", error);
        res.status(500).json({ error: "Internal server error creating tag." });
    }
});

router.get('/:id_tag', async (req, res) => {
    const { id_tag } = req.params;

    try {
        const tag = await tagService.getTagById(id_tag);
        if (tag) {
            res.json(tag);
        } else {
            res.status(404).json({ message: "Tag not found." });
        }
    } catch (error) {
        console.error("Erro ao obter tag:", error);
        res.status(500).json({ error: "Internal server error getting tag." });
    }
});

router.get('/', async (req, res) => {
    try {
        const tags = await tagService.listTags();
        res.json(tags);
    } catch (error) {
        console.error("Erro ao listar tags:", error);
        res.status(500).json({ error: "Internal server error listing tags." });
    }
});


router.put('/:id_tag', async (req, res) => {
    const { id_tag } = req.params;
    const updates = req.body;

    try {
        const tagAtualizada = await tagService.updateTag(id_tag, updates);
        if (tagAtualizada) {
            res.json(tagAtualizada);
        } else {
            res.status(404).json({ message: "Tag not found for update." });
        }
    } catch (error) {
        console.error("Erro ao atualizar tag:", error);
        res.status(500).json({ error: "Internal server error updating tag." });
    }
});

router.delete('/:id_tag', async (req, res) => {
    const { id_tag } = req.params;

    try {
        const sucesso = await tagService.deleteTag(id_tag);
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Tag not found for deletion." });
        }
    } catch (error) {
        console.error("Erro ao deletar tag:", error);
        res.status(500).json({ error: "Internal server error deleting tag." });
    }
});


module.exports = router;    