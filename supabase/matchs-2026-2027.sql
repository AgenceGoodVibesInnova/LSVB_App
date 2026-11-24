-- Matchs à domicile NM1 2026-2027 (calendrier FFBB, à partir du 24/11/2026).
-- Heure 20:00 par défaut : à corriger dans /admin si besoin. Prix en centimes.
-- À exécuter une fois dans Supabase > SQL Editor, après 0001_init.sql.

insert into public.events (id, name, starts_at, venue, capacity, on_sale, journee, prices) values
('J15FOU', 'LSVB vs Fougères', '2026-12-11 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 15, '{"full":1000,"reduced":700,"child":400,"bt":800,"bs":500,"b":250,"s":500,"t":800}'),
('J16CHA', 'LSVB vs Challans', '2026-12-15 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 16, '{"full":1000,"reduced":700,"child":400,"bt":800,"bs":500,"b":250,"s":500,"t":800}'),
('J18REN', 'LSVB vs Rennes',   '2027-01-08 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 18, '{"full":1000,"reduced":700,"child":400,"bt":800,"bs":500,"b":250,"s":500,"t":800}'),
('J20LOR', 'LSVB vs Lorient',  '2027-01-19 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 20, '{"full":1000,"reduced":700,"child":400,"bt":800,"bs":500,"b":250,"s":500,"t":800}'),
('J22ANG', 'LSVB vs Angers',   '2027-01-29 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 22, '{"full":1000,"reduced":700,"child":400,"bt":800,"bs":500,"b":250,"s":500,"t":800}'),
('J24VIT', 'LSVB vs Vitré',    '2027-02-12 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 24, '{"full":1000,"reduced":700,"child":400,"bt":800,"bs":500,"b":250,"s":500,"t":800}'),
('J26LAV', 'LSVB vs Laval',    '2027-02-19 20:00 Europe/Paris', 'Arena Stadium — Les Sables d''Olonne', 0, true, 26, '{"full":1000,"reduced":700,"child":400,"bt":800,"bs":500,"b":250,"s":500,"t":800}')
on conflict (id) do nothing;
