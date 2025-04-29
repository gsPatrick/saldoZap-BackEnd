// src/transacoes/transacao.service.js
const Transacao = require('./transacao.model');
const sequelize = require('../config/database');
const { Sequelize, Op } = require('sequelize'); // Importar Op
// const Usuario = require('../usuarios/usuario.model'); // Usuário não é usado aqui, pode remover se não usar em outra função
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
             // Adicionado options = { paranoid: false } para verificar códigos em soft-deleted também, se necessário
             existing = await Transacao.findOne({ where: { codigo_unico: code }, paranoid: false, attributes: ['id_transacao'] });
             if(existing) console.warn(`[generateUniqueTransactionCode] Colisão detectada para ${code}. Tentando novamente (${safetyCount})...`);
        } catch (findError){
             console.error("[generateUniqueTransactionCode] Erro ao verificar existência do código:", findError);
             throw findError;
        }
    }
     if (existing) {
         // Se após 10 tentativas ainda colidir (muito improvável), lançar erro
         throw new Error("Não foi possível gerar um código único de transação após várias tentativas.");
     }
    return code;
};
// ---------------------------------------------------------


// --- Função Helper para Calcular Data de Início ---
function calcularStartDate(periodoInput) {
    let startDate = null;
    // Cria a data de hoje no fuso horário local e ajusta para o início do dia
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (!periodoInput) {
        // Se nenhum período for fornecido, assume início do mês atual (no fuso local)
        startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        console.warn("[calcularStartDate] Período não fornecido, usando início do mês atual.");
        return startDate;
    }

    try {
        const lowerPeriodo = periodoInput.toLowerCase();
        switch (lowerPeriodo) {
            case 'mes_atual':
                startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                break;
            case 'mes_passado':
                 startDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                 break;
            case 'mes_proximo':
                 startDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
                 break;
            case 'ano_atual':
                 startDate = new Date(hoje.getFullYear(), 0, 1);
                 break;
            case 'ano_passado':
                 startDate = new Date(hoje.getFullYear() - 1, 0, 1);
                 break;
            case 'hoje':
                startDate = hoje; // Já configurado para início do dia
                break;
            case 'ontem':
                startDate = new Date(hoje);
                startDate.setDate(hoje.getDate() - 1);
                break;
            case 'semana_atual':
                startDate = new Date(hoje);
                const diaSemanaHoje = hoje.getDay();
                 // Ajusta para segunda-feira (dia 1). Se hoje for domingo (0), volta 6 dias.
                const diffSegunda = hoje.getDate() - diaSemanaHoje + (diaSemanaHoje === 0 ? -6 : 1);
                startDate.setDate(diffSegunda);
                startDate.setHours(0,0,0,0); // Garante o início do dia
                break;
            case 'semana_passada':
                 startDate = new Date(hoje);
                 const diaSemanaHojePassada = hoje.getDay();
                 const diffSegundaPassada = hoje.getDate() - diaSemanaHojePassada + (diaSemanaHojePassada === 0 ? -6 : 1);
                 startDate.setDate(diffSegundaPassada - 7); // Volta mais 7 dias para a semana passada
                 startDate.setHours(0,0,0,0); // Garante o início do dia
                 break;
            case 'ultimos_7_dias':
                 startDate = new Date(hoje);
                 startDate.setDate(hoje.getDate() - 6); // Hoje + 6 dias anteriores = 7 dias
                 startDate.setHours(0,0,0,0); // Garante o início do dia
                 break;
             case 'ultimos_30_dias':
                 startDate = new Date(hoje);
                 startDate.setDate(hoje.getDate() - 29); // Hoje + 29 dias anteriores = 30 dias
                 startDate.setHours(0,0,0,0); // Garante o início do dia
                 break;
            default:
                // Tenta parsear como data YYYY-MM-DD no fuso local
                if (/^\d{4}-\d{2}-\d{2}$/.test(periodoInput)) {
                     const [year, month, day] = periodoInput.split('-').map(Number);
                     // Cria a data no fuso horário local
                     startDate = new Date(year, month - 1, day);
                     if (isNaN(startDate.getTime())) {
                         console.warn(`[calcularStartDate] Data inválida fornecida: ${periodoInput}. Usando início do mês atual.`);
                         startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                     } else {
                         // Garante que seja o início do dia fornecido no fuso local
                         startDate.setHours(0, 0, 0, 0);
                     }
                } else {
                    console.warn(`[calcularStartDate] Período não reconhecido: ${periodoInput}. Usando início do mês atual.`);
                    startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                }
                break;
        }

        // Verificação final para garantir que startDate é uma data válida
        if (!(startDate instanceof Date && !isNaN(startDate.getTime()))) {
            console.error(`[calcularStartDate] Data Inválida calculada para período "${periodoInput}". Usando início do mês atual.`);
            startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        }

    } catch(dateError){
         console.error(`[calcularStartDate] Erro ao calcular data para período "${periodoInput}":`, dateError, "Usando início do mês atual.");
         startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }

    // Retorna a data de início (início do dia no fuso local)
    return startDate;
}
// ---------------------------------------------------------------------------

