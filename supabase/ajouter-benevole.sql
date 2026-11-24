-- Donne l'accès au scanner (entrée et buvette) à un bénévole.
-- 1. Créez d'abord son compte : Supabase > Authentication > Users > Add user > Create new user
--    (e-mail + mot de passe, « Auto Confirm User » coché).
-- 2. Remplacez l'adresse ci-dessous, puis exécutez ce script dans SQL Editor.

insert into public.staff (user_id, email, role)
select id, email, 'scan'
from auth.users
where email = 'BENEVOLE@exemple.fr'
on conflict (user_id) do update set role = 'scan';

-- Pour retirer l'accès :
-- delete from public.staff where email = 'BENEVOLE@exemple.fr';
