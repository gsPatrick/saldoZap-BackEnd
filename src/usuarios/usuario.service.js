// src/usuarios/usuario.service.js
const Usuario = require('./usuario.model');

const createUser = async (nome, telefone, email, trial_fim, assinatura_ativa) => {
    try {
        const usuario = await Usuario.create({ nome, telefone, email, trial_fim, assinatura_ativa });
        return usuario;
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        throw error;
    }
};

const getUserById = async (id_usuario) => {
    try {
        const usuario = await Usuario.findByPk(id_usuario);
        return usuario;
    } catch (error) {
        console.error("Erro ao obter usuário:", error);
        throw error;
    }
};

const updateUser = async (id_usuario, updates) => {
    try {
        const usuario = await Usuario.findByPk(id_usuario);
        if (!usuario) {
            return null;
        }
        await usuario.update(updates);
        return usuario;
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        throw error;
    }
};

const deleteUser = async (id_usuario) => {
    try {
        const usuarioDeletado = await Usuario.destroy({
            where: { id_usuario }
        });
        return usuarioDeletado > 0;
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        throw error;
    }
};

module.exports = {
    createUser,
    getUserById,
    updateUser,
    deleteUser
};