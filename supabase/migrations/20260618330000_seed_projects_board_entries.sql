insert into public.projects (trello_board_id, name, status)
values
  ('5oj0clmi', 'PSLite', 'active'),
  ('5oj0clmi', 'PSLite SEO', 'active'),
  ('5oj0clmi', 'PSLite ProStock', 'active'),
  ('5oj0clmi', 'SW Plumb', 'active'),
  ('5oj0clmi', 'Legacy', 'active')
on conflict (name) do update
set
  trello_board_id = excluded.trello_board_id,
  status = excluded.status;
