UPDATE usuarios
SET setor = 'Financeiro'
WHERE id = 1;

UPDATE solicitacoes
SET status = 'aprovada'
WHERE id = 1;

UPDATE solicitacoes
SET
    status = 'rejeitada',
    motivoRejeicao = 'Documentação incompleta'
WHERE id = 1;