/**
 * Retorna o saldo atual do usuário.
 * Se o saldo for negativo, retorna 0.
 * Pode aceitar opções do Sequelize (ex: { transaction: t }) para cálculo dentro de uma transação.
 * @param {number} id_usuario - ID do usuário.
 * @param {object} [options] - Opções do Sequelize.
 * @returns {Promise<number>} O saldo atual (não negativo).
 */
const getCurrentBalance = async (id_usuario, options = {}) => {
    const userIdNum = parseInt(id_usuario, 10);
     if(isNaN(userIdNum)) {
         console.error("[getCurrentBalance] ID de usuário inválido:", id_usuario);
         // Lançar erro ou retornar um valor indicando erro
         throw new Error("ID de usuário inválido fornecido para getCurrentBalance.");
     }
    try {
        // Passa as options para as operações de SUM
        const receitas = await Transacao.sum('valor', {
            where: { id_usuario: userIdNum, tipo: 'receita' },
            ...options // Espalha as opções (incluindo 'transaction' se existir)
        });
        const despesas = await Transacao.sum('valor', {
            where: { id_usuario: userIdNum, tipo: 'despesa' },
            ...options // Espalha as opções (incluindo 'transaction' se existir)
        });

        const totalReceitas = receitas || 0;
        const totalDespesas = despesas || 0;

        let balance = parseFloat(totalReceitas) - parseFloat(totalDespesas);

        // Garante que o saldo não seja negativo
        balance = Math.max(0, balance); // Retorna o maior entre 0 e o saldo calculado

        return parseFloat(balance.toFixed(2)); // Formata para 2 casas decimais
    } catch (error) {
        console.error(`[getCurrentBalance] Erro ao obter saldo atual para usuário ${id_usuario}:`, error);
        throw error; // Re-lança para a camada superior
    }
};


/**
 * Cria uma nova transação e retorna os saldos antes e depois.
 * O codigo_unico é gerado automaticamente.
 * @param {object} dadosTransacao - Objeto contendo os dados da transação. Deve incluir nome_subcategoria (opcional).
 * @param {object} [options] - Opções do Sequelize (ex: { transaction: t }).
 * @returns {Promise<object>} Um objeto contendo a transação criada e os saldos. Ex: { transaction: Transacao, saldoAntesDaTransacao: number, saldoAposTransacao: number }.
 */
