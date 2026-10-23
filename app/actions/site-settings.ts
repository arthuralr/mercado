'use server';

import { updateTag } from 'next/cache';

export async function revalidateSiteSettings() {
  updateTag('site-settings');
}
