// src/recorrencias/recorrencia.service.js
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Recorrencia = require('./recorrencia.model');
const Usuario = require('../usuarios/usuario.model');
const AlertaPagamento = require('../alertas-pagamento/alerta-pagamento.model');
const alertaPagamentoService = require('../alertas-pagamento/alerta-pagamento.service');
const { nanoid } = require('nanoid');

function _calcularProximaDataOcorrencia(recorrencia, aPartirDe) {
    const { frequencia, intervalo = 1, dia_mes, dia_semana, data_inicio } = recorrencia;
    let proximaData = new Date(aPartirDe);
    proximaData.setHours(12, 0, 0, 0);

    const dtInicio = new Date(data_inicio);
    dtInicio.setHours(12, 0, 0, 0);

    proximaData.setDate(proximaData.getDate() + 1);
    proximaData.setHours(12, 0, 0, 0);


    let loopSafety = 0;
    const MAX_LOOPS = 366 * (intervalo || 1) + 5;

    while (loopSafety < MAX_LOOPS) {
        loopSafety++;
        let dataCandidata = new Date(proximaData);

        switch (frequencia) {
            case 'mensal':
                if (!dia_mes) return null;
                let mesRef = dataCandidata.getMonth();
                dataCandidata.setDate(dia_mes);

                if (dataCandidata.getMonth() !== mesRef || dataCandidata < proximaData) {
                    proximaData.setMonth(proximaData.getMonth() + intervalo);
                    proximaData.setDate(1);
                    continue;
                }
                return dataCandidata;

            case 'semanal':
                const diasMap = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
                const diaAlvo = diasMap[dia_semana];
                if (diaAlvo === undefined) return null;

                while (dataCandidata.getDay() !== diaAlvo) {
                    dataCandidata.setDate(dataCandidata.getDate() + 1);
                }

                if (dataCandidata < proximaData) {
                    proximaData.setDate(proximaData.getDate() + 7 * intervalo);
                    continue;
                }
                 return dataCandidata;

            case 'diaria':
                 if(intervalo > 1) {
                    dataCandidata.setDate(proximaData.getDate() + (intervalo - 1));
                 }
                 return dataCandidata;

            case 'anual':
                 if (!data_inicio) return null;
                 let mesInicio = new Date(data_inicio).getMonth();
                 let diaInicio = new Date(data_inicio).getDate();

                 if(dataCandidata.getFullYear() < new Date(data_inicio).getFullYear()){
                    dataCandidata.setFullYear(new Date(data_inicio).getFullYear());
                 }
                 dataCandidata.setMonth(mesInicio, diaInicio);

                 let dataAlvoNesteAno = new Date(dataCandidata.getFullYear(), mesInicio, diaInicio);
                 if (dataCandidata > dataAlvoNesteAno) {
                     proximaData.setFullYear(proximaData.getFullYear() + intervalo);
                     continue;
                 }

                 while (dataCandidata < proximaData || dataCandidata < dtInicio) {
                     dataCandidata.setFullYear(dataCandidata.getFullYear() + intervalo);
                     dataCandidata.setMonth(mesInicio, diaInicio);
                 }
                 return dataCandidata;

            default:
                console.error(`Frequência desconhecida: ${frequencia}`);
                return null;
        }
    }

    console.warn(`Cálculo de próxima ocorrência atingiu limite de ${MAX_LOOPS} loops.`);
    return null;
}


