// src/categorias/categoria.service.js
const Categoria = require('./categoria.model');

const createCategory = async (nome_categoria) => {
    try {
        const categoria = await Categoria.create({ nome_categoria });
        return categoria;
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        throw error;
    }
};

const getCategoryById = async (id_categoria) => {
    try {
        const categoria = await Categoria.findByPk(id_categoria);
        return categoria;
    } catch (error) {
        console.error("Erro ao obter categoria:", error);
        throw error;
    }
};

const listCategories = async () => {
    try {
        const categorias = await Categoria.findAll();
        return categorias;
    } catch (error) {
        console.error("Erro ao listar categorias:", error);
        throw error;
    }
};

const updateCategory = async (id_categoria, updates) => {
    try {
        const categoria = await Categoria.findByPk(id_categoria);
        if (!categoria) {
            return null;
        }
        await categoria.update(updates);
        return categoria;
    } catch (error) {
        console.error("Erro ao atualizar categoria:", error);
        throw error;
    }
};

const deleteCategory = async (id_categoria) => {
    try {
        const categoriaDeletada = await Categoria.destroy({
            where: { id_categoria }
        });
        return categoriaDeletada > 0;
    } catch (error) {
        console.error("Erro ao deletar categoria:", error);
        throw error;
    }
};


module.exports = {
    createCategory,
    getCategoryById,
    listCategories,
    updateCategory,
    deleteCategory
};