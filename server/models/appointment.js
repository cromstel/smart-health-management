'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Appointment extends Model {
    /**
     * Helper method for defining associations.
     * This file contains a Sequelize model definition for the Appointment entity.
     * It defines the attributes of an appointment, including its ID, patient, doctor,
     * department, date, time, type, notes, status, and a new recurrence_rule field.
     * The associate method is used to define relationships with other models,
     * such as Patient, Staff (for doctor), and Department.
     * The model is configured to use UUIDs for the primary key and to manage timestamps.
     */
    static associate(models) {
      // define association here
      Appointment.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
      Appointment.belongsTo(models.Staff, { foreignKey: 'doctor_id', as: 'doctor' });
      Appointment.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    }
  }
  Appointment.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    appointment_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    patient_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    doctor_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    department_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    appointment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    appointment_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'scheduled',
    },
    recurrence_rule: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
    timestamps: true,
  });
  return Appointment;
};