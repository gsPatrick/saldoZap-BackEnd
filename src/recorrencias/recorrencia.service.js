// src/recorrencias/recorrencia.service.js
const Recorrencia = require('./recorrencia.model');
const Usuario = require('../usuarios/usuario.model'); // Para includes futuros, se necessário

// Assinatura modificada: id_categoria -> nome_categoria
const createRecurrence = async (id_usuario, tipo, valor, nome_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo, data_fim_recorrencia, descricao) => {
    try {
        // Objeto de criação modificado: id_categoria -> nome_categoria
        const recorrencia = await Recorrencia.create({
            id_usuario, tipo, valor, nome_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo, data_fim_recorrencia, descricao
        });
        return recorrencia;
    } catch (error) {
        console.error("Erro ao criar recorrência:", error);
        throw error;
    }
};

const getRecurrenceById = async (id_recorrencia) => {
    try {
        const recorrencia = await Recorrencia.findByPk(id_recorrencia, {
            include: [{ model: Usuario, as: 'usuario' }] // Exemplo
        });
        return recorrencia;
    } catch (error) {
        console.error("Erro ao obter recorrência:", error);
        throw error;
    }
};

const listRecurrences = async (id_usuario) => {
    try {
        const recorrencias = await Recorrencia.findAll({
            where: { id_usuario },
            include: [{ model: Usuario, as: 'usuario' }] // Exemplo
        });
        return recorrencias;
    } catch (error) {
        console.error("Erro ao listar recorrências:", error);
        throw error;
    }
};

const updateRecurrence = async (id_recorrencia, updates) => {
    try {
        const recorrencia = await Recorrencia.findByPk(id_recorrencia);
        if (!recorrencia) {
            return null;
        }
         // Garante que não tentem atualizar id_categoria que não existe mais
        delete updates.id_categoria;
        await recorrencia.update(updates);
        return recorrencia;
    } catch (error) {
        console.error("Erro ao atualizar recorrência:", error);
        throw error;
    }
};

const deleteRecurrence = async (id_recorrencia) => {
    try {
        const recorrenciaDeletada = await Recorrencia.destroy({
            where: { id_recorrencia }
        });
        return recorrenciaDeletada > 0; // Retorna true se 1 ou mais linhas foram deletadas
    } catch (error) {
        console.error("Erro ao deletar recorrência:", error);
        throw error;
    }
};


module.exports = {
    createRecurrence,
    getRecurrenceById,
    listRecurrences,
    updateRecurrence,
    deleteRecurrence
};