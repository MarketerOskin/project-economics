'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { MemberSelect } from './member-select';
import { CrmImport, type CrmSelection } from './crm-import';

const formSchema = z
  .object({
    name: z.string().trim().min(1, 'Укажите название проекта').max(200),
    clientName: z.string().trim().max(200).optional(),
    description: z.string().trim().max(4000).optional(),
    internalComment: z.string().trim().max(4000).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (v) => !v.startDate || !v.endDate || v.endDate >= v.startDate,
    { path: ['endDate'], message: 'Дата окончания не может быть раньше даты начала' },
  );

type FormValues = z.infer<typeof formSchema>;

export interface ProjectFormInitial {
  id?: string;
  name?: string;
  clientName?: string | null;
  description?: string | null;
  internalComment?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  memberIds?: string[];
}

export function ProjectForm({ initial }: { initial?: ProjectFormInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(initial?.id);
  const [members, setMembers] = React.useState<string[]>(initial?.memberIds ?? []);
  const [submitting, setSubmitting] = React.useState(false);
  const [source, setSource] = React.useState<'MANUAL' | 'BITRIX_CRM'>('MANUAL');
  const [crm, setCrm] = React.useState<CrmSelection | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initial?.name ?? '',
      clientName: initial?.clientName ?? '',
      description: initial?.description ?? '',
      internalComment: initial?.internalComment ?? '',
      startDate: initial?.startDate ?? '',
      endDate: initial?.endDate ?? '',
    },
  });

  const pickCrm = (v: CrmSelection | null) => {
    setCrm(v);
    if (v) {
      setValue('name', v.title);
      if (v.clientName) setValue('clientName', v.clientName);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const payload = {
      name: values.name,
      clientName: values.clientName || undefined,
      description: values.description || undefined,
      internalComment: values.internalComment || undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      ...(isEdit ? {} : { memberIds: members }),
      ...(!isEdit && source === 'BITRIX_CRM' && crm
        ? { source: 'BITRIX_CRM', crmEntityTypeId: crm.entityTypeId, crmEntityId: crm.id }
        : {}),
    };
    try {
      if (isEdit && initial?.id) {
        await apiFetch(`/api/projects/${initial.id}`, { method: 'PATCH', body: payload });
        await apiFetch(`/api/projects/${initial.id}/members`, {
          method: 'PUT',
          body: { userIds: members },
        });
        toast('Проект обновлён');
        router.push(`/projects/${initial.id}`);
      } else {
        const { id } = await apiFetch<{ id: string }>('/api/projects', {
          method: 'POST',
          body: payload,
        });
        toast('Проект создан');
        router.push(`/projects/${id}`);
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        for (const [k, msg] of Object.entries(err.fields)) {
          setError(k as keyof FormValues, { message: msg });
        }
      } else {
        toast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-5">
      {!isEdit ? (
        <Segmented
          value={source}
          onChange={(v) => {
            setSource(v);
            if (v === 'MANUAL') pickCrm(null);
          }}
          options={[
            { value: 'MANUAL', label: 'Создать вручную' },
            { value: 'BITRIX_CRM', label: 'Выбрать из Bitrix24' },
          ]}
        />
      ) : null}

      {!isEdit && source === 'BITRIX_CRM' ? (
        <Field label="CRM-сущность" error={undefined} hint="Сделка или компания из Bitrix24">
          <CrmImport value={crm} onChange={pickCrm} />
        </Field>
      ) : null}

      <Field label="Название" htmlFor="name" error={errors.name?.message}>
        <Input id="name" {...register('name')} placeholder="Внедрение CRM «Альфа»" />
      </Field>

      <Field label="Клиент" htmlFor="clientName" error={errors.clientName?.message}>
        <Input id="clientName" {...register('clientName')} placeholder="ООО «Альфа-Трейд»" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Дата начала" htmlFor="startDate" error={errors.startDate?.message}>
          <Input id="startDate" type="date" {...register('startDate')} />
        </Field>
        <Field label="Дата окончания" htmlFor="endDate" error={errors.endDate?.message}>
          <Input id="endDate" type="date" {...register('endDate')} />
        </Field>
      </div>

      <Field label="Описание" htmlFor="description" error={errors.description?.message}>
        <Textarea id="description" {...register('description')} />
      </Field>

      <Field
        label="Сотрудники проекта"
        error={undefined}
        hint="Видят проект и его финансы"
      >
        <MemberSelect value={members} onChange={setMembers} />
      </Field>

      <Field
        label="Внутренний комментарий"
        htmlFor="internalComment"
        error={errors.internalComment?.message}
        hint="Виден только руководителям и администраторам"
      >
        <Textarea id="internalComment" {...register('internalComment')} />
      </Field>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать проект'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
