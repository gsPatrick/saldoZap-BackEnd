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

    const getUserByPhone = async (telefone) => {
        try {
            // Encontra o primeiro usuário que corresponde ao telefone
            // Ajuste o nome do campo 'telefone' se for diferente no seu model
            const usuario = await Usuario.findOne({
                where: { telefone: telefone }
            });
            return usuario; // Retorna o usuário encontrado ou null
        } catch (error) {
            console.error("Erro ao obter usuário pelo telefone:", error);
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

    const listUsers = async (options = {}) => {
        const page = parseInt(options.page, 10) || 1;
        // Definir um limite padrão e máximo seguro para evitar sobrecarga
        const defaultLimit = 50;
        const maxLimit = 200;
        let limit = parseInt(options.limit, 10) || defaultLimit;
        if (limit > maxLimit) {
             console.warn(`[listUsers] Limite solicitado (${options.limit}) excede o máximo (${maxLimit}). Usando ${maxLimit}.`);
             limit = maxLimit;
         }
        if (limit <= 0) limit = defaultLimit; // Garante limite positivo
    
        const offset = (page - 1) * limit;
    
        const whereClause = {}; // Começa vazia
    
        // Filtro de Busca (nome OU email) - Case-Insensitive
        if (options.search) {
            const searchTerm = `%${options.search}%`; // Adiciona wildcards para ILIKE
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: searchTerm } },
                { email: { [Op.iLike]: searchTerm } }
            ];
            console.log(`[listUsers] Aplicando filtro de busca: ${options.search}`);
        }
    
        // Filtro de Plano - Case-Insensitive
        if (options.plan) {
            // Se o plano for 'Free', precisa de lógica especial? Ou busca direto na coluna 'plano'?
            // Assumindo que busca direto na coluna 'plano' por enquanto
            // Se 'Free' for representado por plano=NULL E assinatura_ativa=false, a lógica seria diferente
            whereClause.plano = { [Op.iLike]: options.plan };
            console.log(`[listUsers] Aplicando filtro de plano: ${options.plan}`);
        }
    
        console.log('[listUsers] Where Clause Final:', JSON.stringify(whereClause, null, 2));
    
        try {
            const { count, rows } = await Usuario.findAndCountAll({
                attributes: [ // <<< SELECIONAR APENAS CAMPOS NECESSÁRIOS E SEGUROS >>>
                    'id_usuario',
                    'nome',
                    'email',
                    'telefone', // Necessário para contato talvez? Avalie a necessidade.
                    'data_cadastro',
                    'trial_fim',
                    'assinatura_ativa',
                    'assinatura_expira_em',
                    'plano'
                    // NUNCA inclua senhas ou tokens aqui!
                ],
                where: whereClause,
                limit: limit,
                offset: offset,
                order: [
                    ['data_cadastro', 'DESC'] // Ordena pelos mais recentes primeiro
                    // ['nome', 'ASC'] // Ou por nome
                ],
                // distinct: true // Pode ser necessário se includes causarem duplicatas
            });
    
            console.log(`[listUsers] Encontrados ${rows.length} usuários de um total de ${count}. Página: ${page}, Limite: ${limit}`);
            return { rows, count }; // Retorna usuários da página e contagem total
    
        } catch (error) {
            console.error("[listUsers] Erro ao buscar usuários:", error);
            throw new Error("Erro ao buscar lista de usuários.");
        }
    };

    module.exports = {
        createUser,
        getUserById,
        updateUser,
        deleteUser,
        getUserByPhone,
        listUsers 
    };