import mongoose from 'mongoose';

const RolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true, // 🔥 should be required
      trim: true,
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null, // 🔥 IMPORTANT → null = global role
      index: true,
    },

    permissions: {
      type: [String],
      default: [],
    },

    isDefault: {
      type: Boolean,
      default: false, // 🔥 system roles (Super Admin etc.)
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null, // 🔥 track who created role
    },
  },
  { timestamps: true }
);

// 🔥 UNIQUE ROLE PER SCHOOL
RolePermissionSchema.index({ role: 1, schoolId: 1 }, { unique: true });

const RoleManagement = mongoose.model('RoleManagement', RolePermissionSchema);

export default RoleManagement;
