// src/auth/auth.service.js
const Usuario = require('../usuarios/usuario.model');

const registerWebsiteUser = async (telefone, email) => {
    try {
        let usuario = await Usuario.findOne({ where: { telefone } });

        if (usuario) {
            usuario.email = email;
            usuario.trial_fim = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await usuario.save();
            return usuario;
        } else {
            const novoUsuario = await Usuario.create({
                telefone,
                email,
                trial_fim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
            return novoUsuario;
        }
    } catch (error) {
        console.error("Erro ao registrar usuário via website:", error);
        throw error;
    }
};

const registerWhatsAppUser = async (telefone) => {
    try {
        let usuario = await Usuario.findOne({ where: { telefone } });

        if (usuario) {
            return usuario;
        } else {
            const novoUsuario = await Usuario.create({
                telefone,
                trial_fim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
            return novoUsuario;
        }
    } catch (error) {
        console.error("Erro ao registrar usuário via WhatsApp:", error);
        throw error;
    }
};

const associateEmailWhatsAppUser = async (telefone, email) => {
    try {
        const usuario = await Usuario.findOne({ where: { telefone } });

        if (!usuario) {
            throw new Error("Usuário não encontrado para associar email.");
        }

        if (usuario.email) {
            return usuario;
        } else {
            usuario.email = email;
            await usuario.save();
            return usuario;
        }
    } catch (error) {
        console.error("Erro ao associar email via WhatsApp:", error);
        throw error;
    }
};

module.exports = {
    registerWebsiteUser,
    registerWhatsAppUser,
    associateEmailWhatsAppUser
};