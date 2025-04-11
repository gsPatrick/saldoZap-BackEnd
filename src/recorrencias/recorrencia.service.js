// src/recorrencias/recorrencia.service.js
const Recorrencia = require('./recorrencia.model');
const Usuario = require('../usuarios/usuario.model'); // Para includes, se necessário
const alertaPagamentoService = require('../alertas-pagamento/alerta-pagamento.service'); // <<< IMPORTAR AlertaPagamentoService

/**
 * Cria uma nova recorrência.
 * @param {number} id_usuario - ID do usuário proprietário.
 * @param {'despesa'|'receita'} tipo - Tipo da recorrência.
 * @param {number} valor - Valor de cada ocorrência.
 * @param {string} [nome_categoria] - Nome da categoria associada.
 * @param {string} [origem] - Origem (para receitas).
 * @param {string} data_inicio - Data de início da recorrência (YYYY-MM-DD).
 * @param {'diaria'|'semanal'|'mensal'|'anual'} frequencia - Frequência da recorrência.
 * @param {number} [dia_mes] - Dia do mês (para frequência mensal).
 * @param {'segunda'|'terca'|'quarta'|'quinta'|'sexta'|'sabado'|'domingo'} [dia_semana] - Dia da semana (para frequência semanal).
 * @param {number} [intervalo=1] - Intervalo entre ocorrências (ex: a cada 2 meses).
 * @param {string} [data_fim_recorrencia] - Data final da recorrência (YYYY-MM-DD, opcional).
 * @param {string} [descricao] - Descrição da recorrência.
 * @returns {Promise<Recorrencia>} A recorrência criada.
 */
const createRecurrence = async (id_usuario, tipo, valor, nome_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo = 1, data_fim_recorrencia, descricao) => {
    try {
        const recorrencia = await Recorrencia.create({
            id_usuario,
            tipo,
            valor,
            nome_categoria, // Campo já existe no modelo Recorrencia
            origem,
            data_inicio,
            frequencia,
            dia_mes,
            dia_semana,
            intervalo: intervalo || 1, // Garante default 1 se nulo/undefined
            data_fim_recorrencia,
            descricao
        });
        // IMPORTANTE: Após criar a recorrência, o N8N (ou um hook 'afterCreate' aqui)
        // precisaria ser acionado para gerar os AlertaPagamento futuros.
        // A criação direta aqui dentro tornaria a resposta da API lenta.
        return recorrencia;
    } catch (error) {
        console.error("Erro ao criar recorrência:", error);
        throw error; // Re-lança para a rota tratar
    }
};

/**
 * Busca uma recorrência pelo seu ID (PK).
 * @param {number} id_recorrencia - ID da recorrência.
 * @param {number} id_usuario - ID do usuário (para validação de permissão).
 * @returns {Promise<Recorrencia|null>} A recorrência encontrada ou null.
 */
const getRecurrenceById = async (id_recorrencia, id_usuario) => {
    try {
        const recorrencia = await Recorrencia.findOne({
             where: {
                 id_recorrencia: id_recorrencia,
                 id_usuario: id_usuario // Filtra pelo usuário
                },
             include: [ // Include opcional para trazer dados relacionados
                 // { model: Usuario, as: 'usuario' },
                 // { model: AlertaPagamento, as: 'alertasGerados', where: { status: 'pendente'}, required: false } // Ex: buscar alertas pendentes
             ]
         });
        return recorrencia;
    } catch (error) {
        console.error("Erro ao obter recorrência por ID:", error);
        throw error;
    }
};

/**
 * Lista todas as recorrências de um usuário.
 * @param {number} id_usuario - ID do usuário.
 * @returns {Promise<Recorrencia[]>} Lista de recorrências.
 */
const listRecurrences = async (id_usuario) => {
    try {
        const recorrencias = await Recorrencia.findAll({
            where: { id_usuario },
            // include: [{ model: Usuario, as: 'usuario' }] // Opcional
             order: [['data_inicio', 'DESC']] // Ou outra ordem desejada
        });
        return recorrencias;
    } catch (error) {
        console.error("Erro ao listar recorrências:", error);
        throw error;
    }
};

