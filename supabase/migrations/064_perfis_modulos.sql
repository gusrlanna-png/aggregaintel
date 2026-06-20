-- Perfis por módulo: rotas de analista_inteligencia (IDM) e financeiro.
insert into perfil_rotas (perfil, prefixo) values
  ('analista_inteligencia','/dashboard'),
  ('analista_inteligencia','/mapa'),
  ('analista_inteligencia','/concorrentes'),
  ('analista_inteligencia','/mercados'),
  ('analista_inteligencia','/mercado'),
  ('analista_inteligencia','/inteligencia'),
  ('analista_inteligencia','/projecao'),
  ('analista_inteligencia','/ranking'),
  ('analista_inteligencia','/cfem'),
  ('analista_inteligencia','/produtos'),
  ('analista_inteligencia','/nf'),
  ('analista_inteligencia','/grupos'),
  ('financeiro','/dashboard'),
  ('financeiro','/financeiro')
on conflict (perfil, prefixo) do nothing;
