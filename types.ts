
export interface RecipeInput {
  url: string;              // A
  heroKeyword: string;      // B
  numPasos: number;         // C
  topKeyword: string;       // D - Antes Top 3 KWs
  secondaryKws: string;     // E - Antes Below Fold KWs
  conclusionKws: string;    // F - Antes Second Page KWs
  faqsSemrush: string;      // G - Antes KW Part Second Page
  longTailKWs: string;      // H
  gbProduct: string;        // I
  faqsList: string;         // J
  ingredientes: string;     // K
  introTextoRef: string;    // L
  conclusionRef: string;    // M
  pasosConcat: string;      // N
}

export interface MasterRecipe {
  url: string;
  name: string;
}

export interface GeneratedRecipe {
  input: RecipeInput;
  introduccion: string;
  infoNutricional: string;
  energia: string;
  hidratos: string;
  fibra: string;
  proteinas: string;
  grasas: string;
  pasos: { title: string; content: string }[];
  conclusion: string;
  faqList: { question: string; answer: string }[];
  relatedRecipesHtml?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export enum GenerationStep {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED'
}
