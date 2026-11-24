-- Matchs à domicile NM1 2026-2027 (calendrier FFBB, à partir du 24/11/2026).
-- Heure 20:00 par défaut : à corriger dans /admin/matchs si besoin. Prix : ceux du catalogue (/admin/produits).
-- À exécuter une fois dans Supabase > SQL Editor, après les migrations (0001, 0002, 0003).

insert into public.events (id, name, starts_at, venue, capacity, on_sale, journee, prices) values
('J15FOU', 'LSVB vs Fougères', '2026-12-11 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 15, '{}'),
('J16CHA', 'LSVB vs Challans', '2026-12-15 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 16, '{}'),
('J18REN', 'LSVB vs Rennes',   '2027-01-08 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 18, '{}'),
('J20LOR', 'LSVB vs Lorient',  '2027-01-19 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 20, '{}'),
('J22ANG', 'LSVB vs Angers',   '2027-01-29 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 22, '{}'),
('J24VIT', 'LSVB vs Vitré',    '2027-02-12 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 24, '{}'),
('J26LAV', 'LSVB vs Laval',    '2027-02-19 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 26, '{}')
on conflict (id) do nothing;
