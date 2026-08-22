export type ProductSyllabusItem = {
  title: string;

  pages: number;

  questions: number;

  topics: string[];
};


export type ProductTestimonial = {
  name: string;

  role: string;

  quote: string;

  score: string;
};


export type Product = {
  slug: string;

  title: string;

  /**
   * Cargo / especialidade da apostila.
   */
  shortTitle: string;

  category: string;

  bank: string;

  level: string;

  /**
   * Organização responsável pelo concurso.
   *
   * Ex.: Transpetro.
   */
  organization: string;

  /**
   * Agrupamento público.
   *
   * Ex.: transpetro.
   */
  contestSlug: string;

  pages: number;

  questions: number;

  oldPrice: number;

  price: number;

  pixPrice: number;

  updated: string;

  cover: string;

  coverClass: string;

  kicker: string;

  description: string;

  seoTitle: string;

  seoDescription: string;

  highlights: string[];

  syllabus:
    ProductSyllabusItem[];

  testimonial:
    ProductTestimonial;

  publishedAt: string;

  updatedAt: string;
};