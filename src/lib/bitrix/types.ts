/** Bitrix24 REST DTOs — only the fields this app reads. */

export interface BitrixTokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  domain?: string;
  member_id?: string;
  client_endpoint?: string;
  application_token?: string;
}

export interface BitrixUser {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  PERSONAL_PHOTO?: string;
  WORK_POSITION?: string;
  ACTIVE?: boolean | string;
  IS_ONLINE?: string;
}

export interface BitrixCurrentUser extends BitrixUser {
  ADMIN?: boolean;
}

/** crm.item.* — fields common to Deal (entityTypeId 2) and Company (4). */
export interface CrmItem {
  id: number;
  title?: string;
  companyId?: number;
  contactId?: number;
  opportunity?: string;
  [key: string]: unknown;
}

export interface BitrixListResponse<T> {
  result: T[] | { items: T[] };
  total?: number;
  next?: number;
  error?: string;
  error_description?: string;
}

export const ENTITY_TYPE_ID = {
  DEAL: 2,
  COMPANY: 4,
} as const;
