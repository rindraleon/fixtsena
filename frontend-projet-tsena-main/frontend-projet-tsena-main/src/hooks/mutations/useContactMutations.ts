import { useMutation } from '@tanstack/react-query';
import { contactApi, type ContactMessageDto } from '../../api/contact.api';

/** Envoi du formulaire de contact public (aucun cache à invalider). */
export function useSendContactMessage() {
  return useMutation({
    mutationFn: (dto: ContactMessageDto) => contactApi.send(dto),
  });
}
