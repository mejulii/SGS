CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    setor TEXT NOT NULL,
    tipo TEXT NOT NULL
);

CREATE TABLE solicitacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    prioridade TEXT,
    status TEXT DEFAULT 'pendente',
    motivoRejeicao TEXT,
    usuarioId INTEGER,
    FOREIGN KEY (usuarioId) REFERENCES usuarios(id)
);