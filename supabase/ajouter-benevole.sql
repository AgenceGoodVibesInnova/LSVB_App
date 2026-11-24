-- Donne l'accès au scanner (entrée et buvette) à un bénévole.
-- Plus simple : invitez la personne depuis /admin/equipe (niveau « Scanner »).
-- Sinon : 1. Créez d'abord son compte sur le site (page /connexion) et confirmez-le.
-- 2. Remplacez l'adresse ci-dessous, puis exécutez ce script dans SQL Editor.

insert into public.staff (user_id, email, role)
select id, email, 'scan'
from auth.users
where email = 'BENEVOLE@exemple.fr'
on conflict (user_id) do update set role = 'scan';

-- Pour retirer l'accès :
-- delete from public.staff where email = 'BENEVOLE@exemple.fr';
