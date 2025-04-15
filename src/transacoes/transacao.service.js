// src/transacoes/transacao.service.js
const Transacao = require('./transacao.model');
const sequelize = require('../config/database');
const { Sequelize, Op } = require('sequelize'); // Importar Op se usar em listTransactions etc.
const Usuario = require('../usuarios/usuario.model');
const { nanoid } = require('nanoid');

// --- Função Helper para Gerar Código Único de Transação ---
const generateUniqueTransactionCode = async () => {
    let code;
    let existing = true;
    let safetyCount = 0;
    while (existing && safetyCount < 10) {
        safetyCount++;
        code = `TRX-${nanoid(7)}`;
        try {
             existing = await Transacao.findOne({ where: { codigo_unico: code }, paranoid: false, attributes: ['id_transacao'] });
             if(existing) console.warn(`[generateUniqueTransactionCode] Colisão detectada para ${code}. Tentando novamente (${safetyCount})...`);
        } catch (findError){
             console.error("[generateUniqueTransactionCode] Erro ao verificar existência do código:", findError);
             throw findError;
        }
    }
     if (existing) {
         throw new Error("Não foi possível gerar um código único de transação após várias tentativas.");
     }
    return code;
};
// ---------------------------------------------------------


// --- Função Helper para Calcular Data de Início ---
function calcularStartDate(periodoInput) {
    let startDate = null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (!periodoInput) {
        startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        console.warn("[API LOG] Período não fornecido para calcularStartDate, usando início do mês.");
        return startDate;
    }

    try {
        switch (periodoInput.toLowerCase()) {
            case 'mes_atual':
                startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                break;
            case 'hoje':
                startDate = hoje;
                break;
            case 'ontem':
                startDate = new Date(hoje);
                startDate.setDate(hoje.getDate() - 1);
                break;
            case 'semana_atual':
                startDate = new Date(hoje);
                const diaSemana = hoje.getDay();
                const diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
                startDate.setDate(diff);
                break;
            case 'semana_passada':
                 startDate = new Date(hoje);
                 const diaSemanaPassada = hoje.getDay();
                 const diffParaSegunda = hoje.getDate() - diaSemanaPassada + (diaSemanaPassada === 0 ? -6 : 1);
                 startDate.setDate(diffParaSegunda - 7);
                 break;
            default:
                if (/^\d{4}-\d{2}-\d{2}$/.test(periodoInput)) {
                     startDate = new Date(Date.UTC(
                        parseInt(periodoInput.substring(0, 4)),
                        parseInt(periodoInput.substring(5, 7)) - 1,
                        parseInt(periodoInput.substring(8, 10))
                    ));
                    if (isNaN(startDate.getTime())) {
                         console.warn(`[API LOG] Data inválida fornecida em calcularStartDate: ${periodoInput}. Usando início do mês.`);
                         startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                    }
                } else {
                    console.warn(`[API LOG] Período não reconhecido em calcularStartDate: ${periodoInput}. Usando início do mês.`);
                    startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                }
                break;
        }

        if (!(startDate instanceof Date && !isNaN(startDate))) {
            console.error(`[API LOG] Data Inválida calculada para período "${periodoInput}". Usando início do mês.`);
            startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        }

    } catch(dateError){
         console.error(`[API LOG] Erro em calcularStartDate para período "${periodoInput}":`, dateError, "Usando início do mês.");
         startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }
    return startDate;
}
// ---------------------------------------------------------------------------

/**
 * Cria uma nova transação.
 * O codigo_unico é gerado automaticamente.
 * @param {object} dadosTransacao - Objeto contendo os dados da transação.
 * @param {object} [options] - Opções do Sequelize (ex: { transaction: t }).
 * @returns {Promise<Transacao>} A transação criada.
 */