const createTransaction = async (dadosTransacao, options = {}) => {
    // LOG 1: Início da função e dados recebidos
    console.log("[createTransaction] Iniciando. Dados recebidos:", JSON.stringify(dadosTransacao, null, 2));
    if (options.transaction) {
        console.log(`[createTransaction] Executando dentro da transação ID: ${options.transaction.id || 'N/A'}`);
    }

    try {
        // --- PASSO 1: Obter o saldo ANTES da transação ---
        console.log("[createTransaction] Obtendo saldo antes da transação...");
        // Passa as options (incluindo transaction se estiver no contexto)
        const saldoAntesDaTransacao = await getCurrentBalance(dadosTransacao.id_usuario, options);
        console.log(`[createTransaction] Saldo ANTES: ${saldoAntesDaTransacao}`);

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
             // --- NOVO CAMPO ADICIONADO AQUI ---
            nome_subcategoria: dadosTransacao.nome_subcategoria || null,
            // --- FIM NOVO CAMPO ---
            data_transacao: dadosTransacao.data_transacao, // Assume que já está YYYY-MM-DD ou Date
            data_ocorrencia_recorrencia: dadosTransacao.data_ocorrencia_recorrencia || null,
            descricao: dadosTransacao.descricao || null,
            comprovante_url: dadosTransacao.comprovante_url || null,

            // Adiciona o código único gerado
            codigo_unico: codigo_unico_gerado,
        };

        // Validação extra de tipos (opcional)
        if (isNaN(dadosParaCriar.id_usuario)) throw new Error("ID de usuário inválido fornecido para createTransaction.");
        if (isNaN(dadosParaCriar.valor)) throw new Error("Valor inválido fornecido para createTransaction.");
        if (!['receita', 'despesa'].includes(dadosParaCriar.tipo)) throw new Error("Tipo de transação inválido fornecido (deve ser 'receita' ou 'despesa').");
         // Adicione outras validações de tipo/formato se necessário (ex: data_transacao)


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

        // --- PASSO 2: Obter o saldo DEPOIS da transação ---
        console.log("[createTransaction] Obtendo saldo após a transação...");
         // Passa as options (incluindo transaction se estiver no contexto)
        const saldoAposTransacao = await getCurrentBalance(dadosParaCriar.id_usuario, options);
        console.log(`[createTransaction] Saldo DEPOIS: ${saldoAposTransacao}`);

        // --- PASSO 3: Retornar a transação criada E os saldos ---
        // Use .get({ plain: true }) para obter um objeto JavaScript simples
        return {
            ...novaTransacao.get({ plain: true }), // Inclui todos os campos da nova transação, incluindo nome_subcategoria
            saldoAntesDaTransacao: saldoAntesDaTransacao,
            saldoAposTransacao: saldoAposTransacao
        };

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
         console.error("[listTransactions] ID de usuário inválido:", id_usuario);
         throw new Error("ID de usuário inválido fornecido para listTransactions.");
    }

    // Start with an array of conditions for the WHERE clause.
    // Sequelize will implicitly AND these conditions at the top level.
    const conditions = [];
    conditions.push({ id_usuario: userIdNum }); // User ID is always required
    console.log("[listTransactions] Condições iniciais (apenas id_usuario):", JSON.stringify(conditions));


    // Processa additionalFilters (que pode conter nome_categoria para busca)
    if(additionalFilters) {
        console.log("[listTransactions] Processando additionalFilters:", JSON.stringify(additionalFilters));
        for (const key in additionalFilters) {
             if (Object.hasOwnProperty.call(additionalFilters, key)) {
                 const value = additionalFilters[key];
                 // Add condition only if value is not null/empty/undefined
                 if (value !== undefined && value !== null && value !== '') {

                    // --- ALTERAÇÃO AQUI: INCLUIR nome_subcategoria NA BUSCA ---
                    // Handle category/subcategory/description filter (search in nome_categoria OR nome_subcategoria OR descricao)
                    // This key should come from the API query parameter, likely still 'nome_categoria'
                    // if the user provides a single search term that could be a category or subcategory.
                    if (key === 'nome_categoria') { // Assumimos que o filtro geral chega via 'nome_categoria' na API
                        const searchTerm = `%${value}%`;
                        // Create the OR condition object searching across category, subcategory, AND description
                        conditions.push({
                            [Op.or]: [
                                { nome_categoria: { [Op.iLike]: searchTerm } }, // Busca na categoria principal
                                { nome_subcategoria: { [Op.iLike]: searchTerm } }, // Busca na subcategoria
                                { descricao: { [Op.iLike]: searchTerm } } // Busca na descrição
                            ]
                        });
                         console.log(`[listTransactions] Adicionado objeto Op.or para nome_categoria/nome_subcategoria/descricao com termo: "${value}"`);
                    }
                    // --- FIM ALTERAÇÃO ---

                    // Add other filters from additionalFilters if needed in the future
                    // else if (key === 'outro_filtro') {
                    //    conditions.push({ [key]: value }); // Or with specific Op if necessary
                    // }
                 }
             }
        }
    }

    // Processa filtroPeriodo
    // O filtroPeriodo pode vir como string normalizada ('mes_atual') ou como objeto {startDate, endDate}
    if (filtroPeriodo) {
        console.log("[listTransactions] Processando filtroPeriodo:", filtroPeriodo);
        let dateCondition = null; // Objeto para a condição de data

        // Caso 1: Objeto {startDate, endDate} (preferencial se disponível, espera strings YYYY-MM-DD)
        if (typeof filtroPeriodo === 'object' && filtroPeriodo.startDate && filtroPeriodo.endDate) {
            // Validar formato das datas no objeto
            if (/^\d{4}-\d{2}-\d{2}$/.test(filtroPeriodo.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(filtroPeriodo.endDate)) {
                const startDate = filtroPeriodo.startDate;
                const endDate = filtroPeriodo.endDate;
                dateCondition = { data_transacao: { [Op.between]: [startDate, endDate] } };
                console.log("[listTransactions] Filtro de data (between objeto {startDate, endDate}) aplicado:", startDate, "até", endDate);
             } else {console.warn(`[listTransactions] Formato de data inválido no objeto periodo: ${JSON.stringify(filtroPeriodo)}. Filtro de data ignorado.`);}
        }
        // Caso 2: String normalizada (termo relativo ou data YYYY-MM-DD)
        else if (typeof filtroPeriodo === 'string') {
             // Tenta calcular a data de início usando a helper function (retorna Date local)
             const startDateCalculada = calcularStartDate(filtroPeriodo);

             if (startDateCalculada instanceof Date && !isNaN(startDateCalculada.getTime())) {
                  // Para usar Op.between ou Op.eq com colunas DATEONLY, usamos strings YYYY-MM-DD
                  const startDateStr = startDateCalculada.toISOString().split('T')[0];
                  let endDateStr = null; // Variável para a data final do range

                  // Define a data final para ranges comuns (hoje, ontem, etc.) baseados na data calculada (local)
                  const endDateCalculada = new Date(startDateCalculada); // Começa igual à data de início

                  if (['hoje', 'ontem'].includes(filtroPeriodo.toLowerCase()) || /^\d{4}-\d{2}-\d{2}$/.test(filtroPeriodo.toLowerCase())) {
                       // Para um dia específico (hoje, ontem, ou data YYYY-MM-DD)
                       endDateStr = startDateStr;
                       dateCondition = { data_transacao: { [Op.between]: [startDateStr, endDateStr] } }; // Usa between para um único dia
                       console.log(`[listTransactions] Filtro de data (data específica ou dia relativo ${filtroPeriodo}) aplicado: ${startDateStr}`);
                  }
                  // Define a data final para ranges semanais, mensais ou anuais
                  else if (['semana_atual', 'semana_passada'].includes(filtroPeriodo.toLowerCase())) {
                       endDateCalculada.setDate(startDateCalculada.getDate() + 6); // Fim da semana (domingo)
                       endDateStr = endDateCalculada.toISOString().split('T')[0];
                       dateCondition = { data_transacao: { [Op.between]: [startDateStr, endDateStr] } };
                       console.log(`[listTransactions] Filtro de data (between string ${filtroPeriodo}) aplicado: ${startDateStr} até ${endDateStr}`);
                  }
                  else if (['mes_atual', 'mes_passado', 'mes_proximo'].includes(filtroPeriodo.toLowerCase())) {
                       // Último dia do mês da data de início calculada
                       endDateCalculada.setMonth(startDateCalculada.getMonth() + 1);
                       endDateCalculada.setDate(0);
                       endDateStr = endDateCalculada.toISOString().split('T')[0];
                       dateCondition = { data_transacao: { [Op.between]: [startDateStr, endDateStr] } };
                       console.log(`[listTransactions] Filtro de data (between string ${filtroPeriodo}) aplicado: ${startDateStr} até ${endDateStr}`);
                  }
                   else if (['ano_atual', 'ano_passado'].includes(filtroPeriodo.toLowerCase())) {
                       // Último dia do ano da data de início calculada
                       endDateCalculada.setMonth(11); // Dezembro
                       endDateCalculada.setDate(31); // Dia 31
                       endDateStr = endDateCalculada.toISOString().split('T')[0];
                        dateCondition = { data_transacao: { [Op.between]: [startDateStr, endDateStr] } };
                        console.log(`[listTransactions] Filtro de data (between string ${filtroPeriodo}) aplicado: ${startDateStr} até ${endDateStr}`);
                   }
                   // Trata termos como 'ultimos X dias'
                  else if (['ultimos_7_dias', 'ultimos_30_dias'].includes(filtroPeriodo.toLowerCase())) {
                       // A data calculada já é a data de início do período. A data de fim é hoje (início do dia).
                       const hojeStr = hoje.toISOString().split('T')[0]; // hoje já está no início do dia local
                       dateCondition = { data_transacao: { [Op.between]: [startDateStr, hojeStr] } };
                        console.log(`[listTransactions] Filtro de data (between string ${filtroPeriodo}) aplicado: ${startDateStr} até ${hojeStr}`);
                  }
                   // Fallback para outros termos não mapeados: "a partir da data calculada"
                  else {
                       // Aplica um filtro de "maior ou igual que" a data calculada.
                       dateCondition = { data_transacao: { [Op.gte]: startDateStr } };
                       console.log(`[listTransactions] Filtro de data (gte string ${filtroPeriodo}) aplicado: a partir de ${startDateStr}`);
                  }

                  // --- Fim da Lógica de Intervalo ---

             } else { console.warn(`[listTransactions] Não foi possível calcular data válida para o período string: "${filtroPeriodo}". Filtro de data ignorado.`); }
        } else { console.warn(`[listTransactions] Tipo de filtroPeriodo inesperado: ${typeof filtroPeriodo}. Filtro de data ignorado.`); }

        // Add the date condition object to the main conditions array if it was created
        if (dateCondition) {
            conditions.push(dateCondition);
        }
    } else { console.log("[listTransactions] Nenhum filtro de período fornecido."); }

    // Add tipo filter (receita or despesa)
    // Este filtro deve vir da IA/N8N como 'receita' ou 'despesa'
    if (tipoFiltro && ['receita', 'despesa'].includes(tipoFiltro.toLowerCase())) {
        conditions.push({ tipo: tipoFiltro.toLowerCase() });
        console.log(`[listTransactions] Filtro de tipo aplicado: ${tipoFiltro.toLowerCase()}`);
    } else if (tipoFiltro){ // Log se tipo for inválido (não é 'receita' nem 'despesa')
        console.warn(`[listTransactions] Filtro de tipo inválido ('${tipoFiltro}') ignorado.`);
    } else {
         console.log(`[listTransactions] Nenhum filtro de tipo aplicado.`);
    }

    // Combine all collected conditions using Op.and at the top level of the where clause.
    // If the 'conditions' array has only one element (just id_usuario), using Op.and is not
    // strictly necessary but is harmless and keeps the structure consistent.
    // If the array is empty (shouldn't happen with id_usuario), use an empty object.
    const finalWhereClause = conditions.length > 0 ? { [Op.and]: conditions } : {};

    // Log final da cláusula WHERE
    // Usa um replacer para Op para que eles apareçam como string no log
    const replacer = (key, value) => {
        if (typeof value === 'symbol') {
            // Mapeia símbolos Sequelize Op para strings legíveis no log
            switch(value) {
                case Op.between: return 'Op.between';
                case Op.eq: return 'Op.eq';
                case Op.gte: return 'Op.gte';
                case Op.iLike: return 'Op.iLike';
                case Op.or: return 'Op.or';
                case Op.and: return 'Op.and'; // Adiciona Op.and
                default: return value.toString(); // Qualquer outro símbolo
            }
        }
        return value; // Retorna o valor original para não-símbolos
    };
    console.log("[listTransactions] Where clause final para findAll:", JSON.stringify(finalWhereClause, replacer, 2));

    try {
        // Execute a consulta com a cláusula WHERE combinada
        const transacoes = await Transacao.findAll({
            where: finalWhereClause, // Use a cláusula where combinada
            // Ordena por data decrescente e depois por ID decrescente
            order: [['data_transacao', 'DESC'], ['id_transacao', 'DESC']]
             // Por padrão, findAll retorna todos os atributos, incluindo nome_subcategoria agora
        });
        console.log(`[listTransactions] Consulta Sequelize executada. Retornou ${transacoes.length} transações.`);
        return transacoes;

    } catch (error) {
        console.error("[listTransactions] Erro Sequelize durante a consulta:", error);
        // Tenta extrair o SQL se disponível para debug
        if (error.parent?.sql) { console.error("[listTransactions] SQL Gerado (aproximado):", error.parent.sql); }
        else if (error.sql) { console.error("SQL Gerado:", error.sql); }
        throw error; // Re-lança o erro para a camada superior (rota)
    }
};


