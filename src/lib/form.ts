import { zodResolver } from '@hookform/resolvers/zod';
import { type FieldValues, useForm, type UseFormProps } from 'react-hook-form';
import type { z } from 'zod';

/** useForm pre-wired with a Zod schema. */
export function useZodForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>,
) {
  return useForm<z.infer<TSchema>>({ resolver: zodResolver(schema as never), mode: 'onTouched', ...options });
}