async function _generateFutureAlerts(recorrencia, horizonteMeses = 12, transaction) {
    const alertasParaCriar = [];
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);

    const horizonteFim = new Date(hoje);
    horizonteFim.setMonth(hoje.getMonth() + horizonteMeses);
    horizonteFim.setHours(12, 0, 0, 0);

    const dataFimRec = recorrencia.data_fim_recorrencia ? new Date(recorrencia.data_fim_recorrencia) : null;
    if (dataFimRec) dataFimRec.setHours(12, 0, 0, 0);

    let dataCalculo = new Date(recorrencia.data_inicio);
    dataCalculo.setHours(12, 0, 0, 0);

    let iterations = 0;
    const MAX_ITERATIONS = horizonteMeses * 40;

    while (dataCalculo <= horizonteFim && (!dataFimRec || dataCalculo <= dataFimRec) && iterations < MAX_ITERATIONS) {
        iterations++;

        if (!isNaN(dataCalculo.getTime()) && dataCalculo >= new Date(recorrencia.data_inicio).setHours(12,0,0,0)) {
            const codigoUnicoAlerta = `ALT-${nanoid(7)}`;
            const dataVencimentoStr = dataCalculo.toISOString().split('T')[0];
            alertasParaCriar.push({
                id_usuario: recorrencia.id_usuario,
                valor: recorrencia.valor,
                data_vencimento: dataVencimentoStr,
                tipo: recorrencia.tipo,
                descricao: `${recorrencia.descricao || recorrencia.nome_categoria || 'Recorrência'} (${dataCalculo.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit'})})`,
                nome_categoria: recorrencia.nome_categoria,
                id_recorrencia_pai: recorrencia.id_recorrencia,
                status: 'pendente',
                codigo_unico: codigoUnicoAlerta
            });
        } else if (isNaN(dataCalculo.getTime())) {
            console.error(`[GenerateAlerts] Data de cálculo inválida encontrada para Rec ID ${recorrencia.id_recorrencia}. Iteração ${iterations}. Parando.`);
            break;
        }

        let proximaData = _calcularProximaDataOcorrencia(recorrencia, dataCalculo);

        if (!proximaData || isNaN(proximaData.getTime()) || proximaData <= dataCalculo) {
             console.warn(`[GenerateAlerts] Não foi possível calcular a próxima data após ${dataCalculo.toISOString().split('T')[0]} para Rec ID ${recorrencia.id_recorrencia} ou data não avançou. Encerrando loop.`);
             break;
        }
        dataCalculo = proximaData;

    } // Fim while

     if (iterations >= MAX_ITERATIONS) {
         console.error(`[GenerateAlerts] Limite de ${MAX_ITERATIONS} iterações atingido para Rec ID ${recorrencia.id_recorrencia}. Verifique a lógica de cálculo/avanço de data.`);
     }

    if (alertasParaCriar.length > 0) {
        console.log(`[GenerateAlerts] Tentando criar ${alertasParaCriar.length} alertas futuros para Rec ID ${recorrencia.id_recorrencia}`);
        try {
            await AlertaPagamento.bulkCreate(alertasParaCriar, {
                transaction: transaction,
                validate: false
            });
            console.log(`[GenerateAlerts] ${alertasParaCriar.length} alertas criados com sucesso para Rec ID ${recorrencia.id_recorrencia}.`);
        } catch (bulkError) {
             console.error(`[GenerateAlerts] Erro durante bulkCreate para Rec ID ${recorrencia.id_recorrencia}:`, bulkError);
             throw bulkError;
        }
    } else {
         console.log(`[GenerateAlerts] Nenhum alerta futuro a ser gerado no horizonte para Rec ID ${recorrencia.id_recorrencia}.`);
    }
}


const createRecurrence = async (id_usuario, tipo, valor, nome_categoria, origem, data_inicio, frequencia, dia_mes, dia_semana, intervalo = 1, data_fim_recorrencia, descricao) => {
    const t = await sequelize.transaction();

    try {
        console.log(`[INFO] Iniciando criação de recorrência para usuário ${id_usuario} - Desc: ${descricao || nome_categoria}`);
        const recorrencia = await Recorrencia.create({
            id_usuario, tipo, valor, nome_categoria, origem, data_inicio, frequencia,
            dia_mes, dia_semana, intervalo: intervalo || 1, data_fim_recorrencia, descricao
        }, { transaction: t });

        console.log(`[INFO] Recorrência ${recorrencia.id_recorrencia} criada. Gerando alertas futuros...`);
        const horizonteGeracaoMeses = 24;
        await _generateFutureAlerts(recorrencia, horizonteGeracaoMeses, t);

        await t.commit();
        console.log(`[SUCCESS] Recorrência ${recorrencia.id_recorrencia} e alertas futuros criados com sucesso.`);
        return recorrencia;

    } catch (error) {
        console.error(`[ROLLBACK] Erro ao criar recorrência ou seus alertas para usuário ${id_usuario}:`, error);
        await t.rollback();
        const errorMessage = error.original?.detail || error.original?.message || error.message || 'Erro desconhecido ao criar recorrência.';
        throw new Error(`Erro ao criar recorrência: ${errorMessage}`);
    }
};


const getRecurrenceById = async (id_recorrencia, id_usuario) => {
    try {
        const recorrencia = await Recorrencia.findOne({
             where: {
                 id_recorrencia: id_recorrencia,
                 id_usuario: id_usuario
                }
         });
        return recorrencia;
    } catch (error) {
        console.error(`Erro ao obter recorrência ${id_recorrencia} para usuário ${id_usuario}:`, error);
        throw error;
    }
};


