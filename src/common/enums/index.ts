export enum Brand {
  SHUBHA_VIVAH = 'shubha_vivah',
  LINGAYAT = 'lingayat',
  VOKKALIGA = 'vokkaliga',
}

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

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

export enum StatusEnum {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export enum SortOrderEnum {
  ASC = 'Asc',
  DESC = 'Desc',
}

export enum ProfileForEnum {
  MYSELF = 'Myself',
  MY_SON = 'My Son',
  MY_DAUGHTER = 'My Daughter',
  MY_BROTHER = 'My Brother',
  MY_SISTER = 'My Sister',
  MY_FRIEND = 'My Friend',
  MY_RELATIVE = 'My Relative',
  OTHERS = 'Others',
}

export enum MaritalStatus {
  NEVER_MARRIED = 'Never married',
  WIDOW_WIDOWER = 'Widow / Widower',
  DIVORCED = 'Divorced',
  ANNULLED = 'Annulled',
}

export enum MasterTypeEnum {
  EMPLOYMENT_TYPE = 'employment_type',
  NATIONAL_LANGUAGE = 'national_language',
  INTERNATIONAL_LANGUAGE = 'international_language',
  HOME_TOWN = 'home_town',
}

export enum ResidenceTypeEnum {
  OWN_HOUSE = 'Own House',
  RENTED_HOUSE = 'Rented House',
  COMPANY_PROVIDED_ACCOMMODATION = 'Company-Provided Accommodation',
  PAYING_GUEST = 'Paying Guest (PG)',
  HOSTEL = 'Hostel',
  SHARED_ACCOMMODATION = 'Shared Accommodation',
  OTHER = 'Other',
}

export enum LivingWithEnum {
  PARENTS = 'Parents',
  ALONE = 'Alone',
}

export enum DietEnum {
  VEGETARIAN = 'Vegetarian',
  NON_VEGETARIAN = 'Non-Vegetarian',
  EGGETARIAN = 'Eggetarian',
}

export enum SmokingEnum {
  NON_SMOKER = 'Non-Smoker',
  OCCASIONALLY = 'Occasionally',
  REGULAR = 'Regular Smoker',
  TRYING_TO_QUIT = 'Trying to Quit',
}

export enum DrinkingEnum {
  NON_DRINKER = 'Non-Drinker',
  OCCASIONALLY = 'Occasionally',
  REGULAR = 'Regular Drinker',
  TRYING_TO_QUIT = 'Trying to Quit',
}

export enum FamilyTypeEnum {
  NUCLEAR_FAMILY = 'Nuclear Family',
  JOINT_FAMILY = 'Joint Family',
  EXTENDED_FAMILY = 'Extended Family',
}

export enum EducationCategoryEnum {
  ENGINEERING_TECHNOLOGY = 'engineering_technology',
  MEDICINE_HEALTHCARE = 'medicine_healthcare',
  ARTS_HUMANITIES_SOCIAL_SCIENCE = 'arts_humanities_social_science',
  SCIENCE = 'science',
  COMMERCE_MANAGEMENT = 'commerce_management',
  LAW = 'law',
}

export enum EducationLevelEnum {
  UNDERGRADUATE = 'Undergraduate',
  POSTGRADUATE = 'Postgraduate',
  DOCTORAL = 'Doctoral',
  DIPLOMA = 'Diploma',
}

export enum ReligionEnum {
  HINDU = 'Hindu',
  MUSLIM_SHIA = 'Muslim-Shia',
  MUSLIM_SUNNI = 'Muslim-Sunni',
  MUSLIM_OTHERS = 'Muslim-Others',
  CHRISTIAN = 'Christian',
  SIKH = 'Sikh',
  JAIN_DIGAMBAR = 'Jain-Digambar',
  JAIN_SHWETAMBAR = 'Jain-Shwetambar',
  JAIN_OTHERS = 'Jain-Others',
  BUDDHIST = 'Buddhist',
  PARSI = 'Parsi',
  JEWISH = 'Jewish',
  INTER_RELIGION = 'Inter-Religion',
}

export enum InquiryStatusEnum {
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

export enum IdTypeEnum {
  AADHAAR = 'aadhaar',
  PAN = 'pan',
  VOTER_ID = 'voter_id',
  PASSPORT = 'passport',
  DRIVING_LICENSE = 'driving_license',
}

export enum IdVerificationStatusEnum {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum CitizenEnum {
  INDIAN = 'Indian',
  NRI = 'NRI',
}

export enum CastePreferenceEnum {
  SAME_CASTE = 'same_caste',
  OPEN_TO_ANY_CASTE = 'open_to_any_caste',
}
