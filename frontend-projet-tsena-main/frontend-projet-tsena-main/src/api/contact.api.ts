import { post } from './client';

export interface ContactMessageDto {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Champ piège anti-robot (doit rester vide). */
  website?: string;
}

export interface ContactMessageResult {
  delivered: boolean;
  supportEmail: string;
}

export const contactApi = {
  /** Transmet le message à l'équipe Tsena (adresse de support configurée côté serveur). */
  send: (dto: ContactMessageDto) => post<ContactMessageResult>('/contact', dto),
};
