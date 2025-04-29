// src/transacoes/transacao.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Usuario = require('../usuarios/usuario.model');
const Recorrencia = require('../recorrencias/recorrencia.model');
const AlertaPagamento = require('../alertas-pagamento/alerta-pagamento.model');
const { nanoid } = require('nanoid'); // Mantenha se usar o hook

const Transacao = sequelize.define('Transacao', {
    id_transacao: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_transacao'
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_usuario',
        references: {
            model: Usuario, // Referencia o MODELO importado (correto para FK para outra tabela)
            key: 'id_usuario'
        }
    },
    tipo: {
        type: DataTypes.ENUM('despesa', 'receita'),
        allowNull: false
    },
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    nome_categoria: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nome_subcategoria: {
        type: DataTypes.STRING(255),
        allowNull: true // Subcategoria é opcional
      },
    data_transacao: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'data_transacao'
    },
    codigo_unico: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        field: 'codigo_unico'
    },
    descricao: {
        type: DataTypes.TEXT
    },
    comprovante_url: {
        type: DataTypes.STRING(255),
        field: 'comprovante_url'
    },
    // --- CORREÇÃO NA REFERÊNCIA ABAIXO ---
    id_transacao_pai: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'id_transacao_pai',
        references: {
            // Em vez de referenciar o nome do MODELO ('Transacao') como string,
            // especifique o nome da TABELA explicitamente.
            model: {
              tableName: 'transacoes' // <<< USAR O NOME DA TABELA CORRETO
            },
            key: 'id_transacao'
        }
    },
    // --- FIM DA CORREÇÃO ---
    parcela_numero: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    total_parcelas: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    id_recorrencia_origem: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'id_recorrencia_origem',
        references: {
            model: Recorrencia, // Referencia o MODELO (correto)
            key: 'id_recorrencia'
        }
    },
    data_ocorrencia_recorrencia: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'data_ocorrencia_recorrencia'
    },
    id_alerta_origem: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'id_alerta_origem',
        references: {
            model: AlertaPagamento, // Referencia o MODELO (correto)
            key: 'id_alerta'
        }
    }
}, {
    tableName: 'transacoes', // <<< NOME DA TABELA DEFINIDO AQUI
    timestamps: false
});

// --- Associações permanecem as mesmas ---
Transacao.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
// A associação belongsTo/hasMany lida com a auto-referência corretamente
Transacao.belongsTo(Transacao, { foreignKey: 'id_transacao_pai', as: 'transacaoPai' });
Transacao.hasMany(Transacao, { foreignKey: 'id_transacao_pai', as: 'parcelasFilhas' }); // Exemplo de associação inversa

Transacao.belongsTo(Recorrencia, { foreignKey: 'id_recorrencia_origem', as: 'recorrenciaOrigem' });
Transacao.belongsTo(AlertaPagamento, { foreignKey: 'id_alerta_origem', as: 'alertaOrigem' });

Usuario.hasMany(Transacao, { foreignKey: 'id_usuario', as: 'transacoes' });
AlertaPagamento.hasOne(Transacao, { foreignKey: 'id_alerta_origem', as: 'transacaoGerada' });
Recorrencia.hasMany(Transacao, { foreignKey: 'id_recorrencia_origem', as: 'transacoesGeradas'}); // Adicionando se não existia

// Hook beforeValidate (opcional, se a geração está no service)
Transacao.beforeValidate(async (transacao, options) => {
  if (!transacao.codigo_unico) {
    console.warn(`[HOOK Transacao.beforeValidate] Código único não fornecido, gerando...`);
    let code;
    let existing = true;
    while(existing) {
      code = `TRX-${nanoid(7)}`;
      existing = await Transacao.findOne({ where: { codigo_unico: code } });
    }
    transacao.codigo_unico = code;
  }
});

module.exports = Transacao;