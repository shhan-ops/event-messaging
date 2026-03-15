'use strict'

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('piis', {
      pii_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      source: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      name: {
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
      hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'ACTIVE',
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

    await queryInterface.addIndex('piis', ['source', 'hash'], {
      unique: true,
      name: 'piis_source_hash_unique',
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('piis')
  },
}
