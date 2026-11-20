import { get, getPaginated, patch, post } from './client';
import type {
  AddEvidenceDto,
  ApiDispute,
  CreateDisputeDto,
  DisputeEvidence,
  DisputeFilters,
  DisputeStats,
  Paginated,
  ResolveDisputeDto,
  UpdateDisputeStatusDto,
} from '../types/api';

export const disputesApi = {
  list: (filters: DisputeFilters = {}): Promise<Paginated<ApiDispute>> =>
    getPaginated<ApiDispute>('/disputes', filters as Record<string, unknown>),

  getById: (id: string) => get<ApiDispute>(`/disputes/${id}`),

  evidence: (id: string) => get<DisputeEvidence[]>(`/disputes/${id}/evidence`),

  stats: () => get<DisputeStats>('/disputes/stats'),

  create: (dto: CreateDisputeDto) => post<ApiDispute>('/disputes', dto),

  addEvidence: (id: string, dto: AddEvidenceDto) => post<DisputeEvidence>(`/disputes/${id}/evidence`, dto),

  resolve: (id: string, dto: ResolveDisputeDto) => post<ApiDispute>(`/disputes/${id}/resolve`, dto),

  updateStatus: (id: string, dto: UpdateDisputeStatusDto) => patch<ApiDispute>(`/disputes/${id}/status`, dto),
};