const createTransaction = async (dadosTransacao, options = {}) => {
    // LOG 1: Início da função e dados recebidos
    console.log("[createTransaction] Iniciando. Dados recebidos:", JSON.stringify(dadosTransacao, null, 2));
    if (options.transaction) {
        console.log(`[createTransaction] Executando dentro da transação ID: ${options.transaction.id || 'N/A'}`);
    }

    try {
        // LOG 2: Antes de gerar código único
        console.log("[createTransaction] Gerando código único...");
        const codigo_unico_gerado = await generateUniqueTransactionCode();
        // LOG 3: Após gerar código único
        console.log("[createTransaction] Código único gerado:", codigo_unico_gerado);

        // Prepara o objeto final para criação, ajustando tipos
        const dadosParaCriar = {
            // Garante que IDs sejam números inteiros
            id_usuario: parseInt(dadosTransacao.id_usuario, 10),
            id_alerta_origem: dadosTransacao.id_alerta_origem ? parseInt(dadosTransacao.id_alerta_origem, 10) : null,
            id_transacao_pai: dadosTransacao.id_transacao_pai ? parseInt(dadosTransacao.id_transacao_pai, 10) : null,
            parcela_numero: dadosTransacao.parcela_numero ? parseInt(dadosTransacao.parcela_numero, 10) : null,
            total_parcelas: dadosTransacao.total_parcelas ? parseInt(dadosTransacao.total_parcelas, 10) : null,
            id_recorrencia_origem: dadosTransacao.id_recorrencia_origem ? parseInt(dadosTransacao.id_recorrencia_origem, 10) : null,

            // Garante que valor seja número float
            valor: parseFloat(dadosTransacao.valor),

            // Mantém strings como estão (ou null se ausentes)
            tipo: dadosTransacao.tipo,
            nome_categoria: dadosTransacao.nome_categoria || null,
            data_transacao: dadosTransacao.data_transacao, // Assume que já está YYYY-MM-DD
            data_ocorrencia_recorrencia: dadosTransacao.data_ocorrencia_recorrencia || null,
            descricao: dadosTransacao.descricao || null,
            comprovante_url: dadosTransacao.comprovante_url || null,

            // Adiciona o código único gerado
            codigo_unico: codigo_unico_gerado,
        };

        // Validação extra de tipos (opcional)
        if (isNaN(dadosParaCriar.id_usuario)) throw new Error("ID de usuário inválido fornecido para createTransaction.");
        if (isNaN(dadosParaCriar.valor)) throw new Error("Valor inválido fornecido para createTransaction.");
        // Adicione outras validações de tipo se necessário

        // Remove chaves com valor explicitamente null se o banco não gostar ou para limpeza
        // (Sequelize geralmente lida bem com null, então isso pode não ser necessário)
        // Object.keys(dadosParaCriar).forEach(key => (dadosParaCriar[key] === null) && delete dadosParaCriar[key]);

        // LOG 4: Antes de chamar Transacao.create
        console.log("[createTransaction] Chamando Transacao.create com (tipos ajustados):", JSON.stringify(dadosParaCriar, null, 2));

        // Chama Transacao.create passando os dados e as opções (que podem conter a transação)
        const novaTransacao = await Transacao.create(dadosParaCriar, options);

        // LOG 5: Após chamar Transacao.create
        if (novaTransacao && novaTransacao.id_transacao) {
            console.log(`[createTransaction] Transacao.create SUCESSO. ID da Nova Transação: ${novaTransacao.id_transacao}`);
        } else {
            console.warn("[createTransaction] Transacao.create retornou um valor inesperado:", novaTransacao);
            throw new Error("Falha ao obter o objeto da transação após a criação.");
        }

        return novaTransacao; // Retorna o objeto criado

    } catch (error) {
        // LOG 6: Se ocorrer um erro em qualquer ponto do try
        console.error("[createTransaction] Erro durante a execução:", error);
         if (error.name === 'SequelizeUniqueConstraintError') {
            console.error("[createTransaction] Erro de Violação Única:", error.errors);
        } else if (error.name === 'SequelizeValidationError') {
             console.error("[createTransaction] Erro de Validação:", error.errors);
        } else if (error.original) {
            console.error("[createTransaction] Erro Original do DB:", error.original);
            console.error("[createTransaction] SQL do Erro (se disponível):", error.sql);
        }
        throw error; // Re-lança para a camada superior
    }
};

