const express = require('express');
const exphbs = require('express-handlebars');
const session = require('express-session');

const sequelize = require('./config/bd');
const Usuario = require('./model/usuario.model');
const Solicitacao = require('./model/solicitacao.model');

const app = express();

app.engine('handlebars', exphbs.engine({
    defaultLayout: false,

    helpers: {
        ifEquals: function (a, b, options) {
            return a == b
                ? options.fn(this)
                : options.inverse(this);
        }
    }
}));

app.set('view engine', 'handlebars');

app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));

app.use(session({
    secret: 'sgs-secret',
    resave: false,
    saveUninitialized: false
}));

function autenticado(req, res, next) {

    if (!req.session.usuario) {
        return res.redirect('/login');
    }

    next();
}

function somenteAdmin(req, res, next) {

    if (!req.session.usuario) {
        return res.redirect('/login');
    }

    if (req.session.usuario.tipo !== 'administrador') {
        return res.redirect('/');
    }

    next();
}

function somenteSolicitante(req, res, next) {

    if (!req.session.usuario) {
        return res.redirect('/login');
    }

    if (req.session.usuario.tipo !== 'solicitante') {
        return res.redirect('/');
    }

    next();
}

app.get('/login', (req, res) => {

    if (req.session.usuario) {
        return res.redirect('/');
    }

    res.render('login', {
        erro: null
    });

});

app.post('/login', async (req, res) => {

    const { email, senha } = req.body;

    const usuario = await Usuario.findOne({
        where: {
            email: email,
            senha: senha
        },
        raw: true
    });

    if (!usuario) {

        return res.render('login', {
            erro: 'E-mail ou senha incorretos.'
        });

    }

    const tipo = String(usuario.tipo).trim().toLowerCase();

    if (tipo !== 'administrador' && tipo !== 'solicitante') {

        return res.render('login', {
            erro: 'Tipo de usuário inválido.'
        });

    }

    usuario.tipo = tipo;

    req.session.usuario = usuario;

    res.redirect('/');

});

app.get('/logout', (req, res) => {

    req.session.destroy(() => {
        res.redirect('/login');
    });

});

app.get('/', autenticado, (req, res) => {

    const usuario = req.session.usuario;

    if (usuario.tipo === 'administrador') {

        return res.render('homeAdmin', {
            usuario: usuario
        });

    }

    return res.render('homeSolicitante', {
        usuario: usuario
    });

});

app.get('/usuarios', somenteAdmin, async (req, res) => {

    const usuarios = await Usuario.findAll({
        raw: true
    });

    res.render('listarUsuarios', {
        usuarios,
        usuario: req.session.usuario
    });

});

app.get('/usuarios/cadastrar', somenteAdmin, (req, res) => {

    res.render('cadastrarUsuario');

});

app.post('/usuarios', somenteAdmin, async (req, res) => {

    const {
        nome,
        email,
        senha,
        setor,
        tipo
    } = req.body;

    await Usuario.create({
        nome,
        email,
        senha,
        setor,
        tipo: String(tipo).trim().toLowerCase()
    });

    res.redirect('/usuarios');

});

app.get('/usuarios/:id/editar', somenteAdmin, async (req, res) => {

    const usuario = await Usuario.findByPk(req.params.id, {
        raw: true
    });

    if (!usuario) {
        return res.redirect('/usuarios');
    }

    res.render('editarUsuario', {
        usuario
    });

});

app.post('/usuarios/:id/editar', somenteAdmin, async (req, res) => {

    const {
        nome,
        email,
        senha,
        setor,
        tipo
    } = req.body;

    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
        return res.redirect('/usuarios');
    }

    usuario.nome = nome;
    usuario.email = email;
    usuario.senha = senha;
    usuario.setor = setor;
    usuario.tipo = String(tipo).trim().toLowerCase();

    await usuario.save();

    res.redirect('/usuarios');

});

app.get('/usuarios/:id/excluir', somenteAdmin, async (req, res) => {

    const usuario = await Usuario.findByPk(req.params.id);

    if (usuario) {
        await usuario.destroy();
    }

    res.redirect('/usuarios');

});

app.get('/solicitacoes', autenticado, async (req, res) => {

    let where = {};

    if (req.session.usuario.tipo === 'solicitante') {
        where.usuarioId = req.session.usuario.id;
    }

    const solicitacoesRaw = await Solicitacao.findAll({
        where: where,
        include: Usuario
    });

    const solicitacoes = solicitacoesRaw.map(s => s.toJSON());

    const isAdmin =
        req.session.usuario.tipo === 'administrador';

    res.render('listarSolicitacoes', {
        solicitacoes,
        isAdmin,
        usuario: req.session.usuario
    });

});

app.get('/solicitacoes/cadastrar', somenteSolicitante, (req, res) => {

    res.render('cadastrarSolicitacao', {
        usuario: req.session.usuario
    });

});

app.post('/solicitacoes', somenteSolicitante, async (req, res) => {

    const {
        titulo,
        descricao,
        prioridade
    } = req.body;

    await Solicitacao.create({

        titulo,
        descricao,
        prioridade,

        usuarioId: req.session.usuario.id,

        status: 'pendente',

        etapa: null

    });

    res.redirect('/solicitacoes');

});

app.get('/solicitacoes/:id/editar', somenteSolicitante, async (req, res) => {

    const solicitacao = await Solicitacao.findByPk(
        req.params.id,
        {
            raw: true
        }
    );

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.usuarioId !== req.session.usuario.id) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.status !== 'pendente') {
        return res.redirect('/solicitacoes');
    }

    res.render('editarSolicitacao', {
        solicitacao
    });

});

