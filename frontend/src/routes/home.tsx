import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import z from 'zod';
import { HomePage } from '../home/home-page';

export const Route = createFileRoute('/home')({
  component: HomePage,
  validateSearch: zodValidator(z.object({
    collection: z.string().optional(), snapshot: z.string().optional(),
    entry: z.string().optional(), species: z.number().optional(),
  })),
});
