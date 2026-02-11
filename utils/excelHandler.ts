
import * as XLSX from 'xlsx';
import { RecipeInput, GeneratedRecipe, MasterRecipe } from '../types';

export const parseExcelFile = (file: File): Promise<RecipeInput[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' }) as any[];
        
        const recipes: RecipeInput[] = jsonData
          .filter((row, index) => index > 0 && row.B)
          .map(row => ({
            url: String(row.A || ''),
            heroKeyword: String(row.B || ''),
            numPasos: parseInt(row.C) || 3,
            topKeyword: String(row.D || ''),
            secondaryKws: String(row.E || ''),
            conclusionKws: String(row.F || ''),
            faqsSemrush: String(row.G || ''),
            longTailKWs: String(row.H || ''),
            gbProduct: String(row.I || ''),
            faqsList: String(row.J || ''),
            ingredientes: String(row.K || ''),
            introTextoRef: String(row.L || ''),
            conclusionRef: String(row.M || ''),
            pasosConcat: String(row.N || '')
          }));
        resolve(recipes);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const parseMasterExcel = (file: File): Promise<MasterRecipe[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' }) as any[];
        
        // Col A: URL, Col B: Name
        const master: MasterRecipe[] = jsonData
          .filter((row, index) => index > 0 && row.A && row.B)
          .map(row => ({
            url: String(row.A || ''),
            name: String(row.B || '')
          }));
        resolve(master);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const exportRecipesExcel = (data: GeneratedRecipe[]) => {
  const rows = data.map(item => ({
    'A - URLs': item.input.url,
    'B - Introduction': item.introduccion,
    'C - calories_kcal': item.energia,
    'D - carbohydrates_g': item.hidratos,
    'F - fats_g': item.grasas,
    'G - fibre_g': item.fibra,
    'H - proteins_g': item.proteinas,
    'I - conclusion': item.conclusion + (item.relatedRecipesHtml || '')
  }));
  saveExcel(rows, 'Excel_1_Recipes');
};

export const exportStepsExcel = (data: GeneratedRecipe[]) => {
  const rows: any[] = [];
  data.forEach(recipe => {
    recipe.pasos.forEach((step, idx) => {
      rows.push({
        'A - URLs': recipe.input.url,
        'B - title_step': step.title || `Paso ${idx + 1}`,
        'C - preparation step': step.content
      });
    });
  });
  saveExcel(rows, 'Excel_2_Steps');
};

export const exportFaqsExcel = (data: GeneratedRecipe[]) => {
  const rows: any[] = [];
  data.forEach(recipe => {
    recipe.faqList.forEach(faq => {
      rows.push({
        'A - URLs': recipe.input.url,
        'B - title_faq': faq.question,
        'C - answer_faq': faq.answer
      });
    });
  });
  saveExcel(rows, 'Excel_3_FAQs');
};

const saveExcel = (rows: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}_${new Date().getTime()}.xlsx`);
};