const getTransactionById = async (id_transacao) => {
    try {
        // findByPk retorna todos os atributos por padrão, incluindo nome_subcategoria agora
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

        // Limpa updates para prevenir modificações de campos sensíveis
        delete updates.id_usuario;
        delete updates.id_transacao;
        delete updates.codigo_unico;
        delete updates.id_alerta_origem;
        delete updates.id_recorrencia_origem;
         delete updates.data_ocorrencia_recorrencia; // Geralmente não se atualiza isso
         delete updates.parcela_numero; // Geralmente não se atualiza
         delete updates.total_parcelas; // Geralmente não se atualiza
         delete updates.id_transacao_pai; // Geralmente não se atualiza


        // Converte valor para float se presente
        if (updates.valor !== undefined) {
            updates.valor = parseFloat(updates.valor);
             if (isNaN(updates.valor)) {
                 console.warn(`[updateTransaction] Valor inválido '${updates.valor}' fornecido para atualização da transação ${id_transacao}.`);
                 throw new Error("Valor inválido fornecido para atualização da transação.");
             }
        }
         // Converte data_transacao se presente
         if (updates.data_transacao !== undefined && updates.data_transacao !== null && updates.data_transacao !== '') {
             // Validação básica de formato YYYY-MM-DD ou similar que Date() entenda
             // Cria uma data no fuso local para validar
             const dateCheck = new Date(updates.data_transacao);
             if (isNaN(dateCheck.getTime())) {
                  console.warn(`[updateTransaction] Data inválida '${updates.data_transacao}' fornecida para atualização da transação ${id_transacao}.`);
                  throw new Error("Data de transação inválida fornecida.");
             }
             // Sequelize DATEONLY deve lidar bem com string 'YYYY-MM-DD' ou objeto Date local no início do dia
             // Se a entrada for só 'YYYY-MM-DD', já está no formato ideal.
             // Se for um objeto Date, Sequelize deve converter corretamente para DATEONLY
             updates.data_transacao = updates.data_transacao;
         }

        // Agora, atualiza os campos permitidos, incluindo nome_categoria e nome_subcategoria
        // Apenas inclui no objeto de update se estiver presente nos 'updates' recebidos
        const updateFields = {};
        if (updates.tipo !== undefined) updateFields.tipo = updates.tipo; // Permite mudar tipo? Cuidado.
        if (updates.valor !== undefined) updateFields.valor = updates.valor;
        if (updates.nome_categoria !== undefined) updateFields.nome_categoria = updates.nome_categoria || null; // Permite definir como null
        // --- NOVO CAMPO ADICIONADO AQUI ---
        if (updates.nome_subcategoria !== undefined) updateFields.nome_subcategoria = updates.nome_subcategoria || null; // Permite definir como null
        // --- FIM NOVO CAMPO ---
        if (updates.data_transacao !== undefined) updateFields.data_transacao = updates.data_transacao;
        if (updates.descricao !== undefined) updateFields.descricao = updates.descricao || null; // Permite definir como null
        if (updates.comprovante_url !== undefined) updateFields.comprovante_url = updates.comprovante_url || null; // Permite definir como null
        // Adicione outros campos se precisar permitir atualização

         console.log(`[updateTransaction] Atualizando transação ${id_transacao} com dados:`, JSON.stringify(updateFields));

        await transacao.update(updateFields);
        return transacao; // Retorna a transação atualizada (incluirá nome_subcategoria)
    } catch (error) {
        console.error(`Erro ao atualizar transação ${id_transacao}:`, error);
        throw error;
    }
};

