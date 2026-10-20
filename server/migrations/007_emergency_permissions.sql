-- 007 -- Emergency module permissions
--
-- The emergency board is guarded by a permission on the `emergency` module.
-- The seed creates those rows, but an installation that was seeded before
-- the module existed has no rows for it, and every request to the board is
-- then refused with 403.
--
-- The module is not one of the four in which the repository grants blanket
-- access, so the rows are created explicitly here.

INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete)
VALUES
  (2, 'emergency', 1, 1, 1, 1),   -- admin: full access, including code blue
  (3, 'emergency', 1, 1, 1, 0),   -- doctor: admits and updates, no code blue
  (5, 'emergency', 1, 0, 1, 0)    -- nurse: reads the board and updates it
ON DUPLICATE KEY UPDATE
  can_view = VALUES(can_view),
  can_add = VALUES(can_add),
  can_edit = VALUES(can_edit),
  can_delete = VALUES(can_delete);
