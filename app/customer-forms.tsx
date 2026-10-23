'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check, Upload } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useSiteSettings } from './admin-data-provider';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-700';

function Consent() {
  return (
    <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
      <input type="checkbox" required className="mt-1 accent-emerald-700" />
      <span>Autorizo o uso dos dados informados para analisar e responder a esta solicitação, conforme a <Link className="font-bold text-emerald-800 underline" href="/privacidade">Política de Privacidade</Link>.</span>
    </label>
  );
}

function SubmissionStatus({ message, error }: { message: string; error: string }) {
  return (
    <>
      {message && <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={17} className="mt-0.5 shrink-0" />{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    </>
  );
}

export function CardRequestForm() {
  const { settings } = useSiteSettings();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { data: { user } } = await supabaseBrowser.auth.getUser();
    const { error: submitError } = await supabaseBrowser.from('solicitacoes_cartao').insert({
      usuario_id: user?.id ?? null,
      nome: String(form.get('name') ?? '').trim(),
      cpf: String(form.get('cpf') ?? '').replace(/\D/g, ''),
      telefone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      data_nascimento: form.get('birth') || null,
    });
    setBusy(false);
    if (submitError) {
      setError(`Não foi possível enviar sua solicitação: ${submitError.message}`);
      return;
    }
    formElement.reset();
    setMessage('Pré-cadastro recebido. A equipe entrará em contato para dar continuidade à análise.');
  }

  if (!settings.features.cardApplicationsEnabled) {
    return <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">O pré-cadastro do Cartão da Loja está temporariamente indisponível.</div>;
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Nome completo<input name="name" required minLength={2} maxLength={120} autoComplete="name" className={fieldClass} /></label>
        <label className="block text-sm font-semibold">CPF<input name="cpf" required inputMode="numeric" pattern="[0-9.\\-]{11,14}" maxLength={14} placeholder="000.000.000-00" className={fieldClass} /></label>
        <label className="block text-sm font-semibold">Telefone<input name="phone" required type="tel" minLength={10} maxLength={20} autoComplete="tel" className={fieldClass} /></label>
        <label className="block text-sm font-semibold">E-mail<input name="email" required type="email" maxLength={254} autoComplete="email" className={fieldClass} /></label>
        <label className="block text-sm font-semibold sm:col-span-2">Data de nascimento (opcional)<input name="birth" type="date" className={fieldClass} /></label>
      </div>
      <p className="m-0 text-xs leading-5 text-slate-500">Este formulário é um pré-cadastro e não representa aprovação ou concessão de crédito. Não informe dados bancários ou senhas.</p>
      <Consent />
      <SubmissionStatus message={message} error={error} />
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Enviando…' : 'Solicitar pré-cadastro'}</button>
    </form>
  );
}

export function ClubSignupForm() {
  const { settings } = useSiteSettings();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { data: { user } } = await supabaseBrowser.auth.getUser();
    const { error: submitError } = await supabaseBrowser.from('clube_cadastros').insert({
      usuario_id: user?.id ?? null,
      nome: String(form.get('name') ?? '').trim(),
      telefone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim() || null,
    });
    setBusy(false);
    if (submitError) {
      setError(`Não foi possível concluir o cadastro: ${submitError.message}`);
      return;
    }
    formElement.reset();
    setMessage('Cadastro recebido! Em breve você poderá receber novidades e ofertas do clube.');
  }

  const storeName = settings.institution.storeName.trim() || 'Supermercado';
  if (!settings.features.clubEnabled) {
    return <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">Novos cadastros do Clube {storeName} estão pausados no momento.</div>;
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="m-0 text-xl font-black">Faça seu pré-cadastro</h2>
      <label className="block text-sm font-semibold">Nome completo<input name="name" required minLength={2} maxLength={120} autoComplete="name" className={fieldClass} /></label>
      <label className="block text-sm font-semibold">WhatsApp / telefone<input name="phone" required type="tel" minLength={10} maxLength={20} autoComplete="tel" className={fieldClass} /></label>
      <label className="block text-sm font-semibold">E-mail (opcional)<input name="email" type="email" maxLength={254} autoComplete="email" className={fieldClass} /></label>
      <Consent />
      <SubmissionStatus message={message} error={error} />
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Enviando…' : 'Quero participar do clube'}</button>
    </form>
  );
}

export function JobApplicationForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get('resume_file');
    const resumeFile = file instanceof File && file.size > 0 ? file : null;
    if (!resumeFile && !String(form.get('resume_text') ?? '').trim()) {
      setBusy(false);
      setError('Informe o currículo em texto ou anexe um arquivo.');
      return;
    }
    let filePath: string | null = null;
    if (resumeFile) {
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(resumeFile.type)) {
        setBusy(false);
        setError('Anexe seu currículo em PDF, DOC ou DOCX.');
        return;
      }
      if (resumeFile.size > 5 * 1024 * 1024) {
        setBusy(false);
        setError('O currículo anexado deve ter no máximo 5 MB.');
        return;
      }
      const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      filePath = `resumes/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabaseBrowser.storage.from('curriculos').upload(filePath, resumeFile, { contentType: resumeFile.type, upsert: false });
      if (uploadError) {
        setBusy(false);
        setError(`Não foi possível enviar o currículo: ${uploadError.message}`);
        return;
      }
    }
    const { data: { user } } = await supabaseBrowser.auth.getUser();
    const { error: submitError } = await supabaseBrowser.from('candidaturas').insert({
      usuario_id: user?.id ?? null,
      nome: String(form.get('name') ?? '').trim(),
      contato: String(form.get('contact') ?? '').trim(),
      cargo_desejado: String(form.get('role') ?? '').trim(),
      curriculo_texto: String(form.get('resume_text') ?? '').trim(),
      arquivo_path: filePath,
    });
    setBusy(false);
    if (submitError) {
      setError(`Não foi possível salvar sua candidatura: ${submitError.message}`);
      return;
    }
    formElement.reset();
    setMessage('Currículo recebido. Obrigado pelo interesse em trabalhar conosco!');
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Nome completo<input name="name" required minLength={2} maxLength={120} autoComplete="name" className={fieldClass} /></label>
        <label className="block text-sm font-semibold">Telefone ou e-mail de contato<input name="contact" required minLength={8} maxLength={80} className={fieldClass} /></label>
        <label className="block text-sm font-semibold sm:col-span-2">Cargo desejado<input name="role" required minLength={2} maxLength={120} placeholder="Ex.: Repositor(a), Operador(a) de caixa" className={fieldClass} /></label>
      </div>
      <label className="block text-sm font-semibold">Currículo em texto (ou adicione um arquivo abaixo)<textarea name="resume_text" rows={6} maxLength={20000} placeholder="Experiências, formação e habilidades" className={fieldClass} /></label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
        <Upload size={20} />Anexar currículo (PDF, DOC ou DOCX · até 5 MB)
        <input name="resume_file" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" />
      </label>
      <Consent />
      <SubmissionStatus message={message} error={error} />
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-800 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Enviando candidatura…' : 'Enviar currículo'}</button>
    </form>
  );
}