const deleteTransaction = async (id_transacao) => {
    try {
        // Soft delete (se paranoid estiver ativo no modelo)
        const transacaoDeletadaCount = await Transacao.destroy({
            where: { id_transacao }
        });
        return transacaoDeletadaCount > 0; // Retorna true se 1 ou mais linhas foram afetadas
    } catch (error) {
        console.error(`Erro ao excluir transação por ID ${id_transacao}:`, error);
        throw error;
    }
};

const deleteTransactionByCode = async (codigo_unico, id_usuario) => {
    // Garante que id_usuario seja número
    const userIdNum = parseInt(id_usuario, 10);
    if(isNaN(userIdNum)) {
        console.error("[deleteTransactionByCode] ID de usuário inválido:", id_usuario);
        // Lançar erro em vez de retornar null para indicar que a operação falhou
        throw new Error("ID de usuário inválido fornecido para deleteTransactionByCode.");
    }
    if (!codigo_unico) {
         console.error("[deleteTransactionByCode] Código único não fornecido.");
         throw new Error("Código único da transação não fornecido.");
    }

    let transactionToDelete; // Variável para guardar a transação encontrada

    try {
        // Passo 1: Encontrar a transação. Inclui a condição de usuário para evitar deletar transações de outros.
        transactionToDelete = await Transacao.findOne({
            where: {
                codigo_unico: codigo_unico,
                id_usuario: userIdNum
            },
            // Se você usar soft delete, paranoid: true é o default para findOne.
            // Se quiser encontrar mesmo soft-deletadas, use paranoid: false.
            // Para deletar, destroy respeita paranoid por padrão.
        });

        // Se não encontrou, retorna null (ou lance um erro específico como 404 Not Found na rota)
        if (!transactionToDelete) {
            console.log(`[deleteTransactionByCode] Transação com código ${codigo_unico} não encontrada para usuário ${userIdNum}.`);
            return null; // Indica que a transação não foi encontrada/deletada
        }

        // Passo 2: Armazenar detalhes (o objeto inteiro ou campos específicos) antes de deletar
        // Usaremos o objeto inteiro aqui para simplicidade, convertido para plain object
        const deletedDetails = transactionToDelete.get({ plain: true });
         console.log(`[deleteTransactionByCode] Encontrada transação para deletar (ID: ${deletedDetails.id_transacao}, Código: ${codigo_unico}).`);

        // Passo 3: Deletar a transação encontrada (soft delete por padrão se paranoid estiver ativo no modelo)
        const deleteResult = await transactionToDelete.destroy();
        // destroy() com paranoid retorna a instância deletada. Sem paranoid, retorna undefined/null
        // Podemos verificar se o resultado não é null/undefined ou se o count foi 1 (se usasse destroy({ where: ... }))

        console.log(`[deleteTransactionByCode] Transação com código ${codigo_unico} deletada com sucesso (Soft Delete: ${!!deleteResult}).`); // !!deleteResult converte o resultado para boolean

        // Passo 4: Retornar os detalhes armazenados (incluirá nome_subcategoria)
        return deletedDetails;

    } catch (error) {
        console.error(`[deleteTransactionByCode] Erro ao tentar deletar transação por código ${codigo_unico} para usuário ${userIdNum}:`, error);
        // Re-lançar o erro para a camada superior (rota) tratar
        throw error;
    }
};


