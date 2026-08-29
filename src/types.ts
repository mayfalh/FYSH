export type FeatureItem = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  details: string[];
  metrics: string;
};

export type NavSection = 'product' | 'solutions' | 'pricing' | 'company';

export interface ApiKeyItem {
  id: string;
  name: string;
  token: string;
  maskedToken: string;
  access: 'Full access' | 'Read only' | 'Custom';
  ipAllowlist: string;
  userId: string;
  userEmail?: string;
  createdAt: string;
  lastUsedAt?: string;
  status: 'ACTIVE' | 'REVOKED';
  allowedToolkits?: string[];
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  ownerEmail: string;
  activeProject: string;
}

