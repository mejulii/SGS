const express = require('express');
const exphbs = require('express-handlebars');
const session = require('express-session');

const sequelize = require('./config/bd');
const Usuario = require('./model/usuario.model');
const Solicitacao = require('./model/solicitacao.model');
const Historico = require('./model/historico.model');

const app = express();

const { Op } = require('sequelize');

app.engine('handlebars', exphbs.engine({
    defaultLayout: false,

    helpers: {
        ifEquals: function (a, b, options) {
            return a == b
                ? options.fn(this)
                : options.inverse(this);
        },

        formatDate: function (data) {

            if (!data) {
                return '-';
            }

            const d = new Date(data);

            if (isNaN(d.getTime())) {
                return '-';
            }

            return d.toLocaleString('pt-BR', {
                timeZone: 'America/Recife',
                dateStyle: 'short',
                timeStyle: 'medium'
            }).replace(', ', ' ');
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

const NOMES_ETAPAS = {
    analise: 'Em análise para compra',
    compra: 'Em processo de compra',
    entrega: 'Processo de entrega',
    finalizada: 'Finalizada'
};

const NOMES_PRIORIDADES = {
    baixa: 'baixa',
    media: 'média',
    alta: 'alta'
};

async function registrarHistorico(solicitacaoId, evento, descricao, usuario) {

    await Historico.create({
        solicitacaoId: solicitacaoId,
        evento: evento,
        descricao: descricao,
        responsavel: usuario ? usuario.nome : null
    });

}

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

    const isAdmin = req.session.usuario.tipo === 'administrador';

    let where = {};

    // Solicitante vê somente as próprias solicitações
    if (!isAdmin) {
        where.usuarioId = req.session.usuario.id;
    }

    const filtros = {
        status: '',
        prioridade: '',
        busca: ''
    };

    // Filtros valem só para o administrador
    if (isAdmin) {

        const statusValidos = ['pendente', 'aprovada', 'rejeitada'];
        const prioridadesValidas = ['baixa', 'media', 'alta'];

        if (statusValidos.includes(req.query.status)) {
            filtros.status = req.query.status;
            where.status = filtros.status;
        }

        if (prioridadesValidas.includes(req.query.prioridade)) {
            filtros.prioridade = req.query.prioridade;
            where.prioridade = filtros.prioridade;
        }

        const busca = String(req.query.busca || '').trim();

        if (busca) {
            filtros.busca = busca;

            where[Op.or] = [
                { titulo: { [Op.like]: '%' + busca + '%' } },
                { '$Usuario.nome$': { [Op.like]: '%' + busca + '%' } }
            ];
        }
    }

    const solicitacoesRaw = await Solicitacao.findAll({
        where: where,
        include: Usuario
    });

    const solicitacoes = solicitacoesRaw.map(s => s.toJSON());

    res.render('listarSolicitacoes', {
        solicitacoes,
        isAdmin,
        usuario: req.session.usuario,
        filtros,
        filtrado: Boolean(filtros.status || filtros.prioridade || filtros.busca)
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

    const nova = await Solicitacao.create({

        titulo,
        descricao,
        prioridade,

        usuarioId: req.session.usuario.id,

        status: 'pendente',

        etapa: null

    });

    await registrarHistorico(
        nova.id,
        'Criação',
        'Solicitação criada com prioridade ' +
            (NOMES_PRIORIDADES[prioridade] || prioridade) + '.',
        req.session.usuario
    );

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

    const alteracoes = [];

    if (solicitacao.titulo !== titulo) {
        alteracoes.push('título');
    }

    if (solicitacao.descricao !== descricao) {
        alteracoes.push('descrição');
    }

    if (solicitacao.prioridade !== prioridade) {
        alteracoes.push('prioridade');
    }

    solicitacao.titulo = titulo;
    solicitacao.descricao = descricao;
    solicitacao.prioridade = prioridade;

    await solicitacao.save();

    if (alteracoes.length > 0) {

        await registrarHistorico(
            solicitacao.id,
            'Edição',
            'Campos alterados: ' + alteracoes.join(', ') + '.',
            req.session.usuario
        );

    }

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

    const historicoRaw = await Historico.findAll({
        where: {
            solicitacaoId: solicitacao.id
        },
        order: [
            ['createdAt', 'ASC'],
            ['id', 'ASC']
        ]
    });

    const historico = historicoRaw.map(h => h.toJSON());

    res.render('acompanharSolicitacao', {

        solicitacao,

        historico,

        isAdmin:
            req.session.usuario.tipo === 'administrador'

    });

});



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

    const etapaAnterior = solicitacao.etapa;

    solicitacao.etapa = req.body.etapa;

    await solicitacao.save();

    if (etapaAnterior !== req.body.etapa) {

        await registrarHistorico(
            solicitacao.id,
            'Atualização de etapa',
            'Etapa alterada de ' +
                (NOMES_ETAPAS[etapaAnterior] || 'não definida') +
                ' para ' + NOMES_ETAPAS[req.body.etapa] + '.',
            req.session.usuario
        );

    }

    res.redirect(
        '/solicitacoes/' +
        req.params.id +
        '/acompanhar'
    );

});



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

    await registrarHistorico(
        solicitacao.id,
        'Aprovação',
        'Solicitação aprovada. Etapa inicial: Em análise para compra.',
        req.session.usuario
    );

    res.redirect(
        '/solicitacoes/' +
        req.params.id +
        '/acompanhar'
    );

});



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

    await registrarHistorico(
        solicitacao.id,
        'Rejeição',
        'Solicitação rejeitada. Motivo: ' + motivoRejeicao,
        req.session.usuario
    );

    res.redirect(
        '/solicitacoes/' +
        req.params.id +
        '/acompanhar'
    );

});


async function iniciar() {

    await sequelize.sync();


    await Solicitacao.update(
        { etapa: 'analise' },
        {
            where: {
                status: 'aprovada',
                etapa: { [Op.or]: [null, 'Em andamento', 'Aguardando análise'] }
            }
        }
    );

  
    await Solicitacao.update({ prioridade: 'media' }, { where: { prioridade: 'Média' } });
    await Solicitacao.update({ prioridade: 'alta' }, { where: { prioridade: 'Alta' } });
    await Solicitacao.update({ prioridade: 'baixa' }, { where: { prioridade: 'Baixa' } });

    console.log('Banco de dados conectado!');

    app.listen(3000, () => {

        console.log(
            'Servidor rodando em http://localhost:3000'
        );

    });

}

iniciar();