const getMonthlySummary = async (id_usuario, year, month) => {
     const userIdNum = parseInt(id_usuario, 10);
     const yearNum = parseInt(year, 10);
     const monthNum = parseInt(month, 10); // 1-12

     if(isNaN(userIdNum) || isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
          console.error(`[getMonthlySummary] Parâmetros inválidos: id_usuario=${id_usuario}, year=${year}, month=${month}`);
          throw new Error("Parâmetros inválidos para getMonthlySummary. Forneça ID de usuário, ano e mês válidos.");
     }

    try {
        // Datas no fuso horário local para compatibilidade com colunas DATEONLY
        const startDate = new Date(yearNum, monthNum - 1, 1); // Mês é 0-indexado em JS Date
        const endDate = new Date(yearNum, monthNum, 0); // Dia 0 do próximo mês é o último dia do mês atual

         // Formata para YYYY-MM-DD para o WHERE clause do Sequelize (Op.between espera este formato para DATEONLY)
         const startDateStr = startDate.toISOString().split('T')[0];
         const endDateStr = endDate.toISOString().split('T')[0];

         console.log(`[getMonthlySummary] Buscando resumo para usuário ${userIdNum} no período: ${startDateStr} a ${endDateStr}`);

        // Inclui nome_subcategoria na busca caso precise dela futuramente nos resumos
        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
            // Incluído nome_subcategoria nos atributos retornados
            attributes: ['tipo', 'valor', 'nome_categoria', 'nome_subcategoria']
        });

        let summary = { totalIncome: 0, totalExpenses: 0, categorySummary: {} };

        transacoes.forEach(transacao => {
            const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') {
                summary.totalIncome += valorNum;
            } else {
                summary.totalExpenses += valorNum;
                // O resumo ainda é por categoria principal
                const categoryName = transacao.nome_categoria || 'Sem Categoria';
                summary.categorySummary[categoryName] = (summary.categorySummary[categoryName] || 0) + valorNum;
            }
        });

        summary.totalIncome = parseFloat(summary.totalIncome.toFixed(2));
        summary.totalExpenses = parseFloat(summary.totalExpenses.toFixed(2));
        // Ordena o resumo por categoria decrescente
        const sortedCategorySummary = Object.fromEntries(
             Object.entries(summary.categorySummary).sort(([, a], [, b]) => b - a)
        );
        summary.categorySummary = sortedCategorySummary;


        return summary;
    } catch (error) {
        console.error(`[getMonthlySummary] Erro ao obter resumo mensal para ${id_usuario}/${year}-${month}:`, error);
        throw error;
    }
};

