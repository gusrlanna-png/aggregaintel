-- Rastreabilidade da identidade: quem vinculou (usuário do app) e de qual conta
-- de origem (ex.: e-mail M365 do dono do contato no Outlook) — base para, no
-- futuro, devolver/unificar o contato no Outlook de cada usuário.
alter table pessoa_identidades add column if not exists criado_por uuid default auth.uid();
alter table pessoa_identidades add column if not exists conta_origem text;
