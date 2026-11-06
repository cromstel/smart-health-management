-- 007 -- Emergency module permissions
--
-- The emergency board is guarded by a permission on the `emergency` module.
-- The seed creates those rows, but an installation that was seeded before
-- the module existed has no rows for it, and every request to the board is
-- then refused with 403.
--
-- The module is not one of the four in which the repository grants blanket
-- access, so the rows are created explicitly here.
--
-- The rows are inserted only for the roles that exist. A migration must not
-- depend on the seed having run first: this one is applied between the
-- schema and the seed on a clean install, where there are no roles yet, and
-- it has to succeed there rather than fail on a foreign key.

INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete)
SELECT
  r.id,
  'emergency',
  p.can_view,
  p.can_add,
  p.can_edit,
  p.can_delete
FROM roles r
JOIN (
  SELECT 2 AS role_id, 1 AS can_view, 1 AS can_add, 1 AS can_edit, 1 AS can_delete
  UNION ALL SELECT 3, 1, 1, 1, 0
  UNION ALL SELECT 5, 1, 0, 1, 0
) p ON p.role_id = r.id
ON DUPLICATE KEY UPDATE
  can_view = VALUES(can_view),
  can_add = VALUES(can_add),
  can_edit = VALUES(can_edit),
  can_delete = VALUES(can_delete);
