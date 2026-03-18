export enum Permission {
  // User Management
  USER_CREATE = 'user_create',
  USER_READ = 'user_read',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',

  // Profile Management
  PROFILE_READ = 'profile_read',
  PROFILE_UPDATE = 'profile_update',
  PROFILE_DELETE = 'profile_delete',

  // Role Management
  ROLE_CREATE = 'role_create',
  ROLE_READ = 'role_read',
  ROLE_UPDATE = 'role_update',
  ROLE_DELETE = 'role_delete',

  // Dashboard & Analytics
  DASHBOARD_READ = 'dashboard_read',
  ANALYTICS_READ = 'analytics_read',

  // Subscription Management
  SUBSCRIPTION_CREATE = 'subscription_create',
  SUBSCRIPTION_READ = 'subscription_read',
  SUBSCRIPTION_UPDATE = 'subscription_update',
  SUBSCRIPTION_DELETE = 'subscription_delete',

  // Match Management
  MATCH_CREATE = 'match_create',
  MATCH_READ = 'match_read',
  MATCH_UPDATE = 'match_update',
  MATCH_DELETE = 'match_delete',
}

export enum UserRole {
  USER = 'User',
  EXPERT = 'Expert',
  ADMIN = 'Admin',
  SUPER_ADMIN = 'SuperAdmin',
}

export enum StatusEnum {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export enum CmsType {
  PRIVACY_POLICY = 'privacy_policy',
  TERMS_AND_CONDITIONS = 'terms_and_conditions',
}

export enum SortOrderEnum {
  ASC = 'Asc',
  DESC = 'Desc',
}

export enum SocialPlatformEnum {
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  LINKEDIN = 'linkedin',
  TWITTER = 'twitter',
  WEBSITE = 'website',
}