const listTransactions = async (id_usuario, filtroPeriodo = null, tipoFiltro = null, additionalFilters = {}) => {
    const userIdNum = parseInt(id_usuario, 10);
    if(isNaN(userIdNum)) {
         throw new Error("ID de usuário inválido fornecido para listTransactions.");
    }

    // Começa com o id_usuario obrigatório. Os outros filtros serão adicionados.
    const whereClause = { id_usuario: userIdNum };
    console.log("[listTransactions] Filtros iniciais (apenas id_usuario):", JSON.stringify(whereClause));

    // Processa additionalFilters (que pode conter nome_categoria)
    if(additionalFilters) {
        console.log("[listTransactions] Processando additionalFilters:", JSON.stringify(additionalFilters));
        for (const key in additionalFilters) {
             if (Object.hasOwnProperty.call(additionalFilters, key)) {
                 const value = additionalFilters[key];
                 // Adiciona à whereClause apenas se o valor não for nulo/vazio/undefined
                 if (value !== undefined && value !== null && value !== '') {

                    // <<< INÍCIO DA ALTERAÇÃO: Busca flexível por categoria/descrição >>>
                    if (key === 'nome_categoria') { // A chave ainda será 'nome_categoria' vinda da IA/expressão N8N
                        const searchTerm = `%${value}%`; // Prepara termo para busca com LIKE/ILIKE (contém)

                        // Adiciona uma condição OR para buscar o termo em nome_categoria OU descricao
                        // Verifica se já existe um Op.or para não sobrescrever outras condições OR (raro, mas seguro)
                        if (!whereClause[Op.or]) {
                            whereClause[Op.or] = [];
                        }
                        // Adiciona as condições OR específicas para categoria/descrição
                        whereClause[Op.or].push(
                             { nome_categoria: { [Op.iLike]: searchTerm } }, // Busca na categoria
                             { descricao: { [Op.iLike]: searchTerm } }      // Busca na descrição
                        );
                         console.log(`[listTransactions] Adicionado filtro ILIKE com OR para nome_categoria/descricao: ${value}`);
                    }
                    // <<< FIM DA ALTERAÇÃO >>>

                    // Adicionar outros filtros de 'additionalFilters' se houver no futuro
                    // else if (key === 'outro_filtro') {
                    //    whereClause[key] = value; // Ou com Op específico se necessário
                    // }
                 }
             }
        }
    }

    // Processa filtroPeriodo
    if (filtroPeriodo) {
        console.log("[listTransactions] Processando filtroPeriodo:", filtroPeriodo);
        // Caso 1: Objeto {startDate, endDate}
        if (typeof filtroPeriodo === 'object' && filtroPeriodo.startDate && filtroPeriodo.endDate) {
            if (/\d{4}-\d{2}-\d{2}/.test(filtroPeriodo.startDate) && /\d{4}-\d{2}-\d{2}/.test(filtroPeriodo.endDate)) {
                // Use datas locais para comparação correta com DATEONLY
                const startDate = filtroPeriodo.startDate;
                const endDate = filtroPeriodo.endDate;
                // Sequelize lida corretamente com YYYY-MM-DD para DATEONLY
                whereClause.data_transacao = { [Op.between]: [startDate, endDate] };
                console.log("[listTransactions] Filtro de data (between objeto) aplicado:", startDate, "até", endDate);
             } else {console.warn(`[listTransactions] Formato de data inválido no objeto periodo: ${JSON.stringify(filtroPeriodo)}`);}
        }
        // Caso 2: String normalizada
        else if (typeof filtroPeriodo === 'string') {
            const startDateCalculada = calcularStartDate(filtroPeriodo); // Assume que retorna Date ou null
            if (startDateCalculada instanceof Date && !isNaN(startDateCalculada)) {
                // Converte para string YYYY-MM-DD para consistência com a API
                 const startDateStr = startDateCalculada.toISOString().split('T')[0];
                 let endDateStr = null; // Calcular endDate apenas quando necessário

                 // Lógica para definir o intervalo de data baseado na string
                 if (['hoje', 'ontem'].includes(filtroPeriodo.toLowerCase())) {
                      endDateStr = startDateStr; // Para 'hoje' ou 'ontem', o intervalo é de um dia
                      whereClause.data_transacao = { [Op.eq]: startDateStr }; // Usa Op.eq para um único dia
                      console.log(`[listTransactions] Filtro de data (eq string ${filtroPeriodo}) aplicado: ${startDateStr}`);
                 } else if (filtroPeriodo.toLowerCase() === 'semana_passada' || filtroPeriodo.toLowerCase() === 'semana_atual') {
                      const diaSemana = startDateCalculada.getDay(); // 0 = Domingo, 1 = Segunda...
                      const diffParaDomingo = 6 - diaSemana + (diaSemana === 0 ? 0 : 1); // Correção para domingo ser fim
                      const endDateCalculada = new Date(startDateCalculada);
                      endDateCalculada.setDate(startDateCalculada.getDate() + diffParaDomingo);
                      endDateStr = endDateCalculada.toISOString().split('T')[0];
                      whereClause.data_transacao = { [Op.between]: [startDateStr, endDateStr] };
                      console.log(`[listTransactions] Filtro de data (between string ${filtroPeriodo}) aplicado: ${startDateStr} até ${endDateStr}`);
                 } else if (filtroPeriodo.toLowerCase() === 'mes_passado' || filtroPeriodo.toLowerCase() === 'mes_atual' || filtroPeriodo.toLowerCase() === 'mes_proximo') {
                      const ultimoDiaMes = new Date(startDateCalculada.getFullYear(), startDateCalculada.getMonth() + 1, 0);
                      endDateStr = ultimoDiaMes.toISOString().split('T')[0];
                      whereClause.data_transacao = { [Op.between]: [startDateStr, endDateStr] };
                      console.log(`[listTransactions] Filtro de data (between string ${filtroPeriodo}) aplicado: ${startDateStr} até ${endDateStr}`);
                 } else if (filtroPeriodo.toLowerCase() === 'ano_passado' || filtroPeriodo.toLowerCase() === 'ano_atual') {
                      const ultimoDiaAno = new Date(startDateCalculada.getFullYear(), 11, 31);
                      endDateStr = ultimoDiaAno.toISOString().split('T')[0];
                      whereClause.data_transacao = { [Op.between]: [startDateStr, endDateStr] };
                       console.log(`[listTransactions] Filtro de data (between string ${filtroPeriodo}) aplicado: ${startDateStr} até ${endDateStr}`);
                 }
                 // Para outros ('ultimos_x_dias') ou default, usa Op.gte
                 // (Pode precisar ajustar endDate se quiser *exatamente* os últimos X dias)
                 else {
                     whereClause.data_transacao = { [Op.gte]: startDateStr };
                     console.log(`[listTransactions] Filtro de data (gte string ${filtroPeriodo}) aplicado: a partir de ${startDateStr}`);
                 }
            } else { console.warn(`[listTransactions] Não foi possível calcular data válida para o período string: ${filtroPeriodo}`); }
        } else { console.warn(`[listTransactions] Tipo de filtroPeriodo inesperado: ${typeof filtroPeriodo}`); }
    } else { console.log("[listTransactions] Nenhum filtro de período fornecido."); }

    // Adiciona filtro de tipo
    if (tipoFiltro && ['receita', 'despesa'].includes(tipoFiltro)) {
        whereClause.tipo = tipoFiltro;
        console.log(`[listTransactions] Filtro de tipo aplicado: ${tipoFiltro}`);
    } else if (tipoFiltro){ // Log se tipo for inválido
        console.warn(`[listTransactions] Filtro de tipo inválido ('${tipoFiltro}') ignorado.`);
    } else {
         console.log(`[listTransactions] Nenhum filtro de tipo aplicado.`);
    }

    // Log final da cláusula WHERE
    const replacer = (key, value) => typeof value === 'symbol' ? value.toString() : value;
    console.log("[listTransactions] Where clause final para findAll:", JSON.stringify(whereClause, replacer, 2));

    try {
        const transacoes = await Transacao.findAll({
            where: whereClause,
            order: [['data_transacao', 'DESC'], ['id_transacao', 'DESC']]
        });
        console.log(`[listTransactions] Consulta retornou ${transacoes.length} transações.`);
        return transacoes;

    } catch (error) {
        console.error("Erro Sequelize em listTransactions:", error);
        if (error.parent?.sql) { console.error("SQL Gerado (aproximado):", error.parent.sql); }
        else if (error.sql) { console.error("SQL Gerado:", error.sql); }
        throw error; // Re-lança o erro
    }
};



