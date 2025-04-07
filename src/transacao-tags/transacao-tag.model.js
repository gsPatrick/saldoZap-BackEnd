const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Transacao = require('../transacoes/transacao.model'); // Importa o Model de Transacao
const Tag = require('../tags/tag.model'); // Importa o Model de Tag

const TransacaoTag = sequelize.define('TransacaoTag', {
  id_transacao_tag: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_transacao_tag'
  },
  id_transacao: { // Chave estrangeira para Transacoes
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'id_transacao',
    references: {
      model: Transacao, // Referencia o Model Transacao
      key: 'id_transacao' // Coluna chave na tabela Transacoes
    }
  },
  id_tag: { // Chave estrangeira para Tags
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'id_tag',
    references: {
      model: Tag, // Referencia o Model Tag
      key: 'id_tag' // Coluna chave na tabela Tags
    }
  }
}, {
  tableName: 'Transacao_Tags',
  timestamps: false,
  uniqueKeys: { // Define a chave única composta (id_transacao, id_tag)
    actions_unique: {
      fields: ['id_transacao', 'id_tag']
    }
  }
});

// Define as associações (relacionamentos)
TransacaoTag.belongsTo(Transacao, { foreignKey: 'id_transacao', as: 'transacao' }); // TransacaoTag PERTENCE a uma Transacao
TransacaoTag.belongsTo(Tag, { foreignKey: 'id_tag', as: 'tag' }); // TransacaoTag PERTENCE a uma Tag

// Relação Muitos-para-Muitos (através da tabela Transacao_Tags)
Transacao.belongsToMany(Tag, { through: TransacaoTag, foreignKey: 'id_transacao', otherKey: 'id_tag', as: 'tags' });
Tag.belongsToMany(Transacao, { through: TransacaoTag, foreignKey: 'id_tag', otherKey: 'id_transacao', as: 'transacoes' });


module.exports = TransacaoTag;