app.post('/solicitacoes/:id/editar', somenteSolicitante, async (req, res) => {

    const {
        titulo,
        descricao,
        prioridade
    } = req.body;

    const solicitacao = await Solicitacao.findByPk(req.params.id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.usuarioId !== req.session.usuario.id) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.status !== 'pendente') {
        return res.redirect('/solicitacoes');
    }

    solicitacao.titulo = titulo;
    solicitacao.descricao = descricao;
    solicitacao.prioridade = prioridade;

    await solicitacao.save();

    res.redirect('/solicitacoes');

});

app.get('/solicitacoes/:id/excluir', autenticado, async (req, res) => {

    const solicitacao = await Solicitacao.findByPk(req.params.id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    if (req.session.usuario.tipo === 'administrador') {

        if (
            solicitacao.status !== 'aprovada' &&
            solicitacao.status !== 'rejeitada'
        ) {
            return res.redirect('/solicitacoes');
        }

        await solicitacao.destroy();

        return res.redirect('/solicitacoes');

    }

    if (req.session.usuario.tipo === 'solicitante') {

        if (solicitacao.usuarioId !== req.session.usuario.id) {
            return res.redirect('/solicitacoes');
        }

        if (solicitacao.status !== 'pendente') {
            return res.redirect('/solicitacoes');
        }

        await solicitacao.destroy();

        return res.redirect('/solicitacoes');

    }

    res.redirect('/');

});

app.get('/solicitacoes/:id/acompanhar', autenticado, async (req, res) => {

    const solicitacaoRaw = await Solicitacao.findByPk(
        req.params.id,
        {
            include: Usuario
        }
    );

    if (!solicitacaoRaw) {
        return res.redirect('/solicitacoes');
    }

    const solicitacao = solicitacaoRaw.toJSON();

    if (
        req.session.usuario.tipo === 'solicitante' &&
        solicitacao.usuarioId !== req.session.usuario.id
    ) {
        return res.redirect('/solicitacoes');
    }

    res.render('acompanharSolicitacao', {

        solicitacao,

        isAdmin:
            req.session.usuario.tipo === 'administrador'

    });

});


/*
 * ATUALIZAR ETAPA
 */
app.post('/solicitacoes/:id/etapa', somenteAdmin, async (req, res) => {

    const solicitacao = await Solicitacao.findByPk(req.params.id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes');
    }

    if (solicitacao.status !== 'aprovada') {
        return res.redirect(
            '/solicitacoes/' +
            req.params.id +
            '/acompanhar'
        );
    }

    const etapasPermitidas = [
        'analise',
        'compra',
        'entrega',
        'finalizada'
    ];

    if (!etapasPermitidas.includes(req.body.etapa)) {
        return res.redirect(
            '/solicitacoes/' +
            req.params.id +
            '/acompanhar'
        );
    }

    solicitacao.etapa = req.body.etapa;

    await solicitacao.save();

    res.redirect(
        '/solicitacoes/' +
        req.params.id +
        '/acompanhar'
    );

});


/*
 * TELA DE APROVAÇÃO
 */
app.get('/solicitacoes/aprovacao', somenteAdmin, async (req, res) => {

    const solicitacoesRaw = await Solicitacao.findAll({

        where: {
            status: 'pendente'
        },

        include: Usuario

    });

    const solicitacoes =
        solicitacoesRaw.map(s => s.toJSON());

    res.render('aprovarSolicitacoes', {
        solicitacoes
    });

});


/*
 * APROVAR SOLICITAÇÃO
 */
app.post('/solicitacoes/:id/aprovar', somenteAdmin, async (req, res) => {

    const solicitacao =
        await Solicitacao.findByPk(req.params.id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes/aprovacao');
    }

    if (solicitacao.status !== 'pendente') {
        return res.redirect(
            '/solicitacoes/' +
            req.params.id +
            '/acompanhar'
        );
    }

    solicitacao.status = 'aprovada';

    solicitacao.etapa = 'analise';

    solicitacao.motivoRejeicao = null;

    await solicitacao.save();

    res.redirect(
        '/solicitacoes/' +
        req.params.id +
        '/acompanhar'
    );

});


/*
 * REJEITAR SOLICITAÇÃO
 */
app.post('/solicitacoes/:id/rejeitar', somenteAdmin, async (req, res) => {

    const solicitacao =
        await Solicitacao.findByPk(req.params.id);

    if (!solicitacao) {
        return res.redirect('/solicitacoes/aprovacao');
    }

    if (solicitacao.status !== 'pendente') {
        return res.redirect(
            '/solicitacoes/' +
            req.params.id +
            '/acompanhar'
        );
    }

    const motivoRejeicao =
        String(req.body.motivoRejeicao || '').trim();

    if (!motivoRejeicao) {
        return res.redirect(
            '/solicitacoes/' +
            req.params.id +
            '/acompanhar'
        );
    }

    solicitacao.status = 'rejeitada';

    solicitacao.etapa = 'rejeitada';

    solicitacao.motivoRejeicao = motivoRejeicao;

    await solicitacao.save();

    res.redirect(
        '/solicitacoes/' +
        req.params.id +
        '/acompanhar'
    );

});


async function iniciar() {

    await sequelize.sync();

    console.log('Banco de dados conectado!');

    app.listen(3000, () => {

        console.log(
            'Servidor rodando em http://localhost:3000'
        );

    });

}

iniciar();