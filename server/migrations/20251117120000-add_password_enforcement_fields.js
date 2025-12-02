export default {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      ADD COLUMN password_must_change BOOLEAN DEFAULT FALSE AFTER last_login,
      ADD COLUMN password_changed_at DATETIME NULL AFTER password_must_change,
      ADD COLUMN password_postpone_count INT DEFAULT 0 AFTER password_changed_at
    `);
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      DROP COLUMN password_must_change,
      DROP COLUMN password_changed_at,
      DROP COLUMN password_postpone_count
    `);
  }
};