const getTransactionById = async (id_transacao) => {
    try {
        const transacao = await Transacao.findByPk(id_transacao);
        return transacao;
    } catch (error) {
        console.error(`Erro ao obter transação por ID ${id_transacao}:`, error);
        throw error;
    }
};

const updateTransaction = async (id_transacao, updates) => {
    try {
        const transacao = await Transacao.findByPk(id_transacao);
        if (!transacao) {
            return null;
        }

        // Limpa updates
        delete updates.id_usuario;
        delete updates.id_transacao;
        delete updates.codigo_unico;
        delete updates.id_alerta_origem;
        delete updates.id_recorrencia_origem;

        // Converte valor para float se presente
        if (updates.valor !== undefined) {
            updates.valor = parseFloat(updates.valor);
             if (isNaN(updates.valor)) {
                 throw new Error("Valor inválido fornecido para atualização da transação.");
             }
        }

        await transacao.update(updates);
        return transacao;
    } catch (error) {
        console.error(`Erro ao atualizar transação ${id_transacao}:`, error);
        throw error;
    }
};

const deleteTransaction = async (id_transacao) => {
    try {
        const transacaoDeletadaCount = await Transacao.destroy({
            where: { id_transacao }
        });
        return transacaoDeletadaCount > 0;
    } catch (error) {
        console.error(`Erro ao excluir transação por ID ${id_transacao}:`, error);
        throw error;
    }
};

