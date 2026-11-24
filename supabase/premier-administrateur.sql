-- À exécuter UNE FOIS, après avoir créé et confirmé votre compte sur le site (page /connexion).
-- Remplacez l'adresse ci-dessous par la vôtre. Ce script vous donne le rôle d'administrateur.

insert into public.staff (user_id, email, role)
select id, email, 'admin'
from auth.users
where email = 'VOTRE-ADRESSE@exemple.fr'
on conflict (user_id) do update set role = 'admin';
