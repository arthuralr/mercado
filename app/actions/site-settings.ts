'use server';

import { revalidatePath, updateTag } from 'next/cache';

export async function revalidateSiteSettings() {
  updateTag('site-settings');
  revalidatePath('/', 'layout');
  revalidatePath('/manifest.webmanifest');
}

export async function revalidateCatalogAndFlyer() {
  revalidatePath('/', 'layout');
  revalidatePath('/');
  revalidatePath('/panfleto-de-ofertas');
  revalidatePath('/catalogo');
  revalidatePath('/admin');
}
