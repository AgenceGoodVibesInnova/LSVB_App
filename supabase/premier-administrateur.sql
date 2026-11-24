-- À exécuter UNE FOIS, après avoir créé votre compte dans Supabase
-- (Authentication > Users > Add user > Create new user, avec « Auto Confirm User » coché).
-- Remplacez l'adresse ci-dessous par la vôtre. Ce script vous donne le rôle d'administrateur.

insert into public.staff (user_id, email, role)
select id, email, 'admin'
from auth.users
where email = 'VOTRE-ADRESSE@exemple.fr'
on conflict (user_id) do update set role = 'admin';
