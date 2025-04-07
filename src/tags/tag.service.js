// src/tags/tag.service.js
const Tag = require('./tag.model');

const createTag = async (nome_tag) => {
    try {
        const tag = await Tag.create({ nome_tag });
        return tag;
    } catch (error) {
        console.error("Erro ao criar tag:", error);
        throw error;
    }
};

const getTagById = async (id_tag) => {
    try {
        const tag = await Tag.findByPk(id_tag);
        return tag;
    } catch (error) {
        console.error("Erro ao obter tag:", error);
        throw error;
    }
};

const listTags = async () => {
    try {
        const tags = await Tag.findAll();
        return tags;
    } catch (error) {
        console.error("Erro ao listar tags:", error);
        throw error;
    }
};

const updateTag = async (id_tag, updates) => {
    try {
        const tag = await Tag.findByPk(id_tag);
        if (!tag) {
            return null;
        }
        await tag.update(updates);
        return tag;
    } catch (error) {
        console.error("Erro ao atualizar tag:", error);
        throw error;
    }
};

const deleteTag = async (id_tag) => {
    try {
        const tagDeletada = await Tag.destroy({
            where: { id_tag }
        });
        return tagDeletada > 0;
    } catch (error) {
        console.error("Erro ao deletar tag:", error);
        throw error;
    }
};


module.exports = {
    createTag,
    getTagById,
    listTags,
    updateTag,
    deleteTag
};