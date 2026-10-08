import { generateText, Output } from 'ai'
import { z } from 'zod'
import { GROUP_IDS } from './recipe.js'

export const AUTOFILL_MODEL = process.env.AUTOFILL_MODEL || 'google/gemini-2.5-flash'

const draftSchema = z.object({
  title: z.string().describe('Recipe title as written, in Title Case'),
  group: z
    .enum(GROUP_IDS)
    .describe(
      'Section: dinner (mains), salad, side, muffins-and-bread, cookies, cakes (cakes, cheesecakes, brownies, bars), extras (sauces, frostings, spice mixes, dips, toppings)',
    ),
  cookTimeMinutes: z
    .number()
    .nullable()
    .describe('Total time in minutes including prep, chilling and baking; estimate from the steps if not stated; null if impossible'),
  servings: z.number().nullable().describe('Number of servings / yield count; null if unknown'),
  ingredients: z.array(z.string()).describe('One ingredient per item, or a section subhead like "Crust:"'),
  steps: z.array(z.string()).describe('One step per item, or a section subhead like "Crust:"'),
  tips: z.array(z.string()).describe('Tips and personal notes, without a "Tip:" prefix'),
})

export type ExtractedDraft = z.infer<typeof draftSchema>

const SYSTEM = `You transcribe recipe cards, cookbook pages, screenshots and PDFs into a clean structured recipe for the J3 Recipes family site.

House rules (follow all of them):
1. The pages are given in order (page 1, page 2, ...). Combine them into ONE recipe.
2. Copy quantities and wording faithfully; fix obvious OCR/handwriting typos only. Use "°F" for oven temperatures and an en dash for ranges (e.g. "1–2 tablespoons").
3. Section subheads: if the recipe has named components (e.g. Crust / Cheesecake, Chili, Sauce, Topping), keep them as their own list item written exactly as "Name:" (a short name followed by a colon, nothing else on the line), in both ingredients and steps where they apply. Do not invent sections for a single-component recipe.
4. Ingredient order: within each section, order ingredients by the step in which they are FIRST used. Ingredients used together in one step keep their written order. Garnishes and "for serving" items go last in their section. If there are optional ingredients, put them in a final "Optional:" section at the very end.
5. Every ingredient the steps use must be listed, even if the card forgot it (e.g. "Olive oil, for rubbing the potatoes", "1–2 tablespoons oil, for sautéing", "Salt and pepper, to taste").
6. Skip nutrition facts, calories, macros, serving-size nutrition, page numbers, website names and ads.
7. Handwritten personal notes, margin comments, substitutions and serving suggestions become tips (plain sentences, no "Tip:" prefix). Keep a friendly emoji if the author used one inside a step.
8. Steps: one action-oriented paragraph per numbered step on the card; don't number them yourself.
9. group must be one of: ${GROUP_IDS.join(', ')}.
10. cookTimeMinutes is total time (prep + cook + chill) as a number; servings is a number.
If an image is not a recipe, return an empty title and empty lists.`

export type PageInput = { bytes: Uint8Array; mediaType: string }

export async function extractDraft(pages: PageInput[]): Promise<ExtractedDraft> {
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'file'; data: Uint8Array; mediaType: string }
  > = [{ type: 'text', text: `Here ${pages.length === 1 ? 'is the recipe page' : `are ${pages.length} recipe pages, in order`}. Transcribe it following the house rules.` }]
  pages.forEach((p, i) => {
    if (pages.length > 1) content.push({ type: 'text', text: `Page ${i + 1}:` })
    content.push({ type: 'file', data: p.bytes, mediaType: p.mediaType })
  })

  const { output } = await generateText({
    model: AUTOFILL_MODEL,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    output: Output.object({ schema: draftSchema }),
    temperature: 0,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(55_000),
  })
  return output
}