const listRecurrences = async (id_usuario) => {
    try {
        const recorrencias = await Recorrencia.findAll({
            where: { id_usuario },
            order: [['data_inicio', 'DESC']]
        });
        return recorrencias;
    } catch (error) {
        console.error(`Erro ao listar recorrências para usuário ${id_usuario}:`, error);
        throw error;
    }
};


const updateRecurrence = async (id_recorrencia, id_usuario, updates) => {
     const t = await sequelize.transaction();
     try {
         console.log(`[INFO] Iniciando atualização da recorrência ${id_recorrencia} para usuário ${id_usuario}`);
         const recorrencia = await Recorrencia.findOne({
              where: { id_recorrencia: id_recorrencia, id_usuario: id_usuario },
              transaction: t,
              lock: t.LOCK.UPDATE
          });

         if (!recorrencia) {
             await t.rollback();
             console.log(`[INFO] Recorrência ${id_recorrencia} não encontrada ou não pertence ao usuário ${id_usuario}.`);
             return null;
         }

         const oldData = recorrencia.get({ plain: true });
         const cleanUpdates = { ...updates };
         delete cleanUpdates.id_usuario;
         delete cleanUpdates.id_recorrencia;
         delete cleanUpdates.id_categoria;

         await recorrencia.update(cleanUpdates, { transaction: t });
         console.log(`[INFO] Recorrência ${id_recorrencia} atualizada no banco.`);

         const criticalFields = ['data_inicio', 'frequencia', 'intervalo', 'dia_mes', 'dia_semana', 'data_fim_recorrencia', 'valor', 'tipo'];
         const criticalFieldsChanged = criticalFields
             .some(field => {
                 const newValue = cleanUpdates[field];
                 const oldValue = oldData[field];
                 if (newValue === undefined) return false;
                 if (field === 'data_inicio' || field === 'data_fim_recorrencia') {
                      const oldDateStr = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
                      const newDateStr = newValue ? new Date(newValue).toISOString().split('T')[0] : null;
                      return oldDateStr !== newDateStr;
                 }
                 return String(newValue) !== String(oldValue);
             });

         if (criticalFieldsChanged) {
             console.log(`[INFO] Recorrência ${id_recorrencia} atualizada com campos críticos. Regerando alertas futuros.`);
             await alertaPagamentoService.deletePendingAlertsByRecurrence(id_recorrencia, id_usuario, { transaction: t });
             const horizonteGeracaoMeses = 24;
             await _generateFutureAlerts(recorrencia, horizonteGeracaoMeses, t);
         } else {
              console.log(`[INFO] Recorrência ${id_recorrencia} atualizada sem campos críticos alterados. Alertas futuros mantidos.`);
         }

         await t.commit();
         return recorrencia;

     } catch (error) {
         await t.rollback();
         console.error(`Erro ao atualizar recorrência ${id_recorrencia}:`, error);
         const detail = error.original?.detail || error.message;
         throw new Error(`Erro ao atualizar recorrência: ${detail}`);
     }
 };


const deleteRecurrence = async (id_recorrencia, id_usuario) => {
    const t = await sequelize.transaction();
    try {
        const recorrencia = await Recorrencia.findOne({
            where: { id_recorrencia: id_recorrencia, id_usuario: id_usuario},
            transaction: t
        });

        if (!recorrencia) {
            await t.rollback();
            console.warn(`Tentativa de deletar recorrência inexistente ou não autorizada: ID ${id_recorrencia}, Usuário ${id_usuario}`);
            return false;
        }

        await alertaPagamentoService.deletePendingAlertsByRecurrence(
            id_recorrencia,
            id_usuario,
            { transaction: t }
        );

        const recorrenciaDeletadaCount = await Recorrencia.destroy({
            where: { id_recorrencia: id_recorrencia },
            transaction: t
        });

        await t.commit();
        console.log(`[INFO] Recorrência ${id_recorrencia} e seus alertas pendentes deletados com sucesso.`);
        return recorrenciaDeletadaCount > 0;

    } catch (error) {
        await t.rollback();
        console.error(`Erro ao deletar recorrência ${id_recorrencia} e seus alertas:`, error);
        throw new Error(`Erro interno ao deletar recorrência ${id_recorrencia}.`);
    }
};


module.exports = {
    createRecurrence,
    getRecurrenceById,
    listRecurrences,
    updateRecurrence,
    deleteRecurrence
};