const getDailySummary = async (id_usuario, year, month, day) => {
     const userIdNum = parseInt(id_usuario, 10);
     const yearNum = parseInt(year, 10);
     const monthNum = parseInt(month, 10); // 1-12
     const dayNum = parseInt(day, 10); // 1-31


      if(isNaN(userIdNum) || isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
           console.error(`[getDailySummary] Parâmetros inválidos: id_usuario=${id_usuario}, year=${year}, month=${month}, day=${day}`);
           throw new Error("Parâmetros inválidos para getDailySummary. Forneça ID de usuário, ano, mês e dia válidos.");
      }
    try {
         // Cria a data para o dia específico no fuso horário local e formata para YYYY-MM-DD
        const targetDate = new Date(yearNum, monthNum - 1, dayNum); // Mês é 0-indexado
        const targetDateStr = targetDate.toISOString().split('T')[0];

         console.log(`[getDailySummary] Buscando resumo diário para usuário ${userIdNum} na data: ${targetDateStr}`);


        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: targetDateStr // Para um dia específico com DATEONLY, Op.eq ou a string direta funcionam
            },
            order: [['data_transacao', 'ASC'], ['id_transacao', 'ASC']]
            // Por padrão, findAll retorna todos os atributos, incluindo nome_subcategoria agora
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
        console.error(`[getDailySummary] Erro ao obter resumo diário para ${id_usuario}/${year}-${month}-${day}:`, error);
        throw error;
    }
};

const getWeeklySummary = async (id_usuario, year, week) => {
     const userIdNum = parseInt(id_usuario, 10);
     const yearNum = parseInt(year, 10);
     const weekNum = parseInt(week, 10); // Número da semana (1-52 ou 53)

      if(isNaN(userIdNum) || isNaN(yearNum) || isNaN(weekNum) || weekNum < 1 || weekNum > 53) { // 53 semanas é raro, mas pode acontecer
           console.error(`[getWeeklySummary] Parâmetros inválidos: id_usuario=${id_usuario}, year=${year}, week=${week}`);
           throw new Error("Parâmetros inválidos para getWeeklySummary. Forneça ID de usuário, ano e semana válidos.");
      }
    try {
         // Calcular as datas de início e fim da semana (ISO 8601)
        const firstDayOfYear = new Date(Date.UTC(yearNum, 0, 1));
        const dayOfWeek = firstDayOfYear.getUTCDay(); // 0 = Dom, 6 = Sáb
        const firstMondayOfFirstWeek = new Date(Date.UTC(yearNum, 0, 1 + (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek)));

        const startDate = new Date(firstMondayOfFirstWeek.getTime());
        startDate.setUTCDate(firstMondayOfFirstWeek.getUTCDate() + (weekNum - 1) * 7); // Adiciona semanas ao primeiro dia da semana 1

        const endDate = new Date(startDate);
        endDate.setUTCDate(startDate.getUTCDate() + 6); // 6 dias depois para o domingo

         // Formata para YYYY-MM-DD
         const startDateStr = startDate.toISOString().split('T')[0];
         const endDateStr = endDate.toISOString().split('T')[0];

         console.log(`[getWeeklySummary] Buscando resumo semanal para usuário ${userIdNum} (Semana ${weekNum} de ${yearNum}): ${startDateStr} a ${endDateStr}`);


        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
             attributes: ['tipo', 'valor'] // Pega apenas tipo e valor para este resumo simples
             // Não precisamos de nome_categoria/nome_subcategoria para este resumo simples
        });

        let weeklySummary = { totalIncome: 0, totalExpenses: 0, startDate: startDateStr, endDate: endDateStr };

        transacoes.forEach(transacao => {
             const valorNum = parseFloat(transacao.valor) || 0;
            if (transacao.tipo === 'receita') { weeklySummary.totalIncome += valorNum; } else { weeklySummary.totalExpenses += valorNum; }
        });

        weeklySummary.totalIncome = parseFloat(weeklySummary.totalIncome.toFixed(2));
        weeklySummary.totalExpenses = parseFloat(weeklySummary.totalExpenses.toFixed(2));
        return weeklySummary;

    } catch (error) {
        console.error(`[getWeeklySummary] Erro ao obter resumo semanal para ${id_usuario}/Y${year}-W${week}:`, error);
        throw error;
    }
};

