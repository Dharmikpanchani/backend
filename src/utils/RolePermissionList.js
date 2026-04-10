export const developerRolePermissionList = {
  dashboard: {
    read: 'dashboard_view',
  },
  school: {
    create: 'school_add',
    update: 'school_edit',
    read: 'school_view',
    delete: 'school_delete',
    status: 'school_status',
  },
  role: {
    create: 'admin_role_add',
    update: 'admin_role_edit',
    read: 'admin_role_view',
    delete: 'admin_role_delete',
    status: 'admin_role_status',
  },
  admin_user: {
    create: 'admin_user_add',
    update: 'admin_user_edit',
    read: 'admin_user_view',
    delete: 'admin_user_delete',
    status: 'admin_user_status',
  },
  user: {
    read: 'user_view',
    delete: 'user_delete',
    status: 'user_status',
  },
};

export const schoolAdminPermission = {
  dashboard: {
    read: 'dashboard_view',
  },
  role: {
    create: 'admin_role_add',
    update: 'admin_role_edit',
    read: 'admin_role_view',
    delete: 'admin_role_delete',
    status: 'admin_role_status',
  },
  admin_user: {
    create: 'admin_user_add',
    update: 'admin_user_edit',
    read: 'admin_user_view',
    delete: 'admin_user_delete',
    status: 'admin_user_status',
  },
  theme: {
    read: 'theme_view',
    update: 'theme_edit',
  },
  school_profile: {
    read: 'school_profile_view',
    update: 'school_profile_edit',
  },
  department: {
    create: 'department_add',
    read: 'department_view',
    update: 'department_edit',
    delete: 'department_delete',
    status: 'department_status',
  },
  subject: {
    create: 'subject_add',
    read: 'subject_view',
    update: 'subject_edit',
    delete: 'subject_delete',
    status: 'subject_status',
  },
  class: {
    create: 'class_add',
    read: 'class_view',
    update: 'class_edit',
    delete: 'class_delete',
    status: 'class_status',
  },
  section: {
    create: 'section_add',
    read: 'section_view',
    update: 'section_edit',
    delete: 'section_delete',
    status: 'section_status',
  },
  teacher: {
    create: 'teacher_add',
    read: 'teacher_view',
    update: 'teacher_edit',
    delete: 'teacher_delete',
    status: 'teacher_status',
  },
};
