'use strict'

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sample_orders', {
      sample_order_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      order_no: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },
      customer_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      primary_phone: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: false,
        defaultValue: 'KR',
      },
      full_address: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      delivery_message: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      pii_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      pii_outbox_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      source_tag: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'sample_seed',
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
    await queryInterface.dropTable('sample_orders')
  },
}
