const { DataTypes } = require('sequelize');
const sequelize = require('../config/bd');

const Usuario = sequelize.define('Usuario', {
    nome: {
        type: DataTypes.STRING,
    },
    email: {
        type: DataTypes.STRING,
    },
    setor: {
        type: DataTypes.STRING,
    },
    tipo: {
        type: DataTypes.STRING,
    }
});

module.exports = Usuario;