const getSpendingByCategory = async (id_usuario, startDate, endDate) => {
     const userIdNum = parseInt(id_usuario, 10);

     // Validação robusta das datas
     const start = startDate instanceof Date && !isNaN(startDate.getTime()) ? startDate : null;
     const end = endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate : null;

     if(isNaN(userIdNum) || !start || !end) {
          console.error(`[getSpendingByCategory] Parâmetros inválidos: id_usuario=${id_usuario}, startDate=${startDate}, endDate=${endDate}`);
           throw new Error("Parâmetros inválidos para getSpendingByCategory. Forneça ID de usuário e datas válidas.");
      }

    try {
        // Ajusta a data final para o final do dia local
        const endOfDayEndDate = new Date(end);
        endOfDayEndDate.setHours(23, 59, 59, 999);

        // Formata as datas para YYYY-MM-DD para o WHERE clause
        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = endOfDayEndDate.toISOString().split('T')[0];

        console.log(`[getSpendingByCategory] Buscando gastos por categoria para usuário ${userIdNum} no período: ${startDateStr} a ${endDateStr}`);

        // Este resumo agrupa apenas pela categoria principal (nome_categoria)
        // Se você quiser agrupar por subcategoria, precisaria mudar o 'group' e 'attributes' aqui.
        const results = await Transacao.findAll({
            attributes: [
                // Usando COALESCE para garantir 'Sem Categoria' se nome_categoria for NULL
                [sequelize.fn('COALESCE', sequelize.col('nome_categoria'), 'Sem Categoria'), 'categoria'],
                // Opcional: Se quisesse subcategoria no resultado, adicionaria aqui
                // [sequelize.fn('COALESCE', sequelize.col('nome_subcategoria'), 'Sem Subcategoria'), 'subcategoria'],
                [sequelize.fn('SUM', sequelize.col('valor')), 'total']
            ],
            where: {
                id_usuario: userIdNum,
                tipo: 'despesa',
                data_transacao: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
            group: [sequelize.literal('categoria')], // Agrupa apenas por nome_categoria (alias 'categoria')
            // Se quisesse agrupar por categoria E subcategoria, mudaria para:
            // group: [sequelize.literal('categoria'), sequelize.literal('subcategoria')],
            order: [[sequelize.literal('total'), 'DESC']], // Ordena pelo alias 'total' (gastos maiores primeiro)
            raw: true // Retorna resultados como objetos JS puros
        });

        // Formata os resultados
        const formattedSpending = results.map(item => ({
             nome: item.categoria, // Retorna o nome da categoria principal
             // Se quisesse subcategoria, adicionaria: subcategoria: item.subcategoria,
             total: parseFloat(parseFloat(item.total).toFixed(2)) // Garante float com 2 casas
        }));

        console.log(`[getSpendingByCategory] Retornou ${formattedSpending.length} categorias principais.`);

        return formattedSpending;

    } catch (error) {
        console.error(`[getSpendingByCategory] Erro ao obter gastos por categoria para usuário ${id_usuario}:`, error);
        throw error;
    }
};

const getTransactionStatement = async (id_usuario, startDate, endDate) => {
     const userIdNum = parseInt(id_usuario, 10);

     // Validação robusta das datas
      const start = startDate instanceof Date && !isNaN(startDate.getTime()) ? startDate : null;
     const end = endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate : null;

      if(isNaN(userIdNum) || !start || !end) {
          console.error(`[getTransactionStatement] Parâmetros inválidos: id_usuario=${id_usuario}, startDate=${startDate}, endDate=${endDate}`);
           throw new Error("Parâmetros inválidos para getTransactionStatement. Forneça ID de usuário e datas válidas.");
      }

    try {
        // Ajusta a data final para o final do dia local
        const endOfDayEndDate = new Date(end);
        endOfDayEndDate.setHours(23, 59, 59, 999);

        // Formata as datas para YYYY-MM-DD para o WHERE clause
        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = endOfDayEndDate.toISOString().split('T')[0];

        console.log(`[getTransactionStatement] Buscando extrato de transações para usuário ${userIdNum} no período: ${startDateStr} a ${endDateStr}`);

        const transacoes = await Transacao.findAll({
            where: {
                id_usuario: userIdNum,
                data_transacao: {
                    [Op.between]: [startDateStr, endDateStr]
                }
            },
            order: [['data_transacao', 'ASC'], ['id_transacao', 'ASC']]
            // Por padrão, findAll retorna todos os atributos, incluindo nome_subcategoria agora
        });

         console.log(`[getTransactionStatement] Retornou ${transacoes.length} transações para o extrato.`);

        return transacoes;

    } catch (error) {
        console.error(`[getTransactionStatement] Erro ao obter extrato de transações para usuário ${id_usuario}:`, error);
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
    getCurrentBalance, // Exportar pois outras partes podem querer o saldo atual
    getMonthlySummary,
    getDailySummary,
    getWeeklySummary,
    getSpendingByCategory,
    getTransactionStatement
};