const deleteTransactionByCode = async (codigo_unico, id_usuario) => {
     // Garante que id_usuario seja número
     const userIdNum = parseInt(id_usuario, 10);
     if(isNaN(userIdNum)) {
         throw new Error("ID de usuário inválido fornecido para deleteTransactionByCode.");
     }
    try {
        const transacaoDeletadaCount = await Transacao.destroy({
            where: {
                codigo_unico: codigo_unico,
                id_usuario: userIdNum
            }
        });
        return transacaoDeletadaCount > 0;
    } catch (error) {
        console.error(`Erro ao excluir transação por código ${codigo_unico} para usuário ${id_usuario}:`, error);
        throw error;
    }
};

const getCurrentBalance = async (id_usuario) => {
    const userIdNum = parseInt(id_usuario, 10);
     if(isNaN(userIdNum)) {
         throw new Error("ID de usuário inválido fornecido para getCurrentBalance.");
     }
    try {
        const receitas = await Transacao.sum('valor', { where: { id_usuario: userIdNum, tipo: 'receita' } });
        const despesas = await Transacao.sum('valor', { where: { id_usuario: userIdNum, tipo: 'despesa' } });

        const totalReceitas = receitas || 0;
        const totalDespesas = despesas || 0;

        const balance = parseFloat(totalReceitas) - parseFloat(totalDespesas);
        return parseFloat(balance.toFixed(2));

    } catch (error) {
        console.error(`Erro ao obter saldo atual para usuário ${id_usuario}:`, error);
        throw error;
    }
};

const getMonthlySummary = async (id_usuario, year, month) => {
     const userIdNum = parseInt(id_usuario, 10);
     const yearNum = parseInt(year, 10);
     const monthNum = parseInt(month, 10); // 1-12

     if(isNaN(userIdNum) || isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
          throw new Error("Parâmetros inválidos para getMonthlySummary.");
     }

    try {
        const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1));
        const endDate = new Date(Date.UTC(yearNum, monthNum, 1));
        endDate.setUTCMilliseconds(-1);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: {
                    [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
                }
            },
            attributes: ['tipo', 'valor', 'nome_categoria']
        });

        let summary = { totalIncome: 0, totalExpenses: 0, categorySummary: {} };

        transacoes.forEach(transacao => {
            const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') {
                summary.totalIncome += valorNum;
            } else {
                summary.totalExpenses += valorNum;
                const categoryName = transacao.nome_categoria || 'Sem Categoria';
                summary.categorySummary[categoryName] = (summary.categorySummary[categoryName] || 0) + valorNum;
            }
        });

        summary.totalIncome = parseFloat(summary.totalIncome.toFixed(2));
        summary.totalExpenses = parseFloat(summary.totalExpenses.toFixed(2));
        for (const category in summary.categorySummary) {
            summary.categorySummary[category] = parseFloat(summary.categorySummary[category].toFixed(2));
        }
        return summary;
    } catch (error) {
        console.error(`Erro ao obter resumo mensal para ${id_usuario}/${year}-${month}:`, error);
        throw error;
    }
};

const getDailySummary = async (id_usuario, year, month, day) => {
     const userIdNum = parseInt(id_usuario, 10);
     // Add validation for year, month, day
      if(isNaN(userIdNum) /*... add other checks ...*/) {
           throw new Error("Parâmetros inválidos para getDailySummary.");
      }
    try {
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: {
                    [Op.between]: [startOfDay.toISOString().split('T')[0], endOfDay.toISOString().split('T')[0]]
                }
            },
            order: [['id_transacao', 'ASC']]
        });

        let dailySummary = { totalIncome: 0, totalExpenses: 0, transactions: transacoes };

        transacoes.forEach(transacao => {
            const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') { dailySummary.totalIncome += valorNum; } else { dailySummary.totalExpenses += valorNum; }
        });

        dailySummary.totalIncome = parseFloat(dailySummary.totalIncome.toFixed(2));
        dailySummary.totalExpenses = parseFloat(dailySummary.totalExpenses.toFixed(2));
        return dailySummary;

    } catch (error) {
        console.error(`Erro ao obter resumo diário para ${id_usuario}/${year}-${month}-${day}:`, error);
        throw error;
    }
};

