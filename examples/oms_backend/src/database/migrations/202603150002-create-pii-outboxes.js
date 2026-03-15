'use strict'

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pii_outboxes', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      idempotency_key: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true,
      },
      source_table: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      source_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      event_payload: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      pii_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      request_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      next_retry_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pii_outboxes')
  },
}
