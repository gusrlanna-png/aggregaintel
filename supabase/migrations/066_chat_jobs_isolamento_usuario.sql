-- Fase 3 — isolamento por usuário: cada um vê só o seu chat/jobs; admin = master.
alter table chat_mensagens add column if not exists modulo text default 'inteligencia';

drop policy if exists chat_msg_auth on chat_mensagens;
create policy cm_select on chat_mensagens for select to authenticated
  using (criado_por = auth.uid() or is_admin());
create policy cm_insert on chat_mensagens for insert to authenticated
  with check (criado_por = auth.uid());
create policy cm_delete on chat_mensagens for delete to authenticated
  using (criado_por = auth.uid() or is_admin());

drop policy if exists jobs_auth on jobs;
create policy jb_select on jobs for select to authenticated
  using (criado_por = auth.uid() or is_admin());
create policy jb_insert on jobs for insert to authenticated
  with check (criado_por = auth.uid());
create policy jb_update on jobs for update to authenticated
  using (criado_por = auth.uid() or is_admin()) with check (true);
create policy jb_delete on jobs for delete to authenticated
  using (criado_por = auth.uid() or is_admin());

drop policy if exists job_eventos_auth on job_eventos;
create policy je_select on job_eventos for select to authenticated
  using (exists (select 1 from jobs j where j.id = job_eventos.job_id and (j.criado_por = auth.uid() or is_admin())));
create policy je_insert on job_eventos for insert to authenticated
  with check (exists (select 1 from jobs j where j.id = job_eventos.job_id and j.criado_por = auth.uid()));
