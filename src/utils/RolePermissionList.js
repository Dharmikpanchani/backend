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
    create: 'role_add',
    update: 'role_edit',
    read: 'role_view',
    delete: 'role_delete',
    status: 'role_status',
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
  plan: {
    create: 'plan_add',
    update: 'plan_edit',
    read: 'plan_view',
    delete: 'plan_delete',
    status: 'plan_status',
  },
};

export const schoolAdminPermission = {
  dashboard: {
    read: 'dashboard_view',
  },
  role: {
    create: 'role_add',
    update: 'role_edit',
    read: 'role_view',
    delete: 'role_delete',
    status: 'role_status',
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