/**
 * Atualiza uma recorrência existente.
 * @param {number} id_recorrencia - ID da recorrência.
 * @param {number} id_usuario - ID do usuário (para validação).
 * @param {object} updates - Campos a serem atualizados.
 * @returns {Promise<Recorrencia|null>} A recorrência atualizada ou null.
 */
const updateRecurrence = async (id_recorrencia, id_usuario, updates) => {
    try {
        const recorrencia = await Recorrencia.findOne({
             where: { id_recorrencia: id_recorrencia, id_usuario: id_usuario }
         });

        if (!recorrencia) {
            return null; // Não encontrado ou não pertence ao usuário
        }

        // Remover campos que não devem ser atualizados diretamente
        delete updates.id_usuario;
        delete updates.id_recorrencia;
        // Remover o antigo campo id_categoria se ainda estiver sendo enviado
        delete updates.id_categoria;

        await recorrencia.update(updates);

        // IMPORTANTE: Após atualizar, especialmente se datas ou frequência mudarem,
        // o N8N (ou um hook 'afterUpdate' aqui) precisaria re-gerar/ajustar
        // os AlertaPagamento futuros.
        return recorrencia;
    } catch (error) {
        console.error("Erro ao atualizar recorrência:", error);
        throw error;
    }
};

/**
 * Deleta uma recorrência e seus alertas pendentes associados.
 * @param {number} id_recorrencia - ID da recorrência a ser deletada.
 * @param {number} id_usuario - ID do usuário proprietário (para segurança).
 * @returns {Promise<boolean>} True se a recorrência foi deletada, false caso contrário.
 */
const deleteRecurrence = async (id_recorrencia, id_usuario) => {
    const t = await Recorrencia.sequelize.transaction(); // Inicia transação DB

    try {
        // 1. Encontra a recorrência para garantir que pertence ao usuário (dentro da transação)
        const recorrencia = await Recorrencia.findOne({
            where: { id_recorrencia: id_recorrencia, id_usuario: id_usuario},
            transaction: t // Bloqueia a linha
        });

        if (!recorrencia) {
            await t.rollback(); // Libera a transação
            return false; // Não encontrado ou não pertence ao usuário
        }

        // 2. Chama a função para deletar os alertas PENDENTES associados (dentro da transação)
        // Note que deletePendingAlertsByRecurrence não precisa de transação interna,
        // pois ela só faz um `destroy` que será incluído nesta transação `t`.
        const deletedAlertsCount = await alertaPagamentoService.deletePendingAlertsByRecurrence(
            id_recorrencia,
            id_usuario /*, { transaction: t } */ // Passar a transação se a função suportar
        );
        console.log(`[deleteRecurrence] ${deletedAlertsCount} alertas pendentes associados marcados para deleção.`);

        // 3. Deleta a recorrência pai (dentro da transação)
        const recorrenciaDeletadaCount = await Recorrencia.destroy({
            where: { id_recorrencia: id_recorrencia }, // ID já validado pelo findOne
            transaction: t // Garante que a deleção ocorra na transação
        });

        // 4. Confirma a transação se tudo correu bem
        await t.commit();

        // Retorna true se a recorrência foi deletada (count > 0)
        return recorrenciaDeletadaCount > 0;

    } catch (error) {
        // 5. Se qualquer erro ocorreu, desfaz tudo
        await t.rollback();
        console.error(`Erro ao deletar recorrência ${id_recorrencia}:`, error);
        // Re-lança o erro para a rota tratar como 500
        throw new Error(`Erro interno ao deletar recorrência ${id_recorrencia}.`);
    }
};


module.exports = {
    createRecurrence,
    getRecurrenceById,
    listRecurrences,
    updateRecurrence,
    deleteRecurrence // Exporta a versão modificada que inclui a limpeza de alertas
};