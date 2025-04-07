// src/categorias/categoria.routes.js
const express = require('express');
const categoriaService = require('./categoria.service');

const router = express.Router();

router.post('/', async (req, res) => {
    const { nome_categoria } = req.body;

    try {
        const categoria = await categoriaService.createCategory(nome_categoria);
        res.status(201).json(categoria);
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        res.status(500).json({ error: "Internal server error creating category." });
    }
});

router.get('/:id_categoria', async (req, res) => {
    const { id_categoria } = req.params;

    try {
        const categoria = await categoriaService.getCategoryById(id_categoria);
        if (categoria) {
            res.json(categoria);
        } else {
            res.status(404).json({ message: "Category not found." });
        }
    } catch (error) {
        console.error("Erro ao obter categoria:", error);
        res.status(500).json({ error: "Internal server error getting category." });
    }
});

router.get('/', async (req, res) => {
    try {
        const categorias = await categoriaService.listCategories();
        res.json(categorias);
    } catch (error) {
        console.error("Erro ao listar categorias:", error);
        res.status(500).json({ error: "Internal server error listing categories." });
    }
});


router.put('/:id_categoria', async (req, res) => {
    const { id_categoria } = req.params;
    const updates = req.body;

    try {
        const categoriaAtualizada = await categoriaService.updateCategory(id_categoria, updates);
        if (categoriaAtualizada) {
            res.json(categoriaAtualizada);
        } else {
            res.status(404).json({ message: "Category not found for update." });
        }
    } catch (error) {
        console.error("Erro ao atualizar categoria:", error);
        res.status(500).json({ error: "Internal server error updating category." });
    }
});

router.delete('/:id_categoria', async (req, res) => {
    const { id_categoria } = req.params;

    try {
        const sucesso = await categoriaService.deleteCategory(id_categoria);
        if (sucesso) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Category not found for deletion." });
        }
    } catch (error) {
        console.error("Erro ao deletar categoria:", error);
        res.status(500).json({ error: "Internal server error deleting category." });
    }
});


module.exports = router;