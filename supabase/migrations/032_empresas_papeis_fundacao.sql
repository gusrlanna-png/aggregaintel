-- FASE 1 / Passo 1: fundação do cadastro único de empresas (aditivo, sem mudança
-- de comportamento). A tabela física continua "emissores" por ora (preserva
-- todas as FKs/embeds de produtor = a origem/referência do sistema); o rename
-- para "empresas" e o fold dos clientes vêm no passo 2 (DB + código juntos).

-- Flags de papel (um mesmo cadastro pode ter vários papéis).
alter table emissores add column if not exists eh_produtor boolean not null default false;
alter table emissores add column if not exists eh_cliente boolean not null default false;
alter table emissores add column if not exists eh_fornecedor boolean not null default false;
alter table emissores add column if not exists eh_transportador boolean not null default false;

-- Todos os cadastros atuais são produtores (origem do sistema).
update emissores set eh_produtor = true where eh_produtor = false;

-- Colunas que hoje só existem em clientes (para receber o fold no passo 2).
alter table emissores add column if not exists fantasia text;
alter table emissores add column if not exists cpf text;
alter table emissores add column if not exists bairro text;
alter table emissores add column if not exists segmento text;
alter table emissores add column if not exists porte text;
alter table emissores add column if not exists regiao_id uuid;
alter table emissores add column if not exists dono_vendedor_id uuid;
alter table emissores add column if not exists status_validacao text;
alter table emissores add column if not exists transportadora text;
alter table emissores add column if not exists contatos jsonb;
alter table emissores add column if not exists contato_nome text;
alter table emissores add column if not exists status text;
alter table emissores add column if not exists geocode_tentado timestamptz;
alter table emissores add column if not exists empresa_principal_id uuid references emissores(id);
