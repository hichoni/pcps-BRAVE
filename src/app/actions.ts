'use server'
 
import { revalidatePath } from 'next/cache'
 
export async function revalidateConfigCache() {
  revalidatePath('/', 'layout')
}
