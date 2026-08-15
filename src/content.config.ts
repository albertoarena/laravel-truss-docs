import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection, z } from 'astro:content';

export const collections = {
  docs: defineCollection({
    schema: docsSchema({
      extend: z.object({
        /**
         * Marks the page whose content is the FAQ, so the Head override knows to
         * emit FAQPage structured data for it. A flag rather than the questions
         * themselves: the content lives in src/data/faq.ts, which both the page
         * and the markup read, so the two cannot drift.
         */
        faq: z.boolean().optional(),
      }),
    }),
  }),
};