const getWeeklySummary = async (id_usuario, year, week) => {
     const userIdNum = parseInt(id_usuario, 10);
     // Add validation for year, week
      if(isNaN(userIdNum) /*... add other checks ...*/) {
           throw new Error("Parâmetros inválidos para getWeeklySummary.");
      }
    try {
        const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
        const dateInWeek = new Date(firstDayOfYear.getTime());
        dateInWeek.setUTCDate(firstDayOfYear.getUTCDate() + (week - 1) * 7);
        const dayOfWeek = dateInWeek.getUTCDay();
        const diffToMonday = dateInWeek.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const startDate = new Date(dateInWeek.setUTCDate(diffToMonday));
        startDate.setUTCHours(0,0,0,0);

        const endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 6);
        endDate.setUTCHours(23, 59, 59, 999);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: {
                    [Op.between]: [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
                }
            },
             attributes: ['tipo', 'valor']
        });

        let weeklySummary = { totalIncome: 0, totalExpenses: 0, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] };

        transacoes.forEach(transacao => {
             const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') { weeklySummary.totalIncome += valorNum; } else { weeklySummary.totalExpenses += valorNum; }
        });

        weeklySummary.totalIncome = parseFloat(weeklySummary.totalIncome.toFixed(2));
        weeklySummary.totalExpenses = parseFloat(weeklySummary.totalExpenses.toFixed(2));
        return weeklySummary;

    } catch (error) {
        console.error(`Erro ao obter resumo semanal para ${id_usuario}/Y${year}-W${week}:`, error);
        throw error;
    }
};

const getSpendingByCategory = async (id_usuario, startDate, endDate) => {
     const userIdNum = parseInt(id_usuario, 10);
      if(isNaN(userIdNum) || !(startDate instanceof Date) || !(endDate instanceof Date)) {
           throw new Error("Parâmetros inválidos para getSpendingByCategory.");
      }
    try {
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999);

        const results = await Transacao.findAll({
            attributes: [
                [sequelize.fn('COALESCE', sequelize.col('nome_categoria'), 'Sem Categoria'), 'categoria'],
                [sequelize.fn('SUM', sequelize.col('valor')), 'total']
            ],
            where: {
                id_usuario: userIdNum,
                tipo: 'despesa',
                data_transacao: {
                    [Op.between]: [startDate.toISOString().split('T')[0], endOfDayEndDate.toISOString().split('T')[0]]
                }
            },
            group: [sequelize.literal('categoria')], // Agrupa pelo alias 'categoria'
            order: [[sequelize.literal('total'), 'DESC']], // Ordena pelo alias 'total'
            raw: true
        });

        const formattedSpending = results.map(item => ({
             nome: item.categoria,
             total: parseFloat(parseFloat(item.total).toFixed(2))
        }));
        return formattedSpending;

    } catch (error) {
        console.error(`Erro ao obter gastos por categoria para usuário ${id_usuario}:`, error);
        throw error;
    }
};

const getTransactionStatement = async (id_usuario, startDate, endDate) => {
     const userIdNum = parseInt(id_usuario, 10);
      if(isNaN(userIdNum) || !(startDate instanceof Date) || !(endDate instanceof Date)) {
           throw new Error("Parâmetros inválidos para getTransactionStatement.");
      }
    try {
        const endOfDayEndDate = new Date(endDate);
        endOfDayEndDate.setHours(23, 59, 59, 999);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: {
                    [Op.between]: [startDate.toISOString().split('T')[0], endOfDayEndDate.toISOString().split('T')[0]]
                }
            },
            order: [['data_transacao', 'ASC'], ['id_transacao', 'ASC']]
        });
        return transacoes;

    } catch (error) {
        console.error(`Erro ao obter extrato de transações para usuário ${id_usuario}:`, error);
        throw error;
    }
};


module.exports = {
    createTransaction,
    // generateUniqueTransactionCode, // Não exportar helper interno
    listTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
    deleteTransactionByCode,
    getCurrentBalance,
    getMonthlySummary,
    getDailySummary,
    getWeeklySummary,
    getSpendingByCategory,
    getTransactionStatement
};