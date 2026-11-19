export type UserRole = 'admin' | 'user' | 'manager';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActive?: string;
  createdAt: string;
  avatar?: string;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'manager';
  status?: 'active' | 'inactive';
  password?: string;
}

export interface UserFilters {
  search?: string;
  role?: UserRole | 'all';
  status?: UserStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface UsersPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UsersListResponse {
  data: AppUser[];
  pagination: UsersPagination;
}
