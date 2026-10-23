'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChefHat,
  Clock3,
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useSiteSettings } from '@/app/admin-data-provider';
import { revalidateSiteSettings } from '@/app/actions/site-settings';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { dailyRecipes, type Recipe, type RecipeIngredient } from '@/lib/recipes';
import { SITE_SETTINGS_TABLE, type SiteSettings } from '@/lib/site-settings';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700';
const labelClass = 'block text-xs font-bold text-slate-700';

function createEmptyIngredient(): RecipeIngredient {
  return {
    name: '',
    quantity: 1,
    unit: 'unidade',
    searchTerms: [],
  };
}

function createEmptyRecipe(): Recipe {
  return {
    id: `receita-${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    description: '',
    time: '20 min',
    servings: 4,
    ingredients: [createEmptyIngredient()],
    steps: [''],
  };
}

function buildSearchTerms(name: string, customTerms?: string[]): string[] {
  const base = name.trim().toLowerCase();
  const normalized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const terms = new Set<string>();
  if (base) terms.add(base);
  if (normalized) terms.add(normalized);
  for (const term of customTerms ?? []) {
    const clean = term.trim().toLowerCase();
    if (clean) terms.add(clean);
  }
  return Array.from(terms);
}

export default function AdminRecipesPanel() {
  const router = useRouter();
  const { settings, settingsReady, updateSettings } = useSiteSettings();
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isNewRecipe, setIsNewRecipe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!settingsReady) {
    return (
      <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
        Carregando receitas e sugestões do dia…
      </p>
    );
  }

  const recipes = Array.isArray(settings.recipes) ? settings.recipes : dailyRecipes;

  async function persistRecipes(nextRecipes: Recipe[], successText: string) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const nextSettings: SiteSettings = {
        ...settings,
        recipes: nextRecipes,
      };
      const nowIso = new Date().toISOString();
      const { error: dbError } = await supabaseBrowser
        .from(SITE_SETTINGS_TABLE)
        .upsert(
          { id: 'principal', dados: nextSettings, atualizado_em: nowIso },
          { onConflict: 'id' },
        );
      if (dbError) {
        setError(`Não foi possível salvar no Supabase: ${dbError.message}`);
        return false;
      }
      updateSettings(nextSettings);
      window.dispatchEvent(new Event('site-settings-changed'));
      await revalidateSiteSettings().catch(() => undefined);
      router.refresh();
      setMessage(successText);
      return true;
    } catch (unexpectedError) {
      console.error('Erro ao salvar receitas no Supabase.', unexpectedError);
      setError(
        unexpectedError instanceof Error
          ? `Erro ao salvar receitas: ${unexpectedError.message}`
          : 'Erro inesperado ao salvar receitas.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  function startCreateRecipe() {
    setError('');
    setMessage('');
    setIsNewRecipe(true);
    setEditingRecipe(createEmptyRecipe());
  }

  function startEditRecipe(recipe: Recipe) {
    setError('');
    setMessage('');
    setIsNewRecipe(false);
    setEditingRecipe({
      ...recipe,
      ingredients: recipe.ingredients.length
        ? recipe.ingredients.map((item) => ({
            ...item,
            searchTerms: [...item.searchTerms],
          }))
        : [createEmptyIngredient()],
      steps: recipe.steps.length ? [...recipe.steps] : [''],
    });
  }

  async function handleDeleteRecipe(recipe: Recipe) {
    const nextRecipes = recipes.filter((item) => item.id !== recipe.id);
    const ok = await persistRecipes(
      nextRecipes,
      `Receita "${recipe.name}" excluída com sucesso.`,
    );
    if (ok && editingRecipe?.id === recipe.id) {
      setEditingRecipe(null);
      setIsNewRecipe(false);
    }
  }

  async function handleRestoreDefaults() {
    const ok = await persistRecipes(
      dailyRecipes,
      'Receitas padrão restauradas com sucesso.',
    );
    if (ok) {
      setEditingRecipe(null);
      setIsNewRecipe(false);
    }
  }

  async function handleSaveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRecipe) return;

    const name = editingRecipe.name.trim();
    const description = editingRecipe.description.trim();
    const time = editingRecipe.time.trim() || '20 min';
    const servings = Math.max(1, Number(editingRecipe.servings) || 1);

    const validIngredients = editingRecipe.ingredients
      .map((ing) => ({
        name: ing.name.trim(),
        quantity: Math.max(1, Number(ing.quantity) || 1),
        unit: ing.unit.trim() || 'unidade',
        searchTerms: buildSearchTerms(ing.name, ing.searchTerms),
      }))
      .filter((ing) => Boolean(ing.name));

    const validSteps = editingRecipe.steps
      .map((step) => step.trim())
      .filter(Boolean);

    if (!name) {
      setError('Informe o nome da receita.');
      return;
    }
    if (!validIngredients.length) {
      setError('Adicione pelo menos 1 ingrediente à receita.');
      return;
    }
    if (!validSteps.length) {
      setError('Adicione pelo menos 1 passo no modo de preparo.');
      return;
    }

    const sanitizedRecipe: Recipe = {
      id: editingRecipe.id,
      name,
      description: description || `Receita especial de ${name}.`,
      time,
      servings,
      ingredients: validIngredients,
      steps: validSteps,
    };

    const exists = recipes.some((item) => item.id === sanitizedRecipe.id);
    const nextRecipes = exists
      ? recipes.map((item) =>
          item.id === sanitizedRecipe.id ? sanitizedRecipe : item,
        )
      : [...recipes, sanitizedRecipe];

    const ok = await persistRecipes(
      nextRecipes,
      isNewRecipe
        ? `Receita "${sanitizedRecipe.name}" incluída e publicada com sucesso!`
        : `Receita "${sanitizedRecipe.name}" atualizada com sucesso!`,
    );

    if (ok) {
      setEditingRecipe(null);
      setIsNewRecipe(false);
    }
  }

  function updateIngredient(
    index: number,
    patch: Partial<RecipeIngredient>,
  ) {
    if (!editingRecipe) return;
    setEditingRecipe({
      ...editingRecipe,
      ingredients: editingRecipe.ingredients.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function addIngredientRow() {
    if (!editingRecipe) return;
    setEditingRecipe({
      ...editingRecipe,
      ingredients: [...editingRecipe.ingredients, createEmptyIngredient()],
    });
  }

  function removeIngredientRow(index: number) {
    if (!editingRecipe) return;
    const filtered = editingRecipe.ingredients.filter((_, idx) => idx !== index);
    setEditingRecipe({
      ...editingRecipe,
      ingredients: filtered.length ? filtered : [createEmptyIngredient()],
    });
  }

  function updateStep(index: number, value: string) {
    if (!editingRecipe) return;
    setEditingRecipe({
      ...editingRecipe,
      steps: editingRecipe.steps.map((step, idx) =>
        idx === index ? value : step,
      ),
    });
  }

  function addStepRow() {
    if (!editingRecipe) return;
    setEditingRecipe({
      ...editingRecipe,
      steps: [...editingRecipe.steps, ''],
    });
  }

  function removeStepRow(index: number) {
    if (!editingRecipe) return;
    const filtered = editingRecipe.steps.filter((_, idx) => idx !== index);
    setEditingRecipe({
      ...editingRecipe,
      steps: filtered.length ? filtered : [''],
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 flex items-center gap-2 text-lg font-black text-slate-900">
              <ChefHat size={21} className="text-emerald-700" />
              Receitas e Sugestões do Dia
            </h2>
            <p className="mb-0 mt-1 text-xs text-slate-500">
              Inclua novas receitas, edite ingredientes e modo de preparo ou exclua receitas. Todas as alterações são salvas no Supabase e exibidas imediatamente no site.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleRestoreDefaults()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RotateCcw size={15} />
              Restaurar padrão
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={startCreateRecipe}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Plus size={16} />
              Incluir nova receita
            </button>
          </div>
        </div>

        {message && (
          <p
            role="status"
            className="mb-0 mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"
          >
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-0 mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-900"
          >
            {error}
          </p>
        )}
      </section>

      {editingRecipe && (
        <form
          onSubmit={handleSaveRecipe}
          className="space-y-5 rounded-2xl border-2 border-emerald-700 bg-white p-5 shadow-md"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="m-0 text-base font-black text-emerald-950">
              {isNewRecipe ? 'Incluir Nova Receita' : `Editar Receita: ${editingRecipe.name || 'Sem título'}`}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingRecipe(null);
                setIsNewRecipe(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              <X size={16} />
              Cancelar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={`${labelClass} sm:col-span-2`}>
              Nome da receita
              <input
                required
                maxLength={100}
                value={editingRecipe.name}
                onChange={(event) =>
                  setEditingRecipe({ ...editingRecipe, name: event.target.value })
                }
                placeholder="Ex.: Strogonoff de Frango Cremoso"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Tempo de preparo
              <input
                required
                maxLength={40}
                value={editingRecipe.time}
                onChange={(event) =>
                  setEditingRecipe({ ...editingRecipe, time: event.target.value })
                }
                placeholder="Ex.: 30 min"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Rendimento (porções)
              <input
                required
                type="number"
                min={1}
                max={50}
                value={editingRecipe.servings}
                onChange={(event) =>
                  setEditingRecipe({
                    ...editingRecipe,
                    servings: Math.max(1, Number(event.target.value) || 1),
                  })
                }
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2 lg:col-span-4`}>
              Descrição curta
              <input
                maxLength={220}
                value={editingRecipe.description}
                onChange={(event) =>
                  setEditingRecipe({
                    ...editingRecipe,
                    description: event.target.value,
                  })
                }
                placeholder="Ex.: Uma receita rápida e deliciosa para o almoço em família."
                className={inputClass}
              />
            </label>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="m-0 text-sm font-black text-slate-900">
                  Ingredientes da receita
                </h4>
                <p className="mb-0 mt-0.5 text-xs text-slate-500">
                  O sistema vincula automaticamente cada ingrediente aos produtos disponíveis no catálogo pelo nome.
                </p>
              </div>
              <button
                type="button"
                onClick={addIngredientRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
              >
                <Plus size={14} />
                Adicionar ingrediente
              </button>
            </div>

            <div className="space-y-2">
              {editingRecipe.ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[2fr_100px_140px_auto] sm:items-end"
                >
                  <label className={labelClass}>
                    Ingrediente {index + 1}
                    <input
                      required
                      maxLength={80}
                      value={ingredient.name}
                      onChange={(event) =>
                        updateIngredient(index, { name: event.target.value })
                      }
                      placeholder="Ex.: Peito de frango"
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Qtd.
                    <input
                      required
                      type="number"
                      min={1}
                      max={5000}
                      value={ingredient.quantity}
                      onChange={(event) =>
                        updateIngredient(index, {
                          quantity: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Unidade
                    <input
                      required
                      maxLength={30}
                      value={ingredient.unit}
                      onChange={(event) =>
                        updateIngredient(index, { unit: event.target.value })
                      }
                      placeholder="Ex.: g, unidades, embalagem"
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeIngredientRow(index)}
                    aria-label={`Remover ingrediente ${index + 1}`}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={15} />
                    <span className="sm:hidden">Remover</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="m-0 text-sm font-black text-slate-900">
                Modo de preparo (passo a passo)
              </h4>
              <button
                type="button"
                onClick={addStepRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
              >
                <Plus size={14} />
                Adicionar passo
              </button>
            </div>

            <div className="space-y-2">
              {editingRecipe.steps.map((step, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end"
                >
                  <label className={labelClass}>
                    Passo {index + 1}
                    <input
                      required
                      maxLength={300}
                      value={step}
                      onChange={(event) => updateStep(index, event.target.value)}
                      placeholder="Descreva esta etapa do preparo..."
                      className={inputClass}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeStepRow(index)}
                    aria-label={`Remover passo ${index + 1}`}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={15} />
                    <span className="sm:hidden">Remover</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setEditingRecipe(null);
                setIsNewRecipe(false);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Salvando…' : 'Salvar receita'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <article
            key={recipe.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="m-0 text-base font-black text-slate-900">
                  {recipe.name}
                </h3>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  {recipe.ingredients.length} ingr.
                </span>
              </div>
              <p className="mb-3 mt-1.5 text-xs leading-5 text-slate-600">
                {recipe.description}
              </p>
              <div className="mb-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={13} className="text-emerald-700" />
                  {recipe.time}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users size={13} className="text-emerald-700" />
                  {recipe.servings} porções
                </span>
              </div>
              <ul className="mb-4 list-none space-y-1 border-t border-slate-100 pt-3 p-0 text-xs text-slate-600">
                {recipe.ingredients.slice(0, 5).map((ing, idx) => (
                  <li key={`${ing.name}-${idx}`} className="flex justify-between gap-2">
                    <span className="font-semibold text-slate-700">{ing.name}</span>
                    <span className="text-slate-400">
                      {ing.quantity} {ing.unit}
                    </span>
                  </li>
                ))}
                {recipe.ingredients.length > 5 && (
                  <li className="text-[11px] font-semibold text-slate-400">
                    + {recipe.ingredients.length - 5} ingrediente(s)
                  </li>
                )}
              </ul>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => startEditRecipe(recipe)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
              >
                <Edit3 size={14} />
                Editar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDeleteRecipe(recipe)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </article>
        ))}

        {recipes.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="m-0 text-sm font-semibold text-slate-600">
              Nenhuma receita cadastrada.
            </p>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              Clique em &ldquo;Incluir nova receita&rdquo; para criar uma sugestão do dia ou restaure as receitas padrão.
            </p>
            <button
              type="button"
              onClick={startCreateRecipe}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white"
            >
              <Plus size={15} />
              Incluir primeira receita
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
