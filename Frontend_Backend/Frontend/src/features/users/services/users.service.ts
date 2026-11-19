import { apiClient } from '@/shared/lib/axios';
import type {
  AppUser,
  CreateUserDTO,
  UserFilters,
  UserRole,
  UsersListResponse,
  UserStatus,
} from '../types/user.types';
import { buildUsersRequestParams } from '../utils/users-query';

export const usersService = {
  async getUsers(filters: UserFilters): Promise<UsersListResponse> {
    const response = await apiClient.get<UsersListResponse>('/usuarios', {
      params: buildUsersRequestParams(filters),
    });
    return response.data;
  },

  async createUser(dto: CreateUserDTO): Promise<AppUser> {
    const response = await apiClient.post<AppUser>('/usuarios', dto);
    return response.data;
  },

  async updateUserRole(id: string, role: UserRole): Promise<void> {
    await apiClient.patch(`/usuarios/${id}/role`, { role });
  },

  async updateUserStatus(id: string, status: UserStatus): Promise<void> {
    await apiClient.patch(`/usuarios/${id}/status`, { status });
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/usuarios/${id}`);
  },
};
