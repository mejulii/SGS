const { DataTypes } = require('sequelize');
const sequelize = require('../config/bd');
const Usuario = require('./usuario.model');

const Solicitacao = sequelize.define('Solicitacao', {
    titulo: {
        type: DataTypes.STRING,
    },
    descricao: {
        type: DataTypes.TEXT,
    },
    prioridade: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pendente'
    },
    motivoRejeicao: {
        type: DataTypes.TEXT,
    }
});

Solicitacao.belongsTo(Usuario, { foreignKey: 'usuarioId' });
Usuario.hasMany(Solicitacao, { foreignKey: 'usuarioId' });

module.exports = Solicitacao;
